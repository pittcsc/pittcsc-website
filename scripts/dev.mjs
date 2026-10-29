import { execFileSync, spawn } from "node:child_process";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function connects(host, port) {
  return new Promise((done) => {
    const socket = connect({ host, port });
    const settle = (value) => {
      socket.destroy();
      done(value);
    };
    socket.setTimeout(400);
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
    socket.once("timeout", () => settle(false));
  });
}

export async function portIsListening(port) {
  const results = await Promise.all(
    ["127.0.0.1", "::1"].map((host) => connects(host, port)),
  );
  return results.some(Boolean);
}

// Gatsby offers to move to another port when 8000 is occupied. That can leave
// an older site at the documented URL and break the API's single allowed origin.
// Check before starting Supabase so a second `mise run dev` does not stop an
// existing local stack on its way out.
export async function ensureDevelopmentPortsAvailable(
  isListening = portIsListening,
) {
  for (const [port, service] of [
    [8000, "website"],
    [8080, "API"],
  ]) {
    if (await isListening(port)) {
      throw new Error(
        `Port ${port} is already in use by a ${service} or another process. Stop it before running \`mise run dev\` so you do not open a stale site or use the wrong API.`,
      );
    }
  }
}

function launch(command, args) {
  return spawn(command, args, { cwd: root, stdio: "inherit", detached: true });
}

function finished(child) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise((resolveFinished) => {
    child.once("error", (error) => resolveFinished({ code: 1, error }));
    child.once("close", (code, signal) => resolveFinished({ code, signal }));
  });
}

function terminateGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function waitAtMost(promises, milliseconds) {
  let timeout;
  try {
    await Promise.race([
      Promise.all(promises),
      new Promise((resolveWait) => {
        timeout = setTimeout(resolveWait, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function supervise({
  verifyPorts = ensureDevelopmentPortsAvailable,
  startLocal = () =>
    launch(process.execPath, ["scripts/local-dev.mjs", "start"]),
  stopLocal = () =>
    launch(resolve(root, "node_modules/.bin/supabase"), ["stop"]),
  startServers = () => [
    launch("npm", ["run", "develop"]),
    launch("npm", ["run", "dev:api"]),
  ],
  signals = process,
  terminate = terminateGroup,
} = {}) {
  await verifyPorts();
  const children = [];
  let interrupted = false;
  let wakeUp;
  const interrupt = new Promise((resolveInterrupt) => {
    wakeUp = resolveInterrupt;
  });
  const onSignal = () => {
    interrupted = true;
    wakeUp();
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
    signals.on(signal, onSignal);

  try {
    const startup = startLocal();
    children.push(startup);
    const startupResult = await Promise.race([finished(startup), interrupt]);
    if (interrupted) return 0;
    if (startupResult.error || startupResult.code !== 0) {
      console.error("Local Supabase did not start successfully.");
      return 1;
    }

    const servers = startServers();
    children.push(...servers);
    const first = await Promise.race([
      ...servers.map((child) => finished(child)),
      interrupt,
    ]);
    if (interrupted) return 0;
    console.error(
      first.error || first.code !== 0
        ? "A development server exited with an error."
        : "A development server stopped.",
    );
    return first.error || first.code !== 0 ? 1 : 0;
  } finally {
    console.log("Stopping development servers and local Supabase...");
    const running = children.filter(
      (child) => child.exitCode === null && child.signalCode === null,
    );
    // Signal server process groups even if npm exited before its child did.
    for (const child of children.slice(1)) terminate(child, "SIGINT");
    if (running.includes(children[0])) terminate(children[0], "SIGINT");
    await waitAtMost(running.map(finished), 7000);
    for (const child of running.filter(
      (item) => item.exitCode === null && item.signalCode === null,
    ))
      terminate(child, "SIGTERM");
    await waitAtMost(running.map(finished), 3000);
    for (const child of running.filter(
      (item) => item.exitCode === null && item.signalCode === null,
    ))
      terminate(child, "SIGKILL");
    await Promise.all(running.map(finished));
    const stopped = await finished(stopLocal());
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
      signals.off(signal, onSignal);
    if (stopped.error || stopped.code !== 0)
      throw new Error("Could not stop local Supabase; run `mise run db:stop`.");
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  console.log(`Checkout: ${branch} at ${root}`);
  console.log("Website: http://localhost:8000/");
  supervise()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`Development startup failed: ${error.message}`);
      process.exitCode = 1;
    });
}

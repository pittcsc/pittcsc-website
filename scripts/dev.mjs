import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
  supervise()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`Development startup failed: ${error.message}`);
      process.exitCode = 1;
    });
}

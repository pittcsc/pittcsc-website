import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrapper = resolve(root, "scripts/dev-server.mjs");
const directory = resolve(root, ".dev-processes");

// Only identity metadata is persisted: never environment variables or credentials.
export function processIdentity(pid) {
  try {
    const options = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
    return {
      started: execFileSync(
        "ps",
        ["-p", String(pid), "-o", "lstart="],
        options,
      ).trim(),
      command: execFileSync(
        "ps",
        ["-p", String(pid), "-o", "args="],
        options,
      ).trim(),
    };
  } catch {
    return null;
  }
}

export function matchesRecord(record, identity, checkout = root) {
  if (
    !identity ||
    record.root !== checkout ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 1
  )
    return false;
  if (record.started !== identity.started) return false;
  if (record.kind === "group")
    return (
      /^[a-f0-9-]{36}$/.test(record.token) &&
      identity.command.includes(
        ` ${resolve(checkout, "scripts/dev-server.mjs")} ${record.token} `,
      )
    );
  return (
    record.kind === "supervisor" &&
    ["dev.mjs", "demo.mjs"].includes(record.script) &&
    identity.command === record.command &&
    identity.command.includes(`scripts/${record.script}`)
  );
}

export function registerProcess(details, dir = directory) {
  const identity = processIdentity(process.pid);
  if (!identity)
    throw new Error("Could not record development process identity.");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const destination = resolve(dir, `${process.pid}-${randomUUID()}.json`);
  writeFileSync(
    destination,
    JSON.stringify({
      ...details,
      root,
      pid: process.pid,
      started: identity.started,
      ...(details.kind === "supervisor" ? { command: identity.command } : {}),
    }),
    { flag: "wx", mode: 0o600 },
  );
  return () => rmSync(destination, { force: true });
}

export function launchTracked(command, args, env = {}, dir = directory) {
  return spawn(
    process.execPath,
    [wrapper, randomUUID(), dir, command, ...args],
    {
      cwd: root,
      stdio: "inherit",
      detached: true,
      env: { ...process.env, ...env },
    },
  );
}

function records(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => /^\d+-[a-f0-9-]+\.json$/.test(name))
      .flatMap((name) => {
        const path = resolve(dir, name);
        try {
          return [{ path, record: JSON.parse(readFileSync(path, "utf8")) }];
        } catch (error) {
          // A gracefully exiting process can remove its record during our scan.
          if (error.code === "ENOENT") return [];
          throw error;
        }
      });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(
      "Could not read development ownership records; no unverified processes were stopped.",
    );
  }
}

export async function stopRecordedProcesses({
  dir = directory,
  inspect = processIdentity,
  kill = process.kill,
  sleep = delay,
  timeouts = [7000, 3000, 1000],
} = {}) {
  // Stop supervisors first, so startup cannot launch new servers during cleanup.
  for (const kind of ["supervisor", "group"]) {
    const entries = records(dir).filter(({ record }) => record.kind === kind);
    for (const [index, signal] of ["SIGINT", "SIGTERM", "SIGKILL"].entries()) {
      for (const { record } of entries) {
        if (!matchesRecord(record, inspect(record.pid))) continue;
        try {
          kill(kind === "group" ? -record.pid : record.pid, signal);
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
      const deadline = Date.now() + timeouts[index];
      while (
        entries.some(({ record }) =>
          matchesRecord(record, inspect(record.pid)),
        ) &&
        Date.now() < deadline
      )
        await sleep(100);
    }
    for (const { path, record } of entries) {
      if (matchesRecord(record, inspect(record.pid)))
        throw new Error(
          "A managed development process did not stop; its ownership record was retained.",
        );
      rmSync(path, { force: true });
    }
  }
}

export async function stopDevelopment({
  stopServers = stopRecordedProcesses,
  run = (command, args) =>
    new Promise((done) => {
      const child = spawn(command, args, {
        cwd: root,
        stdio: "ignore",
        timeout: command === "docker" ? 10000 : 120000,
        killSignal: "SIGKILL",
      });
      child.once("error", () => done(false));
      child.once("close", (code) => done(code === 0));
    }),
} = {}) {
  await stopServers();
  console.log("Managed development servers stopped (or already stopped).");
  if (!(await run("docker", ["info"])))
    throw new Error(
      "Docker is unavailable. Application servers were cleaned up, but local Supabase could not be inspected or stopped. Start Docker Desktop, then rerun `mise run dev:stop`.",
    );
  // `stop` defaults to this checkout's project_id; never --all or --no-backup.
  if (!(await run(resolve(root, "node_modules/.bin/supabase"), ["stop"])))
    throw new Error(
      "Could not stop this project's local Supabase. Check Docker and dependencies, then rerun `mise run dev:stop`.",
    );
  console.log("Local Supabase stopped; database data preserved.");
}

// A persistent process-group leader lets recovery verify ownership even when
// npm exits before Gatsby/Go. It also survives an agent killing its supervisor.
import { spawnSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { registerProcess, root } from "./dev-processes.mjs";

const [token, directory, command, ...args] = process.argv.slice(2);
const unregister = registerProcess({ kind: "group", token }, directory);
// Group signals reach the children too. Keep the leader alive until they exit,
// so a later dev:stop can still verify and escalate against this same group.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, () => {});

try {
  const child = spawn(command, args, { cwd: root, stdio: "inherit" });
  const code = await new Promise((done) => {
    child.once("error", () => done(1));
    child.once("close", (exitCode) => done(exitCode ?? 0));
  });
  while (true) {
    const snapshot = spawnSync("ps", ["-axo", "pid=,pgid=,stat="], {
      encoding: "utf8",
    });
    if (snapshot.error || snapshot.status !== 0)
      throw new Error("Could not inspect development process group.");
    const remaining = snapshot.stdout
      .trim()
      .split("\n")
      .some((line) => {
        const [pid, group, state] = line.trim().split(/\s+/);
        return (
          Number(group) === process.pid &&
          Number(pid) !== process.pid &&
          Number(pid) !== snapshot.pid &&
          !state.startsWith("Z")
        );
      });
    if (!remaining) break;
    await delay(100);
  }
  process.exitCode = code;
} finally {
  unregister();
}

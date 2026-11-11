import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import {
  launchTracked,
  matchesRecord,
  processIdentity,
  root,
  stopDevelopment,
  stopRecordedProcesses,
} from "../../scripts/dev-processes.mjs";

const token = "01234567-89ab-cdef-0123-456789abcdef";
const record = {
  kind: "group",
  pid: 12345,
  root,
  token,
  started: "Mon Nov  9 10:00:00 2026",
};
const identity = {
  started: record.started,
  command: `/usr/bin/node ${resolve(root, "scripts/dev-server.mjs")} ${token} /tmp/records npm run develop`,
};

test("ownership verification rejects reused PIDs, other checkouts and unrelated commands", () => {
  assert.equal(matchesRecord(record, identity), true);
  assert.equal(matchesRecord(record, null), false);
  assert.equal(
    matchesRecord(record, { ...identity, started: "a later start" }),
    false,
  );
  assert.equal(
    matchesRecord({ ...record, root: "/another/checkout" }, identity),
    false,
  );
  assert.equal(
    matchesRecord(record, { ...identity, command: "node unrelated-server.js" }),
    false,
  );
  assert.equal(matchesRecord({ ...record, token: "" }, identity), false);
  assert.equal(matchesRecord({ ...record, pid: -1 }, identity), false);
});

test("stale records never signal a process and repeated cleanup is safe", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "csc-stop-stale-"));
  try {
    writeFileSync(resolve(dir, `12345-${token}.json`), JSON.stringify(record));
    let signals = 0;
    const options = {
      dir,
      inspect: () => ({ ...identity, started: "PID reused" }),
      kill: () => signals++,
      timeouts: [0, 0, 0],
    };
    await stopRecordedProcesses(options);
    await stopRecordedProcesses(options);
    assert.equal(signals, 0);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Docker unavailable still cleans application servers first", async () => {
  const events = [];
  await assert.rejects(
    stopDevelopment({
      stopServers: async () => events.push("servers"),
      run: async (command) => {
        events.push(command);
        return false;
      },
    }),
    /Docker is unavailable.*Application servers were cleaned up/,
  );
  assert.deepEqual(events, ["servers", "docker"]);
});

test("supervisors stop before newly registered groups and identities are rechecked before escalation", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "csc-stop-order-"));
  const supervisor = {
    ...record,
    kind: "supervisor",
    script: "dev.mjs",
    pid: 23456,
    command: "node scripts/dev.mjs",
  };
  const live = new Map([
    [
      supervisor.pid,
      { started: supervisor.started, command: supervisor.command },
    ],
    [record.pid, identity],
  ]);
  const signals = [];
  try {
    writeFileSync(
      resolve(dir, `23456-${token}.json`),
      JSON.stringify(supervisor),
    );
    await stopRecordedProcesses({
      dir,
      inspect: (pid) => live.get(pid),
      timeouts: [0, 0, 0],
      kill: (pid, signal) => {
        signals.push([pid, signal]);
        if (pid === supervisor.pid) {
          live.delete(pid);
          writeFileSync(
            resolve(dir, `12345-${token}.json`),
            JSON.stringify(record),
          );
        } else {
          // PID reuse after the first signal must not receive TERM or KILL.
          live.set(-pid, { ...identity, started: "a different process" });
        }
      },
    });
    assert.deepEqual(signals, [
      [23456, "SIGINT"],
      [-12345, "SIGINT"],
    ]);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Supabase shutdown targets only this checkout and never discards data", async () => {
  const calls = [];
  await stopDevelopment({
    stopServers: async () => {},
    run: async (command, args) => {
      calls.push([command, args]);
      return true;
    },
  });
  assert.deepEqual(calls, [
    ["docker", ["info"]],
    [resolve(root, "node_modules/.bin/supabase"), ["stop"]],
  ]);
  await assert.rejects(
    stopDevelopment({
      stopServers: async () => {},
      run: async (command) => command === "docker",
    }),
    /Could not stop this project's local Supabase/,
  );
});

test("real process groups stop and restart, including descendants left after their parent exits", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "csc-stop-live-"));
  const children = [];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ready = resolve(dir, "ready");
      const childScript = `
        process.on('SIGINT', () => {});
        process.on('SIGTERM', () => {});
        require('node:fs').writeFileSync(${JSON.stringify(ready)}, String(process.pid));
        setInterval(() => {}, 1000);
      `;
      const parentScript = `
        require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(childScript)}], {stdio: 'inherit'});
        process.exit(0);
      `;
      const child = launchTracked(
        process.execPath,
        ["-e", parentScript],
        {},
        dir,
      );
      children.push(child);
      const closed = once(child, "close");
      let descendant;
      for (let poll = 0; poll < 100; poll++) {
        try {
          descendant = Number(readFileSync(ready, "utf8"));
        } catch {}
        if (descendant) break;
        await delay(50);
      }
      assert.ok(descendant, "descendant became ready");
      assert.ok(
        processIdentity(descendant),
        "descendant survived its direct parent",
      );
      await stopRecordedProcesses({ dir, timeouts: [100, 100, 2000] });
      await closed;
      // Minimal Linux container init processes may leave an adopted zombie;
      // it is stopped, even though ps still has an entry until it is reaped.
      if (processIdentity(descendant)) {
        assert.match(
          execFileSync("ps", ["-p", String(descendant), "-o", "stat="], {
            encoding: "utf8",
          }).trim(),
          /^Z/,
        );
      }
      await stopRecordedProcesses({ dir });
      assert.deepEqual(readdirSync(dir), ["ready"]);
      rmSync(ready);
    }
  } finally {
    for (const child of children) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

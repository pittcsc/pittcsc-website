import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { supervise } from "../../scripts/dev.mjs";

let nextPid = 1000;

function child() {
  const process = new EventEmitter();
  process.pid = nextPid++;
  process.exitCode = null;
  process.signalCode = null;
  process.finish = (code = 0, signal = null) => {
    process.exitCode = code;
    process.signalCode = signal;
    process.emit("close", code, signal);
  };
  return process;
}

test("Ctrl+C stops both servers and then Supabase", async () => {
  const signals = new EventEmitter();
  const startup = child();
  const web = child();
  const api = child();
  const stop = child();
  const events = [];
  const result = supervise({
    signals,
    startLocal: () => {
      queueMicrotask(() => startup.finish());
      return startup;
    },
    startServers: () => {
      queueMicrotask(() => signals.emit("SIGINT"));
      return [web, api];
    },
    terminate: (process, signal) => {
      events.push(`${process.pid}:${signal}`);
      queueMicrotask(() => process.finish(null, signal));
    },
    stopLocal: () => {
      events.push("stop-supabase");
      queueMicrotask(() => stop.finish());
      return stop;
    },
  });

  assert.equal(await result, 0);
  assert.deepEqual(events, [
    `${web.pid}:SIGINT`,
    `${api.pid}:SIGINT`,
    "stop-supabase",
  ]);
});

test("an unexpected server exit also stops the other server and Supabase", async () => {
  const startup = child();
  const web = child();
  const api = child();
  const stop = child();
  const events = [];
  const result = supervise({
    signals: new EventEmitter(),
    startLocal: () => {
      queueMicrotask(() => startup.finish());
      return startup;
    },
    startServers: () => {
      queueMicrotask(() => web.finish(1));
      return [web, api];
    },
    terminate: (process, signal) => {
      events.push(`${process.pid}:${signal}`);
      queueMicrotask(() => process.finish(null, signal));
    },
    stopLocal: () => {
      events.push("stop-supabase");
      queueMicrotask(() => stop.finish());
      return stop;
    },
  });

  assert.equal(await result, 1);
  assert.deepEqual(events, [
    `${web.pid}:SIGINT`,
    `${api.pid}:SIGINT`,
    "stop-supabase",
  ]);
});

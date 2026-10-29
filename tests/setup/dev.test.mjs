import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import {
  ensureDevelopmentPortsAvailable,
  portIsListening,
  supervise,
} from "../../scripts/dev.mjs";

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
    verifyPorts: async () => {},
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
    verifyPorts: async () => {},
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

test("detects a listening loopback port", async () => {
  const server = createServer();
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = server.address().port;
  try {
    assert.equal(await portIsListening(port), true);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
  assert.equal(await portIsListening(port), false);
});

test("a port conflict stops before local Supabase starts", async () => {
  let started = false;
  const verifyPorts = () =>
    ensureDevelopmentPortsAvailable(async (port) => port === 8000);
  await assert.rejects(
    supervise({
      verifyPorts,
      startLocal: () => {
        started = true;
        return child();
      },
    }),
    /Port 8000 is already in use/,
  );
  assert.equal(started, false);
  await assert.rejects(
    ensureDevelopmentPortsAvailable(async (port) => port === 8080),
    /Port 8080 is already in use/,
  );
  await ensureDevelopmentPortsAvailable(async () => false);
});

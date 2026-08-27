/**
 * Storage correctness. The concurrency test here is the important one: two people
 * answering at the same moment can land in different processes (dev) or different
 * containers (Netlify), where a plain read-then-write silently drops an answer.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SRC = new URL("../../src/lib/meet/store.js", import.meta.url).href;

/** Two independent module instances — no shared in-process queue between them. */
async function twoProcesses() {
  const dir = mkdtempSync(join(tmpdir(), "meet-store-"));
  process.env.MEET_DATA_DIR = dir;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const tag = Math.random().toString(36).slice(2);
  const a = await import(`${SRC}?a${tag}`);
  const b = await import(`${SRC}?b${tag}`);
  return { a, b, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("a meeting round-trips and a missing one is null", async () => {
  const { a, cleanup } = await twoProcesses();
  try {
    await a.putMeeting("abc1234", { name: "Retro", participants: [] });
    assert.deepEqual(await a.getMeeting("abc1234"), { name: "Retro", participants: [] });
    assert.equal(await a.getMeeting("nothere"), null);
  } finally {
    cleanup();
  }
});

test("mutating a meeting that does not exist yields null, not a crash", async () => {
  const { a, cleanup } = await twoProcesses();
  try {
    assert.equal(await a.mutateMeeting("nothere", (m) => m), null);
  } finally {
    cleanup();
  }
});

test("returning null from the mutator aborts the write", async () => {
  const { a, cleanup } = await twoProcesses();
  try {
    await a.putMeeting("abc1234", { participants: [{ name: "Ann" }] });
    await a.mutateMeeting("abc1234", () => null);
    const after = await a.getMeeting("abc1234");
    assert.equal(after.participants.length, 1, "untouched");
  } finally {
    cleanup();
  }
});

test("concurrent writers from separate processes never lose an answer", async () => {
  const { a, b, cleanup } = await twoProcesses();
  try {
    await a.putMeeting("abc1234", { participants: [] });

    const names = Array.from({ length: 12 }, (_, i) => `P${i}`);
    const add = (mod, name) =>
      mod.mutateMeeting("abc1234", async (m) => {
        // Widen the window so a non-atomic implementation reliably drops writes.
        await new Promise((r) => setTimeout(r, 5));
        m.participants.push({ name });
        return m;
      });

    const settled = await Promise.allSettled(names.map((n, i) => add(i % 2 ? a : b, n)));
    assert.equal(settled.filter((r) => r.status === "rejected").length, 0, "no writer gave up");

    const final = await a.getMeeting("abc1234");
    assert.deepEqual(
      final.participants.map((p) => p.name).sort(),
      names.slice().sort(),
      "every concurrent write landed exactly once"
    );
  } finally {
    cleanup();
  }
});

test("health status reports durability honestly and leaks nothing", async () => {
  const { a, cleanup } = await twoProcesses();
  try {
    const s = await a.storeStatus();
    assert.equal(s.store, "file");
    assert.equal(s.durable, false, "a local file on serverless is not durable, and says so");
    assert.equal(s.reachable, true);
    assert.ok(!/Bearer|[A-Za-z0-9_-]{32,}/.test(JSON.stringify(s)));
  } finally {
    cleanup();
  }
});

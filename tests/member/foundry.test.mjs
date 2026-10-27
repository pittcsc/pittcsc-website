import assert from "node:assert/strict";
import test from "node:test";
import {
  foundryLapseDate,
  foundryProgress,
  foundryRemaining,
  parseFoundryStatus,
} from "../../src/lib/member/foundry.mjs";

const status = {
  name: "Ada Lovelace",
  points: 20,
  threshold: 50,
  windowDays: 30,
  active: false,
  activeUntil: null,
};
const active = {
  ...status,
  points: 62,
  active: true,
  activeUntil: "2026-11-06T18:00:00Z",
};

test("Foundry lapse dates use the club's New York calendar", () => {
  assert.equal(foundryLapseDate(active.activeUntil), "Nov 6");
  // 01:30 UTC on Nov 7 is still the evening of Nov 6 in New York.
  assert.equal(foundryLapseDate("2026-11-07T01:30:00Z"), "Nov 6");
});

test("Foundry progress is capped and remaining points never go negative", () => {
  assert.equal(foundryProgress(status), 40);
  assert.equal(foundryRemaining(status), 30);
  assert.equal(foundryProgress({ points: 0, threshold: 50 }), 0);
  assert.equal(foundryProgress({ points: 49, threshold: 50 }), 98);
  assert.equal(foundryProgress(active), 100);
  assert.equal(foundryRemaining(active), 0);
});

test("malformed Foundry responses are rejected", () => {
  assert.deepEqual(parseFoundryStatus(status), status);
  assert.deepEqual(parseFoundryStatus(active), active);
  for (const bad of [
    null,
    {},
    { ...status, points: -1 },
    { ...status, points: "20" },
    { ...status, threshold: 0 },
    { ...status, windowDays: 0 },
    { ...status, active: "false" },
    { ...status, name: undefined },
    { ...status, activeUntil: "2026-11-06T18:00:00Z" },
    { ...active, activeUntil: null },
    { ...active, activeUntil: "soon" },
  ])
    assert.throws(() => parseFoundryStatus(bad), /temporarily unavailable/);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  foundryMonthLabel,
  foundryMonthName,
  foundryProgress,
  foundryRemaining,
  parseFoundryStatus,
} from "../../src/lib/member/foundry.mjs";

const status = {
  name: "Ada Lovelace",
  month: "2026-10",
  points: 20,
  threshold: 50,
  active: false,
};

test("Foundry month labels never shift with the viewer's time zone", () => {
  assert.equal(foundryMonthLabel("2026-10"), "OCT 2026");
  assert.equal(foundryMonthLabel("2027-01"), "JAN 2027");
  assert.equal(foundryMonthLabel("2026-12"), "DEC 2026");
  assert.equal(foundryMonthName("2026-10"), "October");
  assert.equal(foundryMonthName("2027-01"), "January");
});

test("Foundry progress is capped and remaining points never go negative", () => {
  assert.equal(foundryProgress(status), 40);
  assert.equal(foundryRemaining(status), 30);
  assert.equal(foundryProgress({ points: 0, threshold: 50 }), 0);
  assert.equal(foundryProgress({ points: 49, threshold: 50 }), 98);
  assert.equal(foundryProgress({ points: 80, threshold: 50 }), 100);
  assert.equal(foundryRemaining({ points: 80, threshold: 50 }), 0);
});

test("malformed Foundry responses are rejected", () => {
  assert.deepEqual(parseFoundryStatus(status), status);
  for (const bad of [
    null,
    {},
    { ...status, month: "2026-13" },
    { ...status, month: "October" },
    { ...status, points: -1 },
    { ...status, points: "20" },
    { ...status, threshold: 0 },
    { ...status, active: "false" },
    { ...status, name: undefined },
  ])
    assert.throws(() => parseFoundryStatus(bad), /temporarily unavailable/);
});

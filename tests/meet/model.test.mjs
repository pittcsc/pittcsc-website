import test from "node:test";
import assert from "node:assert/strict";

import {
  AVAILABLE, IF_NEEDED, UNAVAILABLE, LIMITS,
  decodeSlots, encodeSlots, isContiguousWindow, makeCode, nameKey,
  normalizeCreate, normalizeName, normalizeRespond, slotCount, slotsPerDay,
} from "../../src/lib/meet/model.js";
import { H, meeting } from "./helpers.mjs";

// A name is required, so the helper supplies one; tests that care override it.
const create = (o) => normalizeCreate({ name: "Test", dates: ["2026-09-02"], ...o });

test("the default state is unavailable, so silence is never a yes", () => {
  assert.equal(UNAVAILABLE, 0);
  assert.ok(AVAILABLE > IF_NEEDED && IF_NEEDED > UNAVAILABLE, "higher is better");
  assert.deepEqual([...decodeSlots("", 3)], [0, 0, 0]);
});

test("slot strings survive a round trip and reject junk", () => {
  assert.equal(encodeSlots(decodeSlots("021", 3)), "021");
  assert.equal(encodeSlots(decodeSlots("0x9!", 4)), "0000", "unknown chars fall back to unavailable");
  assert.equal(encodeSlots(decodeSlots("22222", 2)), "22", "over-long input is truncated");
  assert.equal(encodeSlots(decodeSlots("2", 4)), "2000", "short input is padded");
});

test("a window may not straddle a day boundary", () => {
  const m = meeting();
  const per = slotsPerDay(m);
  assert.ok(isContiguousWindow(m, 0, 2));
  assert.ok(isContiguousWindow(m, per - 2, 2), "last two of a day");
  assert.ok(!isContiguousWindow(m, per - 1, 2), "would run into the next day");
  assert.ok(!isContiguousWindow(m, slotCount(m) - 1, 2), "runs off the end");
});

test("creation rejects input the UI would never send", () => {
  assert.throws(() => create({ dates: [] }), /at least one date/i);
  // A name is required: an untitled meeting is unidentifiable in a group chat, and
  // silently substituting "Untitled meeting" hides the omission from whoever made it.
  assert.throws(() => create({ name: "" }), /give the meeting a name/i);
  assert.throws(() => create({ name: "   " }), /give the meeting a name/i);
  assert.throws(
    () => normalizeCreate({ dates: ["2026-09-02"] }),
    /give the meeting a name/i,
    "omitted entirely, not just blank"
  );
  assert.throws(() => create({ startMin: H(20), endMin: H(10) }), /end time/i);
  assert.throws(() => create({ startMin: H(10), endMin: H(10) }), /end time/i);
  // Genuinely distinct consecutive days, or dedup would quietly bring it under.
  const tooMany = Array.from({ length: LIMITS.dates + 5 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)
  );
  assert.equal(new Set(tooMany).size, LIMITS.dates + 5, "fixture really is over the cap");
  assert.throws(() => create({ dates: tooMany }), /days or fewer/i);
  assert.throws(() => create({ dates: ["2026-01-01", "2028-01-01"] }), /within a year/i);
});

test("creation is forgiving about things it can safely normalise", () => {
  const m = create({ dates: ["2026-09-04", "2026-09-02", "2026-09-02", "not-a-date"] });
  assert.deepEqual(m.dates, ["2026-09-02", "2026-09-04"], "sorted, deduped, junk dropped");
  assert.equal(create({ name: "  Retro  " }).name, "Retro", "trimmed, not rejected");
  assert.equal(create({ tz: "Mars/Olympus" }).tz, "America/New_York", "unknown zone falls back");
  assert.equal(create({ startMin: 61, endMin: 1000 }).startMin, 60, "times snap to the slot grid");
});

test("duration can never exceed the daily window", () => {
  const m = create({ startMin: H(16), endMin: H(18), durationMin: 600 });
  assert.equal(m.durationMin, 120, "clamped to the two-hour window");
  assert.equal(create({ durationMin: 5 }).durationMin, 30, "and never below one slot");
});

test("names are cleaned but not mangled", () => {
  assert.equal(normalizeName("  Ada   Lovelace  "), "Ada Lovelace");
  assert.equal(
    normalizeName("AdaLovelace"),
    "Ada Lovelace",
    "control characters are stripped, not left to corrupt a roster"
  );
  assert.equal(normalizeName("x".repeat(200)).length, LIMITS.nameLen);
  assert.equal(normalizeName("José 🎉"), "José 🎉", "unicode and emoji survive");
  assert.equal(nameKey("  ADA lovelace "), nameKey("ada Lovelace"), "same person, either casing");
});

test("a response is clamped to the meeting's real slot count", () => {
  const m = meeting();
  const r = normalizeRespond(m, { name: "Ann", slots: "2".repeat(9999) });
  assert.equal(r.slots.length, slotCount(m), "cannot smuggle in extra slots");
  assert.throws(() => normalizeRespond(m, { name: "   " }), /enter a name/i);
  assert.equal(
    normalizeRespond(m, { name: "Ann", source: "evil" }).source,
    "manual",
    "source is an allowlist"
  );
});

test("meeting codes avoid characters people misread aloud", () => {
  for (let i = 0; i < 200; i += 1) {
    assert.match(makeCode(), /^[23456789abcdefghjkmnpqrstuvwxyz]{7}$/, "no 0/O/1/I/l");
  }
  assert.equal(
    new Set(Array.from({ length: 500 }, () => makeCode())).size,
    500,
    "no collisions in 500"
  );
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  isoAddDays, isoWeekday, parseIso, rangeLabel, timeLabel,
  tzOffsetMs, utcToZoned, zonedToUtcMs,
} from "../../src/lib/meet/time.js";
import { enumerateSlots } from "../../src/lib/meet/model.js";
import { buildViewGrid } from "../../src/lib/meet/score.js";
import { H, meeting } from "./helpers.mjs";

const iso = (ms) => new Date(ms).toISOString();

test("EDT and EST resolve to different offsets across the DST boundary", () => {
  assert.equal(tzOffsetMs(Date.UTC(2026, 6, 1), "America/New_York") / 3600000, -4, "July is EDT");
  assert.equal(tzOffsetMs(Date.UTC(2026, 0, 1), "America/New_York") / 3600000, -5, "January is EST");
});

test("PDT and PST likewise", () => {
  assert.equal(tzOffsetMs(Date.UTC(2026, 6, 1), "America/Los_Angeles") / 3600000, -7);
  assert.equal(tzOffsetMs(Date.UTC(2026, 0, 1), "America/Los_Angeles") / 3600000, -8);
});

test("UTC is a fixed point", () => {
  assert.equal(tzOffsetMs(Date.UTC(2026, 6, 1), "UTC"), 0);
  const z = utcToZoned(Date.UTC(2026, 8, 2, 13, 30), "UTC");
  assert.deepEqual([z.y, z.m, z.d, z.minute], [2026, 9, 2, 13 * 60 + 30]);
});

test("wall clock to instant round-trips in both hemispheres", () => {
  for (const tz of ["America/New_York", "America/Los_Angeles", "Europe/Berlin", "Asia/Kolkata", "Australia/Sydney"]) {
    const wall = { y: 2026, m: 9, d: 2, minute: H(16) };
    const back = utcToZoned(zonedToUtcMs(wall, tz), tz);
    assert.deepEqual([back.y, back.m, back.d, back.minute], [2026, 9, 2, H(16)], tz);
  }
});

test("the ambiguous hour at fall-back resolves forward, not backward", () => {
  // 1 Nov 2026, 01:30 happens twice in New York. Pick the first (EDT, -4).
  const ms = zonedToUtcMs({ y: 2026, m: 11, d: 1, minute: H(1, 30) }, "America/New_York");
  assert.equal(iso(ms), "2026-11-01T05:30:00.000Z");
});

test("a nonexistent spring-forward time resolves forward past the jump", () => {
  // 8 Mar 2026 02:30 does not exist in New York — the clock jumps 02:00 -> 03:00.
  const ms = zonedToUtcMs({ y: 2026, m: 3, d: 8, minute: H(2, 30) }, "America/New_York");
  assert.ok(Number.isFinite(ms), "must never be NaN");
  assert.equal(iso(ms), "2026-03-08T07:30:00.000Z", "lands at 3:30 EDT, after the gap");
  // And it must stay ordered after the slot before it.
  const prior = zonedToUtcMs({ y: 2026, m: 3, d: 8, minute: H(1, 30) }, "America/New_York");
  assert.ok(ms > prior, "a later wall time is still a later instant");
});

test("a meeting spanning the DST change keeps 30 real minutes between slots", () => {
  const m = meeting({ dates: ["2026-11-01"], startMin: H(0), endMin: H(4), durationMin: 30 });
  const slots = enumerateSlots(m);
  for (let i = 1; i < slots.length; i += 1) {
    const gap = slots[i].utcMs - slots[i - 1].utcMs;
    assert.ok(gap === 1800000 || gap === 5400000,
      `slot ${i} gap was ${gap / 60000}min — 30 normally, 90 across the repeated hour`);
  }
});

test("the same instant is labelled differently in each viewer's zone", () => {
  const m = meeting({ dates: ["2026-09-02"], startMin: H(16), endMin: H(18) });
  const slots = enumerateSlots(m);
  const first = slots[0].utcMs;
  assert.equal(iso(first), "2026-09-02T20:00:00.000Z");
  assert.equal(utcToZoned(first, "America/New_York").minute, H(16));
  assert.equal(utcToZoned(first, "America/Los_Angeles").minute, H(13));
  assert.equal(utcToZoned(first, "Europe/Berlin").minute, H(22));
});

test("viewing across a date line puts slots on the correct local day", () => {
  // 9am-3pm Berlin is the small hours in New York, same calendar date.
  const m = meeting({ dates: ["2026-09-02", "2026-09-03"], startMin: H(9), endMin: H(15), tz: "Europe/Berlin" });
  const grid = buildViewGrid(enumerateSlots(m), "America/New_York");
  assert.deepEqual(grid.cols, ["2026-09-02", "2026-09-03"]);
  assert.equal(grid.rows[0], H(3), "9am Berlin is 3am New York");
});

test("a projection that crosses local midnight adds a column and leaves holes", () => {
  // 4pm-10pm New York lands 10pm-4am in Berlin, so it spills into the next local day.
  const m = meeting({ dates: ["2026-09-02", "2026-09-03"], startMin: H(16), endMin: H(22) });
  const slots = enumerateSlots(m);
  const grid = buildViewGrid(slots, "Europe/Berlin");
  assert.equal(grid.cols.length, 3, "two meeting days occupy three Berlin days");
  const cells = grid.cols.length * grid.rows.length;
  assert.ok(cells > slots.length, "the extra cells are holes, rendered inert");
  // Every real slot is still reachable exactly once.
  const found = new Set();
  for (const c of grid.cols) for (const r of grid.rows) {
    const i = grid.at(c, r);
    if (i >= 0) found.add(i);
  }
  assert.equal(found.size, slots.length, "no slot is lost or duplicated in projection");
});

test("changing the viewer's timezone never moves the underlying instant", () => {
  const m = meeting({ dates: ["2026-09-02"], startMin: H(16), endMin: H(18) });
  const slots = enumerateSlots(m);
  const before = slots.map((s) => s.utcMs);
  buildViewGrid(slots, "Asia/Kolkata");
  buildViewGrid(slots, "Pacific/Auckland");
  assert.deepEqual(slots.map((s) => s.utcMs), before);
});

test("plain calendar dates are timezone-free labels", () => {
  assert.equal(isoAddDays("2026-02-28", 1), "2026-03-01");
  assert.equal(isoAddDays("2024-02-28", 1), "2024-02-29", "leap year");
  assert.equal(isoAddDays("2026-12-31", 1), "2027-01-01", "year boundary");
  assert.equal(isoWeekday("2026-09-02"), 3, "Wednesday");
  assert.equal(parseIso("2026-02-31"), null, "impossible dates are rejected");
  assert.equal(parseIso("not-a-date"), null);
});

test("labels read the way a person would say them", () => {
  assert.equal(timeLabel(H(18), { compact: true }), "6 PM");
  assert.equal(timeLabel(H(16, 30)), "4:30 PM");
  assert.equal(timeLabel(0), "12:00 AM");
  assert.equal(rangeLabel(H(16, 30), H(17, 30)), "4:30 – 5:30 PM", "meridiem collapses");
  assert.equal(rangeLabel(H(11, 30), H(12, 30)), "11:30 AM – 12:30 PM", "and doesn't when it shouldn't");
});

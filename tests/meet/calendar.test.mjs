import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBusyIntervals,
  mergeIntervals,
  parseIcs,
  trackManualEdits,
} from "../../src/lib/meet/calendar.js";
import { AVAILABLE, UNAVAILABLE, enumerateSlots, slotsPerDay } from "../../src/lib/meet/model.js";
import { H, meeting } from "./helpers.mjs";

const ics = (...lines) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...lines, "END:VCALENDAR"].join("\r\n");
const vevent = (...lines) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"];

function window(m) {
  const slots = enumerateSlots(m);
  return {
    slots,
    windowStartMs: slots[0].utcMs,
    windowEndMs: slots[slots.length - 1].utcMs + 1800000,
  };
}

/** Render one day of a slot array as a string: "#" selected, "." not. */
function row(m, states, day) {
  const per = slotsPerDay(m);
  return Array.from({ length: per }, (_, i) => (states[day * per + i] === AVAILABLE ? "#" : ".")).join("");
}

test("an import selects the free time and leaves events unselected", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  const intervals = parseIcs(
    ics(...vevent("DTSTART;TZID=America/New_York:20260902T163000", "DTEND;TZID=America/New_York:20260902T174500")),
    w
  );
  const states = applyBusyIntervals(w.slots, intervals);
  // 4:00-10:00pm in 30min slots; the event covers 4:30-5:45.
  assert.equal(row(m, states, 0), "#...########");
});

test("a five-minute event does not consume a half-hour slot", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  const intervals = parseIcs(
    ics(...vevent("DTSTART;TZID=America/New_York:20260902T190000", "DTEND;TZID=America/New_York:20260902T190500")),
    w
  );
  assert.equal(row(m, applyBusyIntervals(w.slots, intervals), 0), "############");
});

test("an empty calendar selects the whole window", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  assert.equal(parseIcs(ics(), w).length, 0);
  assert.equal(row(m, applyBusyIntervals(w.slots, []), 0), "############");
});

test("a weekly class expands onto the right days only", () => {
  const m = meeting();
  const w = window(m);
  const intervals = parseIcs(
    ics(
      ...vevent(
        "DTSTART;TZID=America/New_York:20260824T163000",
        "DTEND;TZID=America/New_York:20260824T174500",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261211T235959Z"
      )
    ),
    w
  );
  const s = applyBusyIntervals(w.slots, intervals);
  assert.equal(row(m, s, 0), "#...########", "Wed is a class day");
  assert.equal(row(m, s, 1), "############", "Thu is not");
  assert.equal(row(m, s, 2), "#...########", "Fri is");
  assert.equal(row(m, s, 3), "############", "Sat is not");
});

test("cancelled and free-marked events are not conflicts", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  const intervals = parseIcs(
    ics(
      ...vevent("DTSTART;TZID=America/New_York:20260902T170000", "DTEND;TZID=America/New_York:20260902T220000", "STATUS:CANCELLED"),
      ...vevent("DTSTART;TZID=America/New_York:20260902T170000", "DTEND;TZID=America/New_York:20260902T220000", "TRANSP:TRANSPARENT")
    ),
    w
  );
  assert.equal(intervals.length, 0);
  assert.equal(row(m, applyBusyIntervals(w.slots, intervals), 0), "############");
});

test("events outside the window are ignored; ones crossing it are clipped", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  const intervals = parseIcs(
    ics(
      ...vevent("DTSTART;TZID=America/New_York:20260901T100000", "DTEND;TZID=America/New_York:20260901T110000"),
      ...vevent("DTSTART;TZID=America/New_York:20260902T140000", "DTEND;TZID=America/New_York:20260902T170000")
    ),
    w
  );
  assert.equal(intervals.length, 1, "the day-before event is dropped entirely");
  const s = applyBusyIntervals(w.slots, intervals);
  assert.equal(row(m, s, 0), "..##########", "only the part inside the window is taken");
});

test("an all-day event blocks the day it covers", () => {
  const m = meeting({ dates: ["2026-09-02", "2026-09-03"] });
  const w = window(m);
  const intervals = parseIcs(ics(...vevent("DTSTART;VALUE=DATE:20260902", "DTEND;VALUE=DATE:20260903")), w);
  const s = applyBusyIntervals(w.slots, intervals);
  assert.ok(intervals.length >= 1);
  assert.equal(row(m, s, 1), "############", "the following day is untouched");
});

test("overlapping and back-to-back events merge instead of double counting", () => {
  assert.deepEqual(mergeIntervals([{ startMs: 0, endMs: 10 }, { startMs: 5, endMs: 20 }]), [{ startMs: 0, endMs: 20 }]);
  assert.deepEqual(mergeIntervals([{ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 }]), [{ startMs: 0, endMs: 20 }]);
  assert.deepEqual(mergeIntervals([{ startMs: 30, endMs: 40 }, { startMs: 0, endMs: 10 }]),
    [{ startMs: 0, endMs: 10 }, { startMs: 30, endMs: 40 }], "sorted");
  assert.deepEqual(mergeIntervals([{ startMs: 5, endMs: 5 }]), [], "zero-length dropped");

  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  const overlapping = parseIcs(
    ics(
      ...vevent("DTSTART;TZID=America/New_York:20260902T170000", "DTEND;TZID=America/New_York:20260902T190000"),
      ...vevent("DTSTART;TZID=America/New_York:20260902T180000", "DTEND;TZID=America/New_York:20260902T200000")
    ),
    w
  );
  assert.equal(overlapping.length, 1, "two overlapping events are one busy block");
  assert.equal(row(m, applyBusyIntervals(w.slots, overlapping), 0), "##......####");
});

test("folded lines, DURATION and UTC stamps all parse", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  const intervals = parseIcs(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20260902T180000",
      "DURATION:PT1H30M",
      "SUMMARY:A summary folded across",
      "\ttwo physical lines",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20260903T000000Z",
      "DTEND:20260903T010000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"),
    w
  );
  assert.equal(intervals.length, 2);
  // 6:00-7:30pm from DURATION, and 8-9pm from the UTC-form event.
  assert.equal(row(m, applyBusyIntervals(w.slots, intervals), 0), "####...#..##");
});

test("a preset does not turn a later import into a no-op", () => {
  // Jayson's report: tap Anytime, upload a .ics, and the whole grid stays selected even
  // though the banner says it found busy blocks. The preset had banked every slot as a
  // hand edit, so the import computed the right answer and then threw all of it away.
  const m = meeting({ dates: ["2026-09-02", "2026-09-03"] });
  const w = window(m);
  const all = w.slots.map((s) => s.index);

  const previous = new Uint8Array(w.slots.length).fill(AVAILABLE); // what Anytime paints
  const manual = trackManualEdits(new Set(), all, { replacesAll: true });
  assert.equal(manual.size, 0, "a whole-grid replacement is not a per-slot decision");

  const intervals = parseIcs(
    ics(
      ...vevent(
        "DTSTART;TZID=America/New_York:20260902T180000",
        "DTEND;TZID=America/New_York:20260902T200000",
        "RRULE:FREQ=WEEKLY;BYDAY=WE,TH;UNTIL=20261211T235959Z"
      )
    ),
    w
  );
  const states = applyBusyIntervals(w.slots, intervals, { previous, manual });
  assert.equal(row(m, states, 0), "####....####", "Wed 6-8pm comes out of the selection");
  assert.equal(row(m, states, 1), "####....####", "and so does Thu");
});

test("a hand-painted cell still wins over an import", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  // Anytime, then one deliberate correction: 4:00 deselected by hand.
  const manual = trackManualEdits(new Set(), w.slots.map((s) => s.index), { replacesAll: true });
  trackManualEdits(manual, [0]);
  assert.deepEqual([...manual], [0], "only the cell the person actually touched is kept");

  const previous = new Uint8Array(w.slots.length).fill(AVAILABLE);
  previous[0] = UNAVAILABLE;
  const states = applyBusyIntervals(w.slots, [], { previous, manual });
  assert.equal(row(m, states, 0), ".###########");
});

test("manual edits survive a re-import", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  const previous = new Uint8Array(w.slots.length);
  previous[0] = UNAVAILABLE; // the person deliberately deselected 4:00
  const manual = new Set([0]);
  const intervals = [];
  const next = applyBusyIntervals(w.slots, intervals, { previous, manual });
  assert.equal(next[0], UNAVAILABLE, "the hand edit is not overwritten by the import");
  assert.equal(next[1], AVAILABLE, "everything else is filled in from the calendar");
});

test("garbage input does not throw", () => {
  const m = meeting({ dates: ["2026-09-02"] });
  const w = window(m);
  for (const junk of ["", "not a calendar", "BEGIN:VCALENDAR\r\nEND:VCALENDAR", ics(...vevent("DTSTART:garbage"))]) {
    assert.doesNotThrow(() => parseIcs(junk, w));
  }
});

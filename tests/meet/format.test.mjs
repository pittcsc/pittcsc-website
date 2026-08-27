import test from "node:test";
import assert from "node:assert/strict";

import { STATE_LABEL, describeWindow, nameList, summarizeDates, buildIcs, googleCalendarUrl } from "../../src/lib/meet/format.js";
import { enumerateSlots } from "../../src/lib/meet/model.js";
import { H, meeting } from "./helpers.mjs";

test("a date summary never implies days that were not offered", () => {
  assert.equal(summarizeDates(["2026-09-02"]), "Sep 2");
  assert.equal(summarizeDates(["2026-09-02", "2026-09-03", "2026-09-04"]), "Sep 2 → Sep 4");
  // The important case: a gap must not be smoothed into a range.
  const scattered = summarizeDates(["2026-08-29", "2026-09-09"]);
  assert.ok(!scattered.includes("→"), `discontiguous dates rendered as a range: ${scattered}`);
  assert.match(scattered, /\+/, "it says how many others there are");
  assert.equal(summarizeDates([]), "");
});

test("every state has exactly one name across the product", () => {
  const names = Object.values(STATE_LABEL);
  assert.equal(new Set(names).size, names.length, "no two states share a label");
  assert.equal(STATE_LABEL.available, "Free");
  assert.equal(STATE_LABEL.unavailable, "Can't make it");
});

test("a window is described in the viewer's timezone, not the organizer's", () => {
  const m = meeting({ dates: ["2026-09-02"], startMin: H(16), endMin: H(20) });
  const slots = enumerateSlots(m);
  const w = { start: 0, k: 2 };
  assert.match(describeWindow(w, slots, "America/New_York").range, /4:00 – 5:00 PM/);
  assert.match(describeWindow(w, slots, "America/Los_Angeles").range, /1:00 – 2:00 PM/);
  assert.equal(describeWindow(w, slots, "America/New_York").startMs, slots[0].utcMs);
});

test("a window crossing local midnight reads forwards, not backwards", () => {
  const m = meeting({ dates: ["2026-09-02"], startMin: H(23), endMin: H(24), durationMin: 60 });
  const slots = enumerateSlots(m);
  const d = describeWindow({ start: 0, k: 2 }, slots, "America/New_York");
  assert.match(d.range, /11:00 PM – 12:00 AM/);
});

test("name lists read like a sentence and truncate honestly", () => {
  const p = (n) => ({ name: n });
  assert.equal(nameList([p("Ann")]), "Ann");
  assert.equal(nameList([p("Ann"), p("Bo")]), "Ann and Bo");
  assert.equal(nameList([p("Ann"), p("Bo"), p("Cy")]), "Ann, Bo and Cy");
  assert.match(nameList([p("A"), p("B"), p("C"), p("D"), p("E")]), /2 others$/);
});

test("the generated calendar invite escapes text and carries no private data", () => {
  const ics = buildIcs({
    title: "Retro; with, punctuation\nand a newline",
    startMs: Date.UTC(2026, 8, 2, 20),
    endMs: Date.UTC(2026, 8, 2, 21),
    url: "https://pittcsc.org/meet/abc1234",
    attendeeCount: "3 of 4",
  });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20260902T200000Z/);
  assert.ok(ics.includes("\;") && ics.includes("\\,") && ics.includes("\\n"), "special chars escaped");
  assert.ok(!ics.split("\r\n").some((l) => l.startsWith("ATTENDEE")), "no attendee identities leak");
});

test("the Google Calendar link encodes its parameters", () => {
  const url = googleCalendarUrl({
    title: "A & B",
    startMs: Date.UTC(2026, 8, 2, 20),
    endMs: Date.UTC(2026, 8, 2, 21),
    url: "https://pittcsc.org/meet/abc1234",
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("text"), "A & B");
  assert.match(parsed.searchParams.get("dates"), /^20260902T200000Z\/20260902T210000Z$/);
});

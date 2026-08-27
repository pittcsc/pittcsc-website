/** Shared fixtures for the /meet suite. */
import { AVAILABLE, IF_NEEDED, encodeSlots, normalizeCreate, slotsPerDay } from "../../src/lib/meet/model.js";

export const H = (h, m = 0) => h * 60 + m;

export function meeting(overrides = {}) {
  return normalizeCreate({
    name: "Test",
    dates: ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"],
    startMin: H(16),
    endMin: H(22),
    durationMin: 60,
    tz: "America/New_York",
    ...overrides,
  });
}

/**
 * Build a slot string from spans of *free* time, expressed as [dayIndex, from, to].
 * Mirrors how a participant actually answers: nothing is selected until they say so.
 */
export function freeSpans(m, spans, maybeSpans = []) {
  const per = slotsPerDay(m);
  const arr = new Uint8Array(m.dates.length * per);
  const paint = (list, value) => {
    for (const [d, from, to] of list) {
      for (let x = (from - m.startMin) / 30; x < (to - m.startMin) / 30; x += 1) {
        arr[d * per + x] = value;
      }
    }
  };
  paint(maybeSpans, IF_NEEDED);
  paint(spans, AVAILABLE);
  return encodeSlots(arr);
}

export function person(id, name, slots, extra = {}) {
  return { id, name, slots, submittedAt: 1, updatedAt: 1, source: "manual", ...extra };
}

export function withParticipants(m, participants) {
  return { ...m, participants };
}

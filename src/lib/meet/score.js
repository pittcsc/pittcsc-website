/**
 * The part that makes /meet worth using: turning a wall of cells into an answer.
 *
 * When2meet renders the data and leaves interpretation to a human squinting at a
 * heatmap. Here the unit of output is a *meeting window* of the requested duration,
 * ranked, deduplicated, and annotated with exactly who is in the way.
 */

import {
  BUSY,
  FREE,
  IF_NEEDED,
  SLOT_MIN,
  decodeSlots,
  isContiguousWindow,
  slotCount,
  slotsPerDay,
  windowLengthSlots,
} from "./model.js";
import { isoOf, utcToZoned } from "./time.js";

/**
 * Everyone who has actually answered, decoded once, plus per-slot tallies.
 * `muted` ids stay in the roster but are excluded from every count — the what-if
 * lever for "we can't find a time that works for all thirty of you".
 */
export function buildGroup(meeting, participants, muted) {
  const n = slotCount(meeting);
  const mutedSet = muted instanceof Set ? muted : new Set(muted || []);
  const answered = (participants || [])
    .filter((p) => p && p.submittedAt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      source: p.source || "manual",
      updatedAt: p.updatedAt || p.submittedAt,
      muted: mutedSet.has(p.id),
      slots: decodeSlots(p.slots, n),
    }));

  const active = answered.filter((p) => !p.muted);
  const free = new Int16Array(n);
  const maybe = new Int16Array(n);
  const busy = new Int16Array(n);

  for (const person of active) {
    for (let i = 0; i < n; i += 1) {
      const state = person.slots[i];
      if (state === BUSY) busy[i] += 1;
      else if (state === IF_NEEDED) maybe[i] += 1;
      else free[i] += 1;
    }
  }

  // People who gave a name but haven't answered yet. They are the honest version of
  // "not yet answered": observed, not inferred from a headcount the organizer guessed.
  const waiting = (participants || [])
    .filter((p) => p && !p.submittedAt)
    .map((p) => ({ id: p.id, name: p.name, pending: true }));

  return {
    meeting,
    answered,
    active,
    waiting,
    total: active.length,
    pending: waiting.length,
    perSlot: { free, maybe, busy },
  };
}

/** Worst state a person holds anywhere inside slots [start, start+k). */
function worstState(slots, start, k) {
  let worst = FREE;
  for (let i = start; i < start + k; i += 1) {
    if (slots[i] === BUSY) return BUSY;
    if (slots[i] === IF_NEEDED) worst = IF_NEEDED;
  }
  return worst;
}

/**
 * Every candidate window of the meeting's duration, sliding one slot at a time and
 * never straddling a day boundary.
 */
export function rankWindows(group) {
  const { meeting, active } = group;
  const k = windowLengthSlots(meeting);
  const per = slotsPerDay(meeting);
  const total = slotCount(meeting);
  const out = [];

  for (let start = 0; start + k <= total; start += 1) {
    if (!isContiguousWindow(meeting, start, k)) continue;

    const yes = [];
    const maybe = [];
    const no = [];
    for (const person of active) {
      const state = worstState(person.slots, start, k);
      if (state === BUSY) no.push(person);
      else if (state === IF_NEEDED) maybe.push(person);
      else yes.push(person);
    }

    const dateIndex = Math.floor(start / per);
    const slotOfDay = start % per;
    const startMinute = meeting.startMin + slotOfDay * SLOT_MIN;

    out.push({
      start,
      k,
      dateIndex,
      date: meeting.dates[dateIndex],
      startMinute,
      endMinute: startMinute + k * SLOT_MIN,
      yes,
      maybe,
      no,
      count: yes.length,
      reach: yes.length + maybe.length,
    });
  }

  out.sort(
    (a, b) =>
      b.count - a.count ||
      b.reach - a.reach ||
      a.dateIndex - b.dateIndex ||
      a.startMinute - b.startMinute
  );
  return out;
}

function overlaps(a, b) {
  return (
    a.dateIndex === b.dateIndex &&
    a.start < b.start + b.k &&
    b.start < a.start + a.k
  );
}

/**
 * The shortlist — the three-ish options a human actually compares.
 *
 * Two things ruin this list if you just take the top N. Windows slide by one slot, so
 * the raw top five are five overlapping views of the same block. And if one evening is
 * wide open it sweeps every position, so you get "Wed 6, Wed 7, Wed 8, Wed 9" — one
 * answer wearing four hats.
 *
 * So: first pass takes the single best window on each distinct day, which yields
 * options that differ in the way people care about. Only if there aren't enough days
 * do we come back for second-best times within a day.
 */
export function pickBest(windows, limit = 3) {
  const chosen = [];
  const usedDays = new Set();

  for (const w of windows) {
    if (chosen.length >= limit) break;
    if (usedDays.has(w.dateIndex)) continue;
    usedDays.add(w.dateIndex);
    chosen.push(w);
  }

  for (const w of windows) {
    if (chosen.length >= limit) break;
    if (chosen.includes(w) || chosen.some((c) => overlaps(c, w))) continue;
    chosen.push(w);
  }

  return chosen.sort(
    (a, b) =>
      b.count - a.count ||
      b.reach - a.reach ||
      a.dateIndex - b.dateIndex ||
      a.startMinute - b.startMinute
  );
}

/**
 * Across the strongest windows, who keeps showing up as the blocker? This is the
 * question organizers actually ask ("is it just Priya?") and the one a heatmap can
 * never answer.
 */
export function topBlockers(windows, { sample = 8, limit = 3 } = {}) {
  const tally = new Map();
  const pool = windows.slice(0, sample);
  if (!pool.length) return [];
  for (const w of pool) {
    for (const person of w.no) {
      const row = tally.get(person.id) || { person, blocks: 0 };
      row.blocks += 1;
      tally.set(person.id, row);
    }
  }
  return Array.from(tally.values())
    .filter((row) => row.blocks > pool.length / 2)
    .sort((a, b) => b.blocks - a.blocks)
    .slice(0, limit)
    .map((row) => ({ ...row, of: pool.length }));
}

/**
 * "Everyone but Sam can do Tuesday at 6." Finds the single person whose absence would
 * unlock a unanimous window, but only when that's actually news — if a window already
 * works for everyone there is nothing to unlock.
 */
export function nearMiss(group, windows) {
  if (group.total < 3 || !windows.length) return null;
  if (windows[0].count === group.total) return null;

  for (const w of windows) {
    if (w.no.length === 1 && w.yes.length + w.maybe.length === group.total - 1) {
      return { window: w, person: w.no[0] };
    }
  }
  return null;
}

/* ------------------------- viewer-timezone projection ------------------------- */

/**
 * Re-project the slot list into the *viewer's* timezone.
 *
 * Columns become viewer-local dates and rows viewer-local times, so a Pittsburgh
 * meeting shown from Berlin lands on the right local days rather than being labelled
 * with someone else's clock. When the two zones agree this collapses to the dense grid
 * you'd draw by hand; when they don't, the offset leaves a few inert cells at the
 * corners, which is the honest rendering.
 */
export function buildViewGrid(slots, viewerTz) {
  const rowSet = new Set();
  const colSet = new Set();
  const cells = new Map();

  for (const slot of slots) {
    const z = utcToZoned(slot.utcMs, viewerTz);
    const date = isoOf(z.y, z.m, z.d);
    rowSet.add(z.minute);
    colSet.add(date);
    cells.set(`${date}|${z.minute}`, slot.index);
  }

  const rows = Array.from(rowSet).sort((a, b) => a - b);
  const cols = Array.from(colSet).sort();

  return {
    rows,
    cols,
    /** Slot index at (date, minute), or -1 when the cell isn't a real slot. */
    at(date, minute) {
      const hit = cells.get(`${date}|${minute}`);
      return hit === undefined ? -1 : hit;
    },
  };
}

/**
 * Turning a calendar into availability, entirely in the browser.
 *
 * The privacy rule that shapes this whole file: the group needs to know *that* you are
 * busy, never *why*. So the only thing that ever crosses the network to our server is
 * one digit per half hour. Event titles, attendees, and locations are read (when they
 * exist at all), used to compute overlaps, and dropped.
 */

import { BUSY, FREE, SLOT_MIN } from "./model.js";
import { utcToZoned, zonedToUtcMs } from "./time.js";

const SLOT_MS = SLOT_MIN * 60000;

/**
 * Paint busy intervals onto a slot array.
 *
 * A slot counts as busy when an event covers more than a token sliver of it —
 * a 9:00–9:05 standup shouldn't wipe out your 9:00–9:30. Manual edits win: anything
 * the person already marked by hand is left alone, so re-importing never silently
 * undoes a correction.
 */
export function applyBusyIntervals(slots, intervals, { previous, manual } = {}) {
  const next = new Uint8Array(slots.length);
  const threshold = SLOT_MS * 0.25;

  for (let i = 0; i < slots.length; i += 1) {
    const start = slots[i].utcMs;
    const end = start + SLOT_MS;
    let covered = 0;
    for (const iv of intervals) {
      const lo = Math.max(start, iv.startMs);
      const hi = Math.min(end, iv.endMs);
      if (hi > lo) covered += hi - lo;
      if (covered >= threshold) break;
    }
    next[i] = covered >= threshold ? BUSY : FREE;
  }

  if (manual && previous) {
    for (let i = 0; i < next.length; i += 1) {
      if (manual.has(i)) next[i] = previous[i];
    }
  }
  return next;
}

/** How many slots an import actually changed — the number worth showing a human. */
export function diffCount(before, after) {
  let changed = 0;
  for (let i = 0; i < after.length; i += 1) if (before[i] !== after[i]) changed += 1;
  return changed;
}

/* ----------------------------------- ICS ----------------------------------- */

/**
 * A deliberately small .ics reader: enough for a Google/Apple/Outlook export, not a
 * conformant implementation. It exists so that calendar import works with zero OAuth
 * setup — you export a file, you drop it in.
 *
 * Recurrence matters more than it looks: a student's blocked hours are almost entirely
 * recurring class meetings, so we expand DAILY/WEEKLY rules (with INTERVAL, BYDAY,
 * COUNT, UNTIL and EXDATE) across the meeting's own window, which is only ever a few
 * days wide. Rules we don't understand are skipped rather than guessed at.
 */
export function parseIcs(text, { windowStartMs, windowEndMs }) {
  const lines = unfold(String(text || ""));
  const intervals = [];

  let current = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = { exdates: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) expandEvent(current, intervals, windowStartMs, windowEndMs);
      current = null;
      continue;
    }
    if (!current) continue;

    const split = line.indexOf(":");
    if (split < 0) continue;
    const rawKey = line.slice(0, split);
    const value = line.slice(split + 1);
    const [name, ...params] = rawKey.split(";");
    const paramMap = {};
    for (const p of params) {
      const eq = p.indexOf("=");
      if (eq > 0) paramMap[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }

    switch (name.toUpperCase()) {
      case "DTSTART":
        current.start = parseIcsDate(value, paramMap);
        break;
      case "DTEND":
        current.end = parseIcsDate(value, paramMap);
        break;
      case "DURATION":
        current.durationMs = parseIcsDuration(value);
        break;
      case "RRULE":
        current.rrule = parseRrule(value);
        break;
      case "EXDATE":
        current.exdates.push(parseIcsDate(value, paramMap));
        break;
      case "STATUS":
        current.status = value.toUpperCase();
        break;
      case "TRANSP":
        current.transparent = value.toUpperCase() === "TRANSPARENT";
        break;
      default:
        break;
    }
  }

  return mergeIntervals(intervals);
}

/** RFC 5545 folds long lines with a leading space or tab on the continuation. */
function unfold(text) {
  const out = [];
  for (const raw of text.split(/\r\n|\n|\r/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && out.length) {
      out[out.length - 1] += raw.slice(1);
    } else {
      out.push(raw);
    }
  }
  return out;
}

function parseIcsDate(value, params) {
  const first = String(value).split(",")[0].trim();

  // All-day: 20260902
  const dayOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(first);
  if (dayOnly) {
    return {
      allDay: true,
      ms: Date.UTC(+dayOnly[1], +dayOnly[2] - 1, +dayOnly[3]),
      tz: params.TZID || null,
    };
  }

  const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(first);
  if (!stamp) return null;

  const [, y, mo, d, h, mi, s, zulu] = stamp;
  const wall = {
    y: +y,
    m: +mo,
    d: +d,
    minute: +h * 60 + +mi,
  };

  if (zulu) return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s), tz: "UTC", wall };
  if (params.TZID) {
    try {
      return { ms: zonedToUtcMs(wall, params.TZID), tz: params.TZID, wall };
    } catch (e) {
      /* unknown TZID — treat as floating below */
    }
  }
  // Floating time: interpret in the viewer's own zone, which is what calendars do.
  const local = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return { ms: local.getTime(), tz: null, wall, floating: true };
}

function parseIcsDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    String(value).trim()
  );
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const ms =
    (+(m[2] || 0) * 604800 + +(m[3] || 0) * 86400 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) *
    1000;
  return sign * ms;
}

function parseRrule(value) {
  const rule = {};
  for (const part of String(value).split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return rule;
}

const BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function expandEvent(event, out, windowStartMs, windowEndMs) {
  if (!event.start || !event.start.ms) return;
  // Declined and free-marked events aren't conflicts.
  if (event.status === "CANCELLED" || event.transparent) return;

  const startMs = event.start.ms;
  let durationMs = event.durationMs;
  if (durationMs == null && event.end && event.end.ms != null) {
    durationMs = event.end.ms - startMs;
  }
  if (durationMs == null) durationMs = event.start.allDay ? 86400000 : 3600000;
  if (durationMs <= 0) return;

  const excluded = new Set(event.exdates.filter(Boolean).map((d) => d.ms));

  const push = (ms) => {
    if (excluded.has(ms)) return;
    const end = ms + durationMs;
    if (end > windowStartMs && ms < windowEndMs) out.push({ startMs: ms, endMs: end });
  };

  if (!event.rrule) {
    push(startMs);
    return;
  }

  const rule = event.rrule;
  const freq = String(rule.FREQ || "").toUpperCase();
  const interval = Math.max(1, parseInt(rule.INTERVAL, 10) || 1);
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : Infinity;
  const untilParsed = rule.UNTIL ? parseIcsDate(rule.UNTIL, {}) : null;
  const until = untilParsed && untilParsed.ms != null ? untilParsed.ms : Infinity;

  if (freq !== "DAILY" && freq !== "WEEKLY") {
    // MONTHLY/YEARLY rules are rare inside a window measured in days, and getting
    // them subtly wrong is worse than not claiming to support them.
    push(startMs);
    return;
  }

  const days = rule.BYDAY
    ? String(rule.BYDAY)
        .split(",")
        .map((token) => BYDAY[token.slice(-2).toUpperCase()])
        .filter((n) => n != null)
    : null;

  const originWeek = Math.floor(startMs / 604800000);
  const originWeekday = new Date(startMs).getDay();

  // Walk day by day. When the rule has no COUNT we can jump straight to the meeting's
  // window; with a COUNT we have to count from the beginning to know where it runs
  // out, so we walk (bounded — a class schedule is a couple hundred iterations).
  let cursor = startMs;
  let emitted = 0;
  if (count === Infinity && windowStartMs - startMs > 86400000) {
    cursor = startMs + Math.floor((windowStartMs - startMs) / 86400000) * 86400000;
  }

  for (let guard = 0; guard < 1200; guard += 1) {
    if (cursor > windowEndMs || cursor > until || emitted >= count) break;

    const weekday = new Date(cursor).getDay();
    const dayOk = days
      ? days.includes(weekday)
      : freq === "DAILY" || weekday === originWeekday;
    const stepOk =
      freq === "DAILY"
        ? Math.round((cursor - startMs) / 86400000) % interval === 0
        : (Math.floor(cursor / 604800000) - originWeek) % interval === 0;

    if (dayOk && stepOk) {
      push(cursor);
      emitted += 1;
    }
    cursor += 86400000;
  }
}

/** Overlapping events collapse — three back-to-back meetings are just "busy". */
export function mergeIntervals(intervals) {
  const sorted = intervals
    .filter((iv) => iv && iv.endMs > iv.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, iv.endMs);
    } else {
      out.push({ startMs: iv.startMs, endMs: iv.endMs });
    }
  }
  return out;
}

/** Human-readable summary of what an import found, without naming any event. */
export function summarizeIntervals(intervals, tz) {
  if (!intervals.length) return "no conflicts";
  const days = new Set();
  let totalMs = 0;
  for (const iv of intervals) {
    totalMs += iv.endMs - iv.startMs;
    const z = utcToZoned(iv.startMs, tz);
    days.add(`${z.y}-${z.m}-${z.d}`);
  }
  const hours = Math.round(totalMs / 3600000);
  return `${intervals.length} busy ${intervals.length === 1 ? "block" : "blocks"} across ${days.size} ${
    days.size === 1 ? "day" : "days"
  }${hours ? ` (~${hours}h)` : ""}`;
}

/**
 * Timezone + calendar math for /meet.
 *
 * Everything the scheduler stores is anchored to the meeting's *home* timezone, but
 * every instant is resolvable to absolute UTC so that a participant in another zone
 * sees the same real moment relabeled. No dependencies — `Intl` already knows the
 * whole tz database.
 */

const _dtf = new Map();

function dtfFor(tz) {
  let d = _dtf.get(tz);
  if (!d) {
    d = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    _dtf.set(tz, d);
  }
  return d;
}

/** The viewer's own timezone, with a safe fallback for exotic environments. */
export function localTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch (e) {
    return "America/New_York";
  }
}

export function isValidTz(tz) {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

/** Break an absolute instant into wall-clock fields inside `tz`. */
export function utcToZoned(utcMs, tz) {
  const out = {};
  for (const p of dtfFor(tz).formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    y: out.year,
    m: out.month,
    d: out.day,
    minute: (out.hour % 24) * 60 + out.minute,
  };
}

function wallAsUtc(z) {
  return Date.UTC(z.y, z.m - 1, z.d, 0, z.minute);
}

/** Offset of `tz` at a given instant, in ms (positive east of UTC). */
export function tzOffsetMs(utcMs, tz) {
  const minuteAligned = Math.floor(utcMs / 60000) * 60000;
  return wallAsUtc(utcToZoned(minuteAligned, tz)) - minuteAligned;
}

/**
 * Wall-clock in `tz` -> absolute UTC. Probed twice so DST transitions land on the
 * correct side; times inside a spring-forward gap resolve forward, which is the
 * behaviour every calendar app uses.
 */
export function zonedToUtcMs({ y, m, d, minute }, tz) {
  const guess = Date.UTC(y, m - 1, d, 0, minute);
  const first = tzOffsetMs(guess, tz);
  const second = tzOffsetMs(guess - first, tz);
  return guess - second;
}

/* ------------------------------------------------------------------ */
/* Plain calendar dates ("2026-09-02"), treated as timezone-free labels */
/* ------------------------------------------------------------------ */

const pad2 = (n) => String(n).padStart(2, "0");

export function isoOf(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return null;
  const y = +match[1];
  const m = +match[2];
  const d = +match[3];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Reject impossible dates like 2026-02-31.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function isoAddDays(iso, n) {
  const p = parseIso(iso);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = Sunday. */
export function isoWeekday(iso) {
  const p = parseIso(iso);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export function isoToday(tz) {
  const z = utcToZoned(Date.now(), tz);
  return isoOf(z.y, z.m, z.d);
}

export function isoDiffDays(a, b) {
  const pa = parseIso(a);
  const pb = parseIso(b);
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000
  );
}

/* ------------------------------- labels ------------------------------- */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function dayLabel(iso) {
  const p = parseIso(iso);
  return { dow: DOW[isoWeekday(iso)], dowLong: DOW_LONG[isoWeekday(iso)], md: `${MON[p.m - 1]} ${p.d}`, day: p.d };
}

/** 990 -> "4:30 PM"; whole hours drop the ":00". */
export function timeLabel(minute, { compact = false } = {}) {
  const m = ((minute % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ap = h24 < 12 ? "AM" : "PM";
  if (compact && mm === 0) return `${h12} ${ap}`;
  return `${h12}:${pad2(mm)} ${ap}`;
}

/** "4:30 – 5:30 PM", collapsing the meridiem when both ends share it. */
export function rangeLabel(startMinute, endMinute) {
  const a = timeLabel(startMinute);
  const b = timeLabel(endMinute);
  const apA = a.slice(-2);
  const apB = b.slice(-2);
  const head = apA === apB ? a.slice(0, -3) : a;
  return `${head} – ${b}`;
}

export function durationLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  if (!m) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}

/** "EDT", "GMT+2" — short enough to sit inline in a sentence. */
export function tzAbbrev(tz, utcMs = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date(utcMs));
    const found = parts.find((p) => p.type === "timeZoneName");
    return found ? found.value : tz;
  } catch (e) {
    return tz;
  }
}

/** "New York" — the human half of an IANA identifier. */
export function tzCity(tz) {
  const tail = String(tz).split("/").pop() || tz;
  return tail.replace(/_/g, " ");
}

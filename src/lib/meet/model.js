/**
 * The /meet data model.
 *
 * A meeting is a set of candidate dates crossed with a daily time window, sliced into
 * 30-minute slots. Slot granularity is deliberately *not* configurable: 30 minutes is
 * the unit real groups actually schedule in, and every knob we don't ship is a
 * decision no organizer has to make.
 *
 * A participant's answer is a digit string, one character per slot:
 *
 *     "0" can't make it   "1" if needed   "2" available
 *
 * Higher is better, and the default is 0. That ordering is deliberate: an answer you
 * never gave must never read as a yes. Nothing here records *why* a slot isn't
 * available, only that it isn't.
 */

import { badRequest } from "./http.js";
import { isoDiffDays, isValidTz, parseIso, zonedToUtcMs } from "./time.js";

export const SLOT_MIN = 30;
export const UNAVAILABLE = 0;
export const IF_NEEDED = 1;
export const AVAILABLE = 2;

export const LIMITS = {
  dates: 45,
  participants: 250,
  nameLen: 60,
  meetingNameLen: 90,
};

/** Ambiguity-free alphabet: no 0/O, no 1/I/l. Reads cleanly over a projector. */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function makeCode(len = 7) {
  let out = "";
  const bytes =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(len))
      : Array.from({ length: len }, () => Math.floor(Math.random() * 256));
  for (let i = 0; i < len; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function makeId() {
  return `${Date.now().toString(36)}${makeCode(6)}`;
}

export function slotsPerDay(meeting) {
  return Math.max(0, Math.round((meeting.endMin - meeting.startMin) / SLOT_MIN));
}

export function slotCount(meeting) {
  return meeting.dates.length * slotsPerDay(meeting);
}

/* ------------------------------- encoding ------------------------------- */

export function decodeSlots(str, n) {
  const out = new Uint8Array(n);
  if (typeof str !== "string") return out;
  const len = Math.min(n, str.length);
  for (let i = 0; i < len; i += 1) {
    const c = str.charCodeAt(i) - 48;
    out[i] = c === 1 || c === 2 ? c : 0;
  }
  return out;
}

export function encodeSlots(arr) {
  let out = "";
  for (let i = 0; i < arr.length; i += 1) {
    out += arr[i] === 1 ? "1" : arr[i] === 2 ? "2" : "0";
  }
  return out;
}

export function emptySlots(n) {
  return new Uint8Array(n);
}

export function hasAnswered(participant) {
  return Boolean(participant && participant.submittedAt);
}

/* ------------------------------ slot geometry ------------------------------ */

/**
 * Flat, ordered list of every slot: date-major, then time.
 * `utcMs` is the absolute instant the slot begins, resolved through the home tz.
 */
export function enumerateSlots(meeting) {
  const per = slotsPerDay(meeting);
  const slots = new Array(meeting.dates.length * per);
  for (let d = 0; d < meeting.dates.length; d += 1) {
    const iso = meeting.dates[d];
    const parsed = parseIso(iso);
    for (let s = 0; s < per; s += 1) {
      const minute = meeting.startMin + s * SLOT_MIN;
      slots[d * per + s] = {
        index: d * per + s,
        dateIndex: d,
        date: iso,
        minute,
        utcMs: zonedToUtcMs(
          { y: parsed.y, m: parsed.m, d: parsed.d, minute },
          meeting.tz
        ),
      };
    }
  }
  return slots;
}

/** True when slots i..i+k-1 are consecutive *and* inside one calendar day. */
export function isContiguousWindow(meeting, i, k) {
  const per = slotsPerDay(meeting);
  if (k <= 0 || i < 0 || i + k > slotCount(meeting)) return false;
  return Math.floor(i / per) === Math.floor((i + k - 1) / per);
}

export function windowLengthSlots(meeting) {
  return Math.max(1, Math.round((meeting.durationMin || SLOT_MIN) / SLOT_MIN));
}

/* ------------------------------- validation ------------------------------- */

function fail(message) {
  throw badRequest(message);
}

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

function cleanString(value, max) {
  return String(value == null ? "" : value)
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function normalizeName(value) {
  return cleanString(value, LIMITS.nameLen);
}

/** Two names are "the same person" if they match case- and space-insensitively. */
export function nameKey(value) {
  return normalizeName(value).toLowerCase();
}

function toSlotMinute(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1440, Math.round(n / SLOT_MIN) * SLOT_MIN));
}

/**
 * Validate + normalize a create request. Throws a 400-tagged Error on bad input so
 * the API layer can stay a thin shell.
 */
export function normalizeCreate(body) {
  const name =
    cleanString(body && body.name, LIMITS.meetingNameLen) || "Untitled meeting";

  const rawDates = Array.isArray(body && body.dates) ? body.dates : [];
  const dates = Array.from(new Set(rawDates.filter((d) => parseIso(d)))).sort();
  if (!dates.length) fail("Pick at least one date.");
  if (dates.length > LIMITS.dates) fail(`Pick ${LIMITS.dates} days or fewer.`);
  if (isoDiffDays(dates[0], dates[dates.length - 1]) > 365) {
    fail("Dates have to fall within a year of each other.");
  }

  const startMin = toSlotMinute(body && body.startMin, 9 * 60);
  const endMin = toSlotMinute(body && body.endMin, 21 * 60);
  if (endMin <= startMin) fail("The end time has to come after the start time.");
  if (endMin > 1440) fail("The daily window has to end by midnight.");

  const span = endMin - startMin;
  let durationMin = toSlotMinute(body && body.durationMin, 60);
  if (durationMin < SLOT_MIN) durationMin = SLOT_MIN;
  if (durationMin > span) durationMin = Math.floor(span / SLOT_MIN) * SLOT_MIN;

  const tz = isValidTz(body && body.tz) ? body.tz : "America/New_York";

  return {
    name,
    dates,
    startMin,
    endMin,
    durationMin,
    tz,
    slotMin: SLOT_MIN,
    createdAt: Date.now(),
    participants: [],
  };
}

export function normalizeRespond(meeting, body) {
  const name = normalizeName(body && body.name);
  if (!name) fail("Enter a name so the group knows who you are.");
  const slots = encodeSlots(decodeSlots(body && body.slots, slotCount(meeting)));
  const source = ["manual", "google", "ics"].includes(body && body.source)
    ? body.source
    : "manual";
  return { name, slots, source };
}

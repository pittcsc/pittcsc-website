/**
 * Presentation helpers shared by the results views.
 *
 * Everything here reads a window's absolute instants and relabels them in whatever
 * timezone the person is looking at, so the same meeting reads correctly from Oakland
 * and from Oakland, California.
 */

import { SLOT_MIN } from "./model.js";
import { dayLabel, isoOf, rangeLabel, utcToZoned } from "./time.js";

/** A ranked window, described in the viewer's own timezone. */
export function describeWindow(window, slots, viewerTz) {
  const first = slots[window.start];
  const startMs = first.utcMs;
  const endMs = startMs + window.k * SLOT_MIN * 60000;

  const zStart = utcToZoned(startMs, viewerTz);
  const zEnd = utcToZoned(endMs, viewerTz);
  const iso = isoOf(zStart.y, zStart.m, zStart.d);
  const label = dayLabel(iso);

  // A window that crosses local midnight needs its end minute unwrapped or the range
  // reads backwards ("11:30 PM – 12:30 AM" is fine; "11:30 PM – 0:30 AM" is not).
  const endMinute = zEnd.minute <= zStart.minute ? zEnd.minute + 1440 : zEnd.minute;

  return {
    startMs,
    endMs,
    iso,
    dow: label.dow,
    dowLong: label.dowLong,
    md: label.md,
    range: rangeLabel(zStart.minute, endMinute),
    /** "Tuesday, Sep 2 · 6:00 – 7:00 PM" */
    full: `${label.dowLong}, ${label.md} · ${rangeLabel(zStart.minute, endMinute)}`,
    short: `${label.dow} ${label.md}, ${rangeLabel(zStart.minute, endMinute)}`,
  };
}

/** Natural-language list: "Alex", "Alex and Sam", "Alex, Sam and two others". */
export function nameList(people, max = 3) {
  const names = people.map((p) => p.name);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length <= max) {
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

/* --------------------------------- calendar --------------------------------- */

function icsStamp(ms) {
  return `${new Date(ms).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * A single-event .ics for the time the group settled on. Small thing, but it's the
 * step every scheduling tool leaves as an exercise for the reader.
 */
export function buildIcs({ title, startMs, endMs, url, attendeeCount }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pitt CSC//meet//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${startMs}-pittcsc-meet@pittcsc.org`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(startMs)}`,
    `DTEND:${icsStamp(endMs)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(
      `${attendeeCount} available. Availability: ${url}`
    )}`,
    `URL:${icsEscape(url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function downloadIcs(filename, contents) {
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Google Calendar's prefilled-event URL, for people who live in the web app. */
export function googleCalendarUrl({ title, startMs, endMs, url }) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${icsStamp(startMs)}/${icsStamp(endMs)}`,
    details: `Availability: ${url}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const EVENT_TIMEZONE = "America/New_York";

const dateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});
const dateOnly = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const timeOnly = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export function formatEventRange(event) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  return `${dateTime.format(start)} – ${dateOnly.format(start) === dateOnly.format(end) ? timeOnly.format(end) : dateTime.format(end)}`;
}

export function isInProgress(event, now = Date.now()) {
  return (
    new Date(event.startsAt).getTime() <= now &&
    new Date(event.endsAt).getTime() > now
  );
}

export function eventExcerpt(description, limit = 180) {
  const text = description.trim().replace(/\s+/g, " ");
  if (text.length <= limit) return text;
  const clipped = text.slice(0, limit - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > limit / 2 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

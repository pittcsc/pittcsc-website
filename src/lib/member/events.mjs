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

export function formatEventRange(event) {
  return `${dateTime.format(new Date(event.startsAt))} – ${dateTime.format(new Date(event.endsAt))}`;
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

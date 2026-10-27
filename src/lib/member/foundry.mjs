// Display helpers for the Foundry page. The API owns the window, threshold and
// active decision; these only validate and format what it returns.

const lapseFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
});

const validDate = (value) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

export function parseFoundryStatus(value) {
  const valid =
    value &&
    typeof value.name === "string" &&
    Number.isInteger(value.points) &&
    value.points >= 0 &&
    Number.isInteger(value.threshold) &&
    value.threshold > 0 &&
    Number.isInteger(value.windowDays) &&
    value.windowDays > 0 &&
    typeof value.active === "boolean" &&
    (value.active ? validDate(value.activeUntil) : value.activeUntil === null);
  if (!valid)
    throw new Error("Foundry status is temporarily unavailable. Try again.");
  return value;
}

// "2026-11-06T18:00:00Z" -> "Nov 6", on the club's New York calendar.
export function foundryLapseDate(activeUntil) {
  return lapseFormat.format(new Date(activeUntil));
}

// Whole-number percent toward the threshold, capped at 100.
export function foundryProgress({ points, threshold }) {
  return Math.min(100, Math.floor((points / threshold) * 100));
}

export function foundryRemaining({ points, threshold }) {
  return Math.max(0, threshold - points);
}

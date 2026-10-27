// Display helpers for the Foundry page. The API owns the month, threshold and
// active decision; these only validate and format what it returns.

const monthFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

const monthName = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
});

export function parseFoundryStatus(value) {
  const valid =
    value &&
    typeof value.name === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) &&
    Number.isInteger(value.points) &&
    value.points >= 0 &&
    Number.isInteger(value.threshold) &&
    value.threshold > 0 &&
    typeof value.active === "boolean";
  if (!valid)
    throw new Error("Foundry status is temporarily unavailable. Try again.");
  return value;
}

// "2026-10" -> "OCT 2026"
export function foundryMonthLabel(month) {
  const [year, index] = month.split("-").map(Number);
  return monthFormat
    .format(new Date(Date.UTC(year, index - 1, 1)))
    .toUpperCase();
}

// "2026-10" -> "October"
export function foundryMonthName(month) {
  const [year, index] = month.split("-").map(Number);
  return monthName.format(new Date(Date.UTC(year, index - 1, 1)));
}

// Whole-number percent toward the threshold, capped at 100.
export function foundryProgress({ points, threshold }) {
  return Math.min(100, Math.floor((points / threshold) * 100));
}

export function foundryRemaining({ points, threshold }) {
  return Math.max(0, threshold - points);
}

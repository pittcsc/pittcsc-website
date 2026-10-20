import { eventPath, localEventTime } from "./events.mjs";

export const MAX_AMOUNT_CENTS = 10_000_000;
export const MAX_RECEIPTS = 25;
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
// Phone photos are downscaled before upload; receipts stay legible at this size
// and well within the API's 4096-pixel limit.
export const RECEIPT_MAX_EDGE = 2400;

export function expensesPath(eventID) {
  return eventPath(eventID, "expenses");
}

export function receiptPath(eventID, receiptID, amountCents) {
  const path = eventPath(eventID, `receipts/${encodeURIComponent(receiptID)}`);
  return amountCents === undefined ? path : `${path}?amountCents=${amountCents}`;
}

export function receiptAmountPath(eventID, receiptID) {
  return `${receiptPath(eventID, receiptID)}/amount`;
}

export function budgetPackagePath(eventID) {
  return eventPath(eventID, "budget-package");
}

// Mirrors the API's download name: New York start date plus an ASCII title slug.
export function budgetFileName(record) {
  const date = localEventTime(record.startsAt).slice(0, 10);
  const slug = (record.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `budget-package-${slug ? `${date}-${slug}` : date}.pdf`;
}

// Editable text for a saved amount: 1250 cents becomes "12.50".
export function amountText(cents) {
  return (cents / 100).toFixed(2);
}

// Parses a typed dollar amount ("$1,234.5") into integer cents, or returns
// null when the text is not a valid amount from $0 to $100,000.
export function parseDollars(text) {
  const value = String(text ?? "")
    .trim()
    .replace(/^\$\s*/, "")
    .replace(/,(?=\d{3}(\D|$))/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/.exec(value);
  if (!match) return null;
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? match[3] ?? "").padEnd(2, "0");
  if (whole.length > 9) return null;
  const cents = Number(whole) * 100 + Number(fraction);
  return cents <= MAX_AMOUNT_CENTS ? cents : null;
}

export function formatCents(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function scaledSize(width, height, maxEdge = RECEIPT_MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

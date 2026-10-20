import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountText,
  budgetFileName,
  budgetPackagePath,
  expensesPath,
  formatCents,
  parseDollars,
  receiptAmountPath,
  receiptPath,
  scaledSize,
} from "../../src/lib/staff/expenses.mjs";

test("typed dollar amounts become integer cents", () => {
  for (const [text, cents] of [
    ["0", 0],
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["$1,234.56", 123456],
    ["  $ 40. ", 4000],
    [".99", 99],
    ["100000", 10_000_000],
    ["100,000.00", 10_000_000],
  ])
    assert.equal(parseDollars(text), cents, text);
});

test("invalid or out-of-range amounts are rejected", () => {
  for (const text of [
    "",
    "-5",
    "12.345",
    "1e3",
    "abc",
    "$",
    ".",
    "1,23",
    "100000.01",
    "9999999999",
    null,
  ])
    assert.equal(parseDollars(text), null, String(text));
});

test("receipt totals display as dollars", () => {
  assert.equal(formatCents(123456), "$1,234.56");
  assert.equal(formatCents(0), "$0.00");
});

test("receipt photos keep their aspect ratio within the upload size", () => {
  assert.deepEqual(scaledSize(4032, 3024), { width: 2400, height: 1800 });
  assert.deepEqual(scaledSize(3024, 4032), { width: 1800, height: 2400 });
  assert.deepEqual(scaledSize(800, 600), { width: 800, height: 600 });
});

test("expense paths encode event and receipt IDs", () => {
  assert.equal(expensesPath("a/b"), "/staff/events/a%2Fb/expenses");
  assert.equal(receiptPath("e", "r/1"), "/staff/events/e/receipts/r%2F1");
  assert.equal(
    receiptPath("e", "r", 1250),
    "/staff/events/e/receipts/r?amountCents=1250",
  );
});

test("receipt edits start from the saved amount", () => {
  assert.equal(amountText(1250), "12.50");
  assert.equal(amountText(0), "0.00");
  assert.equal(parseDollars(amountText(98765)), 98765);
  assert.equal(
    receiptAmountPath("e", "r"),
    "/staff/events/e/receipts/r/amount",
  );
});

test("budget packages download with a dated, title-based name", () => {
  assert.equal(budgetPackagePath("e"), "/staff/events/e/budget-package");
  // 23:00 UTC is 6 PM the same day in New York; 03:00 UTC is the prior evening.
  assert.equal(
    budgetFileName({
      title: 'Fall "Kickoff" / Pizza',
      startsAt: "2027-01-15T23:00:00Z",
    }),
    "budget-package-2027-01-15-fall-kickoff-pizza.pdf",
  );
  assert.equal(
    budgetFileName({ title: "李小龙", startsAt: "2027-01-16T03:00:00Z" }),
    "budget-package-2027-01-15.pdf",
  );
});

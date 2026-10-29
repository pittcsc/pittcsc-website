import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizePittEmail,
  safeReturnTo,
  loginURL,
} from "../../src/lib/auth/policy.mjs";

test("Pitt email UX validation accepts only the exact domain", () => {
  assert.equal(normalizePittEmail(" Student@PITT.EDU "), "student@pitt.edu");
  for (const value of [
    null,
    "a@example.com",
    "a@cs.pitt.edu",
    "a@pitt.edu.evil.test",
    "a@@pitt.edu",
    "a b@pitt.edu",
  ]) {
    assert.equal(normalizePittEmail(value), null);
  }
});

test("return destinations cannot escape internal auth destinations", () => {
  for (const value of [
    undefined,
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/dashboard/%2e%2e/blog",
    "/dashboard/../blog",
    "/dashboard/%252f%252fevil.test",
    "/dashboard\n",
    "/login?returnTo=/login",
    "/zoom",
    "/blog",
    "javascript:alert(1)",
    "/dashboard.evil",
  ]) {
    assert.equal(safeReturnTo(value), "/dashboard", String(value));
  }
  const destination = "/attendance/event-123?source=qr#confirm";
  assert.equal(safeReturnTo(destination), destination);
  assert.equal(safeReturnTo("/dashboard/events/123"), "/dashboard/events/123");
  assert.equal(
    new URL(loginURL(destination), "https://csc.invalid").searchParams.get(
      "returnTo",
    ),
    destination,
  );
});

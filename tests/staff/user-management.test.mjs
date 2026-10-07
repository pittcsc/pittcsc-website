import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confirmMessage,
  displayName,
  lockReason,
  pageCount,
  pageSummary,
  rolePath,
  searchPath,
} from "../../src/lib/staff/user-management.mjs";

test("search paths include only set filters and encode input", () => {
  assert.equal(searchPath(), "/staff/users");
  assert.equal(searchPath({ query: "   " }), "/staff/users");
  assert.equal(
    searchPath({ query: " Ada & co ", role: "staff", page: 3 }),
    "/staff/users?q=Ada+%26+co&role=staff&page=3",
  );
  assert.equal(searchPath({ page: 1 }), "/staff/users");
});

test("role paths cannot escape their segment", () => {
  assert.equal(
    rolePath("../profile", "staff/x"),
    "/staff/users/..%2Fprofile/roles/staff%2Fx",
  );
});

test("names prefer the preferred name and fall back when empty", () => {
  assert.equal(
    displayName({ firstName: "Ada", lastName: "Lovelace" }),
    "Ada Lovelace",
  );
  assert.equal(
    displayName({ firstName: "Augusta", preferredName: "Ada", lastName: "L" }),
    "Ada L",
  );
  assert.equal(displayName({ firstName: null, lastName: null }), "No name yet");
});

test("page summaries and counts", () => {
  assert.equal(
    pageSummary({ total: 0, page: 1, pageSize: 25, users: [] }),
    "No matching members.",
  );
  assert.equal(
    pageSummary({ total: 60, page: 3, pageSize: 25, users: Array(10) }),
    "Showing 51–60 of 60",
  );
  assert.equal(pageCount({ total: 0, pageSize: 25 }), 1);
  assert.equal(pageCount({ total: 51, pageSize: 25 }), 3);
});

test("toggles lock read-only roles and your own protected role only", () => {
  const staff = { name: "staff", editable: true, confirm: true };
  const foundry = { name: "foundry", editable: true, confirm: false };
  const member = { name: "member", editable: false, confirm: false };
  const self = { id: "me", roles: ["member", "staff"] };
  const other = { id: "other", roles: ["member", "staff"] };
  assert.match(lockReason(staff, self, "me"), /your own account/);
  assert.equal(lockReason(staff, other, "me"), "");
  assert.equal(lockReason(staff, { id: "me", roles: ["member"] }, "me"), "");
  assert.equal(lockReason(foundry, self, "me"), "");
  assert.match(lockReason(member, other, "me"), /can't be changed/);
  assert.equal(
    confirmMessage({ label: "Staff" }, { email: "a@pitt.edu" }, true),
    "Grant Staff to a@pitt.edu?",
  );
  assert.equal(
    confirmMessage({ label: "Staff" }, { email: "a@pitt.edu" }, false),
    "Remove Staff from a@pitt.edu?",
  );
});

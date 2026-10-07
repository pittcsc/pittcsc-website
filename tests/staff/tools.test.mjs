import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STAFF_BASE,
  staffRoute,
  staffToolPath,
  staffTools,
} from "../../src/lib/staff/tools.mjs";

test("user management is the first staff tool", () => {
  assert.equal(staffTools[0].slug, "user-management");
  assert.equal(
    staffToolPath("user-management"),
    "/dashboard/staff/user-management",
  );
});

test("tool slugs are unique, URL-safe, and fully described", () => {
  const slugs = staffTools.map((tool) => tool.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const tool of staffTools) {
    assert.match(tool.slug, /^[a-z]+(?:-[a-z]+)*$/);
    for (const field of ["title", "description", "action"])
      assert.ok(tool[field], `${tool.slug} is missing ${field}`);
  }
});

test("staff paths resolve to home, a tool, or not found", () => {
  assert.deepEqual(staffRoute(STAFF_BASE), { view: "home" });
  assert.deepEqual(staffRoute(`${STAFF_BASE}/`), { view: "home" });
  for (const path of [
    "/dashboard/staff/user-management",
    "/dashboard/staff/user-management/",
  ])
    assert.equal(staffRoute(path).tool.slug, "user-management");
  for (const path of [
    "/dashboard/staff/unknown",
    "/dashboard/staff/user-management/extra",
    "/dashboard/staffing",
    "/dashboard/account",
    "/dashboard/staff//user-management",
  ])
    assert.deepEqual(staffRoute(path), { view: "notFound" });
});

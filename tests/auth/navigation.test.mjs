import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardLinks } from "../../src/lib/auth/navigation.mjs";

const labels = (identity, dashboard = true) =>
  dashboardLinks(identity, dashboard).map((link) => link.label);
const memberLinks = ["Dashboard", "Points", "Members", "Foundry"];

test("incomplete accounts and non-dashboard pages have no header links", () => {
  assert.deepEqual(labels({ complete: false, roles: ["member", "staff"] }), []);
  assert.deepEqual(labels({ complete: true, roles: ["member"] }, false), []);
  assert.deepEqual(labels(null), []);
});

test("only staff see the Staff link, in any role combination", () => {
  assert.deepEqual(labels({ complete: true, roles: ["member"] }), memberLinks);
  assert.deepEqual(
    labels({ complete: true, roles: ["member", "foundry", "alumni"] }),
    memberLinks,
  );
  assert.deepEqual(labels({ complete: true, roles: ["member", "staff"] }), [
    ...memberLinks,
    "Staff",
  ]);
});

test("Dashboard is only current on the exact path; sections match subpages", () => {
  const links = dashboardLinks({ complete: true, roles: ["staff"] }, true);
  assert.equal(links[0].partiallyActive, undefined);
  assert.ok(links.slice(1).every((link) => link.partiallyActive));
});

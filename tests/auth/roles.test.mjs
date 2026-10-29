import assert from "node:assert/strict";
import { test } from "node:test";
import { hasStaffRole } from "../../src/lib/auth/roles.mjs";

test("staff presentation requires staff in an additive role array", () => {
  const all = ["member", "foundry", "staff", "alumni"];
  for (let mask = 0; mask < 16; mask++) {
    const roles = all.filter((_, index) => mask & (1 << index));
    assert.equal(hasStaffRole({ roles }), Boolean(mask & 4));
  }
  for (const identity of [
    null,
    {},
    { roles: "staff" },
    { role: "staff" },
    { roles: ["Staff"] },
  ])
    assert.equal(hasStaffRole(identity), false);
});

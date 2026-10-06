import assert from "node:assert/strict";
import { test } from "node:test";
import { formFromProfile, profileInput } from "../../src/lib/account/form.mjs";

test("empty and partial profiles can be saved without invented data", () => {
  const form = formFromProfile({ majors: [] });
  assert.deepEqual(profileInput(form), {
    firstName: null,
    lastName: null,
    preferredName: null,
    graduationYear: null,
    majors: [],
  });
  assert.deepEqual(
    profileInput({
      ...form,
      firstName: " Fixture ",
      majors: ["Computer Science", "", " Math "],
    }).majors,
    ["Computer Science", "Math"],
  );
  assert.equal(
    profileInput({ ...form, graduationYear: "2028" }).graduationYear,
    2028,
  );
});

test("invalid years, duplicate majors and overly long fields explain the problem", () => {
  const form = formFromProfile({});
  for (const graduationYear of ["20", "2028.5", "NaN", "2101", "2e3"]) {
    assert.throws(
      () => profileInput({ ...form, graduationYear }),
      /graduation year/,
    );
  }
  assert.throws(
    () => profileInput({ ...form, majors: ["Math", " math "] }),
    /only once/,
  );
  assert.throws(
    () => profileInput({ ...form, firstName: "x".repeat(101) }),
    /100/,
  );
  assert.throws(
    () => profileInput({ ...form, majors: ["x".repeat(121)] }),
    /120/,
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { alumniForm, alumniInput } from "../../src/lib/alumni/profile.mjs";
import {
  directoryFilters,
  directorySearch,
  directoryReturn,
} from "../../src/lib/alumni/directory.mjs";
test("partial CRM data remains saveable and directory choices round-trip", () => {
  const empty = alumniInput(alumniForm({}));
  assert.equal(empty.contactEmail, null);
  assert.equal(empty.openToMentorship, false);
  const input = alumniInput(
    alumniForm({
      contactEmail: " work@example.org ",
      openToMentorship: true,
      positionIsCurrent: false,
    }),
  );
  assert.equal(input.contactEmail, "work@example.org");
  assert.equal(input.openToMentorship, true);
  assert.equal(input.openToCoffeeChats, false);
  assert.equal(input.positionIsCurrent, false);
});
test("contact checking rejects Pitt addresses and malformed values without inventing verification", () => {
  for (const contactEmail of [
    "student@PITT.EDU",
    "bad",
    "Name <work@example.org>",
    "work@example.org\nBcc: bad@example.org",
  ])
    assert.throws(() => alumniInput({ ...alumniForm({}), contactEmail }));
  assert.equal(
    alumniInput({ ...alumniForm({}), contactEmail: "work+tag@example.org" })
      .contactEmail,
    "work+tag@example.org",
  );
});
test("directory filters survive a detail return without personal records or external redirects", () => {
  const filters = {
    search: "Engineer & mentor",
    graduation_year: 2026,
    open_to_mentorship: true,
    location: "New York",
  };
  const search = directorySearch(filters);
  assert.deepEqual(directoryFilters(search), filters);
  assert.deepEqual(
    directoryFilters(
      new URL(
        directoryReturn("/dashboard/alumni" + search),
        "https://csc.invalid",
      ).search,
    ),
    filters,
  );
  for (const bad of [
    "https://other.example/dashboard/alumni",
    "//other.example",
    "/login",
    "/dashboard/alumni/id",
  ])
    assert.equal(directoryReturn(bad), "/dashboard/alumni");
});

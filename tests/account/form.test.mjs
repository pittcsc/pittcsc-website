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
    githubUsername: null,
    leetcodeUsername: null,
    linkedinUsername: null,
    currentCompany: null,
    jobTitle: null,
    location: null,
    bio: null,
    personalWebsite: null,
    contactEmail: null,
    offersCoffee: false,
    offersMentorship: false,
    offersReferrals: false,
    offersResumeReview: false,
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

test("optional career fields round-trip and reject unsafe links", () => {
  const form = formFromProfile({
    currentCompany: "PNC",
    offersMentorship: true,
    personalWebsite: "https://example.com/profile",
  });
  const input = profileInput({ ...form, bio: "  Hello CSC  " });
  assert.equal(input.currentCompany, "PNC");
  assert.equal(input.bio, "Hello CSC");
  assert.equal(input.offersMentorship, true);
  assert.equal(input.offersCoffee, false);
  for (const personalWebsite of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com"]) {
    assert.throws(() => profileInput({ ...form, personalWebsite }), /HTTPS/);
  }
  assert.throws(() => profileInput({ ...form, currentCompany: "a".repeat(161) }), /Company/);
});

test("contact email is optional, distinct from sign-in, and never a profile role", () => {
  const form = formFromProfile({ contactEmail: " work@example.org " });
  assert.equal(profileInput(form, "member@pitt.edu").contactEmail, "work@example.org");
  assert.equal(profileInput({ ...form, contactEmail: "other@pitt.edu" }, "member@pitt.edu").contactEmail, "other@pitt.edu");
  for (const contactEmail of ["member@PITT.EDU", "bad", "Name <work@example.org>", "work@example.org\nBcc:bad@example.org"]) {
    assert.throws(() => profileInput({ ...form, contactEmail }, "member@pitt.edu"), /contact email/i);
  }
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

test("profile handles accept a pasted URL and keep only the username", () => {
  const form = formFromProfile({});
  const input = profileInput({
    ...form,
    githubUsername: "https://github.com/octocat",
    leetcodeUsername: "https://leetcode.com/u/octocat/",
    linkedinUsername: "www.linkedin.com/in/jordan-lee-1a2b3c?trk=nav",
  });
  assert.equal(input.githubUsername, "octocat");
  assert.equal(input.leetcodeUsername, "octocat");
  assert.equal(input.linkedinUsername, "jordan-lee-1a2b3c");

  // A bare handle is kept as typed, and blanks clear the field.
  assert.equal(
    profileInput({ ...form, githubUsername: "  octo-cat9 " }).githubUsername,
    "octo-cat9",
  );
  assert.equal(
    profileInput({ ...form, githubUsername: "   " }).githubUsername,
    null,
  );
});

test("profile handles reject shapes the platforms do not use", () => {
  const form = formFromProfile({});
  // "a-a-a-..." is 77 chars; the pattern alone accepted it because it consumes
  // the character after each hyphen, so maxLen has to catch it.
  const alternating = "a" + "-a".repeat(38);
  assert.equal(alternating.length, 77);
  for (const githubUsername of [
    "-octocat",
    "octocat-",
    "octo--cat",
    "a".repeat(40),
    "octo cat",
    alternating,
  ]) {
    assert.throws(() => profileInput({ ...form, githubUsername }), /GitHub/);
  }
  assert.throws(
    () => profileInput({ ...form, leetcodeUsername: "octo cat" }),
    /LeetCode/,
  );
  for (const linkedinUsername of ["ab", "jordan_lee"]) {
    assert.throws(
      () => profileInput({ ...form, linkedinUsername }),
      /LinkedIn/,
    );
  }
});

test("formFromProfile round-trips stored handles", () => {
  const form = formFromProfile({
    githubUsername: "octocat",
    leetcodeUsername: "octo.cat",
    linkedinUsername: "jordan-lee",
  });
  assert.equal(form.githubUsername, "octocat");
  const input = profileInput(form);
  assert.equal(input.leetcodeUsername, "octo.cat");
  assert.equal(input.linkedinUsername, "jordan-lee");
});

import test from "node:test";
import assert from "node:assert/strict";
import { formFromProfile, profileInput } from "../../src/lib/account/form.mjs";
import {
  suggestResumeProfile,
  validResumeSuggestions,
  resumeChanges,
  applyResumeSuggestions,
} from "../../src/lib/account/resume/suggestions.mjs";

const parse = (text, links = []) =>
  suggestResumeProfile({ lines: text.split("\n"), links }, "jlee@pitt.edu");
test("maps a student resume into existing valid profile inputs", () => {
  const result = parse(
    `Jordan Lee
Pittsburgh, PA
jlee@pitt.edu | jordan@example.com
github.com/jlee | linkedin.com/in/jordan-lee | https://jordan.dev/
EDUCATION
University of Pittsburgh
Bachelor of Science in Computer Science
August 2023 - May 2027
EXPERIENCE
Software Engineer Intern at Example Labs | May 2026 - Present
SUMMARY
I build accessible tools.
SKILLS
JavaScript`,
    ["https://leetcode.com/u/jlee"],
  );
  assert.deepEqual(result, {
    firstName: "Jordan",
    lastName: "Lee",
    graduationYear: "2027",
    majors: ["Computer Science"],
    githubUsername: "jlee",
    linkedinUsername: "jordan-lee",
    leetcodeUsername: "jlee",
    personalWebsite: "https://jordan.dev/",
    contactEmail: "jordan@example.com",
    location: "Pittsburgh, PA",
    currentCompany: "Example Labs",
    jobTitle: "Software Engineer Intern",
    bio: "I build accessible tools.",
  });
  assert.doesNotThrow(() =>
    profileInput(
      applyResumeSuggestions(formFromProfile({}), result),
      "jlee@pitt.edu",
    ),
  );
});
test("extracts embedded profile hyperlinks but not repositories, jobs, or lookalike hosts", () => {
  const result = parse("Jordan Lee", [
    "https://github.com/jlee",
    "https://github.com/club/project",
    "https://linkedin.com/in/jordan-lee",
    "https://github.com.evil.test/fake",
    "javascript:alert(1)",
    "https://company.example/jobs",
    "https://leetcode.com/problems/two-sum",
  ]);
  assert.equal(result.githubUsername, "jlee");
  assert.equal(result.linkedinUsername, "jordan-lee");
  assert.equal(result.leetcodeUsername, undefined);
  assert.equal(result.personalWebsite, undefined);
});
test("does not guess ambiguous links, dates, current roles, or contact email", () => {
  const result = parse(`Jordan Lee
a@example.com b@example.com
github.com/one github.com/two
Education
University One | Computer Science | 2024
University Two | Data Science | 2026
Experience
Engineer at One | 2025 - Present
Analyst at Two | 2025 - Present`);
  for (const field of [
    "githubUsername",
    "graduationYear",
    "currentCompany",
    "jobTitle",
    "contactEmail",
  ])
    assert.equal(result[field], undefined, field);
});
test("prefers explicitly expected graduation and does not use past jobs as current employment", () => {
  const result = parse(`Élodie O’Neill
Education
University of Pittsburgh
Major: Mathematics
2023 - Present | Expected graduation: May 2028
Experience
Intern at Old Company | May 2024 - August 2024`);
  assert.equal(result.firstName, "Élodie");
  assert.equal(result.lastName, "O’Neill");
  assert.deepEqual(result.majors, ["Mathematics"]);
  assert.equal(result.graduationYear, "2028");
  assert.equal(result.currentCompany, undefined);
});
test("does not manufacture names or data from an empty or non-profile document", () => {
  assert.deepEqual(parse(""), {});
  assert.deepEqual(
    parse("Software Engineer\nSkills\nComputer Science\n2028"),
    {},
  );
});

test("does not treat a current education start year as graduation", () => {
  assert.equal(
    parse("Jordan Lee\nEducation\nComputer Science\n2024 - Present")
      .graduationYear,
    undefined,
  );
});

test("recognizes either explicit company/title order and skips ambiguous employment", () => {
  for (const line of [
    "Example Labs | Software Engineer | 2024 - Present",
    "Software Engineer | Example Labs | 2024 - Present",
  ]) {
    const result = parse(`Jordan Lee\nExperience\n${line}`);
    assert.equal(result.currentCompany, "Example Labs");
    assert.equal(result.jobTitle, "Software Engineer");
  }
  assert.equal(
    parse("Jordan Lee\nExperience\nOne | Two | 2024 - Present").currentCompany,
    undefined,
  );
});

test("plain portfolio domains are recognized without mistaking email domains for websites", () => {
  const result = parse("Jordan Lee\njordan@example.com | jordan.dev");
  assert.equal(result.personalWebsite, "https://jordan.dev/");
  assert.equal(result.contactEmail, "jordan@example.com");
});
test("filters individual invalid suggestions and never accepts privilege or preference fields", () => {
  assert.deepEqual(
    validResumeSuggestions(
      {
        firstName: "Jordan",
        lastName: "Bad\nName",
        contactEmail: "jlee@pitt.edu",
        majors: ["CS", "cs"],
        graduationYear: "9999",
        githubUsername: "bad/handle",
        bio: "x".repeat(2001),
        personalWebsite: "javascript:alert(1)",
        offersCoffee: true,
        roles: ["staff"],
      },
      "jlee@pitt.edu",
    ),
    { firstName: "Jordan" },
  );
});
test("preserves existing and unsaved values unless replaced by an identified field", () => {
  const form = formFromProfile({
    firstName: "Saved",
    lastName: "Name",
    currentCompany: "Keep",
    offersCoffee: true,
    majors: ["Physics"],
  });
  form.bio = "Unsaved bio";
  const suggestions = {
    firstName: "Jordan",
    majors: ["Computer Science", "Mathematics"],
    githubUsername: "jlee",
  };
  const changes = resumeChanges(form, suggestions);
  assert.deepEqual(
    changes.map(({ field, replaces }) => [field, replaces]),
    [
      ["firstName", true],
      ["majors", true],
      ["githubUsername", false],
    ],
  );
  const next = applyResumeSuggestions(form, suggestions);
  assert.equal(next.bio, "Unsaved bio");
  assert.equal(next.currentCompany, "Keep");
  assert.equal(next.lastName, "Name");
  assert.equal(next.offersCoffee, true);
  assert.deepEqual(next.majorOther, [false, true]);
  assert.equal(form.firstName, "Saved");
  assert.deepEqual(resumeChanges(next, suggestions), []);
});

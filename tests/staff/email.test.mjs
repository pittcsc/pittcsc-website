import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseCSV,
  guessMapping,
  matchesAudience,
  emptyAudience,
  makeCSV,
  draftContent,
} from "../../src/lib/staff/email.mjs";
test("CSV preview understands escaped quotes, commas, CRLF, and multiline names", () => {
  const rows = parseCSV(
    '\uFEFFFirst Name,Last Name,Email\r\n"A, B","O""Name",a@example.test\r\n"Multi\nline",Last,b@example.test\r\n',
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], "A, B");
  assert.equal(rows[1][1], 'O"Name');
  assert.equal(rows[2][0], "Multi\nline");
  assert.deepEqual(guessMapping(rows[0]), {
    firstName: 0,
    lastName: 1,
    email: 2,
  });
  assert.throws(() => parseCSV('"unfinished'), /not closed/);
});
test("general newsletters need no account, major, or graduation year; exclusions win", () => {
  const c = {
    subscribed: true,
    active: true,
    archived: false,
    blockedReason: "",
    tags: ["Newsletter"],
    majors: [],
    roles: [],
    attendance: [],
    graduationYear: null,
  };
  const a = emptyAudience();
  assert.equal(matchesAudience(c, a), true);
  a.conditions = [{ field: "major", value: "CS" }];
  assert.equal(matchesAudience(c, a), false);
  a.mode = "any";
  a.conditions.push({ field: "tag", value: "newsletter" });
  assert.equal(matchesAudience(c, a), true);
  a.exclusions = [{ field: "tag", value: "newsletter" }];
  assert.equal(matchesAudience(c, a), false);
  assert.equal(
    matchesAudience({ ...c, subscribed: false }, emptyAudience()),
    false,
  );
  assert.equal(
    matchesAudience({ ...c, subscribed: false }, emptyAudience(), false),
    true,
  );
});
test("exports escape formulas and quote CSV values", () => {
  assert.equal(
    makeCSV([["=SUM(A1)", 'a"b', "plain, value", " \t@bad"]]),
    '"\'=SUM(A1)","a""b","plain, value","\' \t@bad"',
  );
});
test("autosave comparison ignores server metadata but notices content and audience changes", () => {
  const d = {
    name: "News",
    subject: "Hello",
    preheader: "",
    blocks: [],
    audience: emptyAudience(),
    version: 1,
  };
  assert.equal(
    draftContent(d),
    draftContent({ ...d, version: 4, updatedAt: "later", editorName: "Other" }),
  );
  assert.notEqual(draftContent(d), draftContent({ ...d, subject: "Changed" }));
});

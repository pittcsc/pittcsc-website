import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MEMBER_RESULT_LIMIT,
  filterCommands,
  isApplePlatform,
  isPaletteShortcut,
  memberCommands,
  memberSearchPath,
  pageCommands,
  wrapIndex,
} from "../../src/lib/command-palette.mjs";

const labels = (identity) => pageCommands(identity).map((page) => page.label);
const memberPages = [
  "Dashboard",
  "Points",
  "Members",
  "Foundry",
  "My account",
  "Your submissions",
];
const staffPages = [
  "Staff",
  "User Management",
  "Events",
  "Point claims",
  "Attendance",
];

test("incomplete or missing identities get no commands", () => {
  assert.deepEqual(pageCommands(null), []);
  assert.deepEqual(pageCommands(undefined), []);
  assert.deepEqual(
    pageCommands({ complete: false, roles: ["member", "staff"] }),
    [],
  );
});

test("members see dashboard pages but no staff pages, in any role combination", () => {
  assert.deepEqual(labels({ complete: true, roles: ["member"] }), memberPages);
  assert.deepEqual(
    labels({ complete: true, roles: ["member", "foundry", "alumni"] }),
    memberPages,
  );
  assert.deepEqual(labels({ complete: true }), memberPages);
});

test("staff additionally see the staff home and every staff tool", () => {
  const pages = pageCommands({ complete: true, roles: ["member", "staff"] });
  const byLabel = Object.fromEntries(pages.map((page) => [page.label, page]));
  assert.deepEqual(
    pages.map((page) => page.label).sort(),
    [...memberPages, ...staffPages].sort(),
  );
  assert.equal(byLabel.Staff.to, "/dashboard/staff");
  assert.equal(
    byLabel["User Management"].to,
    "/dashboard/staff/user-management",
  );
  assert.equal(byLabel["My account"].to, "/dashboard/account");
  assert.equal(
    byLabel["Your submissions"].to,
    "/dashboard/points/submissions",
  );
});

test("command ids are unique so they can key list items and option ids", () => {
  const ids = pageCommands({ complete: true, roles: ["staff"] }).map(
    (page) => page.id,
  );
  assert.equal(new Set(ids).size, ids.length);
});

test("filtering is a case-insensitive substring match on label and keywords", () => {
  const pages = pageCommands({ complete: true, roles: ["staff"] });
  const filtered = (query) =>
    filterCommands(pages, query).map((page) => page.label);
  assert.equal(filtered("").length, pages.length);
  assert.equal(filtered("   ").length, pages.length);
  assert.deepEqual(filtered("POINT"), ["Points", "Point claims"]);
  assert.deepEqual(filtered("  my   ACC "), ["My account"]);
  assert.deepEqual(filtered("staff"), staffPages);
  assert.deepEqual(filtered("zzz"), []);
});

test("platform detection recognizes Apple devices only", () => {
  assert.equal(isApplePlatform({ platform: "MacIntel" }), true);
  assert.equal(isApplePlatform({ userAgentData: { platform: "macOS" } }), true);
  assert.equal(isApplePlatform({ platform: "iPad" }), true);
  assert.equal(isApplePlatform({ platform: "Win32" }), false);
  assert.equal(isApplePlatform({ platform: "Linux x86_64" }), false);
  assert.equal(isApplePlatform(undefined), false);
});

test("the shortcut is Cmd+K on Apple platforms and Ctrl+K elsewhere", () => {
  const key = (modifiers) => ({ key: "k", ...modifiers });
  assert.equal(isPaletteShortcut(key({ metaKey: true }), true), true);
  assert.equal(isPaletteShortcut(key({ ctrlKey: true }), true), false);
  assert.equal(isPaletteShortcut(key({ ctrlKey: true }), false), true);
  assert.equal(isPaletteShortcut(key({ metaKey: true }), false), false);
  assert.equal(isPaletteShortcut({ key: "K", ctrlKey: true }, false), true);
  assert.equal(isPaletteShortcut(key({}), false), false);
  assert.equal(isPaletteShortcut({ key: "j", ctrlKey: true }, false), false);
});

test("the shortcut ignores Shift, Alt, and mixed Cmd+Ctrl", () => {
  for (const apple of [true, false]) {
    const primary = apple ? { metaKey: true } : { ctrlKey: true };
    for (const extra of [
      { shiftKey: true },
      { altKey: true },
      { metaKey: true, ctrlKey: true },
    ]) {
      assert.equal(
        isPaletteShortcut({ key: "k", ...primary, ...extra }, apple),
        false,
        JSON.stringify({ apple, extra }),
      );
    }
  }
});

test("member search needs two characters and encodes the query", () => {
  assert.equal(memberSearchPath(""), null);
  assert.equal(memberSearchPath(" a "), null);
  assert.equal(memberSearchPath("ad"), "/members?q=ad&page=1");
  assert.equal(
    memberSearchPath("  Ada   Love&ace "),
    "/members?q=Ada+Love%26ace&page=1",
  );
});

test("member results are capped and link to profiles", () => {
  const members = Array.from({ length: 8 }, (_, index) => ({
    id: `id-${index}`,
    name: `Member ${index}`,
    majors: index === 0 ? ["Computer Science", "Math"] : [],
    graduationYear: index === 0 ? 2027 : null,
  }));
  const commands = memberCommands(members);
  assert.equal(commands.length, MEMBER_RESULT_LIMIT);
  assert.deepEqual(commands[0], {
    id: "member:id-0",
    label: "Member 0",
    detail: "Computer Science, Math · Class of 2027",
    to: "/dashboard/members/id-0",
  });
  assert.equal(commands[1].detail, "");
  assert.deepEqual(memberCommands(), []);
});

test("arrow navigation wraps around both ends", () => {
  assert.equal(wrapIndex(3, 3), 0);
  assert.equal(wrapIndex(-1, 3), 2);
  assert.equal(wrapIndex(1, 3), 1);
  assert.equal(wrapIndex(0, 0), -1);
});

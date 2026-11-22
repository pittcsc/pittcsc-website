import assert from "node:assert/strict";
import { test } from "node:test";
import {
  academicYearLabel,
  attendanceCSV,
  loadAttendanceReport,
  attendanceReportPath,
  formatAttendanceDate,
} from "../../src/lib/staff/attendance.mjs";
import { staffRoute } from "../../src/lib/staff/tools.mjs";

test("Attendance resolves under the staff dashboard and uses the current year by default", () => {
  assert.equal(
    staffRoute("/dashboard/staff/attendance").tool.slug,
    "attendance",
  );
  assert.equal(
    attendanceReportPath({ sort: "desc", page: 1 }),
    "/staff/attendance",
  );
  assert.equal(
    attendanceReportPath({
      year: 2025,
      query: "Ada & Grace",
      sort: "asc",
      page: 2,
    }),
    "/staff/attendance?year=2025&q=Ada+%26+Grace&sort=asc&page=2",
  );
});

test("attendance page requests encode the minimum along with the other filters", () => {
  assert.equal(
    attendanceReportPath({ year: 2025, query: "Ada", sort: "asc", minEvents: 4, page: 3 }),
    "/staff/attendance?year=2025&q=Ada&sort=asc&minEvents=4&page=3",
  );
});

test("dates use Pittsburgh time and years display both halves", () => {
  assert.equal(academicYearLabel(2025), "25–26");
  assert.equal(formatAttendanceDate("2026-08-01T03:59:59Z"), "Jul 31, 2026");
  assert.equal(formatAttendanceDate("2026-08-01T04:00:00Z"), "Aug 1, 2026");
});

test("a legacy report applies the minimum before paginating and exporting", async () => {
  const filters = { year: 2025, query: "Fixture", sort: "asc", minEvents: 4, page: 1 };
  const legacyPages = [
    [{ id: "1", eventsAttended: 1 }, { id: "2", eventsAttended: 3 }],
    [{ id: "3", eventsAttended: 4 }, { id: "4", eventsAttended: 5 }],
    [{ id: "5", eventsAttended: 6 }],
  ];
  const request = async (path) => {
    const query = new URL(path, "https://example.test").searchParams;
    assert.equal(query.get("year"), "2025");
    assert.equal(query.get("q"), "Fixture");
    assert.equal(query.get("sort"), "asc");
    const index = Number(query.get("page") || 1) - 1;
    return { year: 2025, members: legacyPages[index], hasMore: index < 2 };
  };
  const first = await loadAttendanceReport(request, filters);
  assert.deepEqual(first.members.map(({ id }) => id), ["3", "4"]);
  assert.equal(first.hasMore, true);
  const second = await loadAttendanceReport(request, { ...filters, page: 2 });
  assert.deepEqual(second.members.map(({ id }) => id), ["5"]);
  assert.equal(second.hasMore, false);
  const exported = await loadAttendanceReport(request, { ...filters, page: 2 }, undefined, { all: true });
  assert.deepEqual(exported.members.map(({ id }) => id), ["3", "4", "5"]);
});

test("a current API can return a filtered table page in one request", async () => {
  const report = { minEvents: 4, members: [{ eventsAttended: 4 }], hasMore: true };
  let calls = 0;
  const result = await loadAttendanceReport(async () => {
    calls++;
    return report;
  }, { minEvents: 4, page: 2 });
  assert.equal(result, report);
  assert.equal(calls, 1);
});

test("CSV has one row per member, the displayed columns, and no IDs", () => {
  const csv = attendanceCSV([
    {
      id: "internal-id",
      firstName: "Ada",
      lastName: "Lovelace, Jr.",
      eventsAttended: 4,
      lastEventTitle: 'Workshop "A"',
      lastEventStart: "2026-08-01T03:59:59Z",
    },
    { id: "other-id", preferredName: "=Spreadsheet", eventsAttended: 0 },
  ]);
  assert.equal(csv, [
    "Member,Events attended,Last event attended",
    '"Ada Lovelace, Jr.",4,"Workshop ""A"" (Jul 31, 2026)"',
    "'=Spreadsheet,0,—",
    "",
  ].join("\r\n"));
});

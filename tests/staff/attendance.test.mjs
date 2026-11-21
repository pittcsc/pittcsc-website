import assert from "node:assert/strict";
import { test } from "node:test";
import {
  academicYearLabel,
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

test("dates use Pittsburgh time and years display both halves", () => {
  assert.equal(academicYearLabel(2025), "25–26");
  assert.equal(formatAttendanceDate("2026-08-01T03:59:59Z"), "Jul 31, 2026");
  assert.equal(formatAttendanceDate("2026-08-01T04:00:00Z"), "Aug 1, 2026");
});

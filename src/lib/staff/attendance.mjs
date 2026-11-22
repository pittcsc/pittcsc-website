import { EVENT_TIMEZONE } from "./events.mjs";

const eventDate = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  dateStyle: "medium",
});

export function formatAttendanceDate(startsAt) {
  return eventDate.format(new Date(startsAt));
}

export function academicYearLabel(year) {
  const short = (value) => String(value).slice(-2);
  return `${short(year)}–${short(year + 1)}`;
}

export function attendanceReportPath({ year, query, sort, page, minEvents, csv }) {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (query) params.set("q", query);
  if (sort === "asc") params.set("sort", sort);
  if (minEvents) params.set("minEvents", String(minEvents));
  if (csv) params.set("format", "csv");
  else if (page > 1) params.set("page", String(page));
  return params.size ? `/staff/attendance?${params}` : "/staff/attendance";
}

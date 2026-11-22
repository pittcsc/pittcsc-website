import { EVENT_TIMEZONE } from "./events.mjs";
import { displayName } from "./user-management.mjs";

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

export function attendanceReportPath({ year, query, sort, page, minEvents }) {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (query) params.set("q", query);
  if (sort === "asc") params.set("sort", sort);
  if (minEvents) params.set("minEvents", String(minEvents));
  if (page > 1) params.set("page", String(page));
  return params.size ? `/staff/attendance?${params}` : "/staff/attendance";
}

export async function loadAttendanceReport(
  request,
  filters,
  options,
  { all = false } = {},
) {
  const { page = 1, minEvents = 0 } = filters;
  const getPage = (page, year = filters.year) =>
    request(attendanceReportPath({ ...filters, page, year }), options);
  const firstPage = all ? 1 : page;
  const report = await getPage(firstPage);
  if (!all && (!minEvents || report.minEvents === minEvents)) return report;

  // Older APIs ignore minEvents. Filter across their pages before slicing.
  const first = firstPage === 1 ? report : await getPage(1, report.year);
  const pageSize = first.members.length;
  const end = page * pageSize;
  const members = [];
  let current = first;
  let currentPage = 1;
  for (;;) {
    members.push(...current.members.filter((member) => member.eventsAttended >= minEvents));
    if (!current.hasMore || (!all && members.length > end)) break;
    current = await getPage(++currentPage, first.year);
  }
  if (all) return { ...first, members, hasMore: false };
  return {
    ...first,
    page,
    members: members.slice(end - pageSize, end),
    hasMore: members.length > end,
  };
}

export function attendanceMemberRow(member) {
  return {
    name: displayName(member),
    count: member.eventsAttended,
    eventTitle: member.lastEventTitle,
    eventStart: member.lastEventStart,
    eventDate: member.lastEventStart ? formatAttendanceDate(member.lastEventStart) : "",
  };
}

function csvCell(value) {
  let text = String(value);
  // A name or event title can begin with a spreadsheet formula marker.
  if (/^[\r\n\t]/.test(text) || /^[=+\-@＝＋－＠]/u.test(text.trimStart())) {
    text = "'" + text;
  }
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export function attendanceCSV(members) {
  const rows = [
    ["Member", "Events attended", "Last event attended"],
    ...members.map((member) => {
      const { name, count, eventTitle, eventDate } = attendanceMemberRow(member);
      return [name, count, eventDate ? `${eventTitle} (${eventDate})` : "—"];
    }),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

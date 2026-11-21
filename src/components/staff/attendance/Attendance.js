import React, { useEffect, useState } from "react";
import { Link } from "gatsby";
import {
  academicYearLabel,
  attendanceReportPath,
  formatAttendanceDate,
} from "../../../lib/staff/attendance.mjs";
import { STAFF_BASE } from "../../../lib/staff/tools.mjs";
import { displayName } from "../../../lib/staff/user-management.mjs";
import "../../../styles/staff/attendance.scss";

export default function Attendance({ identity, request, revalidate }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    query: "",
    year: "",
    sort: "desc",
    page: 1,
  });
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const path = attendanceReportPath(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((previous) => {
        const next = query.trim();
        return previous.query === next
          ? previous
          : { ...previous, query: next, page: 1 };
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    request(path, { userID: identity.id, signal: controller.signal })
      .then((report) => {
        if (!controller.signal.aborted) setResponse({ path, attempt, report });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setResponse((previous) => ({
          path,
          attempt,
          error,
          report: previous?.report,
        }));
        if (error.status === 401 || error.status === 403) void revalidate();
      });
    return () => controller.abort();
  }, [identity.id, request, revalidate, path, attempt]);

  function updateFilters(changes) {
    setFilters((previous) => ({ ...previous, page: 1, ...changes }));
  }

  const settled = response?.path === path && response.attempt === attempt;
  const loaded = response?.report;
  const error = settled && response.error;
  const report = settled && !error ? loaded : null;
  const years = loaded
    ? Array.from(
        { length: loaded.currentYear - loaded.firstYear + 1 },
        (_, index) => loaded.currentYear - index,
      )
    : [];

  return (
    <section className="csc-staff csc-staff-attendance">
      <Link to={STAFF_BASE} className="csc-staff-back">
        ← Staff Dashboard
      </Link>
      <h1>Attendance</h1>
      <div className="csc-attendance-filters">
        <div role="search" aria-label="Member attendance">
          <label htmlFor="attendance-search">Search by name</label>
          <input
            id="attendance-search"
            type="search"
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="attendance-year">Academic year</label>
          <select
            id="attendance-year"
            value={filters.year || loaded?.currentYear || ""}
            disabled={!loaded}
            onChange={(event) => updateFilters({ year: event.target.value })}
          >
            {!loaded && <option value="">Current academic year</option>}
            {years.map((year) => (
              <option key={year} value={year}>
                {academicYearLabel(year)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <div className="csc-attendance-error">
          <p role="alert">{error.message}</p>
          <button
            className="csc-auth-secondary"
            onClick={() => setAttempt(attempt + 1)}
          >
            Try again
          </button>
        </div>
      )}
      <div className="csc-attendance-table">
        <table aria-label="Attendance by member" aria-busy={!settled}>
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th
                scope="col"
                aria-sort={filters.sort === "asc" ? "ascending" : "descending"}
              >
                <button
                  className="csc-auth-secondary"
                  onClick={() =>
                    updateFilters({
                      sort: filters.sort === "asc" ? "desc" : "asc",
                    })
                  }
                >
                  Events attended{" "}
                  <span aria-hidden="true">
                    {filters.sort === "asc" ? "↑" : "↓"}
                  </span>
                </button>
              </th>
              <th scope="col">Last event attended</th>
            </tr>
          </thead>
          <tbody>
            {report?.members.map((member) => (
              <tr key={member.id}>
                <th scope="row">{displayName(member)}</th>
                <td>{member.eventsAttended}</td>
                <td>
                  {member.lastEventStart ? (
                    <>
                      {member.lastEventTitle}
                      <time dateTime={member.lastEventStart}>
                        {formatAttendanceDate(member.lastEventStart)}
                      </time>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!error && (
          <p role="status" className="csc-attendance-status">
            {!settled
              ? "Loading attendance…"
              : report?.members.length === 0
                ? "No matching members."
                : ""}
          </p>
        )}
      </div>
      {(filters.page > 1 || report?.hasMore) && (
        <nav className="csc-attendance-pages" aria-label="Attendance pages">
          <button
            className="csc-auth-secondary"
            disabled={filters.page <= 1 || !settled}
            onClick={() => updateFilters({ page: filters.page - 1 })}
          >
            Previous
          </button>
          <span>Page {filters.page}</span>
          <button
            className="csc-auth-secondary"
            disabled={!report?.hasMore}
            onClick={() => updateFilters({ page: filters.page + 1 })}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Link } from "gatsby";
import {
  academicYearLabel,
  attendanceCSV,
  attendanceMemberRow,
  loadAttendanceReport,
} from "../../../lib/staff/attendance.mjs";
import { STAFF_BASE } from "../../../lib/staff/tools.mjs";
import "../../../styles/staff/attendance.scss";

export default function Attendance({ identity, request, revalidate }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    query: "",
    year: "",
    sort: "desc",
    page: 1,
    minEvents: 0,
  });
  const [minimumDraft, setMinimumDraft] = useState("");
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const activeExport = useRef(null);
  const filterMenu = useRef(null);
  const filterButton = useRef(null);

  useEffect(() => {
    function dismissOnOutsideClick(event) {
      const menu = filterMenu.current;
      if (menu?.open && !menu.contains(event.target)) menu.open = false;
    }
    document.addEventListener("pointerdown", dismissOnOutsideClick);
    return () => document.removeEventListener("pointerdown", dismissOnOutsideClick);
  }, []);

  useEffect(() => {
    setExporting(false);
    setExportError("");
    return () => {
      activeExport.current?.abort();
      activeExport.current = null;
    };
  }, [identity.id]);

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
    loadAttendanceReport(request, filters, { userID: identity.id, signal: controller.signal })
      .then((report) => {
        if (!controller.signal.aborted) setResponse({ filters, attempt, report });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setResponse((previous) => ({
          filters,
          attempt,
          error,
          report: previous?.report,
        }));
        if (error.status === 401 || error.status === 403) void revalidate();
      });
    return () => controller.abort();
  }, [identity.id, request, revalidate, filters, attempt]);

  function updateFilters(changes) {
    setFilters((previous) => ({ ...previous, page: 1, ...changes }));
  }

  const settled = response?.filters === filters && response.attempt === attempt;
  const loaded = response?.report;
  const error = settled && response.error;
  const report = settled && !error ? loaded : null;
  const years = loaded
    ? Array.from(
        { length: loaded.currentYear - loaded.firstYear + 1 },
        (_, index) => loaded.currentYear - index,
      )
    : [];

  function closeFilterMenu() {
    filterMenu.current.open = false;
    filterButton.current.focus();
  }

  function applyMinimum(minEvents) {
    updateFilters({ minEvents, query: query.trim() });
    closeFilterMenu();
  }

  async function exportCSV() {
    if (activeExport.current || !report) return;
    const controller = new AbortController();
    activeExport.current = controller;
    setExportError("");
    setExporting(true);
    try {
      const year = report.year;
      const { members } = await loadAttendanceReport(
        request,
        { ...filters, year },
        { userID: identity.id, signal: controller.signal },
        { all: true },
      );
      if (controller.signal.aborted) return;
      const blob = new Blob([attendanceCSV(members)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pittcsc-attendance-${year}-${year + 1}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setExportError(failure.message || "Could not export attendance. Try again.");
      if (failure.status === 401 || failure.status === 403) void revalidate();
    } finally {
      if (activeExport.current === controller) {
        activeExport.current = null;
        setExporting(false);
      }
    }
  }

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
        <details
          className="csc-attendance-filter-menu"
          ref={filterMenu}
          onToggle={(event) => {
            if (event.currentTarget.open) setMinimumDraft(String(filters.minEvents || ""));
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && event.currentTarget.open) {
              event.preventDefault();
              closeFilterMenu();
            }
          }}
        >
          <summary ref={filterButton} className="csc-auth-secondary">Filters</summary>
          <form
            className="csc-attendance-filter-panel"
            onSubmit={(event) => {
              event.preventDefault();
              applyMinimum(Number(minimumDraft));
            }}
          >
            <label htmlFor="attendance-min-events">Minimum events attended</label>
            <input
              id="attendance-min-events"
              type="number"
              inputMode="numeric"
              min={0}
              max={2147483647}
              step={1}
              value={minimumDraft}
              onChange={(event) => setMinimumDraft(event.target.value)}
            />
            <div className="csc-attendance-filter-actions">
              <button type="button" className="csc-auth-secondary" onClick={() => applyMinimum(0)}>
                Clear
              </button>
              <button type="submit">Apply filters</button>
            </div>
          </form>
        </details>
        <button
          type="button"
          className="csc-auth-secondary"
          disabled={!report || exporting || query.trim() !== filters.query}
          onClick={() => void exportCSV()}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {filters.minEvents > 0 && (
        <p className="csc-attendance-active-filter">
          Minimum events attended · {filters.minEvents}
        </p>
      )}
      {exportError && <p role="alert">{exportError}</p>}
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
            {report?.members.map((member) => {
              const { name, count, eventTitle, eventStart, eventDate } = attendanceMemberRow(member);
              return (
                <tr key={member.id}>
                  <th scope="row">{name}</th>
                  <td>{count}</td>
                  <td>
                    {eventStart ? (
                      <>
                        {eventTitle}
                        <time dateTime={eventStart}>{eventDate}</time>
                      </>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
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

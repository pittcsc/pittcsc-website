import React, { useEffect, useRef, useState } from "react";
import { Link } from "gatsby";
import { STAFF_BASE } from "../../../lib/staff/tools.mjs";
import {
  auditLabels,
  calendarLink,
  eventFilters,
  eventForm,
  eventPath,
  formatEventTime,
  syncLabel,
  syncMessage,
} from "../../../lib/staff/events.mjs";
import "../../../styles/staff/events.scss";
import EventAttendance from "./EventAttendance";

export default function Events({ identity, request, revalidate }) {
  const [filter, setFilter] = useState("upcoming");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);

  const denied = (failure) => {
    if (failure.status === 401 || failure.status === 403) void revalidate();
  };

  useEffect(() => {
    if (selected) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request(`/staff/events?filter=${filter}&page=${page}`, {
      userID: identity.id,
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setResults(value);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(failure.message);
        denied(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identity.id, request, filter, page, attempt, selected]);

  return (
    <section className="csc-staff csc-staff-events">
      <Link to={STAFF_BASE} className="csc-staff-back">
        ← Staff Dashboard
      </Link>
      {selected ? (
        <EventEditor
          key={selected.id}
          selected={selected}
          identity={identity}
          request={request}
          denied={denied}
          onBack={() => setSelected(null)}
        />
      ) : (
        <>
          <div className="csc-events-heading">
            <div>
              <h1>Events</h1>
              <p>Create and manage events on the CSC Google Calendar.</p>
            </div>
            <button
              onClick={() =>
                setSelected({ id: crypto.randomUUID(), isNew: true })
              }
            >
              Create event
            </button>
          </div>
          <p className="csc-events-note">
            All times are America/New_York (Eastern Time).
          </p>
          <div
            className="csc-events-filters"
            role="group"
            aria-label="Filter events"
          >
            {eventFilters.map(([value, label]) => (
              <button
                key={value}
                className="csc-auth-secondary"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button
                className="csc-auth-secondary"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Retry loading events
              </button>
            </div>
          )}
          {loading ? (
            <p role="status">Loading events…</p>
          ) : (
            !error &&
            results && (
              <>
                {results.events.length === 0 && (
                  <p>
                    No {filter === "all" ? "" : `${filter} `}events to show.
                  </p>
                )}
                <ul className="csc-events-list">
                  {results.events.map((event) => (
                    <li key={event.id}>
                      <div className="csc-events-row-heading">
                        <h2>
                          <button
                            className="csc-events-title"
                            onClick={() => setSelected({ id: event.id })}
                          >
                            {event.title}
                          </button>
                        </h2>
                        {event.status === "cancelled" && (
                          <span className="csc-events-badge">Cancelled</span>
                        )}
                      </div>
                      <p>
                        {formatEventTime(event.startsAt)} –{" "}
                        {formatEventTime(event.endsAt)}
                      </p>
                      <p>{event.location}</p>
                      <span
                        className={`csc-events-sync csc-events-sync-${event.syncStatus}`}
                      >
                        {syncLabel(event)}
                      </span>
                    </li>
                  ))}
                </ul>
                {(page > 1 || results.hasMore) && (
                  <nav className="csc-auth-actions" aria-label="Event pages">
                    <button
                      className="csc-auth-secondary"
                      disabled={page <= 1}
                      onClick={() => setPage((n) => n - 1)}
                    >
                      Previous
                    </button>
                    <span>Page {page}</span>
                    <button
                      className="csc-auth-secondary"
                      disabled={!results.hasMore}
                      onClick={() => setPage((n) => n + 1)}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )
          )}
        </>
      )}
    </section>
  );
}

function EventEditor({ selected, identity, request, denied, onBack }) {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(() => eventForm());
  const [loading, setLoading] = useState(!selected.isNew);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const lifetime = useRef(null);
  const busy = useRef(false);

  const call = (path, options = {}) =>
    request(path, {
      userID: identity.id,
      signal: lifetime.current.signal,
      ...options,
    });
  const accept = (value, replaceForm = true) => {
    setRecord(value);
    if (replaceForm) setForm(eventForm(value));
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(eventForm(record));

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    if (!selected.isNew) void reload();
    return () => controller.abort();
  }, [selected.id, identity.id, request]);

  async function loadHistory(before = 0) {
    setHistoryBusy(true);
    setHistoryError("");
    try {
      const value = await call(
        `${eventPath(selected.id, "history")}${before ? `?before=${before}` : ""}`,
      );
      if (lifetime.current.signal.aborted) return;
      setHistory((old) => ({
        ...value,
        entries: before
          ? [...(old?.entries || []), ...value.entries]
          : value.entries,
      }));
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      setHistoryError(failure.message);
      denied(failure);
    } finally {
      if (!lifetime.current.signal.aborted) setHistoryBusy(false);
    }
  }

  async function reload() {
    if (busy.current) return;
    setLoading(true);
    setError("");
    try {
      const value = await call(eventPath(selected.id));
      if (lifetime.current.signal.aborted) return;
      accept(value);
      setConflict(false);
      setConfirming(false);
      void loadHistory();
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      setError(failure.message);
      denied(failure);
    } finally {
      if (!lifetime.current.signal.aborted) setLoading(false);
    }
  }

  async function mutate(action) {
    if (busy.current) return;
    busy.current = true;
    setPending(action);
    setError("");
    setNotice("");
    setConfirming(false);
    try {
      const value = await call(
        eventPath(selected.id, action === "save" ? "" : action),
        {
          method: action === "save" ? "PUT" : "POST",
          ...(action !== "sync" && {
            contentType: "application/json",
            body: JSON.stringify(
              action === "save" ? form : { version: record.version },
            ),
          }),
        },
      );
      if (lifetime.current.signal.aborted) return;
      accept(value);
      setConflict(false);
      setNotice(
        action === "save"
          ? "Event saved."
          : action === "cancel"
            ? "Event cancelled."
            : value.syncStatus === "synced"
              ? "Calendar updated."
              : "Calendar sync needs attention.",
      );
      void loadHistory();
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      setError(failure.message);
      setConflict(failure.status === 409);
      denied(failure);
    } finally {
      busy.current = false;
      if (!lifetime.current.signal.aborted) setPending("");
    }
  }

  function back() {
    if (!dirty || window.confirm("Discard your unsaved event changes?"))
      onBack();
  }

  const cancelled = record?.status === "cancelled";
  const url = calendarLink(record?.calendarUrl);
  const disabled = Boolean(pending) || cancelled;
  return (
    <>
      <button
        className="csc-events-back csc-auth-secondary"
        disabled={Boolean(pending)}
        onClick={back}
      >
        ← All events
      </button>
      <h1>
        {record
          ? cancelled
            ? "Cancelled event"
            : "Edit event"
          : selected.isNew
            ? "Create event"
            : "Event"}
      </h1>
      {loading ? (
        <p role="status">Loading event…</p>
      ) : (
        <>
          {record && (
            <div
              className={`csc-events-delivery csc-events-sync-${record.syncStatus}`}
            >
              <strong>{syncLabel(record)}</strong>
              {syncMessage(record) && <p role="alert">{syncMessage(record)}</p>}
              {url && record.status !== "cancelled" && (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Open in Google Calendar ↗
                </a>
              )}
            </div>
          )}
          {(record || selected.isNew) && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void mutate("save");
              }}
            >
              <fieldset disabled={disabled} className="csc-events-fields">
                <label htmlFor="event-title">Title</label>
                <input
                  id="event-title"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <label htmlFor="event-location">Location</label>
                <input
                  id="event-location"
                  required
                  maxLength={500}
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
                <p className="csc-events-note" id="event-timezone">
                  America/New_York (Eastern Time)
                </p>
                <div className="csc-events-times">
                  <div>
                    <label htmlFor="event-start">Start</label>
                    <input
                      id="event-start"
                      type="datetime-local"
                      required
                      min="2000-01-01T00:00"
                      max="2100-12-31T23:59"
                      step={60}
                      aria-describedby="event-timezone"
                      value={form.start}
                      onChange={(e) =>
                        setForm({ ...form, start: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="event-end">End</label>
                    <input
                      id="event-end"
                      type="datetime-local"
                      required
                      min={form.start || "2000-01-01T00:00"}
                      max="2100-12-31T23:59"
                      step={60}
                      aria-describedby="event-timezone"
                      value={form.end}
                      onChange={(e) =>
                        setForm({ ...form, end: e.target.value })
                      }
                    />
                  </div>
                </div>
                <label htmlFor="event-description">
                  Description{" "}
                  <span className="csc-events-optional">(optional)</span>
                </label>
                <textarea
                  id="event-description"
                  rows={5}
                  maxLength={5000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </fieldset>
              {!cancelled && (
                <>
                  <p className="csc-events-note">
                    Saving publishes these details to the public CSC Google
                    Calendar.
                  </p>
                  <button type="submit" disabled={Boolean(pending) || conflict}>
                    {pending === "save" ? "Saving and syncing…" : "Save event"}
                  </button>
                </>
              )}
            </form>
          )}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          {(conflict || (!record && !selected.isNew && error)) && (
            <button
              className="csc-auth-secondary"
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm(
                    "Reload the saved event and discard your unsaved changes?",
                  )
                )
                  void reload();
              }}
            >
              Reload saved event
            </button>
          )}
          {record && (
            <>
              <EventAttendance
                record={record}
                identity={identity}
                request={request}
                denied={denied}
              />
              <div className="csc-auth-actions csc-events-actions">
                <button
                  className="csc-auth-secondary"
                  disabled={Boolean(pending) || dirty}
                  onClick={() => void mutate("sync")}
                >
                  {pending === "sync"
                    ? "Syncing…"
                    : cancelled
                      ? "Retry calendar removal"
                      : "Sync to Calendar"}
                </button>
                {!cancelled && (
                  <button
                    className="csc-auth-secondary csc-events-danger"
                    disabled={Boolean(pending)}
                    onClick={() => setConfirming(true)}
                  >
                    Cancel event
                  </button>
                )}
              </div>
              {dirty && (
                <p className="csc-events-note">
                  Save your changes before syncing the calendar.
                </p>
              )}
              {confirming && (
                <div
                  className="csc-events-confirm"
                  role="group"
                  aria-label="Confirm cancellation"
                >
                  <p>
                    Cancel “{record.title}” and remove it from Google Calendar?
                    The event and its history will remain here.
                  </p>
                  <div className="csc-auth-actions">
                    <button onClick={() => void mutate("cancel")}>
                      Yes, cancel event
                    </button>
                    <button
                      className="csc-auth-secondary"
                      onClick={() => setConfirming(false)}
                    >
                      Keep event
                    </button>
                  </div>
                </div>
              )}
              <section
                className="csc-events-history"
                aria-label="Event history"
              >
                <h2>History</h2>
                {historyError && (
                  <>
                    <p role="alert">{historyError}</p>
                    <button
                      className="csc-auth-secondary"
                      disabled={historyBusy}
                      onClick={() => void loadHistory()}
                    >
                      Retry history
                    </button>
                  </>
                )}
                <ol>
                  {history?.entries.map((entry) => (
                    <li key={entry.id}>
                      <strong>
                        {auditLabels[entry.action] || entry.action}
                      </strong>
                      <span>
                        {entry.actorName} · {formatEventTime(entry.createdAt)}
                      </span>
                      <details>
                        <summary>View recorded details</summary>
                        <p>{entry.snapshot.title}</p>
                        <p>{entry.snapshot.location}</p>
                        <p>
                          {formatEventTime(entry.snapshot.startsAt)} –{" "}
                          {formatEventTime(entry.snapshot.endsAt)}
                        </p>
                        {entry.snapshot.description && (
                          <p className="csc-events-description">
                            {entry.snapshot.description}
                          </p>
                        )}
                        <p>
                          Status: {entry.snapshot.status} ·{" "}
                          {syncLabel(entry.snapshot)}
                        </p>
                      </details>
                    </li>
                  ))}
                </ol>
                {historyBusy && <p role="status">Loading history…</p>}
                {history?.hasMore && (
                  <button
                    className="csc-auth-secondary"
                    disabled={historyBusy}
                    onClick={() => void loadHistory(history.entries.at(-1).id)}
                  >
                    Load older entries
                  </button>
                )}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}

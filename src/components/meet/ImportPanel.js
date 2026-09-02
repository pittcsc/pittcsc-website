import React, { useRef, useState } from "react";
import {
  applyBusyIntervals,
  calendarName,
  mergeIntervals,
  parseIcs,
  summarizeIntervals,
} from "../../lib/meet/calendar";
import { fetchGoogleBusy, googleConfigured } from "../../lib/meet/gcal";

const BUTTON =
  "px-4 py-2 text-sm font-bold bg-white border border-gray-300 rounded-full hover:border-gray-500 transition disabled:opacity-50";

/**
 * Optional shortcut, shown right above the grid you'd otherwise fill in by hand: it
 * selects every slot your calendar leaves open, so the common case is "import, fix one
 * thing, done".
 *
 * Calendars are additive, and that is the whole point of keeping a list here rather
 * than a single parsed result. Nobody's week lives in one file: Google exports one
 * .ics per calendar, so a student's classes and their club meetings and their shifts
 * arrive separately. An import that replaced the last one made two uploads look like
 * a bug — the second silently undid the first — and left the person with a grid that
 * hid whichever half they loaded first.
 *
 * Each source is listed by the calendar's own name, because the commonest failure is
 * uploading the wrong file, and "School" vs "To do" on screen catches that instantly.
 * Removing one re-derives the selection from whatever is left, so a wrong file is one
 * click to undo rather than a page reload.
 *
 * Google is asked for the `calendar.freebusy` scope and nothing else — that grant
 * returns opaque start/end pairs, so event titles, guests and locations never reach the
 * browser in the first place. Busy intervals become slot states here, on this machine,
 * and only one digit per half hour is ever sent to the server.
 */
export default function ImportPanel({ slots, states, manual, onImport, windowMs }) {
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  /**
   * Re-derive the whole selection from every loaded calendar at once. Always a fresh
   * union rather than a patch on the last result, so adding and removing a file leave
   * you exactly where you started.
   */
  const apply = (nextSources) => {
    const intervals = mergeIntervals(nextSources.flatMap((s) => s.intervals));
    onImport(
      applyBusyIntervals(slots, intervals, { previous: states, manual }),
      nextSources.some((s) => s.kind === "ics") ? "ics" : "google"
    );
    setSources(nextSources);

    if (!nextSources.length) {
      setStatus(null);
      return;
    }
    const many = nextSources.length > 1;
    setStatus({
      kind: "ok",
      text: intervals.length
        ? `Selected the times ${
            many ? `those ${nextSources.length} calendars are` : "your calendar is"
          } open, around ${summarizeIntervals(intervals, windowMs.tz)}. Adjust anything that's off.`
        : `${many ? "Those calendars are" : "Your calendar is"} clear for this whole window, so everything is selected.`,
    });
  };

  /** Later uploads of the same calendar replace it rather than double-counting it. */
  const put = (list, entry) => [...list.filter((s) => s.id !== entry.id), entry];

  const runGoogle = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const intervals = await fetchGoogleBusy({
        timeMinMs: windowMs.start,
        timeMaxMs: windowMs.end,
      });
      apply(put(sources, { id: "google", kind: "google", label: "Google Calendar", intervals }));
    } catch (err) {
      if (!err.cancelled) setStatus({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const readFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    setStatus(null);
    try {
      let next = sources;
      const rejected = [];
      for (const file of files) {
        const text = await file.text();
        if (!/BEGIN:VCALENDAR/i.test(text)) {
          rejected.push(file.name);
          continue;
        }
        next = put(next, {
          id: `ics:${file.name}`,
          kind: "ics",
          label: calendarName(text) || file.name.replace(/\.ics$/i, ""),
          intervals: parseIcs(text, {
            windowStartMs: windowMs.start,
            windowEndMs: windowMs.end,
          }),
        });
      }
      if (next !== sources) apply(next);
      if (rejected.length) {
        setStatus({
          kind: "error",
          text: `${rejected.join(", ")} ${
            rejected.length === 1 ? "doesn't" : "don't"
          } look like a calendar export (.ics).`,
        });
      }
    } catch (err) {
      setStatus({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`px-4 py-3 border rounded-2xl transition ${
        dragOver ? "border-primary border-dashed bg-blue-50" : "border-gray-200 bg-white"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        readFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">
            {dragOver ? "Drop the .ics files" : "Import your calendar"}
          </p>
          <p className="text-gray-500 text-sm">
            We&apos;ll select when you&apos;re free. Add as many calendars as you like
            — only free/busy is read, never event details.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {googleConfigured() && (
            <button type="button" className={BUTTON} onClick={runGoogle} disabled={busy}>
              {busy ? "Checking…" : "Import Google Calendar"}
            </button>
          )}
          <button
            type="button"
            className={BUTTON}
            onClick={() => fileRef.current && fileRef.current.click()}
            disabled={busy}
          >
            {sources.some((s) => s.kind === "ics") ? "Add another .ics" : "Upload .ics"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            multiple
            className="meet-sr"
            onChange={(e) => {
              readFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {sources.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-200 rounded-full bg-gray-50"
            >
              <span className="font-semibold truncate max-w-[16rem]">{s.label}</span>
              <button
                type="button"
                className="text-gray-400 hover:text-red-700"
                aria-label={`Remove ${s.label}`}
                onClick={() => apply(sources.filter((x) => x.id !== s.id))}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      {status && (
        <p
          className={`mt-3 text-sm ${
            status.kind === "error" ? "text-red-700" : "text-gray-500"
          }`}
          role="status"
        >
          {status.text}
        </p>
      )}
    </div>
  );
}

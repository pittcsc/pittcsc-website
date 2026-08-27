import React, { useRef, useState } from "react";
import {
  applyBusyIntervals,
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
 * Google is asked for the `calendar.freebusy` scope and nothing else — that grant
 * returns opaque start/end pairs, so event titles, guests and locations never reach the
 * browser in the first place. Busy intervals become slot states here, on this machine,
 * and only one digit per half hour is ever sent to the server.
 */
export default function ImportPanel({ slots, states, manual, onImport, windowMs }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const ingest = (intervals, source, tz) => {
    const next = applyBusyIntervals(slots, intervals, { previous: states, manual });
    onImport(next, source);
    setStatus({
      kind: "ok",
      text: intervals.length
        ? `Selected the times your calendar is open, around ${summarizeIntervals(
            intervals,
            tz
          )}. Adjust anything that's off.`
        : "Your calendar is clear for this whole window, so everything is selected.",
    });
  };

  const runGoogle = async () => {
    setBusy(true);
    setStatus(null);
    try {
      ingest(
        await fetchGoogleBusy({ timeMinMs: windowMs.start, timeMaxMs: windowMs.end }),
        "google",
        windowMs.tz
      );
    } catch (err) {
      if (!err.cancelled) setStatus({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) {
        throw new Error("That doesn't look like a calendar export (.ics).");
      }
      ingest(
        parseIcs(text, { windowStartMs: windowMs.start, windowEndMs: windowMs.end }),
        "ics",
        windowMs.tz
      );
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
        readFile(e.dataTransfer.files && e.dataTransfer.files[0]);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">
            {dragOver ? "Drop the .ics file" : "Import your calendar"}
          </p>
          <p className="text-gray-500 text-sm">
            We&apos;ll select when you&apos;re free. Only free/busy is read — never
            event details.
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
            Upload .ics
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            className="meet-sr"
            onChange={(e) => {
              readFile(e.target.files && e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

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

import React, { useEffect, useRef, useState } from "react";
import { eventPath } from "../../../lib/staff/events.mjs";
import {
  EXPORT_SIZE,
  PREVIEW_SIZE,
  makeCode,
  setWhiteBackground,
} from "../../../lib/qr/code";

export default function EventAttendance({ record, identity, request, denied }) {
  const [white, setWhite] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrNotice, setQrNotice] = useState("");
  const [page, setPage] = useState(1);
  const [roster, setRoster] = useState(null);
  const [rosterError, setRosterError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const previewRef = useRef(null);
  const qrRef = useRef(null);
  const whiteRef = useRef(white);
  whiteRef.current = white;
  const url = record.attendanceUrl;

  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    setQrError("");
    void makeCode(url, PREVIEW_SIZE, white)
      .then((code) => {
        if (!active) return;
        qrRef.current = code;
        setWhiteBackground(code, whiteRef.current);
        if (previewRef.current) {
          previewRef.current.replaceChildren();
          code.append(previewRef.current);
        }
      })
      .catch(() => {
        if (active) setQrError("QR preview is unavailable. Try reloading the page.");
      });
    return () => {
      active = false;
      qrRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (qrRef.current) setWhiteBackground(qrRef.current, white);
  }, [white]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setRosterError("");
    request(`${eventPath(record.id, "attendance")}?page=${page}`, {
      userID: identity.id,
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setRoster(value);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setRosterError(error.message);
        denied(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [record.id, identity.id, request, page, retry]);

  async function download(extension) {
    setQrError("");
    try {
      const code = await makeCode(url, EXPORT_SIZE, white);
      await code.download({ name: `pittcsc-attendance-${record.id}`, extension });
    } catch {
      setQrError("Could not download the QR code. Try again.");
    }
  }

  async function copyImage() {
    setQrError("");
    setQrNotice("");
    try {
      if (!navigator.clipboard?.write || !window.ClipboardItem) {
        throw new Error("Clipboard image support is unavailable.");
      }
      const image = makeCode(url, EXPORT_SIZE, white).then((code) => code.getRawData("png"));
      await navigator.clipboard.write([
        new window.ClipboardItem({ "image/png": image }),
      ]);
      setQrNotice("QR image copied.");
    } catch {
      setQrError("Could not copy the QR image. Download the PNG instead.");
    }
  }

  return (
    <section className="csc-event-attendance" aria-label="Event attendance">
      <h2>Attendance</h2>
      {record.status === "cancelled" && (
        <p>Check-in is closed. Existing attendance remains below.</p>
      )}
      {url && (
        <div className="csc-event-qr">
          <div ref={previewRef} className="csc-event-qr-preview" aria-label="Attendance QR code" />
          <div className="csc-event-qr-controls">
            <label className="csc-event-qr-background">
              <input type="checkbox" checked={white} onChange={(e) => setWhite(e.target.checked)} />
              White background
            </label>
            <div className="csc-auth-actions">
              <button type="button" onClick={() => void copyImage()}>Copy QR image</button>
              <button type="button" className="csc-auth-secondary" onClick={() => void download("png")}>Download PNG</button>
              <button type="button" className="csc-auth-secondary" onClick={() => void download("svg")}>Download SVG</button>
            </div>
            <p className="csc-event-attendance-link">
              <strong>Sign-in and check-in link</strong>
              <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
            </p>
          </div>
        </div>
      )}
      {qrError && <p role="alert">{qrError}</p>}
      {qrNotice && <p role="status">{qrNotice}</p>}
      <div className="csc-event-roster-heading">
        <h3>Checked in {roster ? `(${roster.count})` : ""}</h3>
        <button type="button" className="csc-auth-secondary" onClick={() => setRetry((n) => n + 1)}>
          Refresh attendance
        </button>
      </div>
      {loading && <p role="status">Loading attendance…</p>}
      {rosterError && (
        <div role="alert">
          <p>{rosterError}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>Retry attendance</button>
        </div>
      )}
      {!loading && !rosterError && roster && (
        <>
          {roster.attendees.length === 0 ? (
            <p>No check-ins to show.</p>
          ) : (
            <ol className="csc-event-roster">
              {roster.attendees.map((attendee) => (
                <li key={`${attendee.email}-${attendee.checkedInAt}`}>
                  <strong>{attendee.name || attendee.email}</strong>
                  {attendee.name && <span>{attendee.email}</span>}
                  <time dateTime={attendee.checkedInAt}>
                    {new Date(attendee.checkedInAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
          {(page > 1 || roster.hasMore) && (
            <nav className="csc-auth-actions" aria-label="Attendance pages">
              <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page}</span>
              <button type="button" disabled={!roster.hasMore} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

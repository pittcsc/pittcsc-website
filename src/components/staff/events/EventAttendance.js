import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import MemberLink from "../../member/MemberLink";
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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
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
        if (active)
          setQrError("QR preview is unavailable. Try reloading the page.");
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
      await code.download({
        name: `pittcsc-attendance-${record.id}`,
        extension,
      });
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
      const image = makeCode(url, EXPORT_SIZE, white).then((code) =>
        code.getRawData("png"),
      );
      await navigator.clipboard.write([
        new window.ClipboardItem({ "image/png": image }),
      ]);
      setQrNotice("QR image copied.");
    } catch {
      setQrError("Could not copy the QR image. Download the PNG instead.");
    }
  }

  async function exportAttendance() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const blob = await request(eventPath(record.id, "attendance.csv"), {
        userID: identity.id,
        responseType: "blob",
      });
      const objectURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectURL;
      link.download = "event-attendance.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
    } catch (error) {
      setExportError(error.message);
      denied(error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <section
        className="csc-events-card csc-event-attendance"
        aria-label="Event attendance"
      >
        <h2>Attendance</h2>
        <p className="csc-events-note">
          {record.status === "cancelled"
            ? "Check-in is closed. Existing attendance remains below."
            : "Members scan this QR code to sign in and check in."}
        </p>
        {url && (
          <div className="csc-event-qr">
            {/* The checkerboard shows through only while the code is transparent. */}
            <div
              ref={previewRef}
              className={`csc-event-qr-preview${white ? " is-white" : ""}`}
              role="img"
              aria-label="Attendance QR code"
            />
            <label className="csc-event-qr-background">
              <input
                type="checkbox"
                checked={white}
                onChange={(e) => setWhite(e.target.checked)}
              />
              White background
            </label>
            <div className="csc-event-qr-actions">
              <button type="button" onClick={() => void copyImage()}>
                <FontAwesomeIcon icon={faCopy} />
                Copy QR image
              </button>
              <button
                type="button"
                className="csc-auth-secondary"
                onClick={() => void download("png")}
              >
                <FontAwesomeIcon icon={faDownload} />
                Download PNG
              </button>
              <button
                type="button"
                className="csc-auth-secondary"
                onClick={() => void download("svg")}
              >
                <FontAwesomeIcon icon={faDownload} />
                Download SVG
              </button>
            </div>
            {qrError && <p role="alert">{qrError}</p>}
            {qrNotice && <p role="status">{qrNotice}</p>}
            <div className="csc-event-attendance-link">
              <strong>Sign-in and check-in link</strong>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {url}
              </a>
            </div>
          </div>
        )}
      </section>
      <section
        className="csc-events-card csc-event-checkins"
        aria-label="Checked-in members"
      >
        <div className="csc-event-roster-heading">
          <h2>Checked in {roster ? `(${roster.count})` : ""}</h2>
          <div className="csc-event-roster-actions">
            <button
              type="button"
              className="csc-auth-secondary"
              disabled={exporting}
              onClick={() => void exportAttendance()}
            >
              <FontAwesomeIcon icon={faDownload} />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              className="csc-auth-secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              Refresh
            </button>
          </div>
        </div>
        {exportError && <p role="alert">{exportError}</p>}
        {loading && <p role="status">Loading attendance…</p>}
        {rosterError && (
          <div role="alert">
            <p>{rosterError}</p>
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Retry attendance
            </button>
          </div>
        )}
        {!loading && !rosterError && roster && (
          <>
            {roster.attendees.length === 0 ? (
              <p className="csc-events-note">No check-ins to show.</p>
            ) : (
              <ol className="csc-event-roster">
                {roster.attendees.map((attendee) => (
                  <li key={`${attendee.email}-${attendee.checkedInAt}`}>
                    <strong>
                      <MemberLink id={attendee.id}>
                        {attendee.name || attendee.email}
                      </MemberLink>
                    </strong>
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
                <button
                  type="button"
                  className="csc-auth-secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  type="button"
                  className="csc-auth-secondary"
                  disabled={!roster.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </>
  );
}

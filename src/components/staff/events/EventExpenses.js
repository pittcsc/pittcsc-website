import React, { useEffect, useRef, useState } from "react";
import {
  MAX_RECEIPTS,
  RECEIPT_MAX_BYTES,
  amountText,
  budgetFileName,
  budgetPackagePath,
  expensesPath,
  formatCents,
  parseDollars,
  receiptAmountPath,
  receiptPath,
  scaledSize,
} from "../../../lib/staff/expenses.mjs";
import { formatEventTime } from "../../../lib/staff/events.mjs";

// Browsers apply photo orientation when drawing, so the re-encoded JPEG is
// upright and much smaller than a phone original. If the browser can't decode
// the file, the original is sent and the API reports whether it is usable.
async function prepareReceipt(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (blob) return blob;
  } catch {
    // Fall back to the original file below.
  }
  return file;
}

export default function EventExpenses({ record, identity, request, denied }) {
  const [expenses, setExpenses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState("");
  const [exporting, setExporting] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [preview, setPreview] = useState("");
  const lifetime = useRef(null);
  const input = useRef(null);
  const dialog = useRef(null);
  // A receipt ID is kept for one file and amount, so retrying a failed or
  // interrupted upload reuses the same receipt instead of creating a copy.
  const attempt = useRef(null);

  const call = (path, options = {}) =>
    request(path, {
      userID: identity.id,
      signal: lifetime.current.signal,
      ...options,
    });

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const value = await call(expensesPath(record.id));
      if (lifetime.current.signal.aborted) return;
      setExpenses(value);
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      setLoadError(failure.message);
      denied(failure);
    } finally {
      if (!lifetime.current.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void load();
    return () => controller.abort();
  }, [record.id, identity.id, request]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const cents = parseDollars(amount);

  function openDialog() {
    setDialogError("");
    setNotice("");
    dialog.current.showModal();
  }

  // Closing discards the draft. A failed upload stays open with its fields so
  // Add receipt retries under the same receipt ID.
  function closeDialog() {
    if (uploading) return;
    dialog.current.close();
    attempt.current = null;
    setFile(null);
    setAmount("");
    setDialogError("");
    if (input.current) input.current.value = "";
  }

  async function addReceipt(event) {
    event.preventDefault();
    if (uploading || !file || cents === null) return;
    if (attempt.current?.file !== file || attempt.current?.cents !== cents)
      attempt.current = { id: crypto.randomUUID(), file, cents };
    const { id } = attempt.current;
    setUploading(true);
    setDialogError("");
    setNotice("");
    try {
      const body = await prepareReceipt(file);
      if (body.size > RECEIPT_MAX_BYTES)
        throw new Error("Choose a receipt image up to 10 MB.");
      await call(receiptPath(record.id, id, cents), {
        method: "PUT",
        body,
        contentType: body.type || "application/octet-stream",
        responseType: "empty",
      });
      if (lifetime.current.signal.aborted) return;
      dialog.current.close();
      attempt.current = null;
      setFile(null);
      setAmount("");
      input.current.value = "";
      setNotice(`Receipt for ${formatCents(cents)} added.`);
      setUploading(false);
      await load();
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      setDialogError(failure.message);
      setUploading(false);
      denied(failure);
    }
  }

  async function remove(receipt) {
    if (
      removing ||
      !window.confirm(`Remove this ${formatCents(receipt.amountCents)} receipt?`)
    )
      return;
    setRemoving(receipt.id);
    setError("");
    setNotice("");
    try {
      await call(receiptPath(record.id, receipt.id), {
        method: "DELETE",
        responseType: "empty",
      });
      if (lifetime.current.signal.aborted) return;
      setNotice("Receipt removed.");
      await load();
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      setError(failure.message);
      denied(failure);
    } finally {
      if (!lifetime.current.signal.aborted) setRemoving("");
    }
  }

  // The amount the editor started from is sent with the change, so an edit
  // made meanwhile by someone else is reported instead of overwritten.
  async function saveAmount(receipt, amountCents) {
    setError("");
    setNotice("");
    try {
      const value = await call(receiptAmountPath(record.id, receipt.id), {
        method: "PUT",
        contentType: "application/json",
        body: JSON.stringify({
          amountCents,
          previousAmountCents: receipt.amountCents,
        }),
      });
      if (lifetime.current.signal.aborted) return;
      setExpenses(value);
      setNotice(`Receipt amount changed to ${formatCents(amountCents)}.`);
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      denied(failure);
      if (failure.status === 409) await load();
      throw failure;
    }
  }

  async function exportPackage() {
    if (exporting) return;
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const blob = await call(budgetPackagePath(record.id), {
        responseType: "blob",
      });
      if (lifetime.current.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = budgetFileName(record);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Your budget package download has started.");
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      setError(failure.message);
      denied(failure);
    } finally {
      if (!lifetime.current.signal.aborted) setExporting(false);
    }
  }

  const receipts = expenses?.receipts || [];
  const full = receipts.length >= MAX_RECEIPTS;

  return (
    <section className="csc-event-expenses" aria-label="Event spending">
      <div className="csc-event-expenses-heading">
        <div>
          <h2>Spending</h2>
          <p className="csc-events-note">Visible only to staff.</p>
        </div>
        {expenses && (
          <button
            type="button"
            disabled={exporting}
            title="A PDF with the numbered attendee list (name and email) followed by every receipt photo."
            onClick={() => void exportPackage()}
          >
            {exporting ? "Creating PDF…" : "Export budget package"}
          </button>
        )}
      </div>
      {loading && !expenses && <p role="status">Loading spending…</p>}
      {loadError && (
        <div role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => void load()}>
            Retry spending
          </button>
        </div>
      )}
      {expenses && (
        <>
          <p className="csc-event-expense-total">
            <span>Total spent</span>
            <strong>{formatCents(expenses.totalCents)}</strong>
            <span className="csc-events-note">
              {receipts.length === 0
                ? "Add receipts to record spending."
                : `Sum of ${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`}
            </span>
          </p>

          <div className="csc-event-receipts-heading">
            <h3>Receipts</h3>
            <button
              type="button"
              disabled={full}
              aria-describedby={full ? "event-receipts-full" : undefined}
              onClick={openDialog}
            >
              Add receipt
            </button>
          </div>
          {full && (
            <p id="event-receipts-full" className="csc-events-note">
              This event has {MAX_RECEIPTS} receipts. Remove one to add
              another.
            </p>
          )}
          {receipts.length === 0 ? (
            <p>No receipts uploaded yet.</p>
          ) : (
            <ul className="csc-event-receipts">
              {receipts.map((receipt) => (
                <ReceiptTile
                  key={receipt.id}
                  eventID={record.id}
                  receipt={receipt}
                  call={call}
                  removing={removing === receipt.id}
                  onRemove={() => void remove(receipt)}
                  onSaveAmount={(cents) => saveAmount(receipt, cents)}
                />
              ))}
            </ul>
          )}

          <dialog
            ref={dialog}
            className="csc-event-receipt-dialog"
            aria-labelledby="event-receipt-dialog-title"
            onCancel={(e) => {
              e.preventDefault();
              closeDialog();
            }}
            onClick={(e) => {
              if (e.target === dialog.current) closeDialog();
            }}
          >
            <form onSubmit={addReceipt}>
              <h3 id="event-receipt-dialog-title">Add a receipt</h3>
              <fieldset disabled={uploading} className="csc-events-fields">
                <label htmlFor="event-receipt">Receipt photo</label>
                <input
                  ref={input}
                  id="event-receipt"
                  type="file"
                  accept="image/*"
                  required
                  aria-describedby="event-receipt-help"
                  onChange={(e) => {
                    setFile(e.target.files[0] || null);
                    setDialogError("");
                  }}
                />
                <p id="event-receipt-help" className="csc-events-note">
                  JPEG, PNG, or WebP, up to 10 MB.
                </p>
                {preview && (
                  <img
                    className="csc-event-receipt-preview"
                    src={preview}
                    alt="Selected receipt"
                  />
                )}
                <label htmlFor="event-receipt-amount">Receipt amount</label>
                <span className="csc-event-expense-input">
                  <span aria-hidden="true">$</span>
                  <input
                    id="event-receipt-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    required
                    aria-describedby="event-receipt-amount-help"
                    aria-invalid={amount !== "" && cents === null}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setDialogError("");
                    }}
                  />
                </span>
                {amount !== "" && cents === null && (
                  <p id="event-receipt-amount-help" className="csc-events-note">
                    Enter a dollar amount from $0 to $100,000, with up to two
                    decimal places.
                  </p>
                )}
              </fieldset>
              {dialogError && <p role="alert">{dialogError}</p>}
              <div className="csc-auth-actions">
                <button
                  type="submit"
                  disabled={uploading || !file || cents === null}
                >
                  {uploading ? "Uploading…" : "Add receipt"}
                </button>
                <button
                  type="button"
                  className="csc-auth-secondary"
                  disabled={uploading}
                  onClick={closeDialog}
                >
                  Cancel
                </button>
              </div>
            </form>
          </dialog>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}

function ReceiptTile({
  eventID,
  receipt,
  call,
  removing,
  onRemove,
  onSaveAmount,
}) {
  const [url, setURL] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const draftCents = draft === null ? null : parseDollars(draft);

  async function save(event) {
    event.preventDefault();
    if (saving || draftCents === null) return;
    if (draftCents === receipt.amountCents) {
      setDraft(null);
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      await onSaveAmount(draftCents);
      if (mounted.current) setDraft(null);
    } catch (failure) {
      if (mounted.current) setEditError(failure.message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  useEffect(() => {
    let active = true;
    let objectURL;
    setFailed(false);
    call(receiptPath(eventID, receipt.id), { responseType: "blob" })
      .then((blob) => {
        if (!active) return;
        objectURL = URL.createObjectURL(blob);
        setURL(objectURL);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [eventID, receipt.id, attempt]);

  const label = `${formatCents(receipt.amountCents)} receipt uploaded by ${receipt.uploadedByName}, ${formatEventTime(receipt.createdAt)}`;
  return (
    <li>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={label} />
        </a>
      ) : failed ? (
        <button
          type="button"
          className="csc-auth-secondary"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Retry image
        </button>
      ) : (
        <span role="status">Loading…</span>
      )}
      {draft === null ? (
        <strong>{formatCents(receipt.amountCents)}</strong>
      ) : (
        <form className="csc-event-receipt-edit" onSubmit={save}>
          <label htmlFor={`receipt-amount-${receipt.id}`}>Receipt amount</label>
          <span className="csc-event-expense-input">
            <span aria-hidden="true">$</span>
            <input
              id={`receipt-amount-${receipt.id}`}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              disabled={saving}
              aria-invalid={draftCents === null}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setEditError("");
              }}
            />
          </span>
          {draftCents === null && (
            <span className="csc-events-note">
              Enter $0 to $100,000, up to two decimal places.
            </span>
          )}
          {editError && <span role="alert">{editError}</span>}
          <span className="csc-auth-actions">
            <button type="submit" disabled={saving || draftCents === null}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="csc-auth-secondary"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setEditError("");
              }}
            >
              Cancel
            </button>
          </span>
        </form>
      )}
      <span className="csc-event-receipt-meta">
        {receipt.uploadedByName} · {formatEventTime(receipt.createdAt)}
      </span>
      {draft === null && (
        <span className="csc-auth-actions">
          <button
            type="button"
            className="csc-auth-secondary"
            disabled={removing}
            onClick={() => setDraft(amountText(receipt.amountCents))}
          >
            Edit amount
          </button>
          <button
            type="button"
            className="csc-auth-secondary csc-events-danger"
            disabled={removing}
            onClick={onRemove}
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </span>
      )}
    </li>
  );
}

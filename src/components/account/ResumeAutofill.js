import React, { useEffect, useRef, useState } from "react";
import { resumeChanges } from "../../lib/account/resume/suggestions.mjs";

async function parseSavedResume(blob, email, signal) {
  const [{ readResumePDF }, { suggestResumeProfile }] = await Promise.all([
    import("../../lib/account/resume/read-pdf.mjs"),
    import("../../lib/account/resume/suggestions.mjs"),
  ]);
  signal.throwIfAborted();
  return suggestResumeProfile(await readResumePDF(blob, { signal }), email);
}

export default function ResumeAutofill({
  form,
  email,
  userID,
  request,
  disabled,
  onApply,
  onBusyChange,
  parseResume = parseSavedResume,
}) {
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef(null);
  const button = useRef(null);
  const confirmation = useRef(null);
  const restoreFocus = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (suggestions) confirmation.current?.focus();
    else if (!busy && restoreFocus.current) {
      button.current?.focus();
      restoreFocus.current = false;
    }
  }, [suggestions, busy]);

  const changes = suggestions ? resumeChanges(form, suggestions) : [];

  function apply(values, fields) {
    onApply(values);
    restoreFocus.current = true;
    setSuggestions(null);
    setNotice(
      `Autofilled: ${fields.map(({ label }) => label).join(", ")}. Review your changes and click Save profile.`,
    );
  }

  async function autofill() {
    if (controller.current || disabled) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setNotice("");
    setSuggestions(null);
    try {
      const blob = await request("/profile/resume", {
        userID,
        signal: current.signal,
        responseType: "blob",
      });
      const values = await parseResume(blob, email, current.signal);
      current.signal.throwIfAborted();
      const fields = resumeChanges(form, values);
      if (!Object.keys(values).length)
        setNotice(
          "No supported profile fields could be identified. You can edit your profile manually.",
        );
      else if (!fields.length)
        setNotice(
          "Your profile already matches the fields identified in this resume.",
        );
      else if (fields.some(({ replaces }) => replaces)) setSuggestions(values);
      else apply(values, fields);
    } catch (failure) {
      if (!current.signal.aborted)
        setError(
          failure.message ||
            "Autofill failed. Try again or edit your profile manually.",
        );
    } finally {
      if (!current.signal.aborted) {
        controller.current = null;
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  return (
    <div className="csc-resume-autofill" aria-busy={busy}>
      <button
        ref={button}
        type="button"
        className="csc-auth-secondary"
        disabled={disabled || busy || !!suggestions}
        onClick={autofill}
      >
        {busy ? "Reading resume…" : "Autofill from resume"}
      </button>
      <p className="csc-account-file-help">
        Reads your saved PDF in this browser. Best with single-column English
        resumes. Changes are not saved automatically.
      </p>
      {busy && <p role="status">Reading your saved resume…</p>}
      {suggestions && (
        <section
          ref={confirmation}
          tabIndex={-1}
          className="csc-resume-confirm"
          aria-label="Confirm resume autofill"
        >
          <h3>Replace profile information?</h3>
          <p>
            Autofill will replace the listed fields, including any unsaved
            edits. Fields not identified in your resume will stay unchanged.
          </p>
          <dl>
            {changes.map(({ field, label, value, replaces }) => (
              <div key={field}>
                <dt>
                  {label}
                  {replaces ? " (replace)" : " (fill)"}
                </dt>
                <dd>{Array.isArray(value) ? value.join(", ") : value}</dd>
              </div>
            ))}
          </dl>
          <div className="csc-account-file-actions">
            <button
              type="button"
              disabled={disabled || !changes.length}
              onClick={() => apply(suggestions, changes)}
            >
              Confirm autofill
            </button>
            <button
              type="button"
              className="csc-auth-secondary"
              onClick={() => {
                restoreFocus.current = true;
                setSuggestions(null);
                setNotice("Autofill canceled. Your profile has not changed.");
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

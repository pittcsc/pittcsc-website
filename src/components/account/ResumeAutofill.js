import React, { useEffect, useId, useRef, useState } from "react";
import {
  RESUME_FIELDS,
  resumeChanges,
  reviewResumeSuggestions,
} from "../../lib/account/resume/suggestions.mjs";

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
  const [review, setReview] = useState(null);
  const [validate, setValidate] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef(null);
  const button = useRef(null);
  const dialog = useRef(null);
  const restoreFocus = useRef(false);
  const id = useId();
  const reviewing = review !== null;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!reviewing) return;
    const modal = dialog.current;
    modal?.showModal();
    const body = typeof document !== "undefined" ? document.body : null;
    const overflow = body?.style.overflow;
    if (body) body.style.overflow = "hidden";
    return () => {
      modal?.close();
      if (body) body.style.overflow = overflow;
    };
  }, [reviewing]);
  useEffect(() => {
    if (!reviewing && !busy && restoreFocus.current) {
      button.current?.focus();
      restoreFocus.current = false;
    }
  }, [reviewing, busy]);

  const { values, errors } = reviewResumeSuggestions(review || {}, email);
  const hasSelection = Object.keys(values).length || Object.keys(errors).length;

  function dismiss() {
    restoreFocus.current = true;
    setReview(null);
    setNotice("Autofill canceled. Your profile has not changed.");
  }

  function apply(event) {
    event.preventDefault();
    if (disabled || !hasSelection) return;
    setValidate(true);
    if (Object.keys(errors).length) return;
    const changes = resumeChanges(form, values);
    if (changes.length) onApply(values);
    restoreFocus.current = true;
    setReview(null);
    setNotice(
      changes.length
        ? `Autofilled: ${changes.map(({ label }) => label).join(", ")}. Review your changes and click Save profile.`
        : "The selected values already match your profile. No changes were made.",
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
    setReview(null);
    setValidate(false);
    try {
      const blob = await request("/profile/resume", {
        userID,
        signal: current.signal,
        responseType: "blob",
      });
      const suggestions = await parseResume(blob, email, current.signal);
      current.signal.throwIfAborted();
      // Always offer career inputs in a successful review, even if extraction
      // missed them. Blank values remain omissions until the member edits them.
      const careerFields = ["currentCompany", "jobTitle", "location"];
      const entries = Object.keys(RESUME_FIELDS)
        .filter(
          (field) =>
            Object.hasOwn(suggestions, field) || careerFields.includes(field),
        )
        .map((field) => [
          field,
          {
            selected: true,
            text: Array.isArray(suggestions[field])
              ? suggestions[field].join("\n")
              : String(suggestions[field] ?? ""),
          },
        ]);
      if (!Object.keys(suggestions).length)
        setNotice(
          "No supported profile fields could be identified. You can edit your profile manually.",
        );
      else setReview(Object.fromEntries(entries));
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

  function change(field, update) {
    setReview((current) => ({
      ...current,
      [field]: { ...current[field], ...update },
    }));
  }

  return (
    <div className="csc-resume-autofill" aria-busy={busy}>
      <button
        ref={button}
        type="button"
        className="csc-auth-secondary"
        disabled={disabled || busy || reviewing}
        onClick={autofill}
      >
        {busy ? "Reading resume…" : "Autofill from resume"}
      </button>
      {busy && <p role="status">Reading your saved resume…</p>}
      {reviewing && (
        <dialog
          ref={dialog}
          className="csc-resume-modal"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-help`}
          onCancel={(event) => {
            event.preventDefault();
            dismiss();
          }}
        >
          <form onSubmit={apply} noValidate>
            <header>
              <h2 id={`${id}-title`}>Review resume autofill</h2>
              <p id={`${id}-help`}>
                Edit the suggestions and choose what to include. Unchecked or
                blank fields stay unchanged.
              </p>
            </header>
            <div className="csc-resume-suggestions">
              {Object.entries(review).map(([field, entry]) => {
                const label = RESUME_FIELDS[field];
                const inputID = `${id}-${field}`;
                const inputProps = {
                  id: inputID,
                  value: entry.text,
                  disabled: !entry.selected,
                  onChange: (event) =>
                    change(field, { text: event.target.value }),
                  "aria-invalid": validate && !!errors[field],
                  "aria-describedby": `${inputID}-hint${validate && errors[field] ? ` ${inputID}-error` : ""}`,
                };
                return (
                  <div className="csc-resume-suggestion" key={field}>
                    <label className="csc-resume-choice">
                      <input
                        type="checkbox"
                        checked={entry.selected}
                        onChange={(event) =>
                          change(field, { selected: event.target.checked })
                        }
                        aria-label={`Include ${label.toLowerCase()}`}
                      />
                      <span>Include {label.toLowerCase()}</span>
                    </label>
                    <label htmlFor={inputID}>{label}</label>
                    {field === "bio" || field === "majors" ? (
                      <textarea
                        {...inputProps}
                        rows={field === "bio" ? 4 : 2}
                      />
                    ) : (
                      <input
                        {...inputProps}
                        type={field === "contactEmail" ? "email" : "text"}
                        inputMode={
                          field === "graduationYear" ? "numeric" : undefined
                        }
                      />
                    )}
                    <p className="csc-account-file-help" id={`${inputID}-hint`}>
                      {field === "majors" ? "One major per line. " : ""}
                      {(
                        Array.isArray(form[field])
                          ? form[field].some(Boolean)
                          : !!form[field]
                      )
                        ? "Replaces your current value if included."
                        : "Fills this field if included."}
                    </p>
                    {validate && errors[field] && (
                      <p role="alert" id={`${inputID}-error`}>
                        {errors[field]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <footer className="csc-account-file-actions">
              <button type="submit" disabled={disabled || !hasSelection}>
                Apply selected
              </button>
              <button
                type="button"
                className="csc-auth-secondary"
                onClick={dismiss}
              >
                Cancel
              </button>
            </footer>
          </form>
        </dialog>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

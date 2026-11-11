import React, { useEffect, useRef, useState } from "react";
import { initials } from "../../lib/account/form.mjs";
import ResumeAutofill from "./ResumeAutofill";

// `only` can render either file section on its own. Omitted, both are shown.
export default function AccountFiles({
  profile,
  userID,
  request,
  onChanged,
  only,
  autofill,
}) {
  const [avatarURL, setAvatarURL] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let url;
    setAvatarURL("");
    setPreviewError("");
    if (profile.hasAvatar) {
      request("/profile/avatar", {
        userID,
        signal: controller.signal,
        responseType: "blob",
      })
        .then((blob) => {
          if (controller.signal.aborted) return;
          url = URL.createObjectURL(blob);
          setAvatarURL(url);
        })
        .catch((error) => {
          if (!controller.signal.aborted) setPreviewError(error.message);
        });
    }
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [profile.hasAvatar, profile.updatedAt, userID, request, previewAttempt]);

  const showAvatar = only !== "resume";
  const showResume = only !== "avatar";

  return (
    <section className="csc-account-files" aria-label="Profile files">
      {showAvatar && (
        <div className="csc-account-card csc-account-file-card">
          <div className="csc-account-file-heading">
            <div className="csc-account-avatar">
              {avatarURL ? (
                <img src={avatarURL} alt="Your profile avatar" />
              ) : (
                <span aria-label="Default profile avatar">
                  {initials(profile)}
                </span>
              )}
            </div>
            <div>
              <h2>Profile picture</h2>
              <div className="csc-account-badges">
                <span
                  className={
                    profile.hasAvatar
                      ? "csc-account-badge csc-account-badge--saved"
                      : "csc-account-badge"
                  }
                >
                  {profile.hasAvatar ? "✓ Saved" : "No picture yet"}
                </span>
                <span className="csc-account-badge">
                  {profile.detailsShared ? "Visible to members" : "Only you"}
                </span>
              </div>
            </div>
          </div>
          {previewError && (
            <div className="csc-account-preview-error">
              <p role="alert">{previewError}</p>
              <button
                type="button"
                className="csc-auth-secondary"
                onClick={() => setPreviewAttempt((value) => value + 1)}
              >
                Retry picture
              </button>
            </div>
          )}
          <FileEditor
            kind="avatar"
            label="Avatar"
            exists={profile.hasAvatar}
            userID={userID}
            request={request}
            onChanged={onChanged}
            autofill={autofill}
          />
        </div>
      )}
      {showResume && (
        <div className="csc-account-card csc-account-file-card">
          <div className="csc-account-file-heading">
            <div className="csc-account-resume-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 2.5h8l4 4V21.5H6V2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 2.5v4h4M9 11h6M9 14.5h6M9 18h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2>Resume</h2>
              <div className="csc-account-badges">
                <span
                  className={
                    profile.hasResume
                      ? "csc-account-badge csc-account-badge--saved"
                      : "csc-account-badge"
                  }
                >
                  {profile.hasResume ? "✓ Saved" : "No resume yet"}
                </span>
                <span className="csc-account-badge">Only you</span>
              </div>
            </div>
          </div>
          <FileEditor
            kind="resume"
            label="Resume PDF"
            exists={profile.hasResume}
            userID={userID}
            request={request}
            onChanged={onChanged}
            autofill={autofill}
          />
        </div>
      )}
    </section>
  );
}

function FileEditor({
  kind,
  label,
  exists,
  userID,
  request,
  onChanged,
  autofill,
}) {
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resumeVersion, setResumeVersion] = useState(0);
  const input = useRef(null);
  const controller = useRef(null);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);
  const isResume = kind === "resume";
  const locked = busy || !!autofill?.busy || !!autofill?.disabled;

  async function act(action) {
    if (locked) return;
    const signal = controller.current.signal;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (action === "upload") {
        if (!selected) throw new Error("Choose a file first.");
        if (selected.size > (isResume ? 10 : 5) * 1024 * 1024)
          throw new Error(`Choose a file up to ${isResume ? 10 : 5} MB.`);
        await request(`/profile/${kind}`, {
          userID,
          signal,
          method: "PUT",
          body: selected,
          contentType: selected.type || "application/octet-stream",
          responseType: "empty",
        });
      } else if (action === "remove") {
        await request(`/profile/${kind}`, {
          userID,
          signal,
          method: "DELETE",
          responseType: "empty",
        });
      } else {
        const blob = await request("/profile/resume", {
          userID,
          signal,
          responseType: "blob",
        });
        if (signal.aborted) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "resume.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice("Your resume download has started.");
        return;
      }
      if (signal.aborted) return;
      // Invalidate suggestions as soon as the saved bytes change, even if the
      // subsequent metadata refresh fails and the member needs to retry it.
      if (isResume) setResumeVersion((version) => version + 1);
      // Keep the selected file available for a safe retry if reloading the
      // saved metadata fails after the upload succeeds.
      await onChanged(signal);
      if (signal.aborted) return;
      setSelected(null);
      input.current.value = "";
      setNotice(action === "remove" ? `${label} removed.` : `${label} saved.`);
    } catch (failure) {
      if (!signal.aborted) setError(failure.message);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="csc-account-file">
      <div
        className={`csc-account-upload${locked ? " csc-account-upload--disabled" : ""}`}
      >
        <span className="csc-account-upload-icon" aria-hidden="true">
          ↑
        </span>
        <label htmlFor={`${kind}-file`}>
          Drop {exists ? "a new" : "a"} {isResume ? "PDF" : "photo"} here, or{" "}
          <span>browse</span>
        </label>
        <p id={`${kind}-help`} className="csc-account-file-help">
          {isResume ? "PDF · up to 10 MB" : "JPEG, PNG, or WebP · up to 5 MB"}
        </p>
        <input
          ref={input}
          id={`${kind}-file`}
          type="file"
          accept={
            isResume
              ? ".pdf,application/pdf"
              : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          }
          aria-describedby={`${kind}-help`}
          disabled={locked}
          onChange={(event) => {
            setSelected(event.target.files[0] || null);
            setError("");
            setNotice("");
          }}
        />
      </div>
      {selected && (
        <p className="csc-account-selected-file">
          Selected: {selected.name}. Save to upload.
        </p>
      )}
      {isResume && exists && autofill && (
        <div className="csc-account-autofill-panel">
          <p>Fill in your profile details from your saved PDF.</p>
          <ResumeAutofill
            key={`${userID}-${resumeVersion}`}
            {...autofill}
            userID={userID}
            request={request}
            disabled={busy || autofill.disabled}
          />
        </div>
      )}
      {(selected || exists) && (
        <div className="csc-account-file-actions">
          {selected && (
            <button
              type="button"
              disabled={locked}
              onClick={() => void act("upload")}
            >
              {exists
                ? "Save replacement"
                : `Save ${isResume ? "resume" : "picture"}`}
            </button>
          )}
          {exists && isResume && (
            <button
              type="button"
              disabled={locked}
              className="csc-auth-secondary"
              onClick={() => void act("download")}
            >
              Download resume
            </button>
          )}
          {exists && (
            <button
              type="button"
              disabled={locked}
              className="csc-auth-secondary csc-account-file-remove"
              onClick={() => void act("remove")}
            >
              Remove {isResume ? "resume" : "picture"}
            </button>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Working…</p>}
    </div>
  );
}

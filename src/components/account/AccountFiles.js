import React, { useEffect, useRef, useState } from "react";
import { initials } from "../../lib/account/form.mjs";

export default function AccountFiles({ profile, userID, request, onChanged }) {
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

  return (
    <section className="csc-account-files" aria-label="Profile files">
      <h2>Profile picture</h2>
      <div className="csc-account-avatar">
        {avatarURL ? (
          <img src={avatarURL} alt="Your profile avatar" />
        ) : (
          <span aria-label="Default profile avatar">{initials(profile)}</span>
        )}
      </div>
      {previewError && (
        <>
          <p role="alert">{previewError}</p>
          <button
            className="csc-auth-secondary"
            onClick={() => setPreviewAttempt((value) => value + 1)}
          >
            Retry picture
          </button>
        </>
      )}
      <FileEditor
        kind="avatar"
        label="Avatar"
        exists={profile.hasAvatar}
        userID={userID}
        request={request}
        onChanged={onChanged}
      />
      <h2>Resume</h2>
      <p>
        {profile.hasResume
          ? "Your resume is saved."
          : "No resume uploaded yet."}{" "}
        Visible only to you.
      </p>
      <FileEditor
        kind="resume"
        label="Resume PDF"
        exists={profile.hasResume}
        userID={userID}
        request={request}
        onChanged={onChanged}
      />
    </section>
  );
}

function FileEditor({ kind, label, exists, userID, request, onChanged }) {
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef(null);
  const controller = useRef(null);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);
  const isResume = kind === "resume";

  async function act(action) {
    if (busy) return;
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
      <label htmlFor={`${kind}-file`}>
        {exists ? "Replace" : "Upload"} {isResume ? "resume PDF" : "avatar"}
      </label>
      <p id={`${kind}-help`} className="csc-account-file-help">
        {isResume
          ? "PDF, up to 10 MB."
          : "JPEG, PNG, or WebP, up to 5 MB. Visible only to you."}
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
        disabled={busy}
        onChange={(event) => {
          setSelected(event.target.files[0] || null);
          setError("");
          setNotice("");
        }}
      />
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Working…</p>}
      <div className="csc-account-file-actions">
        <button disabled={busy || !selected} onClick={() => void act("upload")}>
          {exists
            ? "Save replacement"
            : `Save ${isResume ? "resume" : "avatar"}`}
        </button>
        {exists && (
          <button
            disabled={busy}
            className="csc-auth-secondary"
            onClick={() => void act("remove")}
          >
            Remove {isResume ? "resume" : "avatar"}
          </button>
        )}
        {exists && isResume && (
          <button
            disabled={busy}
            className="csc-auth-secondary"
            onClick={() => void act("download")}
          >
            Download resume
          </button>
        )}
      </div>
    </div>
  );
}

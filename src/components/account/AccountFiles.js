import React, { useEffect, useRef, useState } from "react";

export default function AccountFiles({ profile, userID, request, onChanged }) {
  return (
    <section className="csc-account-files" aria-label="Profile files">
      <h2>Resume</h2>
      <p>
        {profile.hasResume
          ? "Your resume is saved."
          : "No resume uploaded yet."}{" "}
        Visible only to you.
      </p>
      <ResumeEditor
        exists={profile.hasResume}
        userID={userID}
        request={request}
        onChanged={onChanged}
      />
    </section>
  );
}

function ResumeEditor({ exists, userID, request, onChanged }) {
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

  async function act(action) {
    if (busy) return;
    const signal = controller.current.signal;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (action === "upload") {
        if (!selected) throw new Error("Choose a file first.");
        if (selected.size > 10 * 1024 * 1024)
          throw new Error("Choose a PDF up to 10 MB.");
        await request("/profile/resume", {
          userID,
          signal,
          method: "PUT",
          body: selected,
          contentType: selected.type || "application/octet-stream",
          responseType: "empty",
        });
      } else if (action === "remove") {
        await request("/profile/resume", {
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
      setNotice(
        action === "remove" ? "Resume PDF removed." : "Resume PDF saved.",
      );
    } catch (failure) {
      if (!signal.aborted) setError(failure.message);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="csc-account-file">
      <label htmlFor="resume-file">
        {exists ? "Replace" : "Upload"} resume PDF
      </label>
      <p id="resume-help" className="csc-account-file-help">
        PDF, up to 10 MB.
      </p>
      <input
        ref={input}
        id="resume-file"
        type="file"
        accept=".pdf,application/pdf"
        aria-describedby="resume-help"
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
          {exists ? "Save replacement" : "Save resume"}
        </button>
        {exists && (
          <button
            disabled={busy}
            className="csc-auth-secondary"
            onClick={() => void act("remove")}
          >
            Remove resume
          </button>
        )}
        {exists && (
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

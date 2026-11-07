import React, { useEffect, useState } from "react";
export default function EmailSubscription({ identity, request }) {
  const [contact, setContact] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    request("/profile/email-subscription", {
      userID: identity.id,
      signal: c.signal,
    })
      .then((v) => {
        if (!c.signal.aborted) setContact(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [identity.id, request, attempt]);
  async function toggle() {
    setSaving(true);
    setError("");
    try {
      setContact(
        await request("/profile/email-subscription", {
          userID: identity.id,
          method: "PUT",
          contentType: "application/json",
          body: JSON.stringify({ subscribed: !contact.subscribed }),
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="csc-account-sharing"
      aria-label="CSC email subscription"
    >
      <h2>CSC announcements</h2>
      <p>Newsletters and upcoming events sent to your Pitt email.</p>
      {error && <p role="alert">{error}</p>}
      {contact ? (
        <>
          <p role="status">
            {contact.subscribed
              ? "You’re subscribed to CSC announcements."
              : "You’re unsubscribed from CSC announcements."}
          </p>
          {contact.blockedReason && (
            <p>
              Email delivery is blocked following a bounce or complaint.
              Changing your subscription does not clear this delivery block.
            </p>
          )}
          <button
            type="button"
            className="csc-auth-secondary"
            disabled={saving}
            onClick={toggle}
          >
            {saving
              ? "Saving…"
              : contact.subscribed
                ? "Unsubscribe"
                : "Subscribe"}
          </button>
        </>
      ) : error ? (
        <button
          type="button"
          onClick={() => {
            setError("");
            setAttempt((v) => v + 1);
          }}
        >
          Retry subscription
        </button>
      ) : (
        <p role="status">Loading subscription…</p>
      )}
    </section>
  );
}

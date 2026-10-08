import React, { useEffect, useMemo, useState } from "react";
import { navigate } from "gatsby";
import AuthFrame from "../components/auth/AuthFrame";
import SessionStatus from "../components/auth/SessionStatus";
import { useAuth } from "../components/auth/AuthProvider";
import { getAuthClient } from "../lib/auth/client";
import { loginURL } from "../lib/auth/policy.mjs";
import { createAccountClient } from "../lib/account/client.mjs";

const eventPath = /^\/attendance\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/?$/;

export default function Attendance({ location }) {
  const auth = useAuth();
  const eventID = eventPath.exec(location.pathname)?.[1];
  const [event, setEvent] = useState(null);
  const [eventOwner, setEventOwner] = useState(null);
  const [loadedEventID, setLoadedEventID] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const request = useMemo(
    () => createAccountClient({ getClient: getAuthClient, apiURL: process.env.GATSBY_API_URL }),
    [],
  );
  const currentEvent = eventOwner === auth.identity?.id && loadedEventID === eventID ? event : null;

  useEffect(() => {
    if (auth.status === "signedOut" && eventID) {
      void navigate(loginURL(location.pathname + location.search + location.hash), { replace: true });
    }
  }, [auth.status, eventID, location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (auth.status !== "authenticated" || !eventID) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request(`/attendance/${eventID}`, {
      userID: auth.identity.id,
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setEventOwner(auth.identity.id);
          setLoadedEventID(eventID);
          setEvent(value);
        }
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(failure.message);
        if (failure.status === 401 || failure.status === 403) void auth.revalidate();
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [auth.status, auth.identity?.id, eventID, request, attempt]);

  async function checkIn() {
    if (!currentEvent || currentEvent.status !== "active" || currentEvent.checkedInAt || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await request(`/attendance/${eventID}`, {
        userID: auth.identity.id,
        method: "POST",
      });
      setEventOwner(auth.identity.id);
      setLoadedEventID(eventID);
      setEvent(result);
    } catch (failure) {
      setError(failure.message);
      if (failure.status === 401 || failure.status === 403) void auth.revalidate();
      if (failure.status === 409) setAttempt((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame dashboard websiteLink={false}>
      {!eventID ? (
        <><h1>Attendance link not found</h1><p>This attendance link is invalid.</p></>
      ) : auth.status === "signedOut" ? (
        <p role="status">Taking you to sign-in…</p>
      ) : auth.status !== "authenticated" ? (
        <SessionStatus auth={auth} />
      ) : (
        <>
          <h1>{currentEvent?.title || "Event attendance"}</h1>
          {loading ? (
            <p role="status">Loading event…</p>
          ) : (
            <>
              {currentEvent && <p>Signed in as <strong>{auth.identity.email}</strong>.</p>}
              {currentEvent?.status === "cancelled" ? (
                <p role="status">Check-in is closed for this cancelled event.</p>
              ) : currentEvent?.checkedInAt ? (
                <p role="status">You're checked in.</p>
              ) : currentEvent ? (
                <button type="button" disabled={submitting} onClick={() => void checkIn()}>
                  {submitting ? "Checking in…" : "I'm Here!"}
                </button>
              ) : null}
              {error && <p role="alert">{error}</p>}
              {error && <button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button>}
            </>
          )}
        </>
      )}
    </AuthFrame>
  );
}

export const Head = () => (
  <>
    <title>Event attendance | Pitt CSC</title>
    <meta name="robots" content="noindex" />
  </>
);

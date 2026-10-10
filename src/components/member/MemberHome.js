import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import {
  eventExcerpt,
  formatEventRange,
  isInProgress,
} from "../../lib/member/events.mjs";
import "../../styles/member.scss";

export default function MemberHome({ identity, revalidate }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [profileComplete, setProfileComplete] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [profileAttempt, setProfileAttempt] = useState(0);
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );

  useEffect(() => {
    let pending;
    const load = () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      setEvents(null);
      setError("");
      request("/events/upcoming", {
        userID: identity.id,
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (!Array.isArray(result.events))
            throw new Error("Events are temporarily unavailable. Try again.");
          setEvents(result.events);
        })
        .catch((failure) => {
          if (controller.signal.aborted) return;
          setError(failure.message);
          if (failure.status === 401 || failure.status === 403)
            void revalidate();
        });
    };
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", visible);
    return () => {
      pending?.abort();
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [identity.id, request, revalidate, attempt]);

  useEffect(() => {
    let pending;
    const load = () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      setProfileComplete(null);
      setProfileError("");
      request("/profile", { userID: identity.id, signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (typeof result.complete !== "boolean") {
            throw new Error("Profile status is temporarily unavailable.");
          }
          setProfileComplete(result.complete);
        })
        .catch((failure) => {
          if (controller.signal.aborted) return;
          setProfileError(failure.message);
          if (failure.status === 401 || failure.status === 403)
            void revalidate();
        });
    };
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", visible);
    return () => {
      pending?.abort();
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [identity.id, request, revalidate, profileAttempt]);

  return (
    <section className="csc-member-home" aria-labelledby="member-events-title">
      <div className="csc-member-heading">
        <div>
          <p className="csc-member-eyebrow">Your dashboard</p>
          <h1 id="member-events-title">Upcoming events</h1>
        </div>
        {profileComplete === false && (
          <Link className="csc-member-profile-prompt" to="/dashboard/account">
            Complete your profile <span aria-hidden="true">→</span>
          </Link>
        )}
        {profileError && (
          <div className="csc-member-profile-error" role="alert">
            <span>Could not check profile status.</span>
            <button
              className="csc-auth-secondary"
              onClick={() => setProfileAttempt((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}
      </div>
      {error ? (
        <div className="csc-member-state" role="alert">
          <p>{error}</p>
          <button
            className="csc-auth-secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry loading events
          </button>
        </div>
      ) : events === null ? (
        <p role="status">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="csc-member-state">
          No upcoming events to show right now.
        </p>
      ) : (
        <ul className="csc-member-events">
          {events.map((event) => (
            <li className="csc-member-event" key={event.id}>
              {isInProgress(event) && (
                <span className="csc-member-live">In progress</span>
              )}
              <h2>{event.title}</h2>
              <p className="csc-member-event-time">
                <time dateTime={event.startsAt}>{formatEventRange(event)}</time>
              </p>
              <p className="csc-member-event-location">{event.location}</p>
              {event.description && (
                <p className="csc-member-event-description">
                  {eventExcerpt(event.description)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

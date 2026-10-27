import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import { parseFoundryStatus } from "../../lib/member/foundry.mjs";
import FoundryCard from "./FoundryCard";
import "../../styles/foundry.scss";

export default function Foundry({ identity }) {
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    request("/points/foundry", {
      userID: identity.id,
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setStatus(parseFoundryStatus(result));
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [identity.id, request, attempt]);

  return (
    <div className="csc-foundry">
      <section className="csc-foundry-intro" aria-labelledby="foundry-title">
        <h1 id="foundry-title">Foundry</h1>
        <span className="csc-foundry-underline" aria-hidden="true" />
        <p className="csc-foundry-lede">
          Foundry is how CSC recognizes the members who keep showing up:
          shipping code, solving problems, and reading deeply, week after week.
        </p>
        <ol className="csc-foundry-rules">
          <li>
            <span>
              Earn <strong>50 points</strong> within any 30-day stretch to go
              active.
            </span>
          </li>
          <li>
            <span>
              Only the last 30 days count. Older points roll off one day at a
              time, so there&rsquo;s no monthly reset.
            </span>
          </li>
          <li>
            <span>
              If enough points roll off to drop you below 50, you go inactive
              until you&rsquo;re back above it.
            </span>
          </li>
        </ol>
        <Link className="csc-foundry-cta" to="/dashboard/points">
          Earn points
        </Link>
      </section>
      <div className="csc-foundry-status">
        {error ? (
          <div className="csc-foundry-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : status ? (
          <FoundryCard status={status} />
        ) : (
          <p role="status">Loading your Foundry status…</p>
        )}
      </div>
    </div>
  );
}

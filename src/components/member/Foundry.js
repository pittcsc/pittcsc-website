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
          shipping code, solving problems, and reading deeply, every single
          month.
        </p>
        <ol className="csc-foundry-rules">
          <li>
            <span>
              Earn <strong>50 points</strong> within a calendar month to go
              active.
            </span>
          </li>
          <li>
            <span>
              Totals reset at midnight Eastern on the 1st, so everyone starts
              the month at zero.
            </span>
          </li>
          <li>
            <span>
              Until you reach 50 again, your status stays inactive. Once you do,
              it holds for the rest of that month.
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

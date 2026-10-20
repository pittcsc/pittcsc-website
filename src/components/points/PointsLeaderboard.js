import React, { useEffect, useMemo, useState } from "react";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import "../../styles/points.scss";

function Board({ title, board }) {
  return (
    <section className="csc-points-board" aria-label={title}>
      <h2>{title}</h2>
      {board.entries.length === 0 ? (
        <p>No points earned in this period yet.</p>
      ) : (
        <ol>
          {board.entries.map((entry, index) => (
            <li
              key={`${entry.rank}-${index}`}
              className={entry.isYou ? "is-you" : ""}
            >
              <span className="csc-points-rank">#{entry.rank}</span>
              <span>
                {entry.name}
                {entry.isYou ? " (you)" : ""}
              </span>
              <strong>{entry.points}</strong>
            </li>
          ))}
        </ol>
      )}
      {board.own && (
        <p className="csc-points-own-rank">
          You are #{board.own.rank} with {board.own.points} points.
        </p>
      )}
    </section>
  );
}

export default function PointsLeaderboard({ identity }) {
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );
  const [boards, setBoards] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all(
      ["all", "30d"].map((period) =>
        request(`/points/leaderboard?period=${period}`, {
          userID: identity.id,
          signal: controller.signal,
        }),
      ),
    )
      .then((results) => {
        if (!controller.signal.aborted) setBoards(results);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [identity.id, request, attempt]);

  return (
    <div className="csc-points-leaderboards">
      <p className="csc-points-eyebrow">Member activity</p>
      <h1>Points leaderboard</h1>
      <p>
        Top 10 active accounts. Your submitted links remain visible only to you
        and staff.
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {!boards && !error && <p role="status">Loading leaderboards…</p>}
      {boards && (
        <div className="csc-points-boards">
          <Board title="All time" board={boards[0]} />
          <Board title="Last 30 days" board={boards[1]} />
        </div>
      )}
    </div>
  );
}

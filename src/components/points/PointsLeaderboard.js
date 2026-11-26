import { Link } from "gatsby";
import React, { useEffect, useMemo, useState } from "react";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import PointsProfile from "./PointsProfile";
import MemberLink from "../member/MemberLink";
import "../../styles/points.scss";

function Board({ title, board }) {
  return (
    <section className="csc-points-board" aria-label={title}>
      <h3>{title}</h3>
      {board.entries.length === 0 ? (
        <p>No members ranked in this period yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Member</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            {board.entries.map((entry, index) => (
              <tr
                key={`${entry.rank}-${index}`}
                className={entry.isYou ? "is-you" : undefined}
              >
                <td>
                  <span
                    className={`csc-points-rank${entry.rank <= 3 ? " is-top" : ""}`}
                  >
                    {entry.rank}
                  </span>
                </td>
                <td>
                  <MemberLink id={entry.id}>{entry.name}</MemberLink>
                  {entry.isYou ? " (you)" : ""}
                </td>
                <td>{entry.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {board.own && (
        <p className="csc-points-own-rank">
          You are <MemberLink id={board.own.id}>#{board.own.rank}</MemberLink>{" "}
          with {board.own.points} points.
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
      ["all", "7d"].map((period) =>
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
      <h1 className="csc-points-title">Points</h1>
      <PointsProfile
        identity={identity}
        variant="points"
        onChanged={() => setAttempt((value) => value + 1)}
      />
      <section
        className="csc-points-leaderboard-section"
        aria-labelledby="leaderboards-title"
      >
        <div className="csc-points-leaderboard-heading">
          <h2 id="leaderboards-title">Leaderboards</h2>
          <p>
            Manage your leaderboard visibility in{" "}
            <Link to="/dashboard/account">My account</Link>.
          </p>
        </div>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="csc-auth-secondary"
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
            <Board title="Last 7 days" board={boards[1]} />
          </div>
        )}
      </section>
    </div>
  );
}

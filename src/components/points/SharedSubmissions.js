import React, { useEffect, useState } from "react";
import SubmissionList from "./SubmissionList";
import "../../styles/points.scss";

export default function SharedSubmissions({ identity, memberID, request }) {
  const [claims, setClaims] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError("");
    request(`/points/leaderboard/${memberID}/submissions?page=${page}`, {
      userID: identity.id,
      signal,
    })
      .then((result) => {
        if (signal.aborted) return;
        setClaims((current) =>
          page === 1 ? result.claims : [...(current || []), ...result.claims],
        );
        setHasMore(result.hasMore);
      })
      .catch((failure) => {
        if (signal.aborted) return;
        setError(failure.message);
        if (failure.status === 404) {
          setClaims(null);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identity.id, memberID, request, page, attempt]);

  return (
    <section
      className="csc-points-profile"
      aria-labelledby="member-submissions"
    >
      <div className="csc-points-history">
        <h2 id="member-submissions">Submission history</h2>
        {claims && <SubmissionList claims={claims} />}
        {loading && <p role="status">Loading submissions…</p>}
        {error && <p role="alert">{error}</p>}
        {error && (
          <button
            type="button"
            className="csc-auth-secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry
          </button>
        )}
        {hasMore && !error && (
          <button
            type="button"
            className="csc-auth-secondary"
            disabled={loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Load more submissions
          </button>
        )}
      </div>
    </section>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import "../../styles/points.scss";

const dateLabel = (value) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );

export default function PointsProfile({
  identity,
  showForm = false,
  onChanged,
}) {
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );
  const [categories, setCategories] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("");
  const [url, setURL] = useState("");
  const [affirmed, setAffirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([
      request("/points/categories", {
        userID: identity.id,
        signal: controller.signal,
      }),
      request("/points/me", { userID: identity.id, signal: controller.signal }),
    ])
      .then(([catalog, result]) => {
        if (controller.signal.aborted) return;
        setCategories(catalog.categories);
        setCategory((current) => current || catalog.categories[0]?.code || "");
        setData(result);
        setPage(1);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [identity.id, request, attempt]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const claim = await request("/points/claims", {
        userID: identity.id,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ category, url: url.trim(), affirmed }),
      });
      setURL("");
      setAffirmed(false);
      setNotice(
        `${claim.points} points awarded. Your claim is on your profile.`,
      );
      setAttempt((value) => value + 1);
      onChanged?.();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(claim) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/points/claims/${claim.id}`, {
        userID: identity.id,
        method: "DELETE",
      });
      setNotice("Claim withdrawn. Its points have been removed.");
      setAttempt((value) => value + 1);
      onChanged?.();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function more() {
    if (loadingMore || !data?.hasMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const next = page + 1;
      const result = await request(`/points/me?page=${next}`, {
        userID: identity.id,
      });
      setData((current) => ({
        ...current,
        allTime: result.allTime,
        last30Days: result.last30Days,
        claims: [...current.claims, ...result.claims],
        hasMore: result.hasMore,
      }));
      setPage(next);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoadingMore(false);
    }
  }

  const labels = Object.fromEntries(
    (categories || []).map((item) => [item.code, item.label]),
  );

  return (
    <section className="csc-points-profile" aria-labelledby="points-title">
      <div className="csc-points-heading">
        <div>
          <h2 id="points-title">Your points</h2>
          <p>
            {showForm
              ? "Share what you completed. Each link earns 10 points once."
              : "Your scores and submitted links."}
          </p>
        </div>
        {!showForm && (
          <Link to="/dashboard/points">
            Submit points and view leaderboard →
          </Link>
        )}
      </div>
      {data ? (
        <div className="csc-points-totals">
          <div>
            <strong>{data.allTime}</strong>
            <span>All time</span>
          </div>
          <div>
            <strong>{data.last30Days}</strong>
            <span>Last 30 days</span>
          </div>
        </div>
      ) : !error ? (
        <p role="status">Loading your points…</p>
      ) : null}
      {error && (
        <div className="csc-points-error" role="alert">
          <span>{error}</span>
          {!data && (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {categories && data && (
        <>
          {showForm && (
            <form onSubmit={submit}>
              <div className="csc-points-form-row">
                <div>
                  <label htmlFor="point-category">Activity</label>
                  <select
                    id="point-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    required
                  >
                    {categories.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label} · {item.points} points
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="point-url">Link to your work or paper</label>
                  <input
                    id="point-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    maxLength={2048}
                    value={url}
                    onChange={(event) => setURL(event.target.value)}
                    required
                  />
                </div>
              </div>
              <label className="csc-points-affirm">
                <input
                  type="checkbox"
                  checked={affirmed}
                  onChange={(event) => setAffirmed(event.target.checked)}
                  required
                />
                I completed this activity. The linked solution or contribution
                is mine, and the link is public where required.
              </label>
              <p className="csc-points-hint">
                Use a public LeetCode solution, a link to the paper you read, or
                a public GitHub PR or standalone commit. A PR and its commits
                count as one contribution.
              </p>
              <button type="submit" disabled={busy || !category}>
                {busy ? "Saving…" : "Submit link"}
              </button>
            </form>
          )}
          <div className="csc-points-history">
            <h3>Your submissions</h3>
            {data.claims.length === 0 ? (
              <p>No links submitted yet.</p>
            ) : (
              <ul>
                {data.claims.map((claim) => (
                  <li key={claim.id}>
                    <div>
                      <strong>
                        {labels[claim.category] || claim.category}
                      </strong>
                      <span>
                        {dateLabel(claim.awardedAt)} ·{" "}
                        {claim.status === "awarded"
                          ? `+${claim.points} points`
                          : claim.status}
                      </span>
                    </div>
                    <a
                      href={claim.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {claim.url}
                    </a>
                    {claim.status === "revoked" && claim.statusReason && (
                      <p>Staff reason: {claim.statusReason}</p>
                    )}
                    {claim.status === "awarded" && (
                      <button
                        type="button"
                        className="csc-auth-secondary"
                        disabled={busy}
                        onClick={() => void withdraw(claim)}
                      >
                        Withdraw claim
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {data.hasMore && (
              <button
                type="button"
                className="csc-auth-secondary"
                disabled={loadingMore}
                onClick={() => void more()}
              >
                {loadingMore ? "Loading…" : "Load more submissions"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

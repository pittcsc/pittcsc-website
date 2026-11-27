import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import { isSecurePointURL } from "../../lib/points/validation.mjs";
import SubmissionList from "./SubmissionList";
import "../../styles/points.scss";

// The close delay lets the pointer cross the gap between the icon and panel.
function PointsHelp({ children }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  function enter(event) {
    if (event.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    setHovered(true);
  }
  function leave(event) {
    if (event.pointerType !== "mouse") return;
    closeTimer.current = setTimeout(() => setHovered(false), 150);
  }

  return (
    <details
      className="csc-points-help"
      open={pinned || hovered}
      onPointerEnter={enter}
      onPointerLeave={leave}
    >
      <summary
        aria-label="How points work"
        onClick={(event) => {
          event.preventDefault();
          // Without clearing hover, the panel would stay open under the mouse
          // and the click would look ignored.
          if (pinned) setHovered(false);
          setPinned(!pinned);
        }}
      >
        i
      </summary>
      <div className="csc-points-help-panel">{children}</div>
    </details>
  );
}

export default function PointsProfile({
  identity,
  variant = "account",
  onChanged,
}) {
  const showForm = variant === "points";
  const submissionsPage = variant === "submissions";
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
  const [summary, setSummary] = useState("");
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
    if (busy || !validSummary) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const claim = await request("/points/claims", {
        userID: identity.id,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          category,
          url: url.trim(),
          summary: trimmedSummary,
          affirmed,
        }),
      });
      setURL("");
      setSummary("");
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
  const visibleClaims = data
    ? submissionsPage
      ? data.claims
      : data.claims.slice(0, 3)
    : [];
  const hasURL = url.trim().length > 0;
  const validURL = isSecurePointURL(url);
  const isLeetCode = category === "leetcode";
  const urlDescription =
    [
      isLeetCode && "point-url-leetcode-help",
      hasURL && !validURL && "point-url-error",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const trimmedSummary = summary.replace(
    /^\p{White_Space}+|\p{White_Space}+$/gu,
    "",
  );
  const summaryLength = [...trimmedSummary].length;
  const validSummary =
    summaryLength >= 100 &&
    summaryLength <= 250 &&
    !trimmedSummary.includes("\0");

  return (
    <section
      className={`csc-points-profile${submissionsPage ? " csc-points-submissions" : ""}`}
      aria-labelledby={submissionsPage ? "submissions-title" : "points-title"}
    >
      {submissionsPage ? (
        <div className="csc-points-submissions-heading">
          <h1 id="submissions-title">Your submissions</h1>
          <p>Your submitted links, newest first.</p>
        </div>
      ) : (
        <div className="csc-points-heading">
          <div>
            <div className="csc-points-title-row">
              <h2 id="points-title">Your points</h2>
              {showForm && (
                <PointsHelp>
                  <p>
                    Share what you completed. Each link earns 10 points once.
                  </p>
                  <p>
                    Use a LeetCode submission link, a link to the paper you
                    read, or a public GitHub PR or standalone commit. A PR and
                    its commits count as one contribution.
                  </p>
                </PointsHelp>
              )}
            </div>
            {!showForm && <p>Your scores and submitted links.</p>}
          </div>
          <Link
            to={
              showForm ? "/dashboard/points/submissions" : "/dashboard/points"
            }
          >
            {showForm
              ? "View your submissions →"
              : "Submit points and view leaderboard →"}
          </Link>
        </div>
      )}
      {data ? (
        !submissionsPage && (
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
        )
      ) : !error ? (
        <p role="status">
          {submissionsPage
            ? "Loading your submissions…"
            : "Loading your points…"}
        </p>
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
                    aria-invalid={hasURL && !validURL}
                    aria-describedby={urlDescription}
                    onChange={(event) => {
                      setURL(event.target.value);
                      setAffirmed(false);
                    }}
                    required
                  />
                  {isLeetCode && (
                    <p
                      id="point-url-leetcode-help"
                      className="csc-points-field-help"
                    >
                      Open the Submissions tab in LeetCode, select your
                      submission, and copy the URL. Look for a number after
                      /submissions/.
                    </p>
                  )}
                  {hasURL && !validURL && (
                    <p id="point-url-error" className="csc-points-field-error">
                      Enter a public HTTPS link without a username, password, or
                      custom port.
                    </p>
                  )}
                </div>
              </div>
              <div className="csc-points-summary">
                <label htmlFor="point-summary">Submission summary</label>
                <p id="point-summary-help">
                  Describe what you’re submitting in 1–2 sentences (100–250
                  characters).
                </p>
                <textarea
                  id="point-summary"
                  rows={3}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  aria-describedby="point-summary-help point-summary-count"
                  aria-invalid={summaryLength > 250}
                  required
                />
                <p
                  id="point-summary-count"
                  className={
                    summaryLength > 250 ? "csc-points-field-error" : undefined
                  }
                >
                  {summaryLength}/250 characters
                </p>
              </div>
              {hasURL && (
                <label className="csc-points-affirm">
                  <input
                    type="checkbox"
                    checked={affirmed}
                    onChange={(event) => setAffirmed(event.target.checked)}
                    required
                  />
                  I completed this activity. The linked submission or
                  contribution is mine, and the link is public where required.
                </label>
              )}
              <button
                type="submit"
                disabled={
                  busy || !category || !validURL || !validSummary || !affirmed
                }
              >
                {busy ? "Saving…" : "Submit link"}
              </button>
            </form>
          )}
          {!showForm && (
            <div className="csc-points-history">
              {!submissionsPage && (
                <div className="csc-points-history-heading">
                  <h3>Recent submissions</h3>
                  <Link to="/dashboard/points/submissions">
                    View all submissions →
                  </Link>
                </div>
              )}
              <SubmissionList
                claims={visibleClaims}
                labels={labels}
                onWithdraw={withdraw}
                busy={busy}
              />
              {submissionsPage && data.hasMore && (
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
          )}
        </>
      )}
    </section>
  );
}

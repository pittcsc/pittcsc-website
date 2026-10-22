import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { staffToolPath } from "../../../lib/staff/tools.mjs";
import MemberLink from "../../member/MemberLink";
import "../../../styles/staff/points.scss";

const dateLabel = (value) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );

export default function PointClaims({ identity, request }) {
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const labels = useMemo(
    () => Object.fromEntries(categories.map((item) => [item.code, item.label])),
    [categories],
  );

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([
      request("/staff/points/claims", {
        userID: identity.id,
        signal: controller.signal,
      }),
      request("/points/categories", {
        userID: identity.id,
        signal: controller.signal,
      }),
    ])
      .then(([claims, catalog]) => {
        if (controller.signal.aborted) return;
        setData(claims);
        setCategories(catalog.categories);
        setPage(1);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [identity.id, request, attempt]);

  function start(claim, action) {
    setError("");
    setNotice("");
    setEditor({
      id: claim.id,
      action,
      category: claim.category,
      url: claim.url,
      reason: "",
    });
  }

  async function save(event) {
    event.preventDefault();
    if (busy || !editor) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const path = `/staff/points/claims/${editor.id}`;
      await request(
        editor.action === "correct" ? path : `${path}/${editor.action}`,
        {
          userID: identity.id,
          method: editor.action === "correct" ? "PUT" : "POST",
          contentType: "application/json",
          body: JSON.stringify(
            editor.action === "correct"
              ? {
                  category: editor.category,
                  url: editor.url.trim(),
                  reason: editor.reason.trim(),
                }
              : { reason: editor.reason.trim() },
          ),
        },
      );
      setNotice(
        `Claim ${editor.action === "correct" ? "corrected" : editor.action === "revoke" ? "revoked" : "restored"}.`,
      );
      setEditor(null);
      setAttempt((value) => value + 1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function more() {
    if (!data?.hasMore || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const next = page + 1;
      const result = await request(`/staff/points/claims?page=${next}`, {
        userID: identity.id,
      });
      setData((current) => ({
        ...current,
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

  return (
    <section className="csc-staff csc-staff-points">
      <Link className="csc-staff-back" to="/dashboard/staff">
        ← Staff Dashboard
      </Link>
      <h1>Point claims</h1>
      <p>
        Review submitted links, correct mistakes, or reverse invalid awards.
        Members earn points as soon as they submit.
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
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
      {!data && !error && <p role="status">Loading point claims…</p>}
      {data &&
        (data.claims.length === 0 ? (
          <p>No point claims yet.</p>
        ) : (
          <ul className="csc-staff-points-list">
            {data.claims.map((claim) => (
              <li key={claim.id}>
                <div className="csc-staff-points-row">
                  <div>
                    <h2>
                      <MemberLink id={claim.memberID}>
                        {claim.memberName}
                      </MemberLink>
                    </h2>
                    <p>
                      {labels[claim.category] || claim.category} ·{" "}
                      {dateLabel(claim.awardedAt)} · {claim.points} points
                    </p>
                  </div>
                  <strong
                    className={`csc-staff-points-status is-${claim.status}`}
                  >
                    {claim.status}
                  </strong>
                </div>
                <a href={claim.url} target="_blank" rel="noopener noreferrer">
                  {claim.url}
                </a>
                {claim.statusReason && <p>Reason: {claim.statusReason}</p>}
                <div className="csc-staff-points-actions">
                  {claim.status === "awarded" && (
                    <button
                      type="button"
                      className="csc-auth-secondary"
                      disabled={busy}
                      onClick={() => start(claim, "revoke")}
                    >
                      Revoke
                    </button>
                  )}
                  {claim.status !== "awarded" && (
                    <button
                      type="button"
                      className="csc-auth-secondary"
                      disabled={busy}
                      onClick={() => start(claim, "restore")}
                    >
                      Restore
                    </button>
                  )}
                  <button
                    type="button"
                    className="csc-auth-secondary"
                    disabled={busy}
                    onClick={() => start(claim, "correct")}
                  >
                    Correct details
                  </button>
                </div>
                {editor?.id === claim.id && (
                  <form onSubmit={save}>
                    <h3>
                      {editor.action === "correct"
                        ? "Correct claim"
                        : editor.action === "revoke"
                          ? "Revoke claim"
                          : "Restore claim"}
                    </h3>
                    {editor.action === "correct" && (
                      <>
                        <label htmlFor={`category-${claim.id}`}>Activity</label>
                        <select
                          id={`category-${claim.id}`}
                          value={editor.category}
                          onChange={(event) =>
                            setEditor((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                        >
                          {categories.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <label htmlFor={`url-${claim.id}`}>Link</label>
                        <input
                          id={`url-${claim.id}`}
                          type="url"
                          maxLength={2048}
                          value={editor.url}
                          onChange={(event) =>
                            setEditor((current) => ({
                              ...current,
                              url: event.target.value,
                            }))
                          }
                          required
                        />
                      </>
                    )}
                    <label htmlFor={`reason-${claim.id}`}>Reason</label>
                    <input
                      id={`reason-${claim.id}`}
                      maxLength={500}
                      value={editor.reason}
                      onChange={(event) =>
                        setEditor((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                      required
                    />
                    <div className="csc-staff-points-actions">
                      <button type="submit" disabled={busy}>
                        {busy ? "Saving…" : "Save change"}
                      </button>
                      <button
                        type="button"
                        className="csc-auth-secondary"
                        disabled={busy}
                        onClick={() => setEditor(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ))}
      {data?.hasMore && (
        <button
          type="button"
          className="csc-auth-secondary csc-staff-points-more"
          disabled={loadingMore}
          onClick={() => void more()}
        >
          {loadingMore ? "Loading…" : "Load more claims"}
        </button>
      )}
    </section>
  );
}

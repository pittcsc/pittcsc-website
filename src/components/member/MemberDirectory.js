import React, { useEffect, useMemo, useState } from "react";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import MemberLink from "./MemberLink";
import MemberAvatar from "./MemberAvatar";
import "../../styles/directory.scss";

export default function MemberDirectory({ identity }) {
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    request(`/members?${params}`, {
      userID: identity.id,
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identity.id, request, query, page, retry]);

  function search(event) {
    event.preventDefault();
    setPage(1);
    setQuery(input.trim().replace(/\s+/g, " "));
  }

  return (
    <section className="csc-member-directory">
      <h1>Members</h1>
      <p>Find a CSC member by name.</p>
      <form role="search" onSubmit={search} className="csc-directory-search">
        <label htmlFor="member-search">Name</label>
        <div>
          <input
            id="member-search"
            type="search"
            value={input}
            maxLength={100}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit">Search</button>
        </div>
      </form>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading members…</p>
      ) : (
        !error &&
        result && (
          <>
            <p role="status">
              {result.total} {result.total === 1 ? "member" : "members"}
              {query ? ` matching “${query}”` : ""}
            </p>
            {result.members.length === 0 ? (
              <p>No members found.</p>
            ) : (
              <ul className="csc-directory-list">
                {result.members.map((member) => (
                  <li key={member.id}>
                    <MemberLink id={member.id} className="csc-directory-member">
                      <MemberAvatar
                        member={member}
                        request={request}
                        userID={identity.id}
                      />
                      <span>
                        <strong>{member.name}</strong>
                        <small>
                          {member.majors.join(", ")}
                          {member.graduationYear
                            ? ` · Class of ${member.graduationYear}`
                            : ""}
                        </small>
                        {member.isAlumni && (
                          <small className="csc-directory-badge">Alumni</small>
                        )}
                      </span>
                    </MemberLink>
                  </li>
                ))}
              </ul>
            )}
            {result.total > result.pageSize && (
              <nav className="csc-directory-pages" aria-label="Member pages">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.ceil(result.total / result.pageSize)}
                </span>
                <button
                  type="button"
                  disabled={page * result.pageSize >= result.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )
      )}
    </section>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [companyInput, setCompanyInput] = useState("");
  const [company, setCompany] = useState("");
  const [alumniInput, setAlumniInput] = useState(false);
  const [alumni, setAlumni] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);
  const filterButtonRef = useRef(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const activeFilterCount = Number(Boolean(company)) + Number(alumni);

  useEffect(() => {
    if (!filtersOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!filtersRef.current?.contains(event.target)) setFiltersOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      setFiltersOpen(false);
      filterButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    if (company) params.set("company", company);
    if (alumni) params.set("alumni", "1");
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
  }, [identity.id, request, query, company, alumni, page, retry]);

  function search(event) {
    event.preventDefault();
    setPage(1);
    setQuery(input.trim().replace(/\s+/g, " "));
    setCompany(companyInput.trim().replace(/\s+/g, " "));
    setAlumni(alumniInput);
    setFiltersOpen(false);
  }

  function clearFilters() {
    setCompanyInput("");
    setCompany("");
    setAlumniInput(false);
    setAlumni(false);
    setPage(1);
    setFiltersOpen(false);
  }

  return (
    <section className="csc-member-directory">
      <h1>Members</h1>
      <p>Find CSC members by name, current company, or alumni status.</p>
      <form role="search" onSubmit={search} className="csc-directory-search">
        <div className="csc-directory-search-row">
          <div className="csc-directory-name-field">
            <label htmlFor="member-search">Name</label>
            <input id="member-search" type="search" value={input} maxLength={100} onChange={(event) => setInput(event.target.value)} />
          </div>
          <div className="csc-directory-filter-menu" ref={filtersRef}>
            <button
              ref={filterButtonRef}
              type="button"
              className="csc-directory-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls={filtersOpen ? "csc-directory-filter-panel" : undefined}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="csc-directory-filter-count">{activeFilterCount}</span>
              )}
              <span className="csc-directory-filter-chevron" aria-hidden="true" />
            </button>
            {filtersOpen && (
              <div
                id="csc-directory-filter-panel"
                className="csc-directory-filter-panel"
                role="group"
                aria-label="Member filters"
              >
                <label className="csc-directory-alumni-filter">
                  <input
                    type="checkbox"
                    checked={alumniInput}
                    onChange={(event) => setAlumniInput(event.target.checked)}
                  />
                  <span className="csc-directory-checkbox" aria-hidden="true" />
                  Alumni only
                </label>
                <label htmlFor="company-search">Current company</label>
                <input
                  id="company-search"
                  type="search"
                  value={companyInput}
                  maxLength={160}
                  placeholder="e.g. Google"
                  onChange={(event) => setCompanyInput(event.target.value)}
                />
                <div className="csc-directory-filter-actions">
                  <button type="button" className="csc-directory-filter-clear" onClick={clearFilters}>
                    Clear filters
                  </button>
                  <button type="submit" className="csc-directory-filter-apply">
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
          <button type="submit" className="csc-directory-search-submit">Search</button>
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
                        {(member.jobTitle || member.currentCompany) && (
                          <small>{[member.jobTitle, member.currentCompany].filter(Boolean).join(" · ")}</small>
                        )}
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

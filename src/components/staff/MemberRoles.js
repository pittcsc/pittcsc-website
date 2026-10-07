import React, { useEffect, useRef, useState } from "react";
import {
  confirmMessage,
  displayName,
  lockReason,
  pageCount,
  pageSummary,
  rolePath,
  searchPath,
} from "../../lib/staff/members.mjs";
import "../../styles/staff.scss";

// Toggles render from the server catalog; Go enforces every change.
export default function MemberRoles({ identity, request, revalidate }) {
  const [catalog, setCatalog] = useState(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [confirming, setConfirming] = useState(null);
  const lifetime = useRef(null);

  const denied = (failure) => {
    if (failure.status === 401 || failure.status === 403) void revalidate();
  };

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setCatalogError("");
    request("/staff/roles", { userID: identity.id, signal: controller.signal })
      .then((value) => setCatalog(value.roles))
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setCatalogError(failure.message);
        denied(failure);
      });
    return () => controller.abort();
  }, [identity.id, request, attempt]);

  // Search as the user types, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSubmitted(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request(searchPath({ query: submitted, role: roleFilter, page }), {
      userID: identity.id,
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setResults(value);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(failure.message);
        denied(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identity.id, request, submitted, roleFilter, page, attempt]);

  async function change(member, role, grant) {
    const key = `${member.id}:${role.name}`;
    if (pending[key]) return;
    setConfirming(null);
    setRowErrors(({ [member.id]: _, ...rest }) => rest);
    setPending((value) => ({ ...value, [key]: grant }));
    try {
      const updated = await request(rolePath(member.id, role.name), {
        userID: identity.id,
        signal: lifetime.current.signal,
        method: grant ? "PUT" : "DELETE",
      });
      setResults((value) => ({
        ...value,
        users: value.users.map((user) =>
          user.id === updated.id ? updated : user,
        ),
      }));
    } catch (failure) {
      if (lifetime.current.signal.aborted) return;
      setRowErrors((value) => ({ ...value, [member.id]: failure.message }));
      denied(failure);
    } finally {
      setPending(({ [key]: _, ...rest }) => rest);
    }
  }

  function toggle(member, role) {
    const grant = !member.roles.includes(role.name);
    if (role.confirm) setConfirming({ member, role, grant });
    else void change(member, role, grant);
  }

  const pages = results ? pageCount(results) : 1;

  return (
    <section className="csc-staff" aria-labelledby="csc-staff-members">
      <h2 id="csc-staff-members">Members</h2>
      <form
        className="csc-staff-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query.trim());
          setPage(1);
        }}
      >
        <div>
          <label htmlFor="csc-staff-query">Search by name or email</label>
          <input
            id="csc-staff-query"
            type="search"
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="csc-staff-role">Role</label>
          <select
            id="csc-staff-role"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {catalog?.map((role) => (
              <option key={role.name} value={role.name}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </form>

      {(catalogError || error) && (
        <>
          <p role="alert">{catalogError || error}</p>
          <button
            className="csc-auth-secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </>
      )}
      <p role="status" className="csc-staff-summary">
        {loading ? "Searching…" : results ? pageSummary(results) : ""}
      </p>

      {catalog && results && (
        <ul className="csc-staff-members" aria-busy={loading}>
          {results.users.map((member) => (
            <li key={member.id} className="csc-staff-member">
              <div className="csc-staff-member-info">
                <strong>{displayName(member)}</strong>
                <span>{member.email}</span>
                {member.graduationYear && (
                  <span>Class of {member.graduationYear}</span>
                )}
              </div>
              <fieldset className="csc-staff-roles">
                <legend>Roles for {member.email}</legend>
                {catalog.map((role) => {
                  const key = `${member.id}:${role.name}`;
                  const reason = lockReason(role, member, identity.id);
                  const busy = key in pending;
                  const checked = busy
                    ? pending[key]
                    : member.roles.includes(role.name);
                  const id = `csc-role-${member.id}-${role.name}`;
                  return (
                    <label
                      key={role.name}
                      htmlFor={id}
                      className="csc-staff-role"
                      title={reason || role.description}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        disabled={Boolean(reason) || busy}
                        aria-describedby={reason ? `${id}-lock` : undefined}
                        onChange={() => toggle(member, role)}
                      />
                      {role.label}
                      {reason && (
                        <span id={`${id}-lock`} className="csc-staff-sr-only">
                          {reason}
                        </span>
                      )}
                    </label>
                  );
                })}
              </fieldset>
              {confirming?.member.id === member.id && (
                <div
                  className="csc-staff-confirm"
                  role="group"
                  aria-label="Confirm role change"
                >
                  <p>
                    {confirmMessage(
                      confirming.role,
                      confirming.member,
                      confirming.grant,
                    )}
                  </p>
                  <div className="csc-auth-actions">
                    <button
                      autoFocus
                      onClick={() =>
                        void change(
                          confirming.member,
                          confirming.role,
                          confirming.grant,
                        )
                      }
                    >
                      {confirming.grant ? "Grant" : "Remove"}{" "}
                      {confirming.role.label}
                    </button>
                    <button
                      className="csc-auth-secondary"
                      onClick={() => setConfirming(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {rowErrors[member.id] && (
                <p role="alert">{rowErrors[member.id]}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {results && pages > 1 && (
        <nav className="csc-auth-actions" aria-label="Member pages">
          <button
            className="csc-auth-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span className="csc-staff-page">
            Page {page} of {pages}
          </span>
          <button
            className="csc-auth-secondary"
            disabled={page >= pages || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

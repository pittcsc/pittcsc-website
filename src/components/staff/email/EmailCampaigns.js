import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, navigate } from "gatsby";
import {
  draftInput,
  draftContent,
  emptyAudience,
  splitLabels,
  matchesAudience,
  parseCSV,
  guessMapping,
  download,
  makeCSV,
  starterTemplates,
} from "../../../lib/staff/email.mjs";
import "../../../styles/staff/email.scss";

const clone = (value) => JSON.parse(JSON.stringify(value));
const ROOT = "/staff/email";
const LABELS = {
  firstName: "First name *",
  lastName: "Last name *",
  email: "Email *",
  tags: "Tags (optional)",
  major: "Major (optional)",
  graduationYear: "Graduation year (optional)",
};
const date = (s) =>
  s
    ? new Date(s).toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " ET"
    : "—";
const badge = (value) => (
  <span className={`email-badge email-badge--${value}`}>{value}</span>
);
function Field({ label, children }) {
  const labelControls = (nodes) =>
    React.Children.map(nodes, (child) => {
      if (!React.isValidElement(child)) return child;
      if (["input", "select", "textarea"].includes(child.type))
        return React.cloneElement(child, {
          "aria-label": child.props["aria-label"] || label,
        });
      if (child.type === React.Fragment)
        return React.cloneElement(
          child,
          {},
          labelControls(child.props.children),
        );
      return child;
    });
  return (
    <div className="email-field">
      <span>{label}</span>
      {labelControls(children)}
    </div>
  );
}

function Empty({ title, children }) {
  return (
    <div className="email-empty">
      <span aria-hidden="true">✉</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default function EmailCampaigns({ identity, request, revalidate }) {
  const [tab, setTab] = useState("campaigns"),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false);
  const life = useRef(null);
  useEffect(() => {
    const c = new AbortController();
    life.current = c;
    return () => c.abort();
  }, [identity.id]);
  const api = useCallback(
    async (path, body, method = "POST", opts = {}) => {
      try {
        return await request(path.startsWith("/staff/") ? path : ROOT + path, {
          userID: identity.id,
          signal: life.current?.signal,
          ...(body !== undefined
            ? {
                method,
                contentType: "application/json",
                body: JSON.stringify(body),
              }
            : {}),
          ...opts,
        });
      } catch (e) {
        if (e.status === 401 || e.status === 403) void revalidate();
        throw e;
      }
    },
    [identity.id, request, revalidate],
  );
  const refresh = useCallback(async () => {
    const [status, campaigns, contacts, templates, audiences, assets] =
      await Promise.all(
        [
          "status",
          "campaigns",
          "contacts",
          "templates",
          "audiences",
          "assets",
        ].map((p) => api("/" + p)),
      );
    if (!life.current?.signal.aborted)
      setData({ status, campaigns, contacts, templates, audiences, assets });
  }, [api]);
  useEffect(() => {
    void refresh().catch((e) => {
      if (!life.current?.signal.aborted) setError(e.message);
    });
  }, [refresh]);
  async function run(fn) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (!life.current?.signal.aborted) setError(e.message);
    } finally {
      if (!life.current?.signal.aborted) setBusy(false);
    }
  }
  async function exportCSV(kind, params = {}) {
    const blob = await api(
      `/export/${kind}?${new URLSearchParams(params)}`,
      undefined,
      "GET",
      { responseType: "blob" },
    );
    download(blob, `csc-email-${kind}.csv`);
  }
  async function create() {
    await run(async () => {
      const value = await api(
        `/campaigns/${crypto.randomUUID()}`,
        {
          name: "Untitled campaign",
          subject: "",
          preheader: "",
          blocks: clone(starterTemplates[0].blocks),
          audience: emptyAudience(),
          version: 0,
        },
        "PUT",
      );
      setDraft(value);
    });
  }
  if (draft)
    return (
      <CampaignEditor
        key={draft.id}
        initial={draft}
        api={api}
        data={data}
        identity={identity}
        onError={setError}
        onClose={async () => {
          setDraft(null);
          await refresh();
        }}
        refresh={refresh}
        exportCSV={exportCSV}
      />
    );
  return (
    <div className="csc-staff csc-email">
      <Link className="email-back" to="/dashboard/staff">
        ← Staff dashboard
      </Link>
      <header className="email-header">
        <div>
          <p className="email-eyebrow">CSC COMMUNICATIONS</p>
          <h1>Email studio</h1>
          <p>Keep your community in the loop.</p>
        </div>
        <button disabled={busy || !data} onClick={create}>
          ＋ New campaign
        </button>
      </header>
      {error && (
        <div className="email-alert" role="alert">
          {error}
          <button onClick={() => run(refresh)}>Retry</button>
        </div>
      )}
      {notice && (
        <p className="email-notice" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <p role="status">Loading email studio…</p>
      ) : (
        <>
          {!data.status.enabled && (
            <div className="email-banner">
              Delivery is not configured yet. You can prepare contacts,
              audiences, templates, and drafts.
            </div>
          )}
          <nav className="email-tabs" aria-label="Email tools">
            {["campaigns", "contacts", "audiences", "templates", "images"].map(
              (t) => (
                <button
                  key={t}
                  aria-current={tab === t ? "page" : undefined}
                  onClick={() => {
                    setTab(t);
                    setError("");
                    setNotice("");
                  }}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                  {t === "contacts" && <span>{data.contacts.length}</span>}
                </button>
              ),
            )}
          </nav>
          {tab === "campaigns" && (
            <section className="email-panel">
              <div className="email-section-title">
                <h2>All campaigns</h2>
                <button
                  className="email-secondary"
                  onClick={() => run(refresh)}
                >
                  Refresh
                </button>
              </div>
              {!data.campaigns.length ? (
                <Empty title="Your next newsletter starts here">
                  Create a campaign, build it with blocks, and share the draft
                  with your fellow officers.
                </Empty>
              ) : (
                <div className="email-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Last edited</th>
                        <th>Scheduled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <button
                              className="email-text-button"
                              onClick={() =>
                                run(async () =>
                                  setDraft(await api(`/campaigns/${c.id}`)),
                                )
                              }
                            >
                              {c.name}
                            </button>
                            <small>{c.subject || "No subject yet"}</small>
                          </td>
                          <td>{badge(c.status)}</td>
                          <td>
                            {c.editorName}
                            <small>{date(c.updatedAt)}</small>
                          </td>
                          <td>{date(c.scheduledAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {tab === "contacts" && (
            <Contacts
              contacts={data.contacts}
              api={api}
              refresh={refresh}
              run={run}
              busy={busy}
              exportCSV={exportCSV}
              setNotice={setNotice}
            />
          )}
          {(tab === "audiences" || tab === "templates") && (
            <Library
              kind={tab}
              data={data}
              api={api}
              run={run}
              refresh={refresh}
              setNotice={setNotice}
            />
          )}
          {tab === "images" && (
            <Images data={data} api={api} run={run} refresh={refresh} />
          )}
        </>
      )}
    </div>
  );
}

function AudienceBuilder({ value, onChange, disabled = false }) {
  function update(kind, i, key, v) {
    onChange({
      ...value,
      [kind]: value[kind].map((c, n) => (n === i ? { ...c, [key]: v } : c)),
    });
  }
  return (
    <fieldset className="email-audience" disabled={disabled}>
      <legend>Audience rules</legend>
      <Field label="Include contacts matching">
        <select
          value={value.mode}
          onChange={(e) => onChange({ ...value, mode: e.target.value })}
        >
          <option value="all">All conditions</option>
          <option value="any">Any condition</option>
        </select>
      </Field>
      <p className="email-muted">
        No conditions means all eligible subscribers. Optional missing data
        stays empty.
      </p>
      {["conditions", "exclusions"].map((kind) => (
        <div key={kind}>
          <h4>{kind === "conditions" ? "Include" : "Always exclude"}</h4>
          {value[kind].map((c, i) => (
            <div className="email-rule" key={i}>
              <select
                aria-label={`${kind} field ${i + 1}`}
                value={c.field}
                onChange={(e) => update(kind, i, "field", e.target.value)}
              >
                {[
                  ["tag", "Tag"],
                  ["role", "CRM role"],
                  ["graduationYear", "Graduation year"],
                  ["major", "Major"],
                  ["attendance", "Event attendance ID"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                aria-label={`${kind} value ${i + 1}`}
                value={c.value}
                placeholder={
                  c.field === "attendance"
                    ? "Select an event below or paste its ID"
                    : "Value"
                }
                onChange={(e) => update(kind, i, "value", e.target.value)}
              />
              <button
                type="button"
                className="email-secondary"
                aria-label={`Remove ${kind} rule ${i + 1}`}
                onClick={() =>
                  onChange({
                    ...value,
                    [kind]: value[kind].filter((_, n) => n !== i),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="email-text-button"
            onClick={() =>
              onChange({
                ...value,
                [kind]: [...value[kind], { field: "tag", value: "" }],
              })
            }
          >
            ＋ {kind === "conditions" ? "Add condition" : "Add exclusion"}
          </button>
        </div>
      ))}
    </fieldset>
  );
}

function Contacts({ contacts, api, refresh, run, busy, exportCSV, setNotice }) {
  const [q, setQ] = useState(""),
    [archived, setArchived] = useState(false),
    [audience, setAudience] = useState(emptyAudience),
    [rules, setRules] = useState(false),
    [editing, setEditing] = useState(null),
    [importing, setImporting] = useState(false),
    [selected, setSelected] = useState([]),
    [tags, setTags] = useState("");
  const filtered = contacts.filter(
    (c) =>
      (archived || !c.archived) &&
      `${c.firstName} ${c.lastName} ${c.email} ${c.tags.join(" ")}`
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (!rules || matchesAudience(c, audience, false)),
  );
  const newContact = () => ({
    id: "new",
    firstName: "",
    lastName: "",
    email: "",
    graduationYear: null,
    majors: [],
    tags: [],
    archived: false,
    version: 0,
  });
  return (
    <section className="email-panel">
      <div className="email-section-title">
        <div>
          <h2>Contacts</h2>
          <p>
            Names and email are all you need. Other attributes are optional.
          </p>
        </div>
        <div className="email-actions">
          <button
            className="email-secondary"
            onClick={() => setImporting(!importing)}
          >
            Import CSV
          </button>
          <button onClick={() => setEditing(newContact())}>Add contact</button>
        </div>
      </div>
      {importing && (
        <ImportContacts
          api={api}
          run={run}
          refresh={refresh}
          setNotice={setNotice}
        />
      )}
      {editing && (
        <ContactForm
          initial={editing}
          onClose={() => setEditing(null)}
          busy={busy}
          onSave={(v) =>
            run(async () => {
              await api(`/contacts/${editing.id}`, v, "PUT");
              setEditing(null);
              await refresh();
              setNotice("Contact saved.");
            })
          }
        />
      )}
      <div className="email-filters">
        <input
          aria-label="Search contacts"
          placeholder="Search names, emails, or tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />{" "}
          Include archived
        </label>
        <button className="email-secondary" onClick={() => setRules(!rules)}>
          {rules ? "Hide filters" : "Attribute filters"}
        </button>
        <button
          className="email-secondary"
          onClick={() =>
            run(() =>
              exportCSV("contacts", {
                q,
                archived,
                ...(rules
                  ? { audience: JSON.stringify(audience), eligibility: "all" }
                  : {}),
              }),
            )
          }
        >
          Export CSV
        </button>
      </div>
      {rules && <AudienceBuilder value={audience} onChange={setAudience} />}
      {selected.length > 0 && (
        <div className="email-banner email-actions">
          <strong>{selected.length} selected</strong>
          <input
            aria-label="Bulk tags"
            placeholder="Tags, separated by commas"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          {[false, true].map((remove) => (
            <button
              key={String(remove)}
              className="email-secondary"
              disabled={!tags.trim()}
              onClick={() =>
                run(async () => {
                  await api("/tags", {
                    ids: selected,
                    tags: splitLabels(tags),
                    remove,
                  });
                  setSelected([]);
                  setTags("");
                  await refresh();
                })
              }
            >
              {remove ? "Remove tags" : "Add tags"}
            </button>
          ))}
        </div>
      )}
      <p className="email-muted">
        {filtered.length} contacts ·{" "}
        {
          filtered.filter(
            (c) => c.subscribed && !c.blockedReason && !c.archived && c.active,
          ).length
        }{" "}
        eligible subscribers
      </p>
      {!filtered.length ? (
        <Empty title="No contacts to show">
          Import your mailing list or add a contact.
        </Empty>
      ) : (
        <div className="email-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select visible contacts"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((c) => selected.includes(c.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? filtered.map((c) => c.id) : [],
                      )
                    }
                  />
                </th>
                <th>Contact</th>
                <th>Tags</th>
                <th>Subscription</th>
                <th>Attributes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.email}`}
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, c.id]
                            : selected.filter((id) => id !== c.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="email-text-button"
                      onClick={() => setEditing(c)}
                    >
                      {c.firstName || "Unnamed"} {c.lastName}
                    </button>
                    <small>{c.email}</small>
                    {c.userId && <small>Linked CRM account</small>}
                  </td>
                  <td>
                    {c.tags.map((t) => (
                      <span className="email-tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </td>
                  <td>
                    {badge(
                      c.archived
                        ? "archived"
                        : c.blockedReason ||
                            (!c.active
                              ? "inactive"
                              : c.subscribed
                                ? "subscribed"
                                : "unsubscribed"),
                    )}
                  </td>
                  <td>
                    {c.graduationYear || "—"}
                    <small>{c.majors.join(", ")}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function ContactForm({ initial, onSave, onClose, busy }) {
  const [v, setV] = useState({
    ...initial,
    majorText: initial.majors.join("; "),
    tagText: initial.tags.join("; "),
  });
  const change = (k, value) => setV({ ...v, [k]: value });
  return (
    <form
      className="email-inset"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          firstName: v.firstName,
          lastName: v.lastName,
          email: v.email,
          graduationYear: v.graduationYear ? Number(v.graduationYear) : null,
          majors: splitLabels(v.majorText),
          tags: splitLabels(v.tagText),
          archived: v.archived,
          version: v.version,
        });
      }}
    >
      <h3>{initial.id === "new" ? "Add contact" : "Edit contact"}</h3>
      {initial.userId && (
        <p>
          Account attributes are managed by the member in My Account. You can
          manage tags and archiving here.
        </p>
      )}
      <div className="email-grid">
        {[
          ["firstName", "First name"],
          ["lastName", "Last name"],
          ["email", "Email"],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              required
              maxLength={key === "email" ? 254 : 100}
              type={key === "email" ? "email" : "text"}
              disabled={
                key === "email" ? initial.id !== "new" : !!initial.userId
              }
              value={v[key]}
              onChange={(e) => change(key, e.target.value)}
            />
          </Field>
        ))}
        <Field label="Graduation year (optional)">
          <input
            type="number"
            min="1900"
            max="2100"
            disabled={!!initial.userId}
            value={v.graduationYear || ""}
            onChange={(e) => change("graduationYear", e.target.value)}
          />
        </Field>
        <Field label="Majors (optional)">
          <input
            disabled={!!initial.userId}
            value={v.majorText}
            onChange={(e) => change("majorText", e.target.value)}
          />
        </Field>
        <Field label="Tags (optional)">
          <input
            value={v.tagText}
            onChange={(e) => change("tagText", e.target.value)}
          />
        </Field>
      </div>
      <label>
        <input
          type="checkbox"
          checked={v.archived}
          onChange={(e) => change("archived", e.target.checked)}
        />{" "}
        Archive: exclude from future campaigns
      </label>
      <div className="email-actions">
        <button disabled={busy}>Save contact</button>
        <button type="button" className="email-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function ImportContacts({ api, run, refresh, setNotice }) {
  const [csv, setCSV] = useState(""),
    [headers, setHeaders] = useState([]),
    [mapping, setMapping] = useState({}),
    [preview, setPreview] = useState(null),
    [overwrite, setOverwrite] = useState(false),
    [skip, setSkip] = useState([]);
  return (
    <div className="email-inset">
      <h3>Import contacts</h3>
      <p>
        First name, last name, and email are required. Tags, major, and
        graduation year are optional. Use semicolons between multiple tags or
        majors.
      </p>
      <input
        aria-label="Choose a CSV file"
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const f = e.target.files[0];
          if (!f) return;
          void run(async () => {
            if (f.size > 2 * 1024 * 1024)
              throw new Error("Choose a CSV up to 2 MB and 5,000 rows.");
            const text = await f.text();
            const h = parseCSV(text)[0];
            if (!h?.length) throw new Error("The CSV needs a header row.");
            setCSV(text);
            setHeaders(h);
            setMapping(guessMapping(h));
            setPreview(null);
            setSkip([]);
          });
        }}
      />
      {!!headers.length && (
        <>
          <div className="email-grid">
            {Object.entries(LABELS).map(([key, label]) => (
              <Field key={key} label={label}>
                <select
                  value={mapping[key] ?? ""}
                  onChange={(e) => {
                    setMapping((m) => {
                      const next = { ...m };
                      if (e.target.value === "") delete next[key];
                      else next[key] = Number(e.target.value);
                      return next;
                    });
                    setPreview(null);
                  }}
                >
                  <option value="">Not mapped</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <button
            disabled={["firstName", "lastName", "email"].some(
              (k) => mapping[k] === undefined,
            )}
            onClick={() =>
              run(async () => {
                setPreview(await api("/import/preview", { csv, mapping }));
                setSkip([]);
              })
            }
          >
            Preview import
          </button>
        </>
      )}
      {preview && (
        <>
          <h4>
            {preview.rows.length} rows ·{" "}
            {preview.rows.filter((r) => r.error).length} invalid or duplicate ·{" "}
            {preview.rows.filter((r) => r.existing).length} existing contacts
          </h4>
          <p>
            Imports subscribe new contacts. Existing opt-outs, blocks, and
            archived status stay intact. Tags merge and empty fields fill;
            linked CRM account attributes stay authoritative.
          </p>
          <label>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />{" "}
            Overwrite conflicting nonempty fields on external contacts
          </label>
          <div className="email-table-wrap email-import-table">
            <table>
              <thead>
                <tr>
                  <th>Include</th>
                  <th>Row</th>
                  <th>Contact</th>
                  <th>Proposed result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Include row ${r.row}`}
                        disabled={!!r.error}
                        checked={!r.error && !skip.includes(r.row)}
                        onChange={(e) =>
                          setSkip(
                            e.target.checked
                              ? skip.filter((n) => n !== r.row)
                              : [...skip, r.row],
                          )
                        }
                      />
                    </td>
                    <td>{r.row}</td>
                    <td>
                      {r.input.firstName} {r.input.lastName}
                      <small>{r.input.email}</small>
                    </td>
                    <td>
                      {r.error ||
                        (r.existing
                          ? `Merge tags and empty fields${r.conflicts.length ? `; conflicts (${r.conflicts.join(", ")}) ${overwrite && !r.existing.userId ? "will be overwritten" : "keep existing values"}` : ""}`
                          : "Create subscribed contact")}
                      {r.existing && (
                        <small>
                          Existing: {r.existing.firstName} {r.existing.lastName}{" "}
                          · {r.existing.graduationYear || "no year"} ·{" "}
                          {r.existing.majors.join(", ") || "no major"}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="email-actions">
            <button
              disabled={preview.committed}
              onClick={() =>
                run(async () => {
                  const v = await api(`/import/${preview.id}/commit`, {
                    overwrite,
                    skip,
                  });
                  setPreview(v);
                  await refresh();
                  setNotice(
                    `${v.count} contacts imported. Invalid and skipped rows were not imported.`,
                  );
                })
              }
            >
              {preview.committed ? "Imported" : "Confirm import"}
            </button>
            <button
              className="email-secondary"
              onClick={() =>
                download(
                  new Blob(
                    [
                      makeCSV([
                        ["row", "first_name", "last_name", "email", "error"],
                        ...preview.rows
                          .filter((r) => r.error)
                          .map((r) => [
                            r.row,
                            r.input.firstName,
                            r.input.lastName,
                            r.input.email,
                            r.error,
                          ]),
                      ]),
                    ],
                    { type: "text/csv" },
                  ),
                  "csc-import-errors.csv",
                )
              }
            >
              Export rejected rows
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Library({ kind, data, api, run, refresh, setNotice }) {
  const [name, setName] = useState(""),
    [rules, setRules] = useState(emptyAudience),
    [blocks, setBlocks] = useState(clone(starterTemplates[0].blocks));
  const items =
    kind === "templates"
      ? [...starterTemplates, ...data.templates]
      : data.audiences;
  return (
    <section className="email-panel">
      <h2>{kind === "templates" ? "Reusable templates" : "Saved audiences"}</h2>
      <p>
        {kind === "templates"
          ? "Start with CSC branding, then make it your own. Templates never change previously sent campaigns."
          : "Save rules once and use them across campaigns. Recipients are evaluated when sending begins."}
      </p>
      <div className="email-template-grid">
        {items.map((v) => (
          <button
            className="email-library-card"
            key={v.id}
            onClick={() => {
              setName(v.name);
              if (kind === "templates") setBlocks(clone(v.blocks));
              else setRules(clone(v.rules));
            }}
          >
            <span aria-hidden="true">{kind === "templates" ? "▤" : "◎"}</span>
            <strong>{v.name}</strong>
            <small>
              {kind === "templates"
                ? `${v.blocks.length} blocks`
                : `${v.rules.conditions.length} conditions`}
            </small>
          </button>
        ))}
      </div>
      <div className="email-inset">
        <Field label={kind === "templates" ? "Template name" : "Audience name"}>
          <input
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {kind === "audiences" ? (
          <AudienceBuilder value={rules} onChange={setRules} />
        ) : (
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        )}
        <button
          disabled={!name.trim()}
          onClick={() =>
            run(async () => {
              if (
                data[kind].some((v) => v.name === name) &&
                !window.confirm(`Replace “${name}”?`)
              )
                return;
              await api(`/${kind}`, { name, rules, blocks });
              await refresh();
              setNotice("Saved for all officers.");
            })
          }
        >
          Save {kind === "templates" ? "template" : "audience"}
        </button>
      </div>
    </section>
  );
}
function Images({ data, api, run, refresh, onPick }) {
  return (
    <section className="email-panel">
      <h2>Image library</h2>
      <p>
        Campaign images are publicly accessible to email readers and remain
        available for past campaigns. Upload JPEG, PNG, or WebP up to 5 MB.
      </p>
      <input
        type="file"
        aria-label="Upload campaign image"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files[0];
          if (!f) return;
          void run(async () => {
            if (f.size > 5 * 1024 * 1024)
              throw new Error("Choose an image up to 5 MB.");
            await api(
              `/assets?name=${encodeURIComponent(f.name)}`,
              undefined,
              "POST",
              { method: "POST", body: f, contentType: f.type },
            );
            await refresh();
          });
        }}
      />
      <div className="email-template-grid">
        {data.assets.map((a) => {
          const url = `${data.status.publicURL.replace(/\/$/, "")}/email/assets/${a.id}`;
          return (
            <div className="email-image-card" key={a.id}>
              <img src={url} alt={a.name} loading="lazy" />
              <strong>{a.name}</strong>
              {onPick ? (
                <button
                  className="email-secondary"
                  onClick={() => onPick(url, a.name)}
                >
                  Insert image
                </button>
              ) : (
                <a href={url} target="_blank" rel="noreferrer">
                  Open image
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
function BlockEditor({ blocks, onChange, disabled = false }) {
  const update = (i, v) => onChange(blocks.map((b, n) => (n === i ? v : b)));
  return (
    <fieldset className="email-block-editor" disabled={disabled}>
      <legend className="email-sr-only">Email content blocks</legend>
      {blocks.map((b, i) => (
        <div className="email-block" key={i}>
          <div className="email-block-bar">
            <strong>{b.type}</strong>
            <div>
              {[-1, 1].map((direction) => (
                <button
                  type="button"
                  className="email-icon-button"
                  key={direction}
                  aria-label={`Move block ${i + 1} ${direction < 0 ? "up" : "down"}`}
                  disabled={i + direction < 0 || i + direction >= blocks.length}
                  onClick={() => {
                    const next = [...blocks];
                    [next[i], next[i + direction]] = [
                      next[i + direction],
                      next[i],
                    ];
                    onChange(next);
                  }}
                >
                  {direction < 0 ? "↑" : "↓"}
                </button>
              ))}
              <button
                type="button"
                className="email-icon-button"
                aria-label={`Duplicate block ${i + 1}`}
                onClick={() =>
                  onChange([
                    ...blocks.slice(0, i + 1),
                    clone(b),
                    ...blocks.slice(i + 1),
                  ])
                }
              >
                ⧉
              </button>
              <button
                type="button"
                className="email-icon-button"
                aria-label={`Remove block ${i + 1}`}
                onClick={() => onChange(blocks.filter((_, n) => i !== n))}
              >
                ×
              </button>
            </div>
          </div>
          <BlockFields block={b} onChange={(v) => update(i, v)} />
        </div>
      ))}
      <div className="email-add-blocks">
        {[
          "heading",
          "text",
          "image",
          "button",
          "divider",
          "columns",
          "event",
        ].map((type) => (
          <button
            type="button"
            className="email-secondary"
            key={type}
            disabled={blocks.length >= 100}
            onClick={() =>
              onChange([
                ...blocks,
                type === "columns"
                  ? {
                      type,
                      children: [
                        { type: "text", text: "Left column" },
                        { type: "text", text: "Right column" },
                      ],
                    }
                  : {
                      type,
                      text:
                        type === "heading"
                          ? "Your heading"
                          : type === "button"
                            ? "Learn more"
                            : "",
                      ...(type === "button"
                        ? { url: "https://pittcsc.org" }
                        : {}),
                    },
              ])
            }
          >
            ＋ {type}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function BlockFields({ block: b, onChange }) {
  const input = useRef(null);
  function format(before, after = before) {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    const text = b.text || "";
    onChange({
      ...b,
      text:
        text.slice(0, start) +
        before +
        (text.slice(start, end) || "text") +
        after +
        text.slice(end),
    });
  }
  if (b.type === "divider") return <hr />;
  if (b.type === "columns")
    return (
      <div>
        <Field label="Number of columns">
          <select
            value={b.children.length}
            onChange={(e) =>
              onChange({
                ...b,
                children: Array.from(
                  { length: Number(e.target.value) },
                  (_, i) =>
                    b.children[i] || { type: "text", text: "Column text" },
                ),
              })
            }
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <div className="email-grid">
          {b.children.map((child, i) => (
            <div key={i}>
              <Field label={`Column ${i + 1} type`}>
                <select
                  value={child.type}
                  onChange={(e) =>
                    onChange({
                      ...b,
                      children: b.children.map((c, n) =>
                        n === i
                          ? {
                              type: e.target.value,
                              text: "",
                              ...(e.target.value === "image" ||
                              e.target.value === "button"
                                ? { url: "https://pittcsc.org" }
                                : {}),
                            }
                          : c,
                      ),
                    })
                  }
                >
                  {["text", "heading", "image", "button"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <BlockFields
                block={child}
                onChange={(v) =>
                  onChange({
                    ...b,
                    children: b.children.map((c, n) => (n === i ? v : c)),
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <>
      {b.type !== "image" && (
        <Field label={b.type === "button" ? "Button label" : "Content"}>
          {["text", "event"].includes(b.type) ? (
            <>
              <div className="email-format-tools">
                <button type="button" onClick={() => format("**")}>
                  Bold
                </button>
                <button type="button" onClick={() => format("*")}>
                  Italic
                </button>
                <button
                  type="button"
                  onClick={() => format("[", "](https://example.com)")}
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...b, text: (b.text || "") + "{{firstName}}" })
                  }
                >
                  First name
                </button>
              </div>
              <textarea
                ref={input}
                rows={5}
                maxLength={10000}
                value={b.text || ""}
                onChange={(e) => onChange({ ...b, text: e.target.value })}
              />
            </>
          ) : (
            <input
              maxLength={10000}
              value={b.text || ""}
              onChange={(e) => onChange({ ...b, text: e.target.value })}
            />
          )}
        </Field>
      )}
      {["image", "button", "event"].includes(b.type) && (
        <Field label={b.type === "image" ? "Image URL" : "Link URL"}>
          <input
            type="url"
            placeholder="https://…"
            value={b.url || ""}
            onChange={(e) => onChange({ ...b, url: e.target.value })}
          />
        </Field>
      )}
      {b.type === "image" && (
        <>
          <Field label="Image description">
            <input
              value={b.alt || ""}
              maxLength={500}
              onChange={(e) => onChange({ ...b, alt: e.target.value })}
            />
          </Field>
          {b.url && /^https?:\/\//.test(b.url) && (
            <img
              className="email-block-image"
              src={b.url}
              alt={b.alt || "Image preview"}
            />
          )}
        </>
      )}
    </>
  );
}

function CampaignEditor({ initial, api, data, onClose, refresh, exportCSV }) {
  const [d, setD] = useState(initial),
    [saved, setSaved] = useState(draftContent(initial)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [retry, setRetry] = useState(0),
    [view, setView] = useState("content"),
    [preview, setPreview] = useState(""),
    [width, setWidth] = useState("desktop"),
    [report, setReport] = useState(null),
    [at, setAt] = useState(""),
    [tests, setTests] = useState(""),
    [actionBusy, setActionBusy] = useState(false),
    [events, setEvents] = useState([]),
    [eventID, setEventID] = useState(""),
    [images, setImages] = useState(false);
  const current = useRef(d),
    savingRef = useRef(null),
    alive = useRef(true),
    testRequest = useRef(null);
  current.current = d;
  const dirty = draftContent(d) !== saved,
    editable = d.status === "draft";
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const persist = useCallback(async () => {
    if (savingRef.current) {
      await savingRef.current;
      return persist();
    }
    const snapshot = current.current;
    if (snapshot.status !== "draft") return snapshot;
    setSaving(true);
    const promise = api(
      `/campaigns/${snapshot.id}`,
      draftInput(snapshot),
      "PUT",
    );
    savingRef.current = promise;
    try {
      const value = await promise;
      if (!alive.current) return value;
      setSaved(draftContent(snapshot));
      setD((now) => ({
        ...now,
        version: value.version,
        updatedAt: value.updatedAt,
        updatedBy: value.updatedBy,
        editorName: value.editorName,
      }));
      current.current = {
        ...current.current,
        version: value.version,
        updatedAt: value.updatedAt,
        editorName: value.editorName,
      };
      setError("");
      return value;
    } catch (e) {
      if (alive.current) {
        setError(e.message);
        if (e.status === 409) setConflict(true);
      }
      throw e;
    } finally {
      savingRef.current = null;
      if (alive.current) setSaving(false);
    }
  }, [api]);
  useEffect(() => {
    if (!dirty || !editable || conflict || error) return;
    const timer = setTimeout(() => {
      void persist().catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [d, dirty, editable, conflict, error, persist, retry]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const leave = (e) => {
      const a = e.target.closest?.("a[href]");
      if (
        !a ||
        a.target === "_blank" ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.button !== 0
      )
        return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      void persist()
        .then(() => navigate(url.pathname + url.search + url.hash))
        .catch(() => {});
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty, persist]);
  const change = (key, value) => {
    setD((now) => ({ ...now, [key]: value }));
    if (!conflict) setError("");
  };
  async function run(fn) {
    setActionBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setActionBusy(false);
    }
  }
  async function flush() {
    let value = current.current;
    if (draftContent(value) !== saved || savingRef.current)
      value = await persist();
    return value;
  }
  async function act(action) {
    await run(async () => {
      const value = await flush();
      if (
        (action === "send" || action === "schedule") &&
        !window.confirm(
          `${action === "send" ? "Send" : "Schedule"} “${value.subject}” to approximately ${estimated} recipients?${action === "schedule" ? " The audience will be evaluated again when sending starts." : ""}`,
        )
      )
        return;
      const next = await api(`/campaigns/${d.id}/action`, {
        action,
        version: value.version,
        at,
      });
      setD(next);
      current.current = next;
      setSaved(draftContent(next));
    });
  }
  async function loadReport() {
    setReport(await api(`/campaigns/${d.id}/report`));
  }
  const estimated = data.contacts.filter((c) =>
    matchesAudience(c, d.audience),
  ).length;
  useEffect(() => {
    if (view === "report" || view === "delivery" || !editable)
      void loadReport().catch((e) => setError(e.message));
  }, [view, editable, d.id]); // manual refresh keeps history stable while reading
  return (
    <div className="csc-staff csc-email">
      <button
        className="email-text-button"
        onClick={() =>
          run(async () => {
            await flush();
            await onClose();
          })
        }
      >
        ← All campaigns
      </button>
      <header className="email-header">
        <div>
          <p className="email-eyebrow">SHARED CAMPAIGN</p>
          <h1>{d.name}</h1>
          <p>
            {badge(d.status)}{" "}
            <span role="status">
              {saving
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : `Saved ${date(d.updatedAt)}`}
            </span>
          </p>
          <small>
            Last edited by {d.editorName}. All officers can continue this draft.
          </small>
        </div>
        <button
          className="email-secondary"
          disabled={saving || conflict || !editable}
          onClick={() => run(persist)}
        >
          Save now
        </button>
      </header>
      {error && (
        <div className="email-alert" role="alert">
          {error}
          {!conflict && (
            <button
              onClick={() => {
                setError("");
                setRetry((v) => v + 1);
              }}
            >
              Retry autosave
            </button>
          )}
        </div>
      )}
      {conflict && (
        <div className="email-banner">
          <p>
            Another officer changed this campaign. Your unsaved content is
            preserved below.
          </p>
          <div className="email-actions">
            <button
              className="email-secondary"
              onClick={() =>
                download(
                  new Blob([JSON.stringify(draftInput(d), null, 2)], {
                    type: "application/json",
                  }),
                  "csc-unsaved-draft.json",
                )
              }
            >
              Download my changes
            </button>
            <button
              onClick={() =>
                run(async () => {
                  if (
                    !window.confirm(
                      "Reload the shared draft and replace the edits shown here? Download your changes first if needed.",
                    )
                  )
                    return;
                  const value = await api(`/campaigns/${d.id}`);
                  setD(value);
                  current.current = value;
                  setSaved(draftContent(value));
                  setConflict(false);
                })
              }
            >
              Reload shared draft
            </button>
          </div>
        </div>
      )}
      <nav className="email-tabs" aria-label="Campaign sections">
        {["content", "audience", "preview", "delivery", "report"].map((t) => (
          <button
            aria-current={view === t ? "page" : undefined}
            key={t}
            onClick={() => {
              setView(t);
              if (t === "preview")
                void run(async () => {
                  const v = await api("/preview", draftInput(current.current));
                  setPreview(v.html);
                });
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      {view === "content" && (
        <section className="email-panel">
          <fieldset disabled={!editable || conflict || actionBusy}>
            <legend className="email-sr-only">Campaign details</legend>
            <div className="email-grid">
              <Field label="Campaign name (internal)">
                <input
                  maxLength={200}
                  value={d.name}
                  onChange={(e) => change("name", e.target.value)}
                />
              </Field>
              <Field label="Subject">
                <input
                  maxLength={200}
                  value={d.subject}
                  onChange={(e) => change("subject", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Inbox preview text">
              <input
                maxLength={300}
                value={d.preheader}
                onChange={(e) => change("preheader", e.target.value)}
              />
            </Field>
            <div className="email-actions">
              <select
                aria-label="Apply a template"
                defaultValue=""
                onChange={(e) => {
                  const t = [...starterTemplates, ...data.templates].find(
                    (t) => t.id === e.target.value,
                  );
                  if (
                    t &&
                    window.confirm(
                      "Replace the current content with this template?",
                    )
                  )
                    change("blocks", clone(t.blocks));
                  e.target.value = "";
                }}
              >
                <option value="">Choose a template…</option>
                {[...starterTemplates, ...data.templates].map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="email-secondary"
                onClick={() => setImages(!images)}
              >
                Image library
              </button>
              <button
                type="button"
                className="email-secondary"
                onClick={() =>
                  run(async () => {
                    const v = await requestEvents(api);
                    setEvents(v.events);
                  })
                }
              >
                Load CRM events
              </button>
              <button
                type="button"
                className="email-secondary"
                onClick={() =>
                  run(async () => {
                    const name = window.prompt(
                      "Save this content as a reusable template named:",
                    );
                    if (name) {
                      await api("/templates", {
                        name,
                        blocks: d.blocks,
                        rules: emptyAudience(),
                      });
                      await refresh();
                    }
                  })
                }
              >
                Save as template
              </button>
            </div>
            {!!events.length && (
              <div className="email-actions">
                <select
                  aria-label="CRM event"
                  value={eventID}
                  onChange={(e) => setEventID(e.target.value)}
                >
                  <option value="">Choose an event…</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} · {date(e.startsAt)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!eventID}
                  onClick={() => {
                    const e = events.find((e) => e.id === eventID);
                    change("blocks", [
                      ...d.blocks,
                      {
                        type: "event",
                        text: `**${e.title}**\n${date(e.startsAt)}\n${e.location}\n\n${e.description || ""}`,
                      },
                    ]);
                  }}
                >
                  Insert event snapshot
                </button>
              </div>
            )}
            {images && (
              <Images
                data={data}
                api={api}
                run={run}
                refresh={refresh}
                onPick={(url, alt) => {
                  change("blocks", [...d.blocks, { type: "image", url, alt }]);
                  setImages(false);
                }}
              />
            )}
            <BlockEditor
              blocks={d.blocks}
              onChange={(bs) => change("blocks", bs)}
              disabled={!editable || conflict}
            />
          </fieldset>
        </section>
      )}
      {view === "audience" && (
        <section className="email-panel">
          <h2>Who’s receiving this?</h2>
          <p>
            <strong>{estimated}</strong> eligible subscribers match right now.
            Scheduled sends reevaluate these rules at dispatch; exclusions and
            unsubscribes always win.
          </p>
          <select
            disabled={!editable}
            aria-label="Load saved audience"
            defaultValue=""
            onChange={(e) => {
              const a = data.audiences.find((v) => v.id === e.target.value);
              if (a) change("audience", clone(a.rules));
              e.target.value = "";
            }}
          >
            <option value="">Load a saved audience…</option>
            {data.audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <AudienceBuilder
            value={d.audience}
            onChange={(a) => change("audience", a)}
            disabled={!editable || conflict}
          />
          <div className="email-actions">
            <button
              className="email-secondary"
              disabled={!editable}
              onClick={() =>
                run(async () => {
                  const name = window.prompt("Save these audience rules as:");
                  if (name) {
                    await api("/audiences", {
                      name,
                      rules: d.audience,
                      blocks: [],
                    });
                    await refresh();
                  }
                })
              }
            >
              Save audience
            </button>
            <button
              className="email-secondary"
              onClick={() =>
                run(async () => {
                  const v = await requestEvents(api, "all");
                  setEvents(v.events);
                })
              }
            >
              Find attendance event
            </button>
          </div>
          {events.map((e) => (
            <button
              className="email-text-button"
              key={e.id}
              disabled={!editable}
              onClick={() =>
                change("audience", {
                  ...d.audience,
                  conditions: [
                    ...d.audience.conditions,
                    { field: "attendance", value: e.id },
                  ],
                })
              }
            >
              {e.title} · add attendance condition
            </button>
          ))}
        </section>
      )}
      {view === "preview" && (
        <section className="email-panel">
          <div className="email-section-title">
            <h2>Email preview</h2>
            <div className="email-actions">
              <button
                className="email-secondary"
                onClick={() => setWidth("desktop")}
              >
                Desktop
              </button>
              <button
                className="email-secondary"
                onClick={() => setWidth("mobile")}
              >
                Mobile
              </button>
              <button
                onClick={() =>
                  run(async () =>
                    setPreview((await api("/preview", draftInput(d))).html),
                  )
                }
              >
                Refresh preview
              </button>
            </div>
          </div>
          <p>
            Subject: <strong>{d.subject || "No subject yet"}</strong>
          </p>
          <p className="email-muted">
            Sample first name: Alex. Email clients may render layouts
            differently.
          </p>
          <iframe
            title="Rendered email preview"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={preview}
            className={`email-preview email-preview--${width}`}
          />
        </section>
      )}
      {view === "delivery" && (
        <section className="email-panel">
          <h2>Review and send</h2>
          <dl className="email-review">
            <dt>Subject</dt>
            <dd>{d.subject || "Add a subject first"}</dd>
            <dt>Audience</dt>
            <dd>Approximately {estimated} eligible subscribers</dd>
            <dt>Timezone</dt>
            <dd>America/New_York</dd>
            <dt>Scheduled</dt>
            <dd>{date(d.scheduledAt)}</dd>
          </dl>
          {!data.status.enabled && (
            <p className="email-banner">
              Delivery is disabled until email setup is complete.
            </p>
          )}
          <div className="email-inset">
            <h3>Send a test</h3>
            <Field label="Up to five test addresses, separated by commas">
              <input
                value={tests}
                onChange={(e) => {
                  setTests(e.target.value);
                  testRequest.current = null;
                }}
              />
            </Field>
            <button
              disabled={
                !data.status.enabled || actionBusy || conflict || !tests.trim()
              }
              onClick={() =>
                run(async () => {
                  const value = await flush();
                  const emails = splitLabels(tests);
                  if (emails.length > 5)
                    throw new Error("Use up to five test recipients.");
                  if (!testRequest.current)
                    testRequest.current = crypto.randomUUID();
                  await api(`/campaigns/${d.id}/test`, {
                    emails,
                    version: value.version,
                    requestId: testRequest.current,
                  });
                  setTests("");
                  testRequest.current = null;
                  window.alert(
                    "Test emails queued. They will be sent in the background.",
                  );
                })
              }
            >
              Queue test emails
            </button>
            <p className="email-muted">
              Tests are labeled and excluded from campaign analytics. Existing
              unsubscribes and delivery blocks apply.
            </p>
            <button className="email-secondary" onClick={() => run(loadReport)}>
              Refresh test status
            </button>
            {report?.tests?.length > 0 && (
              <ul className="email-history">
                {report.tests.slice(0, 10).map((t) => (
                  <li key={t.id}>
                    {t.email} · {t.status}
                    <small>
                      {t.reason ||
                        (t.status === "accepted"
                          ? "Accepted by the email provider"
                          : "")}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {editable && (
            <>
              <Field label="Schedule date and time (America/New_York)">
                <input
                  type="datetime-local"
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                />
              </Field>
              <div className="email-actions">
                <button
                  disabled={
                    !data.status.enabled ||
                    actionBusy ||
                    conflict ||
                    !d.subject.trim() ||
                    !d.blocks.length
                  }
                  onClick={() => act("send")}
                >
                  Send now
                </button>
                <button
                  className="email-secondary"
                  disabled={
                    !data.status.enabled ||
                    actionBusy ||
                    conflict ||
                    !at ||
                    !d.subject.trim() ||
                    !d.blocks.length
                  }
                  onClick={() => act("schedule")}
                >
                  Schedule campaign
                </button>
              </div>
            </>
          )}
          {d.status === "scheduled" && (
            <button
              className="email-secondary"
              disabled={actionBusy}
              onClick={() => act("draft")}
            >
              Return to draft to edit
            </button>
          )}
          {["scheduled", "sending", "attention"].includes(d.status) && (
            <button
              className="email-danger"
              disabled={actionBusy}
              onClick={() => {
                if (
                  window.confirm(
                    "Stop remaining delivery? Emails already submitted cannot be recalled.",
                  )
                )
                  void act("cancel");
              }}
            >
              Cancel remaining delivery
            </button>
          )}
          <p className="email-muted">
            Sending continues independently of this browser. Scheduled campaigns
            start automatically when due. An email already in flight can still
            arrive after cancellation.
          </p>
        </section>
      )}
      {view === "report" && (
        <section className="email-panel">
          <div className="email-section-title">
            <h2>Campaign report</h2>
            <button className="email-secondary" onClick={() => run(loadReport)}>
              Refresh report
            </button>
          </div>
          <p className="email-muted">
            Delivery means acceptance by the recipient’s mail server. Recorded
            clicks may include automated activity. Test emails are excluded.
          </p>
          {report && (
            <>
              <div className="email-stats">
                {[
                  ["recipients", "Recipients"],
                  ["delivered", "Delivered"],
                  ["bounced", "Bounced"],
                  ["complaints", "Complaints"],
                  ["unsubscribed", "Unsubscribes"],
                  ["clicks", "Recorded clicks"],
                ].map(([k, label]) => (
                  <div key={k}>
                    <strong>{report.counts[k] || 0}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="email-actions">
                {["summary", "recipients", "clicks"].map((kind) => (
                  <button
                    className="email-secondary"
                    key={kind}
                    onClick={() => run(() => exportCSV(kind, { id: d.id }))}
                  >
                    Export {kind} CSV
                  </button>
                ))}
              </div>
              <h3>Links</h3>
              <div className="email-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Clicks</th>
                      <th>Unique recipients</th>
                      <th>Likely automated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.clicks.map((c) => (
                      <tr key={c.url}>
                        <td className="email-url">{c.url}</td>
                        <td>{c.total}</td>
                        <td>{c.unique}</td>
                        <td>{c.automated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>Recipient delivery</h3>
              <div className="email-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Dispatch</th>
                      <th>Delivery</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recipients.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.firstName} {r.lastName}
                          <small>{r.email}</small>
                        </td>
                        <td>
                          {badge(r.status)}
                          <small>{r.reason}</small>
                        </td>
                        <td>
                          {r.complaint
                            ? "Complaint"
                            : r.bounced
                              ? "Bounced"
                              : r.delivered
                                ? "Delivered"
                                : "Awaiting events"}
                        </td>
                        <td>
                          {["uncertain", "failed"].includes(r.status) &&
                            ["sending", "attention"].includes(d.status) && (
                              <div className="email-actions">
                                {["retry", "skip"].map((action) => (
                                  <button
                                    className="email-secondary"
                                    key={action}
                                    onClick={() =>
                                      run(async () => {
                                        if (
                                          action === "retry" &&
                                          !window.confirm(
                                            "An uncertain email may already have arrived. Retrying could send a duplicate. Continue?",
                                          )
                                        )
                                          return;
                                        await api(
                                          `/campaigns/${d.id}/resolve`,
                                          { recipientId: r.id, action },
                                        );
                                        await loadReport();
                                        setD(await api(`/campaigns/${d.id}`));
                                      })
                                    }
                                  >
                                    {action}
                                  </button>
                                ))}
                              </div>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>Activity</h3>
              <ul className="email-history">
                {report.history.map((h, i) => (
                  <li key={i}>
                    <strong>{h.actor}</strong> · {h.action.replaceAll("_", " ")}
                    <small>{date(h.at)}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
// The account client remains the only authenticated request path; this helper
// reaches the existing event tool through the same API wrapper.
async function requestEvents(api, filter = "upcoming") {
  const events = [];
  let page = 1,
    more = true;
  while (more && page <= 200) {
    const result = await api(`/staff/events?filter=${filter}&page=${page++}`);
    events.push(...result.events);
    more = result.hasMore;
  }
  return { events };
}

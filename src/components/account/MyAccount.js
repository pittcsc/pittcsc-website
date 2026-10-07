import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import {
  formFromProfile,
  profileInput,
  HANDLES,
} from "../../lib/account/form.mjs";
import AccountFiles from "./AccountFiles";
import "../../styles/account.scss";

/* The field groups are shared: the guided flow shows one per step, the editor
   shows them all at once, and both render exactly the same inputs. */

function NameFields({ form, change }) {
  return (
    <>
      <div className="csc-account-name-grid">
        <div>
          <label htmlFor="first-name">First name</label>
          <input
            id="first-name"
            autoComplete="given-name"
            maxLength={100}
            value={form.firstName}
            onChange={(event) => change("firstName", event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="last-name">Last name</label>
          <input
            id="last-name"
            autoComplete="family-name"
            maxLength={100}
            value={form.lastName}
            onChange={(event) => change("lastName", event.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="preferred-name">
          Preferred name <span>(optional)</span>
        </label>
        <input
          id="preferred-name"
          autoComplete="nickname"
          maxLength={100}
          value={form.preferredName}
          onChange={(event) => change("preferredName", event.target.value)}
        />
      </div>
    </>
  );
}

function YearField({ form, change }) {
  return (
    <div>
      <label htmlFor="graduation-year">Graduation year</label>
      <input
        id="graduation-year"
        type="number"
        inputMode="numeric"
        min="1900"
        max="2100"
        step="1"
        placeholder="2028"
        value={form.graduationYear}
        onChange={(event) => change("graduationYear", event.target.value)}
      />
    </div>
  );
}

function MajorFields({ form, change }) {
  return (
    <>
      {form.majors.map((major, index) => (
        <div className="csc-account-major" key={index}>
          <div>
            <label htmlFor={`major-${index}`}>Major {index + 1}</label>
            <input
              id={`major-${index}`}
              maxLength={120}
              value={major}
              onChange={(event) =>
                change(
                  "majors",
                  form.majors.map((value, i) =>
                    i === index ? event.target.value : value,
                  ),
                )
              }
            />
          </div>
          <button
            type="button"
            className="csc-auth-secondary"
            aria-label={`Remove major ${index + 1}`}
            onClick={() =>
              change(
                "majors",
                form.majors.length === 1
                  ? [""]
                  : form.majors.filter((_, i) => i !== index),
              )
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="csc-auth-secondary"
        disabled={form.majors.length >= 8}
        onClick={() => change("majors", [...form.majors, ""])}
      >
        Add another major
      </button>
    </>
  );
}

function HandleFields({ form, change }) {
  return Object.entries(HANDLES).map(([field, spec]) => (
    <div className="csc-account-handle" key={field}>
      <label htmlFor={field}>{spec.label}</label>
      <div className="csc-account-handle-input">
        <span aria-hidden="true">{spec.base}</span>
        <input
          id={field}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          maxLength={100}
          placeholder={spec.placeholder}
          value={form[field]}
          onChange={(event) => change(field, event.target.value)}
        />
      </div>
    </div>
  ));
}

// One question per step. The last one holds the optional uploads, which save
// through their own endpoints rather than with the rest of the form.
const STEPS = [
  { id: "name", title: "What’s your name?", Fields: NameFields },
  { id: "year", title: "When do you graduate?", Fields: YearField },
  { id: "majors", title: "What are you studying?", Fields: MajorFields },
  {
    id: "handles",
    title: "Where can we find you?",
    hint: "Your usernames, not the full links — pasting a profile URL works too.",
    Fields: HandleFields,
  },
  { id: "files", title: "Add a photo and resume", optional: true },
];

// Each Next saves, so someone who leaves mid-flow should come back to the
// first question they have not answered rather than clicking through
// pre-filled steps.
function firstUnanswered(profile) {
  const answered = [
    profile.firstName && profile.lastName,
    profile.graduationYear,
    profile.majors?.length,
    profile.githubUsername &&
      profile.leetcodeUsername &&
      profile.linkedinUsername,
  ];
  const index = answered.findIndex((value) => !value);
  return index === -1 ? STEPS.length - 1 : index;
}

export default function MyAccount({ identity }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Fixed when the profile first loads, so finishing a step mid-flow cannot
  // flip the page out from under someone the moment it becomes complete.
  const [guided, setGuided] = useState(null);
  const [step, setStep] = useState(0);
  const lifetime = useRef(null);
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setLoading(true);
    setError("");
    request("/profile", { userID: identity.id, signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return;
        setProfile(value);
        setForm(formFromProfile(value));
        setGuided((current) => {
          if (current !== null) return current;
          if (value.complete) return false;
          setStep(firstUnanswered(value));
          return true;
        });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identity.id, request, attempt]);

  // Writes whatever is filled in so far. Blank fields are valid and clear, so
  // a half-finished profile saves without inventing anything.
  async function persist() {
    const signal = lifetime.current.signal;
    const input = profileInput(form);
    setSaving(true);
    try {
      const value = await request("/profile", {
        userID: identity.id,
        signal,
        method: "PUT",
        contentType: "application/json",
        body: JSON.stringify(input),
      });
      if (signal.aborted) return null;
      setProfile(value);
      setForm(formFromProfile(value));
      return value;
    } finally {
      if (!signal.aborted) setSaving(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setNotice("");
    try {
      if (await persist()) setNotice("Your profile has been saved.");
    } catch (failure) {
      if (!lifetime.current.signal.aborted) setError(failure.message);
    }
  }

  async function next(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setNotice("");
    try {
      // The uploads step has nothing of its own to write.
      if (!STEPS[step].optional && !(await persist())) return;
      if (lifetime.current.signal.aborted) return;
      if (step < STEPS.length - 1) {
        setStep(step + 1);
        setNotice("Saved so far.");
      } else {
        setGuided(false);
      }
    } catch (failure) {
      if (!lifetime.current.signal.aborted) setError(failure.message);
    }
  }

  const change = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice("");
  };

  const files = profile && (
    <AccountFiles
      profile={profile}
      userID={identity.id}
      request={request}
      onChanged={async (signal) => {
        const value = await request("/profile", {
          userID: identity.id,
          signal,
        });
        if (!signal.aborted) setProfile(value);
      }}
    />
  );

  function renderGuided() {
    const current = STEPS[step];
    const last = step === STEPS.length - 1;
    return (
      <>
        <div className="csc-account-steps">
          <div>
            {STEPS.map((entry, index) => (
              <span
                key={entry.id}
                className={index <= step ? "done" : undefined}
              />
            ))}
          </div>
          <p>
            Step {step + 1} of {STEPS.length}
            {current.optional ? " · optional" : ""}
          </p>
        </div>
        <form onSubmit={next}>
          <fieldset disabled={saving}>
            <legend>{current.title}</legend>
            {current.hint && <p className="csc-account-hint">{current.hint}</p>}
            {current.Fields && <current.Fields form={form} change={change} />}
          </fieldset>
          {current.optional && files}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <div className="csc-account-nav">
            {step > 0 && (
              <button
                type="button"
                className="csc-auth-secondary"
                disabled={saving}
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                  setNotice("");
                }}
              >
                Back
              </button>
            )}
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : last ? "Finish" : "Next"}
            </button>
          </div>
        </form>
      </>
    );
  }

  function renderEditor() {
    return (
      <>
        <form onSubmit={save}>
          <fieldset disabled={saving}>
            <legend>About you</legend>
            <NameFields form={form} change={change} />
            <YearField form={form} change={change} />
            <fieldset className="csc-account-majors">
              <legend>Majors</legend>
              <MajorFields form={form} change={change} />
            </fieldset>
            <fieldset className="csc-account-handles">
              <legend>Profiles</legend>
              <HandleFields form={form} change={change} />
            </fieldset>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
        {files}
      </>
    );
  }

  return (
    <div className="csc-account">
      <Link to="/dashboard" className="csc-account-back">
        ← Dashboard
      </Link>
      <h1>My Account</h1>
      <p>Your club profile. You can save your progress at any time.</p>
      {loading ? (
        <p role="status">Loading your profile…</p>
      ) : !profile ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </>
      ) : (
        <>
          <div className="csc-account-completion">
            <strong>
              {profile.complete ? "Profile complete" : "Complete your profile"}
            </strong>
            {!profile.complete && !guided && (
              <p>
                Add your first and last name, graduation year, at least one
                major, and your GitHub, LeetCode and LinkedIn usernames. You can
                finish later.
              </p>
            )}
          </div>
          <p className="csc-account-email">
            Signed in as <strong>{profile.email}</strong>
          </p>
          {guided ? renderGuided() : renderEditor()}
        </>
      )}
    </div>
  );
}

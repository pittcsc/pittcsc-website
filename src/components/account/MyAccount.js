import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import { formFromProfile, profileInput } from "../../lib/account/form.mjs";
import AccountFiles from "./AccountFiles";
import "../../styles/account.scss";

export default function MyAccount({ identity }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identity.id, request, attempt]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setNotice("");
    const signal = lifetime.current.signal;
    try {
      const input = profileInput(form);
      setSaving(true);
      const value = await request("/profile", {
        userID: identity.id,
        signal,
        method: "PUT",
        contentType: "application/json",
        body: JSON.stringify(input),
      });
      if (signal.aborted) return;
      setProfile(value);
      setForm(formFromProfile(value));
      setNotice("Your profile has been saved.");
    } catch (failure) {
      if (!signal.aborted) setError(failure.message);
    } finally {
      if (!signal.aborted) setSaving(false);
    }
  }

  const change = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice("");
  };

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
            {!profile.complete && (
              <p>
                Add your first and last name, graduation year, and at least one
                major. You can finish later.
              </p>
            )}
          </div>
          <p className="csc-account-email">
            Signed in as <strong>{profile.email}</strong>
          </p>
          <form onSubmit={save}>
            <fieldset disabled={saving}>
              <legend>About you</legend>
              <div className="csc-account-name-grid">
                <div>
                  <label htmlFor="first-name">First name</label>
                  <input
                    id="first-name"
                    autoComplete="given-name"
                    maxLength={100}
                    value={form.firstName}
                    onChange={(event) =>
                      change("firstName", event.target.value)
                    }
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
              <label htmlFor="preferred-name">
                Preferred name <span>(optional)</span>
              </label>
              <input
                id="preferred-name"
                autoComplete="nickname"
                maxLength={100}
                value={form.preferredName}
                onChange={(event) =>
                  change("preferredName", event.target.value)
                }
              />
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
                onChange={(event) =>
                  change("graduationYear", event.target.value)
                }
              />
              <fieldset className="csc-account-majors">
                <legend>Majors</legend>
                {form.majors.map((major, index) => (
                  <div className="csc-account-major" key={index}>
                    <div>
                      <label htmlFor={`major-${index}`}>
                        Major {index + 1}
                      </label>
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
              </fieldset>
            </fieldset>
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
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
        </>
      )}
    </div>
  );
}

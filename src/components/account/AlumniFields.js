import React from "react";
import { HELP_FIELDS, ALUMNI_TEXT } from "../../lib/alumni/profile.mjs";
export default function AlumniFields({ form, change }) {
  return (
    <fieldset className="csc-account-alumni">
      <legend>AlumniDB</legend>
      <p>
        Complete these fields, your name, graduation year, LinkedIn and photo to
        publish. Nothing appears in AlumniDB until you choose Publish my
        AlumniDB profile. Shared profile changes appear immediately once
        published.
      </p>
      {Object.entries(ALUMNI_TEXT).map(([key, spec]) => (
        <div key={key}>
          <label htmlFor={`alumni-${key}`}>{spec.label}</label>
          {key === "bio" ? (
            <textarea
              id={`alumni-${key}`}
              maxLength={spec.max}
              rows={5}
              value={form[key]}
              onChange={(e) => change(key, e.target.value)}
            />
          ) : (
            <input
              id={`alumni-${key}`}
              maxLength={spec.max}
              type={key === "contactEmail" ? "email" : "text"}
              value={form[key]}
              onChange={(e) => change(key, e.target.value)}
            />
          )}
        </div>
      ))}
      <label htmlFor="alumni-position">This position is</label>
      <select
        id="alumni-position"
        value={form.positionIsCurrent ? "current" : "recent"}
        onChange={(e) =>
          change("positionIsCurrent", e.target.value === "current")
        }
      >
        <option value="current">My current position</option>
        <option value="recent">My most recent position</option>
      </select>
      <fieldset className="csc-account-help">
        <legend>I'm willing to help with</legend>
        <p>Offer at least one. Unchecked options mean not offered.</p>
        {Object.entries(HELP_FIELDS).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => change(key, e.target.checked)}
            />{" "}
            {label}
          </label>
        ))}
      </fieldset>
      <p>
        Your contact email will be visible to signed-in directory readers. It
        does not change your Pitt sign-in. Your resume remains private.
      </p>
    </fieldset>
  );
}

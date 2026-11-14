import React from "react";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function SubmissionList({ claims, labels, onWithdraw, busy }) {
  if (claims.length === 0) return <p>No submissions yet.</p>;

  return (
    <ul>
      {claims.map((claim) => (
        <li key={claim.id}>
          <div>
            <strong>
              {claim.label || labels?.[claim.category] || claim.category}
            </strong>
            <span>
              {dateFormat.format(new Date(claim.awardedAt))} ·{" "}
              {claim.status === "awarded"
                ? `+${claim.points} points`
                : claim.status}
            </span>
          </div>
          {claim.summary && (
            <p className="csc-points-submission-summary">{claim.summary}</p>
          )}
          <a href={claim.url} target="_blank" rel="noopener noreferrer">
            {claim.url}
          </a>
          {claim.status === "revoked" && claim.statusReason && (
            <p>Staff reason: {claim.statusReason}</p>
          )}
          {onWithdraw && claim.status === "awarded" && (
            <button
              type="button"
              className="csc-auth-secondary"
              disabled={busy}
              onClick={() => void onWithdraw(claim)}
            >
              Withdraw claim
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

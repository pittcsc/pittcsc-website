import React from "react";
import {
  foundryMonthLabel,
  foundryMonthName,
  foundryProgress,
  foundryRemaining,
} from "../../lib/member/foundry.mjs";

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.6 2.3c.4 2.6-.6 4.3-2 5.9C9.1 9.9 7.5 11.6 7.5 14.4A4.6 4.6 0 0 0 12 19a4.6 4.6 0 0 0 4.5-4.6c0-1.5-.5-2.7-1.4-3.8-.2 1.2-.8 2.1-1.8 2.6.4-2.8-.2-5.9-.7-11Zm-1 11.2c.2 1.1.9 1.6 1.6 2.1.5.4.8.8.8 1.4a1.9 1.9 0 0 1-3.9 0c0-1.3.7-2.4 1.5-3.5Z"
      />
      <path fill="currentColor" d="M5 21h14v1.5H5z" />
    </svg>
  );
}

// Pointer position drives the tilt and the specular highlight through CSS
// custom properties, so moving the mouse never re-renders React.
function track(event) {
  if (event.pointerType === "touch") return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width;
  const y = (event.clientY - box.top) / box.height;
  card.style.setProperty("--tilt-x", `${(0.5 - y) * 14}deg`);
  card.style.setProperty("--tilt-y", `${(x - 0.5) * 18}deg`);
  card.style.setProperty("--shine-x", `${x * 100}%`);
  card.style.setProperty("--shine-y", `${y * 100}%`);
  card.classList.add("is-tracking");
}

function release(event) {
  const card = event.currentTarget;
  for (const name of ["--tilt-x", "--tilt-y", "--shine-x", "--shine-y"])
    card.style.removeProperty(name);
  card.classList.remove("is-tracking");
}

export default function FoundryCard({ status }) {
  const month = foundryMonthLabel(status.month);
  const label = status.active ? "Active" : "Inactive";
  const remaining = foundryRemaining(status);

  return (
    <figure className="csc-foundry-stage">
      <div
        className={`csc-foundry-card ${status.active ? "is-active" : "is-inactive"}`}
        onPointerMove={track}
        onPointerLeave={release}
      >
        <span className="csc-foundry-card-shine" aria-hidden="true" />
        <div className="csc-foundry-card-top">
          <span className="csc-foundry-card-brand">
            <FlameIcon />
            Foundry
          </span>
          <span className="csc-foundry-card-status">
            <span className="csc-foundry-card-dot" aria-hidden="true" />
            {label}
          </span>
        </div>
        <p className="csc-foundry-card-name">{status.name}</p>
        <p className="csc-foundry-card-role">Pitt CSC member</p>
        <div className="csc-foundry-card-meta">
          <span>{month}</span>
          <span>
            <strong>{status.points}</strong> / {status.threshold} pts
          </span>
        </div>
        <div
          className="csc-foundry-card-meter"
          role="progressbar"
          aria-label={`Foundry points for ${month}`}
          aria-valuemin={0}
          aria-valuemax={status.threshold}
          aria-valuenow={Math.min(status.points, status.threshold)}
        >
          <span style={{ width: `${foundryProgress(status)}%` }} />
        </div>
      </div>
      <figcaption className="csc-foundry-caption">
        {status.active
          ? `You're active through the end of ${foundryMonthName(status.month)}.`
          : `${remaining} more ${remaining === 1 ? "point" : "points"} to go active.`}
      </figcaption>
    </figure>
  );
}

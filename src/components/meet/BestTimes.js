import React, { useState } from "react";
import { Tag } from "./GroupGrid";
import {
  STATE_LABEL,
  buildIcs,
  describeWindow,
  downloadIcs,
  googleCalendarUrl,
} from "../../lib/meet/format";
import { durationLabel } from "../../lib/meet/time";

const ACTION =
  "px-4 py-2 text-sm font-bold bg-surface-raised border border-line-strong rounded-full hover:border-ink-muted transition";

/**
 * The answer. Ranked windows of the requested length, each expanding to name exactly
 * who can't make it — the question an organizer asks next — and to hand the winner
 * straight to a calendar.
 */
export default function BestTimes({
  windows,
  group,
  slots,
  viewerTz,
  meeting,
  shareUrl,
  onHover,
}) {
  const [open, setOpen] = useState(0);

  if (!group.total) {
    return (
      <div className="p-8 text-center bg-surface-raised border border-line rounded-2xl">
        <p className="font-bold">No one has answered yet</p>
        <p className="mt-1 text-ink-muted text-sm">
          Share the link and the best times will show up here.
        </p>
      </div>
    );
  }

  if (!windows.length) {
    return (
      <div className="p-6 bg-surface-raised border border-line rounded-2xl">
        <p className="font-bold">Nothing fits {durationLabel(meeting.durationMin)}</p>
        <p className="mt-1 text-ink-muted text-sm">
          The daily window is shorter than the meeting length.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {windows.map((window, rank) => {
        const when = describeWindow(window, slots, viewerTz);
        const expanded = open === rank;
        const perfect = window.count === group.total;

        return (
          <div key={`${window.start}-${window.k}`}>
            <button
              type="button"
              className={`flex items-center gap-4 w-full px-5 py-4 text-left bg-surface-raised border transition ${
                expanded
                  ? "border-primary rounded-t-2xl"
                  : "border-line rounded-2xl hover:border-line-strong"
              }`}
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? -1 : rank)}
              onMouseEnter={() => onHover && onHover(window)}
              onFocus={() => onHover && onHover(window)}
              onMouseLeave={() => onHover && onHover(null)}
              onBlur={() => onHover && onHover(null)}
            >
              <span
                className={`grid flex-none place-items-center w-7 h-7 text-xs font-bold rounded-lg ${
                  rank === 0
                    ? "bg-secondary-100 text-yellow-900"
                    : "bg-surface-sunken text-ink-muted"
                }`}
                aria-hidden="true"
              >
                {rank + 1}
              </span>

              <span className="flex-1 min-w-0">
                <span className="block font-bold">
                  {when.dowLong} {when.md}
                  <span className="text-ink-faint font-normal"> · </span>
                  {when.range}
                </span>
                <span className="block mt-0.5 text-ink-muted text-sm">
                  {perfect ? "Works for everyone who answered" : summarize(window, group)}
                </span>
              </span>

              <span className="flex-none text-right">
                <span className={`block text-xl font-bold ${perfect ? "text-primary" : ""}`}>
                  {window.count}/{group.total}
                </span>
                <span className="block text-ink-faint text-xs">available</span>
              </span>
            </button>

            {expanded && (
              <div className="px-5 pt-1 pb-5 space-y-3 bg-surface-raised border border-t-0 border-primary rounded-b-2xl">
                {[
                  { label: STATE_LABEL.unavailable, kind: "no", people: window.no },
                  { label: STATE_LABEL.ifNeeded, kind: "maybe", people: window.maybe },
                  { label: STATE_LABEL.available, kind: "yes", people: window.yes },
                ]
                  .filter((row) => row.people.length)
                  .map((row) => (
                    <div className="flex flex-wrap items-center gap-2" key={row.label}>
                      <span className="text-ink-faint text-xs font-bold tracking-wide uppercase">
                        {row.label}
                      </span>
                      {row.people.map((person) => (
                        <Tag kind={row.kind} key={person.id}>
                          {person.name}
                        </Tag>
                      ))}
                    </div>
                  ))}

                {group.pending > 0 && (
                  <p className="text-ink-faint text-sm">
                    {group.pending}{" "}
                    {group.pending === 1 ? "person hasn't" : "people haven't"} answered yet.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={ACTION}
                    onClick={() =>
                      downloadIcs(
                        `${slugify(meeting.name)}.ics`,
                        buildIcs({
                          title: meeting.name,
                          startMs: when.startMs,
                          endMs: when.endMs,
                          url: shareUrl,
                          attendeeCount: `${window.count} of ${group.total}`,
                        })
                      )
                    }
                  >
                    Download .ics
                  </button>
                  <a
                    className={ACTION}
                    href={googleCalendarUrl({
                      title: meeting.name,
                      startMs: when.startMs,
                      endMs: when.endMs,
                      url: shareUrl,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Add to Google Calendar
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function summarize(window, group) {
  const parts = [];
  if (window.no.length) {
    const names = window.no.slice(0, 2).map((p) => p.name).join(", ");
    const rest = window.no.length - 2;
    parts.push(`${names}${rest > 0 ? ` +${rest}` : ""} can't make it`);
  }
  if (window.maybe.length) {
    parts.push(
      window.maybe.length === 1
        ? `${window.maybe[0].name} could make it work`
        : `${window.maybe.length} others could make it work`
    );
  }
  if (!parts.length) parts.push(`${window.count} of ${group.total} free`);
  return parts.join(" · ");
}

function slugify(text) {
  return (
    String(text || "meeting")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "meeting"
  );
}

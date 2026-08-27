import React from "react";
import Avatar from "./Initials";

/**
 * Who's in, who's still missing, and the what-if lever.
 *
 * Clicking someone drops them from the calculation. With a handful of people that's a
 * curiosity; with thirty and no unanimous time it's the whole question — "what works if
 * the two who can never do Thursdays sit this one out" — answered in one tap instead of
 * a second poll.
 */
export default function Roster({ group, youId, muted, onToggleMute }) {
  const hasMuted = muted && muted.size > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-bold">
          {group.total} answered
          {group.pending > 0 ? ` · ${group.pending} still deciding` : ""}
        </h2>
        {hasMuted && (
          <button
            type="button"
            className="text-primary text-sm font-bold underline"
            onClick={() => onToggleMute(null)}
          >
            Include everyone
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {group.answered.map((person) => (
          <button
            type="button"
            key={person.id}
            onClick={() => onToggleMute(person.id)}
            aria-pressed={person.muted}
            title={
              person.muted
                ? `Count ${person.name} again`
                : `See what works without ${person.name}`
            }
            className={`inline-flex items-center gap-2 py-1.5 pl-2 pr-3 text-sm bg-white border rounded-full transition ${
              person.muted ? "opacity-40 line-through" : ""
            } ${
              person.id === youId
                ? "border-primary ring-2 ring-blue-100"
                : "border-gray-300 hover:border-gray-500"
            }`}
          >
            <Avatar name={person.name} />
            {person.name}
            {person.id === youId && <span className="text-gray-400 text-xs">you</span>}
          </button>
        ))}

        {group.waiting.map((person) => (
          <span
            key={person.id}
            title="Opened the link, hasn't marked anything yet"
            className="inline-flex items-center gap-2 py-1.5 pl-2 pr-3 text-gray-400 text-sm border border-gray-300 border-dashed rounded-full"
          >
            <Avatar name={person.name} pending />
            {person.name}
          </span>
        ))}
      </div>

      {hasMuted && (
        <p className="mt-3 text-gray-400 text-sm">
          Showing results without {muted.size === 1 ? "that person" : "those people"}.
          Nothing changed for anyone else.
        </p>
      )}
    </div>
  );
}

import React from "react";
import GridFrame from "./GridFrame";
import { partitionAt } from "../../lib/meet/score";
import { STATE_LABEL } from "../../lib/meet/format";
import { dayLabel, timeLabel } from "../../lib/meet/time";

const LEGEND_ITEM = "inline-flex items-center gap-2";

/**
 * The group view.
 *
 * The grid is here because sometimes you want to see the shape of the week, but it is
 * deliberately the *second* thing on the page, under an answer already worked out. It
 * also refuses the usual red/green: density is one blue ramp with the headcount printed
 * in the cell, "nobody" is a hatch, "someone said if needed" is a corner notch, and the
 * recommended window is a gold ring. Every distinction survives greyscale.
 */
export default function GroupGrid({
  view,
  group,
  bestSlots,
  focusSlots,
  selected,
  onSelect,
}) {
  const total = group.total;
  const { free, maybe } = group.perSlot;

  const renderCell = ({ key, slotIndex, minute, label, shape }) => {
    const freeCount = total ? free[slotIndex] : 0;
    const maybeCount = total ? maybe[slotIndex] : 0;
    const ratio = total ? freeCount / total : 0;
    // Gamma, not a straight line. What matters is the difference between "almost
    // everyone" and "everyone", so spend the top of the ramp there and keep thin
    // turnouts pale. The 0.05 floor still separates "one person" from "none".
    const heat = freeCount === 0 ? 0 : 0.05 + Math.pow(ratio, 1.5) * 0.95;

    return (
      <button
        type="button"
        key={key}
        className="meet-cell meet-cell--group"
        data-slot={slotIndex}
        data-any={freeCount > 0}
        data-best={bestSlots && bestSlots.has(slotIndex)}
        data-focusband={focusSlots && focusSlots.has(slotIndex)}
        {...shape}
        onClick={() => onSelect && onSelect(slotIndex === selected ? null : slotIndex)}
        aria-pressed={selected === slotIndex}
        aria-label={`${label.dow} ${label.md} ${timeLabel(minute)} — ${freeCount} of ${total} free${
          maybeCount ? `, ${maybeCount} if needed` : ""
        }`}
      >
        <span className="meet-cell__heat" style={{ "--heat": heat }} aria-hidden="true" />
        {maybeCount > 0 && <span className="meet-cell__maybe" aria-hidden="true" />}
        <span className="meet-cell__n" data-inverse={heat > 0.52} aria-hidden="true">
          {total ? freeCount : ""}
        </span>
      </button>
    );
  };

  const detail = selected != null ? describeSlot(group, view, selected) : null;

  return (
    <div>
      <GridFrame view={view} renderCell={renderCell} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-gray-500 text-xs">
        <span className={LEGEND_ITEM}>
          <span className="meet-swatch" data-state="ramp" /> Fewer free → everyone free
        </span>
        <span className={LEGEND_ITEM}>
          <span className="meet-swatch" data-state="none" /> Nobody
        </span>
        <span className={LEGEND_ITEM}>
          <span className="meet-swatch" data-state="best" /> Recommended
        </span>
        <span className={LEGEND_ITEM}>
          <span className="meet-swatch overflow-hidden" aria-hidden="true">
            <span className="meet-cell__maybe" />
          </span>
          If needed
        </span>
        <span className="text-gray-400">Tap a cell to see who&apos;s free</span>
      </div>

      {detail && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-2xl">
          <div className="mb-3 font-bold">{detail.heading}</div>
          {detail.groups.map((row) => (
            <div className="flex flex-wrap items-center gap-2 mb-2" key={row.label}>
              <span className="text-gray-400 text-xs font-bold tracking-wide uppercase">
                {row.label}
              </span>
              {row.people.length ? (
                row.people.map((person) => (
                  <Tag kind={row.kind} key={person.id}>
                    {person.name}
                  </Tag>
                ))
              ) : (
                <span className="text-gray-400 text-sm">nobody</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Tag({ kind, children }) {
  const style =
    kind === "no"
      ? "bg-gray-900 border-gray-900 text-white"
      : kind === "maybe"
      ? "bg-secondary-200 border-secondary-100 text-yellow-900"
      : "bg-white border-gray-300 text-gray-700";
  return (
    <span className={`px-3 py-1 text-sm border rounded-full ${style}`}>{children}</span>
  );
}

function describeSlot(group, view, slotIndex) {
  const { yes, maybe, no } = partitionAt(group, slotIndex, 1);

  // Read the coordinates back out of the projected grid rather than recomputing them
  // from the meeting, so the heading always names the time in the timezone the reader
  // is actually looking at.
  let heading = "This time";
  for (const iso of view.cols) {
    const minute = view.rows.find((m) => view.at(iso, m) === slotIndex);
    if (minute !== undefined) {
      const label = dayLabel(iso);
      heading = `${label.dowLong}, ${label.md} at ${timeLabel(minute)}`;
      break;
    }
  }

  return {
    heading,
    groups: [
      { label: STATE_LABEL.available, kind: "yes", people: yes },
      { label: STATE_LABEL.ifNeeded, kind: "maybe", people: maybe },
      { label: STATE_LABEL.unavailable, kind: "no", people: no },
    ].filter((row) => row.people.length || row.kind === "no"),
  };
}

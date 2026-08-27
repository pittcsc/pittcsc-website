import React from "react";
import { timeLabel } from "../../lib/meet/time";

const MIN = 6 * 60; // 6 AM — earlier than any meeting a club actually schedules
const MAX = 24 * 60;
const STEP = 30;
const TICKS = [6 * 60, 12 * 60, 18 * 60, 24 * 60];

/**
 * A two-handled range over the day, instead of a pair of 48-option dropdowns.
 *
 * It's one row instead of two controls, it shows the shape of the window rather than
 * describing it, and because it's built from two real `<input type="range">` elements
 * it keeps native keyboard stepping and screen-reader semantics for free. Only the
 * thumbs take pointer events, so the two inputs can share one track.
 */
export default function TimeRangeSlider({ startMin, endMin, onChange }) {
  const pct = (value) => ((value - MIN) / (MAX - MIN)) * 100;

  const setStart = (value) => onChange(Math.min(value, endMin - STEP), endMin);
  const setEnd = (value) => onChange(startMin, Math.max(value, startMin + STEP));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-bold">
          {timeLabel(startMin, { compact: true })} –{" "}
          {endMin === MAX ? "Midnight" : timeLabel(endMin, { compact: true })}
        </span>
        <span className="text-sm text-gray-400">
          {Math.round((endMin - startMin) / 60)} hour window
        </span>
      </div>

      <div className="meet-range">
        <div className="meet-range__track" />
        <div
          className="meet-range__fill"
          style={{ left: `${pct(startMin)}%`, right: `${100 - pct(endMin)}%` }}
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={startMin}
          aria-label="Earliest time"
          aria-valuetext={timeLabel(startMin)}
          onChange={(e) => setStart(Number(e.target.value))}
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={endMin}
          aria-label="Latest time"
          aria-valuetext={endMin === MAX ? "Midnight" : timeLabel(endMin)}
          onChange={(e) => setEnd(Number(e.target.value))}
        />
      </div>

      <div className="relative h-4 text-gray-400 text-xs">
        {TICKS.map((tick, i) => {
          // Edge ticks align to the edge instead of centring, or they hang off it.
          const edge =
            i === 0 ? "translate-x-0" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2";
          return (
            <span
              key={tick}
              className={`absolute whitespace-nowrap ${edge}`}
              style={{ left: `${pct(tick)}%` }}
            >
              {tick === MAX ? "12 AM" : timeLabel(tick, { compact: true })}
            </span>
          );
        })}
      </div>
    </div>
  );
}

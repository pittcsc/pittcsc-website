import React, { useMemo, useRef, useState } from "react";
import { summarizeDates } from "../../lib/meet/format";
import { dayLabel, isoAddDays, isoOf, isoToday, isoWeekday, parseIso } from "../../lib/meet/time";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const NAV =
  "w-8 h-8 text-gray-500 text-lg leading-none bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default";

/**
 * Multi-select days, not a date range.
 *
 * The question is "what days could work", and the honest answer is often discontinuous
 * — Thursday and Friday and Sunday, but not Saturday. A conventional range picker can't
 * express that, so selected days stay individual filled cells and a gap reads as a gap.
 *
 * Dragging paints, using the same gesture and the same polarity as the availability
 * grid: filled means chosen. Because a run of selected days can leave the visible month
 * (a "next 7 days" starting on the 27th), the header carries a written summary and a
 * jump link for anything selected off-screen — the calendar alone can't be trusted to
 * show the whole answer.
 */
export default function MonthPicker({ value, onChange, tz }) {
  const today = useMemo(() => isoToday(tz), [tz]);
  const [cursor, setCursor] = useState(() => {
    const first = value.length ? value.slice().sort()[0] : today;
    const p = parseIso(first);
    return { y: p.y, m: p.m };
  });
  const [preview, setPreview] = useState(null);
  const drag = useRef(null);

  const selected = useMemo(() => new Set(value), [value]);
  const monthKey = `${cursor.y}-${String(cursor.m).padStart(2, "0")}`;

  const cells = useMemo(() => {
    const lead = isoWeekday(isoOf(cursor.y, cursor.m, 1));
    const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
    const out = [];
    for (let i = 0; i < lead; i += 1) out.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(isoOf(cursor.y, cursor.m, d));
    return out;
  }, [cursor]);

  /** Selected days that aren't in the month on screen, so nothing hides. */
  const offscreen = useMemo(() => {
    const other = value.filter((iso) => !iso.startsWith(monthKey)).sort();
    if (!other.length) return null;
    const p = parseIso(other[0]);
    return { count: other.length, jumpTo: { y: p.y, m: p.m }, month: MONTHS[p.m - 1] };
  }, [value, monthKey]);

  const rangeBetween = (a, b) => {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const out = [];
    let day = lo;
    for (let guard = 0; guard < 400 && day <= hi; guard += 1) {
      out.push(day);
      day = isoAddDays(day, 1);
    }
    return out;
  };

  const applyRange = (from, to, adding) => {
    const next = new Set(selected);
    for (const iso of rangeBetween(from, to)) {
      if (iso < today) continue;
      if (adding) next.add(iso);
      else next.delete(iso);
    }
    onChange(Array.from(next).sort());
  };

  const startDrag = (iso) => {
    if (iso < today) return;
    const adding = !selected.has(iso);
    drag.current = { from: iso, adding };
    setPreview({ from: iso, to: iso, adding });
    applyRange(iso, iso, adding);
  };

  const extendDrag = (iso) => {
    if (!drag.current || iso < today) return;
    setPreview({ ...drag.current, to: iso });
  };

  const endDrag = () => {
    if (drag.current && preview) applyRange(preview.from, preview.to, preview.adding);
    drag.current = null;
    setPreview(null);
  };

  const previewSet = useMemo(
    () => (preview ? new Set(rangeBetween(preview.from, preview.to)) : null),
    [preview]
  );

  const isOn = (iso) => {
    if (previewSet && previewSet.has(iso)) return preview.adding;
    return selected.has(iso);
  };

  const toggleOne = (iso) => {
    if (iso < today) return;
    applyRange(iso, iso, !selected.has(iso));
  };

  /**
   * Keyboard travel across the grid. Without this the calendar is reachable but not
   * operable: activation used to live on pointerdown alone, which Enter and Space
   * never fire.
   */
  const onKeyDown = (event, iso) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (step) {
      event.preventDefault();
      const target = isoAddDays(iso, step);
      const node = document.querySelector(`[data-iso="${target}"]`);
      if (node && !node.disabled) {
        node.focus();
      } else {
        // Walked off the visible month — follow the cursor so travel doesn't dead-end.
        const p = parseIso(target);
        if (p && target >= today) {
          setCursor({ y: p.y, m: p.m });
          window.requestAnimationFrame(() => {
            const moved = document.querySelector(`[data-iso="${target}"]`);
            if (moved && !moved.disabled) moved.focus();
          });
        }
      }
    }
  };

  const shift = (delta) =>
    setCursor((c) => {
      const next = c.m + delta;
      return { y: c.y + Math.floor((next - 1) / 12), m: ((next - 1 + 12) % 12) + 1 };
    });

  return (
    <div
      className="p-3 bg-white border border-gray-200 rounded-2xl select-none"
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={NAV}
          onClick={() => shift(-1)}
          disabled={monthKey <= today.slice(0, 7)}
          aria-label="Previous month"
        >
          &#8249;
        </button>
        <span className="font-bold">
          {MONTHS[cursor.m - 1]} {cursor.y}
        </span>
        <button type="button" className={NAV} onClick={() => shift(1)} aria-label="Next month">
          &#8250;
        </button>
      </div>

      {/* The written form of the selection, next to the thing that changes it. */}
      <div className="flex flex-wrap items-baseline justify-center gap-x-2 mt-1 mb-2 text-sm">
        {value.length ? (
          <>
            <span className="font-bold text-primary">{summarizeDates(value)}</span>
            <span className="text-gray-400">
              {value.length} {value.length === 1 ? "day" : "days"}
            </span>
          </>
        ) : (
          <span className="text-gray-400">No days selected</span>
        )}
        {offscreen && (
          <button
            type="button"
            className="px-2 py-1.5 -my-1 text-gray-500 underline hover:text-gray-900"
            onClick={() => setCursor(offscreen.jumpTo)}
          >
            +{offscreen.count} in {offscreen.month}
          </button>
        )}
      </div>

      <div className="grid gap-1 grid-cols-7">
        {DOW.map((d, i) => (
          <div
            className="pb-1 text-gray-400 text-xs font-bold text-center"
            key={`${d}${i}`}
            aria-hidden="true"
          >
            {d}
          </div>
        ))}

        {cells.map((iso, i) => {
          if (!iso) return <div key={`pad${i}`} />;
          const p = parseIso(iso);
          const on = isOn(iso);
          return (
            <button
              type="button"
              key={iso}
              className="meet-day"
              data-on={on}
              data-today={iso === today}
              disabled={iso < today}
              data-iso={iso}
              onPointerDown={(e) => {
                e.preventDefault();
                startDrag(iso);
              }}
              onPointerEnter={() => extendDrag(iso)}
              // Enter and Space arrive here as a click with detail 0; a real pointer
              // click has already been handled by onPointerDown, so ignore that one.
              onClick={(e) => {
                if (e.detail === 0) toggleOne(iso);
              }}
              onKeyDown={(e) => onKeyDown(e, iso)}
              aria-pressed={on}
              aria-label={`${dayLabel(iso).dowLong} ${MONTHS[p.m - 1]} ${p.d}`}
            >
              {p.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React, { useMemo, useRef, useState } from "react";
import { isoAddDays, isoOf, isoToday, isoWeekday, parseIso } from "../../lib/meet/time";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const NAV =
  "w-8 h-8 text-gray-500 text-lg leading-none bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default";

/**
 * Pick the candidate days by dragging across them — the same paint-by-inversion
 * gesture as the availability grid, so the one interaction anyone has to learn is
 * learned once and reused. Days need not be contiguous: "the two Tuesdays after next"
 * is a perfectly reasonable thing to ask a group about, and a start/end date pair
 * can't express it.
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

  const cells = useMemo(() => {
    const firstIso = isoOf(cursor.y, cursor.m, 1);
    const lead = isoWeekday(firstIso);
    const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
    const out = [];
    for (let i = 0; i < lead; i += 1) out.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(isoOf(cursor.y, cursor.m, d));
    return out;
  }, [cursor]);

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

  const previewSet = useMemo(() => {
    if (!preview) return null;
    return new Set(rangeBetween(preview.from, preview.to));
  }, [preview]);

  const isOn = (iso) => {
    if (previewSet && previewSet.has(iso)) return preview.adding;
    return selected.has(iso);
  };

  const canGoBack = `${cursor.y}-${String(cursor.m).padStart(2, "0")}` > today.slice(0, 7);

  const shift = (delta) => {
    setCursor((c) => {
      const next = c.m + delta;
      return { y: c.y + Math.floor((next - 1) / 12), m: ((next - 1 + 12) % 12) + 1 };
    });
  };

  return (
    <div
      className="p-3 bg-white border border-gray-200 rounded-2xl select-none"
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          className={NAV}
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          &#8249;
        </button>
        <span className="font-bold">
          {MONTHS[cursor.m - 1]} {cursor.y}
        </span>
        <button
          type="button"
          className={NAV}
          onClick={() => shift(1)}
          aria-label="Next month"
        >
          &#8250;
        </button>
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
          const past = iso < today;
          const p = parseIso(iso);
          return (
            <button
              type="button"
              key={iso}
              className="meet-day"
              data-on={isOn(iso)}
              data-today={iso === today}
              disabled={past}
              onPointerDown={(e) => {
                e.preventDefault();
                startDrag(iso);
              }}
              onPointerEnter={() => extendDrag(iso)}
              aria-pressed={isOn(iso)}
              aria-label={`${MONTHS[p.m - 1]} ${p.d}`}
            >
              {p.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

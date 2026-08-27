import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridFrame from "./GridFrame";
import { AVAILABLE, IF_NEEDED, UNAVAILABLE } from "../../lib/meet/model";
import { dayLabel, isoWeekday, rangeLabel, timeLabel } from "../../lib/meet/time";

const STATE_WORD = { 0: "unavailable", 1: "if needed", 2: "available" };

/**
 * The input surface: **drag to add the times you're free.**
 *
 * Selection means availability, the same way it does in the date picker on the create
 * screen and the same way it does in every other scheduling tool. An earlier version of
 * this inverted it — everything started selected and you painted your conflicts — which
 * bought a few gestures and cost far too much:
 *
 *   - it fails silently in the dangerous direction. Misread "paint free" and you look
 *     unavailable, which is conspicuous and someone asks. Misread "paint busy" and you
 *     look wide open, and the group books a time you can't make.
 *   - a blank answer became a claim. Every hour you never considered read as a yes.
 *
 * The gesture count is recovered where it should be — presets and calendar import —
 * rather than by redefining what a filled cell means. "Weekdays" is one tap; importing
 * a calendar selects everything your events leave open.
 *
 * Pointer events are delegated to the grid container and resolved with
 * `elementFromPoint`, which is what lets one code path serve mouse, trackpad, touch and
 * stylus. Cells set `touch-action: none` so a finger drag paints instead of scrolling;
 * the time gutter keeps `pan-y` so the page can still be scrolled.
 */
export default function AvailabilityGrid({ view, states, onChange, disabled }) {
  const [draft, setDraft] = useState(null);
  const [tool, setTool] = useState(AVAILABLE);
  const [anchor, setAnchor] = useState(null);
  const [active, setActive] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [liveRange, setLiveRange] = useState(null);

  const bodyRef = useRef(null);
  const drag = useRef(null);
  const touched = useRef(new Set());

  const shown = draft || states;

  /** slot index -> where it sits in the projected grid, for keyboard travel. */
  const geometry = useMemo(() => {
    const byIndex = new Map();
    const byCell = new Map();
    view.rows.forEach((minute, rowIndex) => {
      view.cols.forEach((iso, colIndex) => {
        const slotIndex = view.at(iso, minute);
        if (slotIndex < 0) return;
        byIndex.set(slotIndex, { rowIndex, colIndex });
        byCell.set(`${rowIndex}:${colIndex}`, slotIndex);
      });
    });
    return { byIndex, byCell };
  }, [view]);

  const selectedCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < shown.length; i += 1) if (shown[i] !== UNAVAILABLE) n += 1;
    return n;
  }, [shown]);

  const commit = useCallback(
    (next, indices) => {
      onChange(next, indices);
      setDraft(null);
    },
    [onChange]
  );

  const paintMany = useCallback(
    (indices, value) => {
      if (disabled || !indices.length) return;
      const next = Uint8Array.from(states);
      for (const i of indices) next[i] = value;
      commit(next, indices);
    },
    [commit, disabled, states]
  );

  /* ------------------------------- shortcuts ------------------------------- */

  const allSlots = useMemo(() => Array.from(geometry.byIndex.keys()), [geometry]);

  const slotsWhere = useCallback(
    (predicate) => {
      const out = [];
      view.rows.forEach((minute) => {
        view.cols.forEach((iso) => {
          const slotIndex = view.at(iso, minute);
          if (slotIndex >= 0 && predicate(iso, minute)) out.push(slotIndex);
        });
      });
      return out;
    },
    [view]
  );

  /**
   * Presets are how the low-effort case stays low-effort without inverting what
   * selection means. Only the ones that would actually select something in this
   * meeting's window are offered — a dead "Evenings" button on a 9-to-5 poll is worse
   * than no button.
   */
  const presets = useMemo(() => {
    const isWeekday = (iso) => {
      const d = isoWeekday(iso);
      return d >= 1 && d <= 5;
    };
    const candidates = [
      { label: "Anytime", pick: () => allSlots },
      { label: "Weekdays", pick: () => slotsWhere((iso) => isWeekday(iso)) },
      { label: "Weekends", pick: () => slotsWhere((iso) => !isWeekday(iso)) },
      { label: "Evenings", pick: () => slotsWhere((_, minute) => minute >= 17 * 60) },
    ];
    return candidates
      .map((c) => ({ ...c, slots: c.pick() }))
      .filter((c) => c.slots.length && c.slots.length < allSlots.length + 1);
  }, [allSlots, slotsWhere]);

  const applyPreset = (preset) => {
    // Additive: presets stack, so "Weekdays" then "Weekends" is everything.
    const next = Uint8Array.from(states);
    for (const i of preset.slots) next[i] = AVAILABLE;
    commit(next, preset.slots);
    setAnnouncement(`${preset.label} added — ${preset.slots.length} half-hours selected`);
  };

  const clearAll = () => {
    paintMany(allSlots, UNAVAILABLE);
    setAnnouncement("Cleared");
  };

  /* ------------------------------ bulk edits ------------------------------ */

  const toggleDay = useCallback(
    (colIndex) => {
      const iso = view.cols[colIndex];
      const indices = view.rows.map((m) => view.at(iso, m)).filter((i) => i >= 0);
      const allOn = indices.every((i) => states[i] === tool);
      const target = allOn ? UNAVAILABLE : tool;
      paintMany(indices, target);
      const label = dayLabel(iso);
      setAnnouncement(`${label.dowLong} ${label.md} marked ${STATE_WORD[target]}`);
    },
    [paintMany, states, tool, view]
  );

  const toggleTimeRow = useCallback(
    (rowIndex) => {
      const minute = view.rows[rowIndex];
      const indices = view.cols.map((iso) => view.at(iso, minute)).filter((i) => i >= 0);
      const allOn = indices.every((i) => states[i] === tool);
      const target = allOn ? UNAVAILABLE : tool;
      paintMany(indices, target);
      setAnnouncement(`${timeLabel(minute)} on every day marked ${STATE_WORD[target]}`);
    },
    [paintMany, states, tool, view]
  );

  /* ------------------------------- painting ------------------------------- */

  const slotAtPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest ? el.closest("[data-slot]") : null;
    if (!cell) return -1;
    const idx = Number(cell.getAttribute("data-slot"));
    return Number.isInteger(idx) && idx >= 0 ? idx : -1;
  };

  const rectBetween = (a, b) => {
    const pa = geometry.byIndex.get(a);
    const pb = geometry.byIndex.get(b);
    if (!pa || !pb) return [b];
    const out = [];
    for (let r = Math.min(pa.rowIndex, pb.rowIndex); r <= Math.max(pa.rowIndex, pb.rowIndex); r += 1) {
      for (let c = Math.min(pa.colIndex, pb.colIndex); c <= Math.max(pa.colIndex, pb.colIndex); c += 1) {
        const hit = geometry.byCell.get(`${r}:${c}`);
        if (hit !== undefined) out.push(hit);
      }
    }
    return out;
  };

  /** Live "Tue 5:00 – 8:30 PM" feedback while dragging, so the polarity is felt. */
  const describeTouched = () => {
    const indices = Array.from(touched.current);
    if (!indices.length) return null;
    const positions = indices.map((i) => geometry.byIndex.get(i)).filter(Boolean);
    const cols = new Set(positions.map((p) => p.colIndex));
    if (cols.size !== 1) {
      return `${cols.size} days · ${indices.length} half-hours`;
    }
    const rows = positions.map((p) => p.rowIndex);
    const lo = view.rows[Math.min(...rows)];
    const hi = view.rows[Math.max(...rows)] + 30;
    const label = dayLabel(view.cols[positions[0].colIndex]);
    return `${label.dow} ${rangeLabel(lo, hi)}`;
  };

  const onPointerDown = (event) => {
    if (disabled || event.button > 0) return;
    const target = event.target.closest ? event.target.closest("[data-slot]") : null;
    if (!target) return;
    const slotIndex = Number(target.getAttribute("data-slot"));
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return;

    event.preventDefault();
    // preventDefault() suppresses the native focus, so place it explicitly and keep
    // the roving tabindex pointing at whatever was last touched.
    if (target.focus) target.focus({ preventScroll: true });

    // Alt is a transient "if needed" modifier, so a one-off maybe never needs the tool
    // switched and switched back.
    const activeTool = event.altKey ? IF_NEEDED : tool;

    if (event.shiftKey && anchor != null) {
      const indices = rectBetween(anchor, slotIndex);
      const mode = states[slotIndex] === activeTool ? UNAVAILABLE : activeTool;
      paintMany(indices, mode);
      setAnchor(slotIndex);
      return;
    }

    const mode = states[slotIndex] === activeTool ? UNAVAILABLE : activeTool;
    const next = Uint8Array.from(states);
    next[slotIndex] = mode;

    touched.current = new Set([slotIndex]);
    drag.current = { mode, next };
    setDraft(next);
    setAnchor(slotIndex);
    setActive(slotIndex);
    setLiveRange(describeTouched());

    if (bodyRef.current && bodyRef.current.setPointerCapture) {
      try {
        bodyRef.current.setPointerCapture(event.pointerId);
      } catch (e) {
        /* capture is an optimisation; elementFromPoint works without it */
      }
    }
  };

  /**
   * Cells set `touch-action: none` so a finger drag paints instead of scrolling, which
   * means a drag that reaches the edge of the screen would otherwise just stop. Nudge
   * the page (and the day columns) along instead, so painting a tall grid stays one
   * continuous gesture.
   */
  const autoScroll = (x, y) => {
    const EDGE = 48;
    const SPEED = 10;
    if (y < EDGE) window.scrollBy(0, -SPEED);
    else if (y > window.innerHeight - EDGE) window.scrollBy(0, SPEED);

    const scroller = bodyRef.current && bodyRef.current.parentElement;
    if (!scroller) return;
    const box = scroller.getBoundingClientRect();
    if (x < box.left + EDGE) scroller.scrollLeft -= SPEED;
    else if (x > box.right - EDGE) scroller.scrollLeft += SPEED;
  };

  const onPointerMove = (event) => {
    if (!drag.current) return;
    event.preventDefault();
    autoScroll(event.clientX, event.clientY);
    const slotIndex = slotAtPoint(event.clientX, event.clientY);
    if (slotIndex < 0 || touched.current.has(slotIndex)) return;
    touched.current.add(slotIndex);
    const next = Uint8Array.from(drag.current.next);
    next[slotIndex] = drag.current.mode;
    drag.current.next = next;
    setDraft(next);
    setLiveRange(describeTouched());
  };

  const endDrag = () => {
    if (!drag.current) return;
    const { next, mode } = drag.current;
    const indices = Array.from(touched.current);
    drag.current = null;
    setLiveRange(null);
    commit(next, indices);
    if (indices.length > 1) {
      setAnnouncement(`${indices.length} half-hours marked ${STATE_WORD[mode]}`);
    }
  };

  useEffect(() => {
    const stop = () => endDrag();
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  });

  /* ------------------------------- keyboard ------------------------------- */

  const focusSlot = (slotIndex) => {
    setActive(slotIndex);
    window.requestAnimationFrame(() => {
      const node = document.querySelector(`[data-slot="${slotIndex}"]`);
      if (node) node.focus({ preventScroll: false });
    });
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    const target = event.target.closest ? event.target.closest("[data-slot]") : null;
    if (!target) return;
    const slotIndex = Number(target.getAttribute("data-slot"));
    const pos = geometry.byIndex.get(slotIndex);
    if (!pos) return;

    const step = (dr, dc) => {
      for (let n = 1; n <= Math.max(view.rows.length, view.cols.length); n += 1) {
        const hit = geometry.byCell.get(`${pos.rowIndex + dr * n}:${pos.colIndex + dc * n}`);
        if (hit !== undefined) return hit;
      }
      return null;
    };

    const move = (dr, dc) => {
      const dest = step(dr, dc);
      if (dest == null) return;
      event.preventDefault();
      if (event.shiftKey) {
        // Shift + arrow paints as it travels, mirroring a drag.
        paintMany([dest], states[slotIndex] === tool ? UNAVAILABLE : tool);
      }
      focusSlot(dest);
    };

    switch (event.key) {
      case "ArrowUp":
        move(-1, 0);
        break;
      case "ArrowDown":
        move(1, 0);
        break;
      case "ArrowLeft":
        move(0, -1);
        break;
      case "ArrowRight":
        move(0, 1);
        break;
      case " ":
      case "Enter": {
        event.preventDefault();
        const activeTool = event.altKey ? IF_NEEDED : tool;
        const mode = states[slotIndex] === activeTool ? UNAVAILABLE : activeTool;
        paintMany([slotIndex], mode);
        setAnchor(slotIndex);
        setAnnouncement(`Marked ${STATE_WORD[mode]}`);
        break;
      }
      case "m":
      case "M":
        event.preventDefault();
        setTool((t) => (t === AVAILABLE ? IF_NEEDED : AVAILABLE));
        break;
      default:
        break;
    }
  };

  /* -------------------------------- render -------------------------------- */

  const renderCell = ({ slotIndex, date, minute, isHour, isFirstRow, isLastCol }) => {
    if (slotIndex < 0) {
      return (
        <div
          key={`${date}-${minute}`}
          className="meet-cell"
          data-void="true"
          data-hour={isHour}
          data-firstrow={isFirstRow}
          data-lastcol={isLastCol}
          aria-hidden="true"
        />
      );
    }

    const state = shown[slotIndex];
    const label = dayLabel(date);
    const isActive = active === slotIndex || (active == null && slotIndex === 0);

    return (
      <button
        type="button"
        key={`${date}-${minute}`}
        className="meet-cell"
        data-slot={slotIndex}
        data-state={state}
        data-hour={isHour}
        data-firstrow={isFirstRow}
        data-lastcol={isLastCol}
        data-anchor={anchor === slotIndex}
        tabIndex={isActive ? 0 : -1}
        disabled={disabled}
        aria-pressed={state !== UNAVAILABLE}
        aria-label={`${label.dow} ${label.md} ${timeLabel(minute)} — ${STATE_WORD[state]}`}
        onFocus={() => setActive(slotIndex)}
      />
    );
  };

  const hours = (selectedCount / 2).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-bold">When are you free?</h2>
          <p className="text-gray-500 text-sm">
            Drag to add the times that work. Drag again to remove.
          </p>
        </div>

        <div
          className="inline-flex p-1 bg-gray-100 rounded-full"
          role="group"
          aria-label="What dragging adds"
        >
          {[
            [AVAILABLE, "Free"],
            [IF_NEEDED, "If needed"],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={tool === value}
              onClick={() => setTool(value)}
              className={`px-4 py-1.5 text-sm font-bold rounded-full transition ${
                tool === value ? "bg-primary text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={disabled}
            onClick={() => applyPreset(preset)}
            className="px-3 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-full hover:border-gray-500 transition"
          >
            {preset.label}
          </button>
        ))}
        {selectedCount > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={clearAll}
            className="px-3 py-1.5 text-gray-500 text-sm font-bold hover:text-gray-900 transition"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-gray-500 text-sm" aria-live="polite">
          {liveRange || (selectedCount ? `${hours} hours selected` : "Nothing selected yet")}
        </span>
      </div>

      <GridFrame
        view={view}
        renderCell={renderCell}
        onDayHeader={disabled ? undefined : toggleDay}
        onTimeHeader={disabled ? undefined : toggleTimeRow}
        dayHeaderHint="Select all of"
        timeHeaderHint="Select"
        bodyRef={bodyRef}
        bodyProps={{
          onPointerDown,
          onPointerMove,
          onPointerUp: endDrag,
          onKeyDown,
          role: "grid",
          "aria-label": "Your availability",
        }}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-gray-500 text-xs">
        <span className="inline-flex items-center gap-2">
          <span className="meet-swatch" data-state="2" /> Free
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="meet-swatch" data-state="1" /> If needed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="meet-swatch" data-state="0" /> Can&apos;t make it
        </span>
        <span className="text-gray-400">
          Arrows move · Space toggles · Shift fills a block
        </span>
      </div>

      <div className="meet-sr" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridFrame from "./GridFrame";
import { BUSY, FREE, IF_NEEDED } from "../../lib/meet/model";
import { dayLabel, timeLabel } from "../../lib/meet/time";

const STATE_WORD = { 0: "free", 1: "if needed", 2: "busy" };

/**
 * The input surface.
 *
 * Three decisions do most of the work here:
 *
 * 1. **Free is the default.** When2meet starts you at "unavailable" and makes you
 *    paint your whole life green. Inside a window an organizer already narrowed, most
 *    people are mostly free, so you paint the exceptions instead. Far fewer strokes,
 *    and it means someone who opens the link and immediately hits done has said
 *    something true rather than something useless.
 *
 * 2. **No tool picker in the common path.** The first cell your pointer lands on sets
 *    the mode: touch a free cell and you're painting busy, touch a busy cell and
 *    you're erasing. There is nothing to select before you start.
 *
 * 3. **Headers are bulk operations.** Handled by GridFrame, wired up below.
 *
 * Pointer events are delegated to the grid container and driven through
 * `elementFromPoint`, which is what makes one code path serve mouse, trackpad, touch
 * and stylus. Cells set `touch-action: none` so a finger drag paints instead of
 * scrolling; the time gutter keeps `pan-y` so the page can still be scrolled.
 */
export default function AvailabilityGrid({ view, states, onChange, disabled }) {
  const [draft, setDraft] = useState(null);
  const [tool, setTool] = useState(BUSY);
  const [anchor, setAnchor] = useState(null);
  const [active, setActive] = useState(null);
  const [announcement, setAnnouncement] = useState("");

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

  const commit = useCallback(
    (next, indices) => {
      onChange(next, indices);
      setDraft(null);
    },
    [onChange]
  );

  /* ------------------------------ bulk edits ------------------------------ */

  const paintMany = useCallback(
    (indices, valueFor) => {
      if (disabled || !indices.length) return;
      const next = Uint8Array.from(states);
      for (const i of indices) next[i] = valueFor(next[i]);
      commit(next, indices);
    },
    [commit, disabled, states]
  );

  const toggleDay = useCallback(
    (colIndex) => {
      const iso = view.cols[colIndex];
      const indices = view.rows
        .map((minute) => view.at(iso, minute))
        .filter((i) => i >= 0);
      // If any of the day is still open, clear the whole day; otherwise give it back.
      const anyOpen = indices.some((i) => states[i] !== tool);
      const target = anyOpen ? tool : FREE;
      paintMany(indices, () => target);
      const label = dayLabel(iso);
      setAnnouncement(
        `${label.dowLong} ${label.md} marked ${target === FREE ? "free" : STATE_WORD[target]}`
      );
    },
    [paintMany, states, tool, view]
  );

  const toggleTimeRow = useCallback(
    (rowIndex) => {
      const minute = view.rows[rowIndex];
      const indices = view.cols
        .map((iso) => view.at(iso, minute))
        .filter((i) => i >= 0);
      const anyOpen = indices.some((i) => states[i] !== tool);
      const target = anyOpen ? tool : FREE;
      paintMany(indices, () => target);
      setAnnouncement(
        `${timeLabel(minute)} on every day marked ${
          target === FREE ? "free" : STATE_WORD[target]
        }`
      );
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

    // Alt is a transient "if needed" modifier so the tool never has to be switched
    // for a one-off maybe.
    const activeTool = event.altKey ? IF_NEEDED : tool;

    if (event.shiftKey && anchor != null) {
      const indices = rectBetween(anchor, slotIndex);
      const mode = states[slotIndex] === activeTool ? FREE : activeTool;
      paintMany(indices, () => mode);
      setAnchor(slotIndex);
      return;
    }

    const mode = states[slotIndex] === activeTool ? FREE : activeTool;
    const next = Uint8Array.from(states);
    next[slotIndex] = mode;

    touched.current = new Set([slotIndex]);
    drag.current = { mode, next };
    setDraft(next);
    setAnchor(slotIndex);
    setActive(slotIndex);

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
  };

  const endDrag = () => {
    if (!drag.current) return;
    const { next } = drag.current;
    const indices = Array.from(touched.current);
    drag.current = null;
    commit(next, indices);
    if (indices.length > 1) {
      setAnnouncement(`${indices.length} half-hours marked ${STATE_WORD[nextStateOf(next, indices)]}`);
    }
  };

  const nextStateOf = (arr, indices) => arr[indices[indices.length - 1]];

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
        const hit = geometry.byCell.get(
          `${pos.rowIndex + dr * n}:${pos.colIndex + dc * n}`
        );
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
        const mode = states[slotIndex] === tool ? FREE : tool;
        paintMany([dest], () => mode);
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
        const mode = states[slotIndex] === activeTool ? FREE : activeTool;
        paintMany([slotIndex], () => mode);
        setAnchor(slotIndex);
        setAnnouncement(`Marked ${STATE_WORD[mode]}`);
        break;
      }
      case "m":
      case "M":
        event.preventDefault();
        setTool((t) => (t === BUSY ? IF_NEEDED : BUSY));
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
        aria-pressed={state !== FREE}
        aria-label={`${label.dow} ${label.md} ${timeLabel(minute)} — ${STATE_WORD[state]}`}
        onFocus={() => setActive(slotIndex)}
      />
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-bold">Mark when you&apos;re busy</h2>
          <p className="text-gray-500 text-sm">
            Everything starts as available. Drag over the grid, or tap a day or time
            label.
          </p>
        </div>

        <div
          className="inline-flex p-1 bg-gray-100 rounded-full"
          role="group"
          aria-label="What dragging marks"
        >
          {[
            [BUSY, "Busy"],
            [IF_NEEDED, "If needed"],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={tool === value}
              onClick={() => setTool(value)}
              className={`px-4 py-1.5 text-sm font-bold rounded-full transition ${
                tool === value ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <GridFrame
        view={view}
        renderCell={renderCell}
        onDayHeader={disabled ? undefined : toggleDay}
        onTimeHeader={disabled ? undefined : toggleTimeRow}
        dayHeaderHint="Mark all of"
        timeHeaderHint="Mark"
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
          <span className="meet-swatch" data-state="0" /> Available
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="meet-swatch" data-state="1" /> If needed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="meet-swatch" data-state="2" /> Busy
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

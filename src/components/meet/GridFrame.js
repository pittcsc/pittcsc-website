import React from "react";
import { dayLabel, timeLabel } from "../../lib/meet/time";

/**
 * The scaffolding both grids sit in: sticky day headers across the top, a sticky time
 * gutter down the left, horizontal scroll when there are more days than screen.
 *
 * The headers are buttons, not labels. That is the single highest-leverage decision in
 * the input flow — "I'm never free before 6" is one tap on a row, and "I'm gone
 * Thursday" is one tap on a column, instead of a dozen careful drags. Rendering is
 * left to the caller so the editable grid and the group heatmap can share every pixel
 * of this layout without sharing their very different interaction models.
 */
export default function GridFrame({
  view,
  renderCell,
  onDayHeader,
  onTimeHeader,
  dayHeaderHint,
  timeHeaderHint,
  scrollRef,
  bodyRef,
  bodyProps,
}) {
  const { rows, cols } = view;

  return (
    <div className="meet-grid-wrap">
      <div className="meet-grid-scroll" ref={scrollRef}>
        <div
          className="meet-grid"
          ref={bodyRef}
          style={{
            gridTemplateColumns: `var(--meet-gutter) repeat(${cols.length}, minmax(var(--meet-col-min), 1fr))`,
          }}
          {...bodyProps}
        >
          <div className="meet-grid__corner" />

          {cols.map((iso, colIndex) => {
            const label = dayLabel(iso);
            const weekend = label.dow === "Sat" || label.dow === "Sun";
            return (
              <button
                type="button"
                key={iso}
                className="meet-daybtn"
                data-weekend={weekend}
                onClick={onDayHeader ? () => onDayHeader(colIndex) : undefined}
                title={onDayHeader ? `${dayHeaderHint} ${label.dowLong}` : undefined}
                aria-label={
                  onDayHeader
                    ? `${dayHeaderHint} ${label.dowLong}, ${label.md}`
                    : `${label.dowLong}, ${label.md}`
                }
              >
                <span className="meet-daybtn__dow">{label.dow}</span>
                <span className="meet-daybtn__num">{label.day}</span>
              </button>
            );
          })}

          {rows.map((minute, rowIndex) => {
            const isHour = minute % 60 === 0;
            return (
              <React.Fragment key={minute}>
                <button
                  type="button"
                  className="meet-timebtn"
                  data-hour={isHour}
                  style={{ gridRow: rowIndex + 2 }}
                  onClick={onTimeHeader ? () => onTimeHeader(rowIndex) : undefined}
                  title={onTimeHeader ? `${timeHeaderHint} ${timeLabel(minute)}` : undefined}
                  aria-label={
                    onTimeHeader
                      ? `${timeHeaderHint} ${timeLabel(minute)} on every day`
                      : timeLabel(minute)
                  }
                >
                  {isHour ? timeLabel(minute, { compact: true }) : timeLabel(minute)}
                </button>

                {cols.map((iso, colIndex) =>
                  renderCell({
                    slotIndex: view.at(iso, minute),
                    date: iso,
                    minute,
                    rowIndex,
                    colIndex,
                    isHour,
                    isFirstRow: rowIndex === 0,
                    isLastCol: colIndex === cols.length - 1,
                  })
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

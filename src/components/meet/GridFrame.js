import React, { useMemo } from "react";
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
  bodyRef,
  bodyProps,
}) {
  const { rows, cols } = view;

  // Day labels vary per column, not per cell, and `dayLabel` re-parses the ISO string
  // three times. Computing them once here instead of inside renderCell takes this off
  // the drag hot path, where the grid re-renders on every newly-touched slot.
  const dayLabels = useMemo(() => cols.map(dayLabel), [cols]);

  return (
    <div className="meet-grid-wrap">
      <div className="meet-grid-scroll">
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
            const label = dayLabels[colIndex];
            return (
              <button
                type="button"
                key={iso}
                className="meet-daybtn"
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

                {cols.map((iso, colIndex) => {
                  const slotIndex = view.at(iso, minute);
                  const shape = {
                    "data-hour": isHour,
                    "data-firstrow": rowIndex === 0,
                    "data-lastcol": colIndex === cols.length - 1,
                  };

                  // A hole is a product of this frame's own timezone projection, so
                  // the frame renders it rather than making every caller notice -1.
                  if (slotIndex < 0) {
                    return (
                      <div
                        key={`${iso}-${minute}`}
                        className="meet-cell"
                        data-void="true"
                        {...shape}
                        aria-hidden="true"
                      />
                    );
                  }

                  return renderCell({
                    key: `${iso}-${minute}`,
                    slotIndex,
                    minute,
                    label: dayLabels[colIndex],
                    shape,
                  });
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

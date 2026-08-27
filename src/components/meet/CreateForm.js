import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import MonthPicker from "./MonthPicker";
import TimeRangeSlider from "./TimeRangeSlider";
import { createMeeting } from "../../lib/meet/client";
import {
  durationLabel,
  isoAddDays,
  isoToday,
  isoWeekday,
  localTz,
} from "../../lib/meet/time";

const TIME_PRESETS = [
  { label: "Evenings", start: 16 * 60, end: 22 * 60 },
  { label: "Afternoons", start: 12 * 60, end: 18 * 60 },
  { label: "Class hours", start: 9 * 60, end: 17 * 60 },
  { label: "All day", start: 8 * 60, end: 22 * 60 },
];

const DURATIONS = [30, 60, 90, 120];

export function Chip({ on, children, ...rest }) {
  return (
    <button
      type="button"
      className={`px-4 py-2 text-sm font-bold rounded-full border transition ${
        on
          ? "bg-primary border-primary text-white"
          : "bg-white border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-900"
      }`}
      aria-pressed={on}
      {...rest}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-8">
      <span className={`block font-bold ${hint ? "" : "mb-3"}`}>{label}</span>
      {hint && <p className="mb-3 text-gray-500 text-sm">{hint}</p>}
      {children}
    </div>
  );
}

export default function CreateForm({ onCreated }) {
  const tz = useMemo(() => localTz(), []);
  const today = useMemo(() => isoToday(tz), [tz]);

  const [name, setName] = useState("");
  const [dates, setDates] = useState(() => range(today, 7));
  const [startMin, setStartMin] = useState(16 * 60);
  const [endMin, setEndMin] = useState(22 * 60);
  const [durationMin, setDurationMin] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const quick = {
    "Next 7 days": () => range(today, 7),
    "This weekend": () => {
      const saturday = isoAddDays(today, (6 - isoWeekday(today) + 7) % 7);
      return [saturday, isoAddDays(saturday, 1)];
    },
    "Next week": () => {
      const monday = isoAddDays(today, ((8 - isoWeekday(today)) % 7) || 7);
      return range(monday, 5);
    },
    "Next 2 weeks": () => range(today, 14),
  };

  const span = endMin - startMin;

  const submit = async (event) => {
    event.preventDefault();
    if (!dates.length) {
      setError("Pick at least one day.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onCreated(
        await createMeeting({
          name: name.trim(),
          dates,
          startMin,
          endMin,
          durationMin,
          tz,
        })
      );
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      {error && (
        <p className="mb-6 px-4 py-3 text-red-800 text-sm bg-red-50 border border-red-200 rounded-xl">
          {error}
        </p>
      )}

      <Field label="What's the meeting?">
        <input
          className="px-4 py-3 w-full text-lg font-bold border border-gray-300 rounded-xl focus:border-primary focus:ring-primary"
          placeholder="SteelHacks planning"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={90}
          autoFocus
          autoComplete="off"
          aria-label="Meeting name"
        />
      </Field>

      <Field label="What days could work?" hint="Select all that work.">
        <MonthPicker value={dates} onChange={setDates} tz={tz} />
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.keys(quick).map((label) => (
            <Chip key={label} onClick={() => setDates(quick[label]())}>
              {label}
            </Chip>
          ))}
          {dates.length > 0 && <Chip onClick={() => setDates([])}>Clear</Chip>}
        </div>
      </Field>

      <Field label="Between what hours?">
        <TimeRangeSlider
          startMin={startMin}
          endMin={endMin}
          onChange={(nextStart, nextEnd) => {
            setStartMin(nextStart);
            setEndMin(nextEnd);
            if (durationMin > nextEnd - nextStart) {
              setDurationMin(Math.floor((nextEnd - nextStart) / 30) * 30);
            }
          }}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          {TIME_PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              on={startMin === preset.start && endMin === preset.end}
              onClick={() => {
                setStartMin(preset.start);
                setEndMin(preset.end);
                if (durationMin > preset.end - preset.start) {
                  setDurationMin(preset.end - preset.start);
                }
              }}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Meeting length">
        <div className="flex flex-wrap gap-2">
          {DURATIONS.filter((d) => d <= span).map((d) => (
            <Chip key={d} on={durationMin === d} onClick={() => setDurationMin(d)}>
              {durationLabel(d)}
            </Chip>
          ))}
        </div>
      </Field>

      <motion.button
        whileHover={{ scale: submitting ? 1 : 1.02 }}
        whileTap={{ scale: submitting ? 1 : 0.98 }}
        type="submit"
        disabled={submitting}
        className="px-6 py-3 w-full text-white text-lg font-bold bg-primary rounded-full focus:outline-none hover:shadow-lg shadow-md transition disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create meeting"}
      </motion.button>

      <p className="mt-3 text-gray-400 text-sm text-center">
        Times automatically adjust to each person&apos;s timezone.
      </p>
    </form>
  );
}

function range(start, count) {
  return Array.from({ length: count }, (_, i) => isoAddDays(start, i));
}

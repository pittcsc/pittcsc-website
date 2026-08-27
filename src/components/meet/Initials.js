import React from "react";

/** Two letters is enough to recognise a friend and short enough to fit in a pill. */
export function initialsOf(name) {
  const words = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* Hue is decorative only — it never carries availability meaning. */
const HUES = [212, 262, 340, 22, 158, 194, 288, 44];

export function colorOf(name) {
  let hash = 0;
  const key = String(name || "");
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return `hsl(${HUES[Math.abs(hash) % HUES.length]} 46% 38%)`;
}

export default function Avatar({ name, pending }) {
  return (
    <span
      className={`grid flex-none place-items-center w-5 h-5 text-white rounded-full ${
        pending ? "text-gray-400 border border-gray-300 border-dashed" : ""
      }`}
      style={{
        fontSize: 9,
        fontWeight: 700,
        background: pending ? "transparent" : colorOf(name),
      }}
      aria-hidden="true"
    >
      {pending ? "?" : initialsOf(name)}
    </span>
  );
}

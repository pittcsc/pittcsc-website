export const emptyAudience = () => ({
  mode: "all",
  conditions: [],
  exclusions: [],
});
export const draftInput = (d) => ({
  name: d.name,
  subject: d.subject,
  preheader: d.preheader,
  blocks: d.blocks,
  audience: d.audience,
  version: d.version,
});
export const draftContent = (d) =>
  JSON.stringify({ ...draftInput(d), version: 0 });
export const splitLabels = (s) => [
  ...new Set(
    s
      .split(/[;,]/)
      .map((v) => v.trim())
      .filter(Boolean),
  ),
];
export function matchesAudience(c, a, eligible = true) {
  if (eligible && (!c.subscribed || c.archived || c.blockedReason || !c.active))
    return false;
  const match = ({ field, value }) => {
    const values =
      {
        tag: c.tags,
        role: c.roles,
        major: c.majors,
        attendance: c.attendance,
        graduationYear:
          c.graduationYear == null ? [] : [String(c.graduationYear)],
      }[field] || [];
    return values.some((v) => String(v).toLowerCase() === value.toLowerCase());
  };
  if (a.exclusions.some(match)) return false;
  return (
    !a.conditions.length ||
    (a.mode === "any" ? a.conditions.some(match) : a.conditions.every(match))
  );
}
// RFC 4180 fields, including quoted commas/newlines and doubled quote escapes.
export function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && !field) quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (quoted) throw new Error("A quoted CSV field is not closed.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
export function guessMapping(headers) {
  const aliases = {
    firstname: "firstName",
    first: "firstName",
    lastname: "lastName",
    last: "lastName",
    email: "email",
    emailaddress: "email",
    tags: "tags",
    major: "major",
    majors: "major",
    graduationyear: "graduationYear",
    gradyear: "graduationYear",
  };
  const result = {};
  headers.forEach((v, i) => {
    const field = aliases[v.toLowerCase().replace(/[^a-z]/g, "")];
    if (field && result[field] === undefined) result[field] = i;
  });
  return result;
}
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export function makeCSV(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const starterTemplates = [
  {
    id: "newsletter",
    name: "CSC monthly newsletter",
    blocks: [
      { type: "heading", text: "This month at CSC" },
      {
        type: "text",
        text: "Hi {{firstName}},\n\nHere’s what’s happening in our community this month.",
      },
      { type: "divider" },
      { type: "heading", text: "Coming up" },
      {
        type: "text",
        text: "Add an event block, news, or a community highlight here.",
      },
      { type: "text", text: "See you soon,\nThe CSC team" },
    ],
  },
  {
    id: "event",
    name: "Event announcement",
    blocks: [
      { type: "heading", text: "You’re invited" },
      {
        type: "text",
        text: "Hi {{firstName}},\n\nJoin us at our next CSC event!",
      },
      {
        type: "text",
        text: "Use Insert event to add the details, then make it your own.",
      },
    ],
  },
];

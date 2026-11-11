const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const DATE =
  "(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+)?(?:\\d{1,2}[/.-])?(?:19|20)\\d{2}";
const RANGE = new RegExp(
  `\\b(${DATE})\\s*[-–—]\\s*(${DATE}|present|current)\\b`,
  "i",
);
const isTitle = (value) =>
  /\b(engineer(?:ing)?|developer|intern|analyst|manager|assistant|researcher|designer|consultant|founder|president|director|scientist|specialist|coordinator|architect|administrator|officer)\b/i.test(
    value,
  );
const isLocation = (value) =>
  /^(?:remote|hybrid|on[- ]?site)$/i.test(value) ||
  /^[\p{L} .'-]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/u.test(value);

function dateOrder(value, end = false) {
  if (/^(present|current)$/i.test(value)) return Infinity;
  const year = Number(value.match(/(?:19|20)\d{2}/)?.[0]);
  const named = MONTHS.indexOf(value.slice(0, 3).toLowerCase());
  const numeric = value.match(/^(\d{1,2})[/.-]/)?.[1];
  const month =
    named >= 0 ? named : numeric ? Number(numeric) - 1 : end ? 11 : 0;
  return month >= 0 && month < 12 ? year * 12 + month : NaN;
}

function header(value = "") {
  if (
    /^[•*\-–—]/.test(value) ||
    /^(built|developed|led|implemented|designed|created|worked|reduced|improved|managed|supported|delivered)\b/i.test(
      value,
    ) ||
    RANGE.test(value)
  )
    return null;
  const parts = value
    .split(/\s*[|•]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const location = parts.find(isLocation);
  const text = parts.filter((part) => !isLocation(part)).join(" | ");
  if (!text || text.length > 320 || /[!?]$/.test(text)) return null;
  return { text, location, parts: parts.filter((part) => !isLocation(part)) };
}

function roleAt(lines, index, match) {
  const line = lines[index];
  const prefix = line.slice(0, match.index).replace(/[|,\s–—-]+$/, "");
  const suffix = line
    .slice(match.index + match[0].length)
    .replace(/^[|,\s–—-]+/, "");
  const inline = header(prefix);
  const previous = header(lines[index - 1]);
  const next = header(lines[index + 1]);
  let company;
  let title;
  let location = isLocation(suffix) ? suffix : undefined;
  const explicit = inline?.text.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (explicit) {
    title = explicit[1];
    company = explicit[2];
    location ||= inline.location;
  } else if (
    inline?.parts.length === 2 &&
    isTitle(inline.parts[0]) !== isTitle(inline.parts[1])
  ) {
    [title, company] = isTitle(inline.parts[0])
      ? inline.parts
      : [...inline.parts].reverse();
    location ||= inline.location;
  } else if (inline && isTitle(inline.text)) {
    const employer = [previous, next].find(
      (entry) => entry && !isTitle(entry.text),
    );
    if (employer) {
      title = inline.text;
      company = employer.text;
      location ||= employer.location || inline.location;
    }
  } else if (inline) {
    const job = [previous, next].find((entry) => entry && isTitle(entry.text));
    if (job) {
      company = inline.text;
      title = job.text;
      location ||= inline.location || job.location;
    }
  } else {
    const earlier = header(lines[index - 2]);
    const pair =
      earlier && previous
        ? [earlier, previous]
        : previous && next
          ? [previous, next]
          : [];
    if (pair.length === 2 && isTitle(pair[0].text) !== isTitle(pair[1].text)) {
      const [job, employer] = isTitle(pair[0].text)
        ? pair
        : [...pair].reverse();
      title = job.text;
      company = employer.text;
      location ||= employer.location || job.location;
    }
  }
  if (!company || !title || company.length > 160 || title.length > 160)
    return null;
  return {
    currentCompany: company,
    jobTitle: title,
    ...(location ? { location } : {}),
  };
}

// Prefer one explicitly current role. Otherwise suggest the most recently ended
// dated experience for review; this does not verify current employment/residency.
export function suggestEmployment(lines) {
  const dated = lines.flatMap((line, index) => {
    const match = line.match(RANGE);
    if (!match || /^[•*\-–—]/.test(line)) return [];
    const start = dateOrder(match[1]);
    const end = dateOrder(match[2], true);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
    return [{ start, end, values: roleAt(lines, index, match) }];
  });
  const current = dated.filter(({ end }) => end === Infinity);
  if (current.length)
    return current.length === 1 ? current[0].values || {} : {};
  const sorted = dated.sort((a, b) => b.end - a.end || b.start - a.start);
  if (!sorted.length) return {};
  const latest = sorted[0];
  const tied = sorted.filter(
    ({ end, start }) => end === latest.end && start === latest.start,
  );
  if (
    tied.some(
      ({ values }) => JSON.stringify(values) !== JSON.stringify(latest.values),
    )
  )
    return {};
  return latest.values || {};
}

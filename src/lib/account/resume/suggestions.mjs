import {
  HANDLES,
  MAJOR_OPTIONS,
  formFromProfile,
  profileInput,
} from "../form.mjs";

export const RESUME_FIELDS = {
  firstName: "First name",
  lastName: "Last name",
  graduationYear: "Graduation year",
  majors: "Majors",
  githubUsername: "GitHub",
  linkedinUsername: "LinkedIn",
  leetcodeUsername: "LeetCode",
  personalWebsite: "Personal website",
  contactEmail: "Contact email",
  location: "Location",
  currentCompany: "Current company",
  jobTitle: "Job title",
  bio: "Bio",
};

const sectionName = (line) => {
  const title = line.replace(/[:\s]+$/, "").toLowerCase();
  if (
    /^(education|academic background|education & qualifications)$/.test(title)
  )
    return "education";
  if (
    /^(experience|work experience|professional experience|employment|employment history)$/.test(
      title,
    )
  )
    return "work";
  if (/^(summary|professional summary|profile|about me|objective)$/.test(title))
    return "summary";
  if (
    /^(skills|technical skills|projects|personal projects|certifications|awards|activities|leadership|publications|interests|references|volunteering|coursework)$/.test(
      title,
    )
  )
    return "other";
  return null;
};
const unique = (values) => [...new Set(values)];

// Independently implemented, conservative extraction for text-based English
// resumes. Unclear values are omitted; parsing is a suggestion, not verification.
export function suggestResumeProfile({ lines, links = [] }, signInEmail = "") {
  const sections = {
    header: [],
    education: [],
    work: [],
    summary: [],
    other: [],
  };
  let section = "header";
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const heading = sectionName(line);
    if (heading) section = heading;
    else if (line) sections[section].push(line);
  }
  const header = sections.header.slice(0, 12);
  const result = {};
  const name = header.slice(0, 3).find((line) => {
    const words = line.split(" ");
    return (
      words.length >= 2 &&
      words.length <= 5 &&
      words.every((word) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(word)) &&
      !/\b(engineer|developer|student|resume|curriculum|vitae|university|college|science|design|manager|analyst|intern|consultant)\b/i.test(
        line,
      )
    );
  });
  if (name) {
    const [first, ...last] = name.split(" ");
    result.firstName = first;
    result.lastName = last.join(" ");
  }
  const emails = unique(
    (
      header
        .join(" ")
        .match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
    ).filter((email) => email.toLowerCase() !== signInEmail.toLowerCase()),
  );
  if (emails.length === 1) result.contactEmail = emails[0];

  const textURLs =
    header
      .join(" ")
      .match(
        /(?:https?:\/\/|www\.)[^\s|<>]+|(?<![\w@.-])(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[\w./?=#%-]*)?/gi,
      ) || [];
  const candidates = {};
  for (const raw of [...textURLs, ...links]) {
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (
        url.username ||
        url.password ||
        !["https:", "http:"].includes(url.protocol)
      )
        continue;
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const path = url.pathname.split("/").filter(Boolean);
      let field;
      let value;
      if (host === "github.com" && path.length === 1)
        [field, value] = ["githubUsername", path[0]];
      else if (
        /^(?:[a-z]{2,3}\.)?linkedin\.com$/.test(host) &&
        path.length === 2 &&
        path[0] === "in"
      )
        [field, value] = ["linkedinUsername", path[1]];
      else if (host === "leetcode.com" && path.length === 2 && path[0] === "u")
        [field, value] = ["leetcodeUsername", path[1]];
      else if (
        !/(?:^|\.)(github|linkedin|leetcode)\.com$/.test(host) &&
        textURLs.includes(raw) &&
        !url.search
      ) {
        url.protocol = "https:";
        url.hash = "";
        [field, value] = ["personalWebsite", url.href];
      }
      if (field && (!HANDLES[field] || HANDLES[field].pattern.test(value))) {
        (candidates[field] ||= []).push(value);
      }
    } catch {
      /* Non-URLs are not suggestions. */
    }
  }
  for (const [field, values] of Object.entries(candidates)) {
    if (unique(values).length === 1) result[field] = values[0];
  }

  const location = header
    .map(
      (line) =>
        line.match(
          /^(?:Location:\s*)?([\p{L} .'-]+,\s*[A-Z]{2})(?:\s*[|•].*)?$/u,
        )?.[1],
    )
    .filter(Boolean);
  if (unique(location).length === 1) result.location = location[0];

  const education = sections.education.join("\n");
  const majors = MAJOR_OPTIONS.filter((major) =>
    new RegExp(`\\b${major}\\b`, "i").test(education),
  );
  for (const line of sections.education) {
    const custom = line
      .match(
        /(?:^Major(?:s)?:\s*|(?:Bachelor|Master)(?:'s)?(?: of (?:Science|Arts|Engineering))? in\s+)([\p{L} &-]+?)(?=\s*[|,;]|$)/iu,
      )?.[1]
      ?.trim();
    if (
      custom &&
      !majors.some((major) => major.toLowerCase() === custom.toLowerCase())
    )
      majors.push(custom);
  }
  if (majors.length) result.majors = unique(majors);
  // Prefer explicit graduation labels; otherwise use the end of an education
  // date range or a single year. Multiple different end years are ambiguous.
  const explicitYears = [
    ...education.matchAll(
      /(?:expected(?: graduation)?|graduat(?:ion|ing|e[ds]?))\s*[:\-]?\s*(?:[A-Za-z]+\s+)?((?:19|20)\d{2})/gi,
    ),
  ].map((match) => match[1]);
  const endYears = sections.education
    .map((line) => {
      if (/\b(present|current)\b/i.test(line)) return undefined;
      const years = line.match(/\b(?:19|20)\d{2}\b/g);
      return years?.at(-1);
    })
    .filter(Boolean);
  const years = unique(explicitYears.length ? explicitYears : endYears);
  if (
    years.length === 1 &&
    !/\b(high school|secondary school)\b/i.test(education)
  )
    result.graduationYear = years[0];

  const currentRoles = [];
  const isTitle = (value) =>
    /\b(engineer|developer|intern|analyst|manager|assistant|researcher|designer|consultant|founder|president|director)\b/i.test(
      value,
    );
  sections.work.forEach((line, index) => {
    if (!/\b(present|current)\b/i.test(line)) return;
    const beforeDate = line
      .split(
        /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|(?:19|20)\d{2})\b/i,
      )[0]
      .replace(/[|,\s–—-]+$/, "");
    const titleCompany = beforeDate.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (titleCompany)
      currentRoles.push({
        jobTitle: titleCompany[1],
        currentCompany: titleCompany[2],
      });
    else {
      const parts = beforeDate.split(/\s*[|•]\s*/).filter(Boolean);
      if (parts.length === 2 && isTitle(parts[0]) !== isTitle(parts[1])) {
        const [title, company] = isTitle(parts[0])
          ? parts
          : [...parts].reverse();
        currentRoles.push({ jobTitle: title, currentCompany: company });
      } else if (!beforeDate && index >= 2) {
        const company = sections.work[index - 2];
        const title = sections.work[index - 1];
        if (
          /\b(engineer|developer|intern|analyst|manager|assistant|researcher|designer|consultant)\b/i.test(
            title,
          ) &&
          !/\d|[•|]/.test(company)
        ) {
          currentRoles.push({ currentCompany: company, jobTitle: title });
        }
      }
    }
  });
  if (
    currentRoles.length === 1 &&
    sections.work.filter((line) => /\b(present|current)\b/i.test(line))
      .length === 1
  )
    Object.assign(result, currentRoles[0]);
  if (sections.summary.length) result.bio = sections.summary.join("\n");
  return validResumeSuggestions(result, signInEmail);
}

// Apply the same validation as manual entry to each suggestion independently.
// One unsupported field should not discard other useful extraction results.
export function validResumeSuggestions(suggestions, signInEmail) {
  const valid = {};
  for (const field of Object.keys(RESUME_FIELDS)) {
    const value = suggestions[field];
    if (
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && !value.length)
    )
      continue;
    if (
      HANDLES[field] &&
      (typeof value !== "string" || !HANDLES[field].pattern.test(value))
    )
      continue;
    try {
      const form = { ...formFromProfile({}), [field]: value };
      const input = profileInput(form, signInEmail);
      if (input[field])
        valid[field] =
          field === "graduationYear" ? String(input[field]) : input[field];
    } catch {
      /* Keep valid fields when another suggestion fails validation. */
    }
  }
  return valid;
}

export function resumeChanges(form, suggestions) {
  return Object.keys(RESUME_FIELDS)
    .filter((field) => {
      if (!Object.hasOwn(suggestions, field)) return false;
      return JSON.stringify(form[field]) !== JSON.stringify(suggestions[field]);
    })
    .map((field) => ({
      field,
      label: RESUME_FIELDS[field],
      value: suggestions[field],
      replaces: Array.isArray(form[field])
        ? form[field].some((value) => value.trim())
        : !!form[field]?.trim(),
    }));
}

export function applyResumeSuggestions(form, suggestions) {
  const changes = resumeChanges(form, suggestions);
  const next = { ...form };
  for (const { field, value } of changes)
    next[field] = Array.isArray(value) ? [...value] : value;
  if (changes.some(({ field }) => field === "majors")) {
    next.majorOther = next.majors.map(
      (major) => !MAJOR_OPTIONS.includes(major),
    );
  }
  return next;
}

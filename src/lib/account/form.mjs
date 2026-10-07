// Handles are stored as bare usernames, never URLs, so nothing can put an
// arbitrary link in a field the UI renders as an anchor. The API accepts only
// the username; these patterns mirror its own and the database's constraints.
export const HANDLES = {
  githubUsername: {
    label: "GitHub",
    base: "github.com/",
    placeholder: "octocat",
    // Bounded by maxLen as well: this pattern consumes the character after a
    // hyphen, so on its own it would accept "a-a-a-..." up to 77 characters.
    pattern: /^[A-Za-z0-9](?:[A-Za-z0-9]|-[A-Za-z0-9]){0,38}$/,
    maxLen: 39,
    error: "Use your GitHub username, e.g. octocat — not the full URL.",
  },
  leetcodeUsername: {
    label: "LeetCode",
    base: "leetcode.com/u/",
    placeholder: "your-handle",
    pattern: /^[A-Za-z0-9._-]{1,39}$/,
    maxLen: 39,
    error: "Use your LeetCode username — not the full URL.",
  },
  linkedinUsername: {
    label: "LinkedIn",
    base: "linkedin.com/in/",
    placeholder: "jordan-lee-1a2b3c",
    pattern: /^[A-Za-z0-9-]{3,100}$/,
    maxLen: 100,
    error:
      "Use the last part of your LinkedIn URL, e.g. jordan-lee-1a2b3c " +
      "from linkedin.com/in/jordan-lee-1a2b3c.",
  },
};

// People paste the whole profile URL. Take the handle out of it rather than
// rejecting them; anything left over still has to match the pattern below.
export function handleFromPasted(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const stripped = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^github\.com\//i, "")
    .replace(/^leetcode\.com\/(u\/)?/i, "")
    .replace(/^[a-z]{2,3}\.linkedin\.com\/in\//i, "")
    .replace(/^linkedin\.com\/in\//i, "");
  // Drop a trailing slash, query or fragment left by a copied URL.
  return stripped.split(/[/?#]/)[0];
}

export function formFromProfile(profile) {
  return {
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    preferredName: profile.preferredName || "",
    graduationYear: profile.graduationYear?.toString() || "",
    majors: profile.majors?.length ? [...profile.majors] : [""],
    githubUsername: profile.githubUsername || "",
    leetcodeUsername: profile.leetcodeUsername || "",
    linkedinUsername: profile.linkedinUsername || "",
  };
}

export function profileInput(form) {
  const name = (value) => {
    const trimmed = value.trim();
    if ([...trimmed].length > 100 || /[\0\r\n]/.test(trimmed))
      throw new Error("Names must be at most 100 characters.");
    return trimmed || null;
  };
  const year = form.graduationYear.trim();
  if (
    year &&
    (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100)
  ) {
    throw new Error(
      "Enter a graduation year between 1900 and 2100, or leave it blank for now.",
    );
  }
  const majors = form.majors.map((value) => value.trim()).filter(Boolean);
  if (
    majors.length > 8 ||
    majors.some((value) => [...value].length > 120 || /[\0\r\n]/.test(value))
  ) {
    throw new Error("Add up to eight majors, each at most 120 characters.");
  }
  if (
    new Set(majors.map((value) => value.toLowerCase())).size !== majors.length
  ) {
    throw new Error("Each major should appear only once.");
  }
  const handles = {};
  for (const [field, spec] of Object.entries(HANDLES)) {
    const handle = handleFromPasted(form[field]);
    if (
      handle &&
      ([...handle].length > spec.maxLen || !spec.pattern.test(handle))
    )
      throw new Error(spec.error);
    handles[field] = handle || null;
  }

  return {
    firstName: name(form.firstName),
    lastName: name(form.lastName),
    preferredName: name(form.preferredName),
    graduationYear: year ? Number(year) : null,
    majors,
    ...handles,
  };
}

// Fallback shown in the avatar circle before a picture is uploaded.
export function initials(profile) {
  return (
    [profile.preferredName || profile.firstName, profile.lastName]
      .filter(Boolean)
      .map((value) => [...value.trim()][0] || "")
      .join("")
      .toUpperCase() || "?"
  );
}

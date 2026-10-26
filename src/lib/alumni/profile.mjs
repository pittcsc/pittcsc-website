export const HELP_FIELDS = {
  openToCoffeeChats: "Coffee chats",
  openToMentorship: "Mentorship",
  availableForReferrals: "Referrals",
  openToResumeReview: "Resume review",
};
export const ALUMNI_TEXT = {
  location: { label: "Location", max: 200 },
  bio: { label: "Bio", max: 4000 },
  currentCompany: { label: "Company", max: 200 },
  currentRole: { label: "Job title", max: 200 },
  contactEmail: { label: "Contact email (not your Pitt email)", max: 254 },
};
export function alumniForm(profile) {
  return {
    ...Object.fromEntries(
      Object.keys(ALUMNI_TEXT).map((key) => [key, profile[key] || ""]),
    ),
    ...Object.fromEntries(
      Object.keys(HELP_FIELDS).map((key) => [key, Boolean(profile[key])]),
    ),
    positionIsCurrent: profile.positionIsCurrent ?? true,
  };
}
export function alumniInput(form) {
  const result = {};
  for (const [key, spec] of Object.entries(ALUMNI_TEXT)) {
    const value = String(form[key] ?? "").trim();
    if (
      [...value].length > spec.max ||
      /\0/.test(value) ||
      (key !== "bio" && /[\r\n]/.test(value))
    )
      throw new Error(`${spec.label} must be at most ${spec.max} characters.`);
    result[key] = value || null;
  }
  if (
    result.contactEmail &&
    (!/^[^@\s<>"'(),;:]+@[^@\s<>]+\.[^@\s<>]+$/.test(result.contactEmail) ||
      /@pitt\.edu$/i.test(result.contactEmail))
  )
    throw new Error(
      "Use a valid non-Pitt contact email. Your Pitt email remains your sign-in address.",
    );
  for (const key of Object.keys(HELP_FIELDS)) result[key] = Boolean(form[key]);
  result.positionIsCurrent = Boolean(form.positionIsCurrent);
  return result;
}

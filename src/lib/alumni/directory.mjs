export const ALUMNI_BASE = "/dashboard/alumni";
export function directoryFilters(search) {
  const params = new URLSearchParams(search),
    filters = {};
  for (const key of [
    "search",
    "company",
    "location",
    "graduation_year",
    "open_to_coffee_chats",
    "open_to_mentorship",
    "available_for_referrals",
    "open_to_resume_review",
  ]) {
    const value = params.get(key);
    if (!value) continue;
    if (key === "graduation_year") {
      if (/^\d{4}$/.test(value)) filters[key] = Number(value);
    } else if (
      key.startsWith("open_to_") ||
      key === "available_for_referrals"
    ) {
      if (value === "true") filters[key] = true;
    } else filters[key] = value;
  }
  return filters;
}
export function directorySearch(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== false && value !== "")
      params.set(key, String(value));
  const search = params.toString();
  return search ? `?${search}` : "";
}
export function directoryReturn(value) {
  if (typeof value !== "string") return ALUMNI_BASE;
  try {
    const u = new URL(value, "https://csc.invalid");
    return u.origin === "https://csc.invalid" && u.pathname === ALUMNI_BASE
      ? ALUMNI_BASE + directorySearch(directoryFilters(u.search))
      : ALUMNI_BASE;
  } catch {
    return ALUMNI_BASE;
  }
}

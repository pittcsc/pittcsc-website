export const RESEND_SECONDS = 60;

export function normalizePittEmail(value) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  return /^[^@\s]+@pitt\.edu$/.test(email) ? email : null;
}

// An allowlist also avoids public same-site routes that redirect off site
// (e.g. /zoom and /blog). Future attendance links use /attendance/<event>.
export function safeReturnTo(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return "/dashboard";
  try {
    const url = new URL(value, "https://csc.invalid");
    if (
      url.origin !== "https://csc.invalid" ||
      url.pathname.includes("%") ||
      !/^\/(dashboard|attendance)(\/|$)/.test(url.pathname)
    )
      return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/dashboard";
  }
}

export function loginURL(destination) {
  return `/login?${new URLSearchParams({ returnTo: safeReturnTo(destination) })}`;
}

export function authErrorMessage(error, operation) {
  if (
    error?.status === 429 ||
    error?.code === "over_email_send_rate_limit" ||
    error?.code === "over_request_rate_limit"
  ) {
    return "Too many attempts. Wait a minute before trying again.";
  }
  if (
    operation === "verify" &&
    ["otp_expired", "otp_disabled"].includes(error?.code)
  ) {
    return "That code is incorrect or expired. Try again or request a new code.";
  }
  if (operation === "verify" && error?.status === 403) {
    return "That code is incorrect or expired. Try again or request a new code.";
  }
  return "We couldn't connect to sign-in. Check your connection and try again.";
}

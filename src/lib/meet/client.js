/**
 * Browser-side API + identity for /meet.
 *
 * "No accounts" doesn't mean "no identity" — it means the identity lives in the
 * browser instead of a user table. We keep an opaque per-meeting participant id in
 * localStorage, plus the display name you last used anywhere, so joining a second
 * meeting is one tap instead of one typing session.
 */

const NS = "pittcsc.meet";

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    const err = new Error("Can't reach the server. Check your connection.");
    err.offline = true;
    throw err;
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch (e) {
    payload = null;
  }

  if (!res.ok) {
    const err = new Error((payload && payload.error) || "Something went wrong.");
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

/**
 * Is this deployment actually keeping meetings? On a serverless host with no durable
 * store configured, a meeting can vanish between the request that creates it and the
 * next one — so an organizer would share a link that 404s for everybody. Better to say
 * so before they do.
 */
export async function fetchHealth() {
  try {
    const res = await fetch("/api/meet/health", { headers: { Accept: "application/json" } });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export function createMeeting(input) {
  return request("/api/meet/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/**
 * The room polls this every 15s and the answer is usually identical. `Cache-Control:
 * no-store` is correct here (a CDN must never answer for us) but it also means the
 * browser won't revalidate on its own, so the ETag is carried by hand. A 304 comes
 * back as `{ notModified: true }` with no body to parse.
 */
const etags = new Map();

export async function fetchMeeting(code) {
  const url = `/api/meet/get?code=${encodeURIComponent(code)}`;
  const known = etags.get(code);

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: known
        ? { Accept: "application/json", "If-None-Match": known }
        : { Accept: "application/json" },
    });
  } catch (e) {
    const err = new Error("Can't reach the server. Check your connection.");
    err.offline = true;
    throw err;
  }

  if (res.status === 304) return { notModified: true };

  const tag = res.headers.get("ETag");
  if (tag) etags.set(code, tag);

  let payload = null;
  try {
    payload = await res.json();
  } catch (e) {
    payload = null;
  }

  if (!res.ok) {
    const err = new Error((payload && payload.error) || "Something went wrong.");
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

export function saveAvailability(input) {
  return request("/api/meet/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/* -------------------------------- identity -------------------------------- */

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* private browsing, quota, disabled storage — the app still works, just forgets */
  }
}

export function loadIdentity(code) {
  if (typeof window === "undefined") return null;
  return read(`${NS}.${code}`);
}

export function saveIdentity(code, identity) {
  if (typeof window === "undefined") return;
  write(`${NS}.${code}`, identity);
  if (identity && identity.name) write(`${NS}.name`, identity.name);
}

export function clearIdentity(code) {
  if (typeof window === "undefined") return;
  write(`${NS}.${code}`, null);
}

/** The name you used last time, anywhere — prefilled so most people never type it. */
export function rememberedName() {
  if (typeof window === "undefined") return "";
  return read(`${NS}.name`) || "";
}

/** Meetings you've opened before, newest first, for the "recent" list on /meet. */
export function recentMeetings() {
  if (typeof window === "undefined") return [];
  return (read(`${NS}.recent`) || []).slice(0, 6);
}

/**
 * Forget a meeting locally. Deliberately local-only: the link still works and the other
 * participants' answers are untouched — this is "take it off my list", not "delete it
 * for everyone", which is not a call one participant should get to make.
 */
export function forgetMeeting(code) {
  if (typeof window === "undefined") return [];
  const next = recentMeetings().filter((m) => m.code !== code);
  write(`${NS}.recent`, next);
  return next;
}

export function rememberMeeting(entry) {
  if (typeof window === "undefined" || !entry || !entry.code) return;
  const existing = recentMeetings().filter((m) => m.code !== entry.code);
  write(`${NS}.recent`, [{ ...entry, seenAt: Date.now() }, ...existing].slice(0, 6));
}

/* -------------------------------- clipboard -------------------------------- */

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* fall through to the legacy path below */
  }

  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  } catch (e) {
    return false;
  }
}

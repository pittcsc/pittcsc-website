/**
 * Google Calendar import for /meet — the narrowest version of it that exists.
 *
 * We request exactly one scope: `calendar.freebusy`. It is not "read your calendar
 * with a promise not to look"; the free/busy endpoint returns opaque start/end pairs
 * and nothing else, so event titles, guests and locations are not merely unused, they
 * are never sent to the browser in the first place. That is a property of the grant,
 * which means it survives every future change to this file.
 *
 * The access token lives in a local variable for the length of one request and is
 * revoked immediately afterwards. Busy intervals are turned into slot states on this
 * machine; the only thing our server ever receives is one digit per half hour.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
const FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";

export const GOOGLE_CLIENT_ID = process.env.GATSBY_GOOGLE_CLIENT_ID || "";

/** Import is offered only when the deployment has an OAuth client configured. */
export function googleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

let scriptPromise = null;

function loadGis() {
  if (typeof window === "undefined") return Promise.reject(new Error("No browser."));
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    return Promise.resolve(window.google);
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    const el = existing || document.createElement("script");
    const done = () => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve(window.google);
      } else {
        reject(new Error("Google sign-in didn't load."));
      }
    };
    el.addEventListener("load", done);
    el.addEventListener("error", () => {
      scriptPromise = null;
      reject(new Error("Couldn't reach Google. Check your connection or an ad blocker."));
    });
    if (!existing) {
      el.src = GIS_SRC;
      el.async = true;
      el.defer = true;
      document.head.appendChild(el);
    } else if (window.google && window.google.accounts) {
      done();
    }
  });

  return scriptPromise;
}

function requestToken(google) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: FREEBUSY_SCOPE,
      callback: (response) => {
        settled = true;
        if (response && response.access_token) resolve(response.access_token);
        else reject(new Error("Google didn't return access."));
      },
      error_callback: (err) => {
        settled = true;
        const type = err && err.type;
        if (type === "popup_closed" || type === "popup_failed_to_open") {
          const cancelled = new Error("Import cancelled.");
          cancelled.cancelled = true;
          reject(cancelled);
        } else {
          reject(new Error("Google sign-in failed."));
        }
      },
    });

    client.requestAccessToken();

    // The GIS popup can be dismissed without firing either callback in some browsers.
    window.setTimeout(() => {
      if (!settled) {
        const timedOut = new Error("Import timed out.");
        timedOut.cancelled = true;
        reject(timedOut);
      }
    }, 120000);
  });
}

async function revoke(google, token) {
  try {
    google.accounts.oauth2.revoke(token, () => {});
  } catch (e) {
    /* revocation is best-effort; the token is short-lived either way */
  }
}

/**
 * Ask Google when this person is busy between two instants.
 * Returns `[{ startMs, endMs }]` — no titles, because there are none to return.
 */
export async function fetchGoogleBusy({ timeMinMs, timeMaxMs }) {
  if (!googleConfigured()) {
    throw new Error("Google Calendar import isn't set up on this site.");
  }

  const google = await loadGis();
  const token = await requestToken(google);

  try {
    const res = await fetch(FREEBUSY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: new Date(timeMinMs).toISOString(),
        timeMax: new Date(timeMaxMs).toISOString(),
        items: [{ id: "primary" }],
      }),
    });

    if (!res.ok) {
      throw new Error(
        res.status === 403
          ? "Google denied the request. The Calendar API may not be enabled for this site."
          : "Google couldn't return your busy times."
      );
    }

    const data = await res.json();
    const calendar = (data.calendars && data.calendars.primary) || {};
    if (calendar.errors && calendar.errors.length) {
      throw new Error("Google couldn't read your primary calendar.");
    }

    return (calendar.busy || [])
      .map((slot) => ({
        startMs: Date.parse(slot.start),
        endMs: Date.parse(slot.end),
      }))
      .filter((iv) => Number.isFinite(iv.startMs) && Number.isFinite(iv.endMs));
  } finally {
    await revoke(google, token);
  }
}

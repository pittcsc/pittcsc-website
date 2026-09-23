let clientPromise;

export function getAuthClient() {
  if (typeof window === "undefined") throw new Error("Auth is browser-only");
  if (!clientPromise) {
    const url = process.env.GATSBY_SUPABASE_URL;
    const key = process.env.GATSBY_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Missing public auth configuration");
    clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) =>
        createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        }),
      )
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

export async function fetchIdentity(token, signal) {
  const api = process.env.GATSBY_API_URL;
  if (!api) throw new Error("Missing public API configuration");
  const response = await fetch(`${api.replace(/\/$/, "")}/auth/session`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    credentials: "omit",
    signal,
  });
  if (!response.ok) {
    const error = new Error("Session verification failed");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

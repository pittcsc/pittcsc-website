import { normalizePittEmail, authErrorMessage } from "./policy.mjs";

// Framework-independent session lifecycle, with dependency injection for tests.
// Tokens stay inside the SDK and this closure; consumers get only verified data.
export function createAuthStore({ getClient, fetchIdentity }) {
  const initial = Object.freeze({
    status: "loading",
    identity: null,
    error: null,
  });
  let state = initial;
  let client, subscription, session, pending, startPromise;
  let generation = 0;
  let stopped = false;
  let loggingOut = false;
  let logoutRequested = false;
  let refreshing = false;
  let lifecycle = 0;
  const listeners = new Set();

  const publish = (status, identity = null, error = null) => {
    state = { status, identity, error };
    for (const listener of listeners) listener();
  };
  const invalidate = () => {
    generation++;
    pending?.abort();
  };

  async function acceptSession(next, allowRefresh = true) {
    if (stopped || logoutRequested) return;
    invalidate();
    const attempt = generation;
    session = next;
    if (!session) {
      publish("signedOut");
      return;
    }
    pending = new AbortController();
    publish("loading");
    try {
      const identity = await fetchIdentity(
        session.access_token,
        pending.signal,
      );
      if (attempt === generation && !stopped)
        publish("authenticated", identity);
    } catch (error) {
      if (attempt !== generation || stopped) return;
      if (error.status === 401) {
        // A token may have expired during a request. Refresh once, never loop.
        if (allowRefresh) {
          let refreshed;
          refreshing = true;
          try {
            refreshed = await client.auth.refreshSession();
          } catch {
            refreshed = { error: { status: 0 } };
          } finally {
            refreshing = false;
          }
          if (attempt !== generation || stopped || loggingOut) return;
          if (
            refreshed.error &&
            (!refreshed.error.status || refreshed.error.status >= 500)
          ) {
            publish(
              "error",
              null,
              "We couldn't refresh your session. Check your connection and retry.",
            );
            return;
          }
          if (!refreshed.error && refreshed.data.session) {
            await acceptSession(refreshed.data.session, false);
            return;
          }
        }
        session = null;
        publish("signedOut", null, "Your session ended. Please sign in again.");
        // Best effort cleanup; an invalid session is already denied by Go.
        try {
          await client.auth.signOut({ scope: "local" });
        } catch {
          /* Already denied by Go. */
        }
      } else {
        publish(
          "error",
          null,
          "We couldn't verify your session. Check your connection and retry.",
        );
      }
    }
  }

  async function start() {
    if (startPromise) return startPromise;
    stopped = false;
    const life = ++lifecycle;
    startPromise = (async () => {
      try {
        client = await getClient();
        if (stopped || life !== lifecycle) return;
        const result = client.auth.onAuthStateChange((event, next) => {
          if (
            stopped ||
            life !== lifecycle ||
            (event === "TOKEN_REFRESHED" && refreshing)
          )
            return;
          // Clear private state synchronously. Defer SDK work until its callback
          // has returned, avoiding Supabase's internal auth-lock deadlock.
          if (event === "SIGNED_OUT") {
            invalidate();
            session = null;
            publish("signedOut");
          } else if (!logoutRequested) {
            invalidate();
            publish("loading");
            const scheduled = generation;
            setTimeout(() => {
              if (scheduled === generation && !stopped)
                void acceptSession(next);
            }, 0);
          }
        });
        subscription = result.data.subscription;
        const before = generation;
        const restored = await client.auth.getSession();
        if (before !== generation || stopped || life !== lifecycle) return;
        if (restored.error) throw restored.error;
        await acceptSession(restored.data.session);
      } catch {
        if (!stopped && life === lifecycle)
          publish(
            "error",
            null,
            "Sign-in is unavailable. Check your connection and configuration, then retry.",
          );
      }
    })();
    return startPromise;
  }

  async function retry() {
    if (logoutRequested) return;
    if (!client) {
      startPromise = null;
      return start();
    }
    const attempt = generation;
    try {
      const result = await client.auth.getSession();
      if (attempt !== generation || stopped) return;
      if (result.error) throw result.error;
      await acceptSession(result.data.session);
    } catch {
      if (attempt !== generation || stopped) return;
      publish("error", null, "We couldn't restore your session. Please retry.");
    }
  }

  async function signOut() {
    if (loggingOut) return false;
    loggingOut = true;
    logoutRequested = true;
    invalidate();
    publish("signingOut");
    try {
      client = client || (await getClient());
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      session = null;
      logoutRequested = false;
      publish("signedOut");
      return true;
    } catch {
      // Do not claim remote revocation succeeded while offline. Keep private
      // data hidden and let the user retry the same browser-session logout.
      publish(
        "logoutError",
        null,
        "Sign-out couldn't finish. Check your connection and retry sign-out.",
      );
      return false;
    } finally {
      loggingOut = false;
    }
  }

  async function requestCode(value) {
    const email = normalizePittEmail(value);
    if (!email) return { error: "Use your @pitt.edu email address." };
    try {
      const sdk = await getClient();
      const { error } = await sdk.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error)
        return {
          error: authErrorMessage(error, "send"),
          rateLimited: error.status === 429,
        };
      return { email };
    } catch {
      return { error: authErrorMessage(null, "send") };
    }
  }

  async function verifyCode(value, code) {
    const email = normalizePittEmail(value);
    if (!email || !/^\d{6}$/.test(code))
      return { error: "Enter the six-digit code from your email." };
    try {
      const sdk = await getClient();
      const { error } = await sdk.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      return error
        ? {
            error: authErrorMessage(error, "verify"),
            rateLimited: error.status === 429,
          }
        : {};
    } catch {
      return { error: authErrorMessage(null, "verify") };
    }
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    retry,
    signOut,
    requestCode,
    verifyCode,
    stop() {
      stopped = true;
      lifecycle++;
      invalidate();
      subscription?.unsubscribe();
      startPromise = null;
    },
  };
}

// Real local Auth/Mailpit/Go integration; never print credentials or identities.
// Leaves synthetic local accounts/mail for inspection, and signs its sessions out.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

let stage = "local configuration";
const clients = [];
function check(condition, message) {
  if (!condition) throw new Error(message);
}
function localURL(value) {
  const url = new URL(value);
  check(
    url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Refusing a nonlocal service",
  );
  return url.origin;
}

async function main() {
  const config = parse(
    readFileSync(new URL("../.env.development", import.meta.url)),
  );
  const authURL = localURL(config.GATSBY_SUPABASE_URL);
  const apiURL = localURL(config.GATSBY_API_URL);
  const mailURL = "http://127.0.0.1:54324";
  const key = config.GATSBY_SUPABASE_PUBLISHABLE_KEY;
  check(Boolean(key), "Missing public key");
  const suffix = randomUUID();
  const email = `csc-auth-test-${suffix}@pitt.edu`;
  const memory = new Map();
  const storage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
  const client = (storageKey, persistent = false) => {
    const sdk = createClient(authURL, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: persistent,
        detectSessionInUrl: false,
        storageKey,
        storage,
      },
    });
    clients.push(sdk);
    return sdk;
  };
  const first = client(`first-${suffix}`, true);
  const second = client(`second-${suffix}`);
  const api = (token) =>
    fetch(`${apiURL}/auth/session`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  async function codeFromMail() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await fetch(
        `${mailURL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      check(response.ok, "Mailpit search unavailable");
      const result = await response.json();
      if (result.messages?.length) {
        const messageResponse = await fetch(
          `${mailURL}/api/v1/message/${result.messages[0].ID}`,
        );
        check(messageResponse.ok, "Mailpit message unavailable");
        const message = await messageResponse.json();
        const code = (message.Text || message.HTML || "").match(
          /\b\d{6}\b/,
        )?.[0];
        check(Boolean(code), "Code missing from email template");
        check(
          !String(message.HTML).includes("/auth/v1/verify"),
          "Template unexpectedly contains a magic link",
        );
        return code;
      }
      await delay(250);
    }
    throw new Error("Mailpit delivery timed out");
  }

  stage = "missing and malformed tokens";
  check((await api()).status === 401, "Missing token accepted");
  check((await api("malformed")).status === 401, "Malformed token accepted");
  stage = "direct non-Pitt signup rejection";
  const denied = await first.auth.signInWithOtp({
    email: `csc-auth-test-${suffix}@example.com`,
  });
  check(Boolean(denied.error), "Non-Pitt signup accepted");
  stage = "new-user code delivery";
  const requested = await first.auth.signInWithOtp({ email });
  check(!requested.error, "New-user code request failed");
  const sentAt = Date.now();
  const code = await codeFromMail();
  stage = "server resend cooldown";
  const limited = await first.auth.signInWithOtp({ email });
  check(limited.error?.status === 429, "Resend cooldown was not enforced");
  stage = "invalid code rejection";
  const invalid = await first.auth.verifyOtp({
    email,
    token: code === "000000" ? "111111" : "000000",
    type: "email",
  });
  check(Boolean(invalid.error), "Invalid code accepted");
  stage = "new-user verification and Go identity";
  const verified = await first.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  check(!verified.error && verified.data.session, "Code verification failed");
  const originalToken = verified.data.session.access_token;
  const identityResponse = await api(originalToken);
  check(
    identityResponse.status === 200,
    `Go rejected verified identity (${identityResponse.status})`,
  );
  check(
    identityResponse.headers.get("cache-control") === "no-store",
    "Private response cache policy missing",
  );
  const identity = await identityResponse.json();
  check(
    identity.id === verified.data.user.id && identity.email === email,
    "Wrong identity returned",
  );
  const replay = await first.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  check(Boolean(replay.error), "Used OTP accepted again");
  stage = "session restoration and refresh";
  const restored = client(`first-${suffix}`, true);
  const saved = await restored.auth.getSession();
  check(
    saved.data.session?.user.id === identity.id,
    "Persistent session not restored",
  );
  const refreshed = await restored.auth.refreshSession();
  check(!refreshed.error && refreshed.data.session, "Session refresh failed");
  check(
    (await api(refreshed.data.session.access_token)).status === 200,
    "Refreshed token rejected",
  );
  console.log(
    "PASS: domain policy, OTP delivery/validation/cooldown, identity, persistence, refresh",
  );

  stage = "returning-user cooldown wait";
  const wait = Math.max(0, sentAt + 61000 - Date.now());
  if (wait > 0) {
    console.log(
      "Waiting for the real 60-second resend cooldown before testing another browser session…",
    );
    // Keep each wait bounded while preserving the real server-enforced interval.
    await delay(Math.min(wait, 30000));
    await delay(Math.max(0, sentAt + 61000 - Date.now()));
  }
  stage = "returning-user verification";
  const returning = await second.auth.signInWithOtp({ email });
  check(!returning.error, "Returning-user request failed");
  let nextCode;
  for (let attempt = 0; attempt < 20; attempt++) {
    nextCode = await codeFromMail();
    if (nextCode !== code) break;
    await delay(250);
  }
  const secondSession = await second.auth.verifyOtp({
    email,
    token: nextCode,
    type: "email",
  });
  check(
    !secondSession.error && secondSession.data.user.id === identity.id,
    "Returning-user identity changed",
  );
  stage = "current-browser logout and immediate old-token rejection";
  const logout = await restored.auth.signOut({ scope: "local" });
  check(!logout.error, "Logout failed");
  check(
    (await api(originalToken)).status === 401,
    "Pre-refresh token survived logout",
  );
  check(
    (await api(refreshed.data.session.access_token)).status === 401,
    "Unexpired token survived logout",
  );
  check(
    (await api(secondSession.data.session.access_token)).status === 200,
    "Logout revoked another browser session",
  );
  const rejectedRefresh = await restored.auth.refreshSession({
    refresh_token: refreshed.data.session.refresh_token,
  });
  check(Boolean(rejectedRefresh.error), "Logged-out refresh token accepted");
  console.log(
    "PASS: returning-user identity, current-browser logout, immediate revocation, independent session preserved",
  );
}

try {
  await main();
} catch (error) {
  // Deliberately omit SDK errors/responses, which may include private payloads.
  console.error(`FAIL: ${stage}. Check local service configuration and rerun.`);
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      /* Local test cleanup only. */
    }
    client.auth.stopAutoRefresh();
  }
}

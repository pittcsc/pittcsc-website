import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthStore } from "../../src/lib/auth/store.mjs";

const identity = { id: "test-user", email: "student@pitt.edu" };
const session = { access_token: "test-token" };
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

function fixture(overrides = {}) {
  let callback;
  const calls = [];
  const auth = {
    onAuthStateChange(fn) {
      callback = fn;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async getSession() {
      return { data: { session } };
    },
    async refreshSession() {
      return { error: { status: 401 } };
    },
    async signOut(options) {
      calls.push(options);
      callback("SIGNED_OUT", null);
      return {};
    },
    async signInWithOtp(options) {
      calls.push(options);
      return {};
    },
    async verifyOtp(options) {
      calls.push(options);
      return {};
    },
    ...overrides,
  };
  return { auth, calls, emit: (event, next) => callback(event, next) };
}

test("restores sessions using the server-verified identity; tokens never enter view state", async () => {
  const f = fixture();
  const store = createAuthStore({
    getClient: async () => ({ auth: f.auth }),
    fetchIdentity: async (token) => {
      assert.equal(token, session.access_token);
      return identity;
    },
  });
  assert.equal(store.getServerSnapshot().identity, null);
  await store.start();
  assert.deepEqual(store.getSnapshot(), {
    status: "authenticated",
    identity,
    error: null,
  });
  assert.ok(!JSON.stringify(store.getSnapshot()).includes("test-token"));
  f.emit("SIGNED_OUT", null);
  assert.equal(store.getSnapshot().identity, null);
  assert.equal(store.getSnapshot().status, "signedOut");
  store.stop();
});

test("logout is local; failed revocation hides private data and allows retry", async () => {
  let fail = true;
  const f = fixture({
    async signOut(options) {
      f.calls.push(options);
      return fail ? { error: new Error("offline") } : {};
    },
  });
  const store = createAuthStore({
    getClient: async () => ({ auth: f.auth }),
    fetchIdentity: async () => identity,
  });
  await store.start();
  assert.equal(await store.signOut(), false);
  assert.equal(store.getSnapshot().status, "logoutError");
  assert.equal(store.getSnapshot().identity, null);
  f.emit("SIGNED_IN", session);
  f.emit("TOKEN_REFRESHED", session);
  await tick();
  assert.equal(store.getSnapshot().status, "logoutError");
  assert.equal(store.getSnapshot().identity, null);
  fail = false;
  assert.equal(await store.signOut(), true);
  assert.equal(store.getSnapshot().status, "signedOut");
  assert.deepEqual(f.calls, [{ scope: "local" }, { scope: "local" }]);
  store.stop();
});

test("late private responses cannot restore state after logout", async () => {
  let resolve;
  const f = fixture();
  const store = createAuthStore({
    getClient: async () => ({ auth: f.auth }),
    fetchIdentity: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  const startup = store.start();
  await tick();
  await store.signOut();
  resolve(identity);
  await startup;
  assert.equal(store.getSnapshot().status, "signedOut");
  assert.equal(store.getSnapshot().identity, null);
  store.stop();
});

test("expired tokens refresh once and recover even when the SDK emits a refresh event", async () => {
  const f = fixture({
    async refreshSession() {
      f.emit("TOKEN_REFRESHED", { access_token: "fresh" });
      return { data: { session: { access_token: "fresh" } } };
    },
  });
  let calls = 0;
  const store = createAuthStore({
    getClient: async () => ({ auth: f.auth }),
    fetchIdentity: async (token) => {
      calls++;
      if (token !== "fresh") throw Object.assign(new Error(), { status: 401 });
      return identity;
    },
  });
  await store.start();
  assert.equal(store.getSnapshot().status, "authenticated");
  assert.equal(calls, 2);
  store.stop();
});

test("a revoked session cannot create an infinite refresh loop", async () => {
  let refreshes = 0;
  const f = fixture({
    async refreshSession() {
      refreshes++;
      f.emit("TOKEN_REFRESHED", session);
      return { data: { session } };
    },
  });
  const store = createAuthStore({
    getClient: async () => ({ auth: f.auth }),
    fetchIdentity: async () => {
      throw Object.assign(new Error(), { status: 401 });
    },
  });
  await store.start();
  await tick();
  assert.equal(refreshes, 1);
  assert.equal(store.getSnapshot().status, "signedOut");
  store.stop();
});

test("dependency outages are retryable and do not discard the SDK session", async () => {
  let offline = true;
  const f = fixture();
  const store = createAuthStore({
    getClient: async () => ({ auth: f.auth }),
    fetchIdentity: async () => {
      if (offline) throw Object.assign(new Error(), { status: 503 });
      return identity;
    },
  });
  await store.start();
  assert.equal(store.getSnapshot().status, "error");
  assert.equal(store.getSnapshot().identity, null);
  assert.equal(f.calls.length, 0);
  offline = false;
  await store.retry();
  assert.equal(store.getSnapshot().status, "authenticated");
  store.stop();
});

test("code flow uses only Supabase OTP APIs and presents validation/retry errors", async () => {
  const f = fixture();
  const store = createAuthStore({
    getClient: async () => ({ auth: f.auth }),
    fetchIdentity: async () => identity,
  });
  assert.ok((await store.requestCode("student@example.com")).error);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await store.requestCode("Student@PITT.EDU"), {
    email: "student@pitt.edu",
  });
  assert.deepEqual(f.calls[0], {
    email: "student@pitt.edu",
    options: { shouldCreateUser: true },
  });
  assert.ok((await store.verifyCode("student@pitt.edu", "bad")).error);
  await store.verifyCode("student@pitt.edu", "123456");
  assert.deepEqual(f.calls[1], {
    email: "student@pitt.edu",
    token: "123456",
    type: "email",
  });
  f.auth.verifyOtp = async () => ({
    error: { code: "otp_expired", status: 403 },
  });
  assert.match(
    (await store.verifyCode("student@pitt.edu", "123456")).error,
    /incorrect or expired/,
  );
  f.auth.signInWithOtp = async () => ({ error: { status: 429 } });
  assert.equal((await store.requestCode("student@pitt.edu")).rateLimited, true);
  store.stop();
});

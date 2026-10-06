import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccountClient } from "../../src/lib/account/client.mjs";

function fixture(fetchImpl) {
  let session = { user: { id: "owner" }, access_token: "old" };
  let refreshes = 0;
  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      refreshSession: async () => {
        refreshes++;
        session = { ...session, access_token: "new" };
        return { data: { session } };
      },
    },
  };
  return {
    request: createAccountClient({
      getClient: async () => client,
      apiURL: "http://localhost:8080/",
      fetchImpl,
    }),
    endSession: () => {
      session = null;
    },
    refreshes: () => refreshes,
  };
}

test("account requests refresh an expired token once and preserve the request", async () => {
  const calls = [];
  const f = fixture(async (url, options) => {
    calls.push({ url, ...options });
    return calls.length === 1
      ? new Response("{}", { status: 401 })
      : Response.json({ firstName: "Fixture" });
  });
  const result = await f.request("/profile", {
    userID: "owner",
    method: "PUT",
    body: "{}",
    contentType: "application/json",
  });
  assert.equal(result.firstName, "Fixture");
  assert.equal(f.refreshes(), 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers.Authorization, "Bearer new");
  assert.equal(calls[1].body, "{}");
  assert.equal(calls[1].credentials, "omit");
  assert.equal(calls[1].cache, "no-store");
  assert.equal(calls[1].url, "http://localhost:8080/profile");
});

test("denied sessions do not loop and outages do not retry mutations", async () => {
  let calls = 0;
  const denied = fixture(async () => {
    calls++;
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  });
  await assert.rejects(
    denied.request("/profile", { userID: "owner" }),
    /sign in/,
  );
  assert.equal(calls, 2);
  assert.equal(denied.refreshes(), 1);
  calls = 0;
  const offline = fixture(async () => {
    calls++;
    return Response.json({ error: "Try again." }, { status: 503 });
  });
  await assert.rejects(
    offline.request("/profile", { userID: "owner", method: "PUT", body: "{}" }),
    /Try again/,
  );
  assert.equal(calls, 1);
  assert.equal(offline.refreshes(), 0);
});

test("late account responses are discarded after logout or request cancellation", async () => {
  let release;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = f.request("/profile", { userID: "owner" });
  await new Promise((resolve) => setImmediate(resolve));
  f.endSession();
  release(Response.json({ firstName: "Private" }));
  await assert.rejects(pending, /session changed/);

  const controller = new AbortController();
  const canceled = fixture(async () => {
    controller.abort();
    return Response.json({ firstName: "Private" });
  });
  await assert.rejects(
    canceled.request("/profile", {
      userID: "owner",
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
});

test("another account cannot receive the current account's data", async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    return Response.json({});
  });
  await assert.rejects(
    f.request("/profile", { userID: "someone-else" }),
    /session changed/,
  );
  assert.equal(calls, 0);
});

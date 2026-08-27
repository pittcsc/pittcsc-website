/**
 * Persistence for /meet. Server-side only — never import this from a component.
 *
 * The whole surface is get / put / mutate on a JSON document keyed by meeting code,
 * which is small enough that swapping the backing store is a twenty-line adapter.
 * Three ship, and the first one that works wins:
 *
 *   upstash  explicit config beats inference, so if UPSTASH_REDIS_REST_URL and
 *            UPSTASH_REDIS_REST_TOKEN are set they take precedence. Plain REST over
 *            fetch; works on any host.
 *   blobs    Netlify's built-in blob store. No account, no env vars, no signup — it
 *            simply exists when running on Netlify. `getStore` throws off-platform,
 *            which is exactly the signal to fall through.
 *   file     the local default. Right for `gatsby develop` and for self-hosting on a
 *            box with a real disk; on serverless it still *works* but won't outlive
 *            the instance, so it says so loudly at boot.
 *
 * `GET /api/meet/health` reports which one actually engaged, because guessing about
 * storage is how deployments lose data quietly.
 */

import fs from "fs/promises";
import os from "os";
import path from "path";
import { getStore } from "@netlify/blobs";

const TTL_SECONDS = 60 * 60 * 24 * 180; // meetings are ephemeral by nature

/* --------------------------------- file --------------------------------- */

function fileAdapter() {
  const dir =
    process.env.MEET_DATA_DIR || path.join(os.tmpdir(), "pittcsc-meet");

  const fileFor = (code) => path.join(dir, `${code}.json`);

  return {
    name: "file",
    durable: false,
    async get(code) {
      try {
        return JSON.parse(await fs.readFile(fileFor(code), "utf8"));
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
    },
    async put(code, value) {
      await fs.mkdir(dir, { recursive: true });
      // Write-then-rename so a crash mid-write can't leave a truncated meeting.
      const tmp = `${fileFor(code)}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value), "utf8");
      await fs.rename(tmp, fileFor(code));
    },
    async ping() {
      await fs.mkdir(dir, { recursive: true });
      return true;
    },
    describe() {
      return `local file store at ${dir}`;
    },
  };
}

/* --------------------------------- blobs --------------------------------- */

/**
 * Netlify Blobs. Deliberately tried *before* the file store and after Upstash: it needs
 * no configuration at all on Netlify, but `getStore()` throws anywhere else, so the
 * caller treats a throw as "not on Netlify" rather than as an error.
 */
function blobsAdapter() {
  // Strong consistency is what we want — a read-modify-write on a meeting must not see
  // a stale copy and drop somebody's answer. But it needs an `uncachedEdgeURL` that
  // only some runtimes inject, and when it's missing the SDK throws on every single
  // read rather than degrading. So: ask for strong, and downgrade once if the
  // environment can't honour it. A slightly stale read beats a dead endpoint.
  let store = getStore({ name: "pittcsc-meet", consistency: "strong" });
  let strong = true;

  const downgrade = () => {
    if (!strong) return false;
    strong = false;
    store = getStore({ name: "pittcsc-meet" });
    console.warn(
      "[meet] Netlify Blobs strong consistency is unavailable here; falling back to " +
        "eventual consistency."
    );
    return true;
  };

  const withFallback = async (run) => {
    try {
      return await run(store);
    } catch (err) {
      if (err && err.name === "BlobsConsistencyError" && downgrade()) {
        return run(store);
      }
      throw err;
    }
  };

  return {
    name: "blobs",
    durable: true,
    async get(code) {
      return withFallback((s) => s.get(`meet-${code}`, { type: "json" }));
    },
    async put(code, value) {
      await withFallback((s) => s.setJSON(`meet-${code}`, value));
    },
    async ping() {
      // Reading a key that will never exist still proves the store answers.
      await withFallback((s) => s.get("__healthcheck__"));
      return true;
    },
    describe() {
      return `Netlify Blobs (${strong ? "strong" : "eventual"} consistency)`;
    },
  };
}

/* -------------------------------- upstash -------------------------------- */

/**
 * Upstash's REST API takes a Redis command as a JSON array and answers with
 * `{ result }` — or `{ error }` for a command that was understood but failed, which is
 * why the body is inspected even on a 2xx.
 */
function upstashAdapter(url, token) {
  const endpoint = String(url).replace(/\/+$/, "");

  const call = async (command) => {
    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });
    } catch (err) {
      throw new Error(`Can't reach Upstash at ${endpoint}: ${err.message}`);
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error("Upstash rejected the token (check UPSTASH_REDIS_REST_TOKEN).");
    }

    const body = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      throw new Error(`Upstash returned a non-JSON response (${res.status}).`);
    }
    if (!res.ok || parsed.error) {
      throw new Error(`Upstash error: ${parsed.error || body.slice(0, 200)}`);
    }
    return parsed.result;
  };

  return {
    name: "upstash",
    durable: true,
    async get(code) {
      const raw = await call(["GET", `meet:${code}`]);
      return raw ? JSON.parse(raw) : null;
    },
    async put(code, value) {
      await call(["SET", `meet:${code}`, JSON.stringify(value), "EX", TTL_SECONDS]);
    },
    async ping() {
      const pong = await call(["PING"]);
      return String(pong).toUpperCase() === "PONG";
    },
    describe() {
      // Host only — the token must never reach a log or an HTTP response.
      let host = endpoint;
      try {
        host = new URL(endpoint).host;
      } catch (e) {
        /* keep the raw string if it isn't a parseable URL */
      }
      return `Upstash Redis (${host})`;
    },
  };
}

/* -------------------------------- selection -------------------------------- */

let adapter = null;

function pickAdapter() {
  if (adapter) return adapter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    adapter = upstashAdapter(url, token);
  } else {
    try {
      adapter = blobsAdapter();
    } catch (err) {
      adapter = fileAdapter();
      const ephemeral =
        process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (ephemeral && !process.env.MEET_DATA_DIR) {
        console.warn(
          "[meet] Falling back to the local file store on a serverless host — meetings " +
            "will not survive between instances. Netlify Blobs was unavailable " +
            `(${err.message}). Set UPSTASH_REDIS_REST_URL and ` +
            "UPSTASH_REDIS_REST_TOKEN for durable storage."
        );
      }
    }
  }

  console.log(`[meet] storage: ${adapter.describe()}`);
  return adapter;
}

/**
 * Serialize read-modify-write per meeting so two people submitting at the same instant
 * can't clobber each other. In-process only, which is the right scope for the file
 * adapter; Upstash deployments that outgrow this want a WATCH/MULTI upgrade, and the
 * seam for it is right here.
 */
const chains = new Map();

export async function getMeeting(code) {
  return pickAdapter().get(code);
}

export async function putMeeting(code, value) {
  return pickAdapter().put(code, value);
}

/**
 * Load, apply `fn`, save. `fn` may return `null` to abort without writing.
 */
export async function mutateMeeting(code, fn) {
  const previous = chains.get(code) || Promise.resolve();

  const next = previous.then(async () => {
    const store = pickAdapter();
    const meeting = await store.get(code);
    if (!meeting) return null;
    const updated = await fn(meeting);
    if (!updated) return meeting;
    await store.put(code, updated);
    return updated;
  });

  // Keep the chain alive on failure, but don't leak the rejection into the next call.
  chains.set(
    code,
    next.then(
      () => undefined,
      () => undefined
    )
  );

  try {
    return await next;
  } finally {
    if (chains.size > 500) chains.clear();
  }
}

export function storeName() {
  return pickAdapter().name;
}

/**
 * What's actually backing this deployment, for the health endpoint. Deliberately
 * returns a description rather than any credential.
 */
export async function storeStatus() {
  const store = pickAdapter();
  const status = {
    store: store.name,
    detail: store.describe(),
    durable: Boolean(store.durable),
    reachable: false,
  };
  try {
    status.reachable = await store.ping();
  } catch (err) {
    status.error = err.message;
  }
  return status;
}

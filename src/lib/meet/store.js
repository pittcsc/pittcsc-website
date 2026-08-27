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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fileAdapter() {
  const dir =
    process.env.MEET_DATA_DIR || path.join(os.tmpdir(), "pittcsc-meet");

  const fileFor = (code) => path.join(dir, `${code}.json`);
  const lockFor = (code) => path.join(dir, `${code}.lock`);

  /**
   * An exclusive-create lock file. `wx` fails if the file exists, which is the only
   * primitive the filesystem gives us that two processes can't both win — and without
   * it, compare-then-write is a race that silently drops answers.
   */
  async function withLock(code, fn) {
    await fs.mkdir(dir, { recursive: true });
    const lock = lockFor(code);

    for (let attempt = 0; attempt < 400; attempt += 1) {
      let handle = null;
      try {
        handle = await fs.open(lock, "wx");
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
        // Reclaim a lock orphaned by a crashed process rather than hanging forever.
        try {
          const age = Date.now() - (await fs.stat(lock)).mtimeMs;
          if (age > 10000) await fs.unlink(lock);
        } catch (e) {
          /* it vanished on its own, which is what we wanted */
        }
        await sleep(5 + Math.random() * 10);
        continue;
      }

      try {
        return await fn();
      } finally {
        await handle.close();
        await fs.unlink(lock).catch(() => {});
      }
    }
    throw new Error("Timed out waiting to write that meeting.");
  }

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
      const tmp = `${fileFor(code)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value), "utf8");
      await fs.rename(tmp, fileFor(code));
    },
    async read(code) {
      try {
        const raw = await fs.readFile(fileFor(code), "utf8");
        return { value: JSON.parse(raw), token: raw };
      } catch (err) {
        if (err.code === "ENOENT") return { value: null, token: null };
        throw err;
      }
    },
    async writeIfUnchanged(code, value, token) {
      // Re-read *inside* the lock: another writer may have landed between our caller's
      // read and this call, and that is exactly the case the token comparison exists
      // to catch.
      return withLock(code, async () => {
        const current = await this.read(code);
        if (current.token !== token) return false;
        await this.put(code, value);
        return true;
      });
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
  // Netlify auto-wires Blobs for its own function runtime, but Gatsby Functions are
  // compiled through @netlify/plugin-gatsby into a format that doesn't receive
  // NETLIFY_BLOBS_CONTEXT — verified on a deploy preview, where the SDK raised
  // MissingBlobsEnvironmentError while SITE_ID and DEPLOY_ID were both present. So
  // fall back to explicit credentials when the automatic context is absent. Netlify
  // supplies the site id; the token has to be set by hand.
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token =
    process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN;
  const manual =
    !process.env.NETLIFY_BLOBS_CONTEXT && siteID && token ? { siteID, token } : null;

  // Strong consistency is what we want — a read-modify-write on a meeting must not see
  // a stale copy and drop somebody's answer. But it needs an `uncachedEdgeURL` that
  // only some runtimes inject, and when it's missing the SDK throws on every single
  // read rather than degrading. So: ask for strong, and downgrade once if the
  // environment can't honour it. A slightly stale read beats a dead endpoint.
  const open = (extra) =>
    getStore({ name: "pittcsc-meet", ...(manual || {}), ...extra });

  let store = open({ consistency: "strong" });
  let strong = true;

  const downgrade = () => {
    if (!strong) return false;
    strong = false;
    store = open({});
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
    async read(code) {
      const hit = await withFallback((s) =>
        s.getWithMetadata(`meet-${code}`, { type: "json" })
      );
      return hit ? { value: hit.data, token: hit.etag } : { value: null, token: null };
    },
    async writeIfUnchanged(code, value, token) {
      const res = await withFallback((s) =>
        token
          ? s.setJSON(`meet-${code}`, value, { onlyIfMatch: token })
          : s.setJSON(`meet-${code}`, value, { onlyIfNew: true })
      );
      // The SDK reports whether our write is the one that landed.
      return !res || res.modified !== false;
    },
    async ping() {
      // Reading a key that will never exist still proves the store answers.
      await withFallback((s) => s.get("__healthcheck__"));
      return true;
    },
    describe() {
      return `Netlify Blobs (${strong ? "strong" : "eventual"} consistency${
        manual ? ", explicit credentials" : ""
      })`;
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
    async read(code) {
      const raw = await call(["GET", `meet:${code}`]);
      return raw ? { value: JSON.parse(raw), token: raw } : { value: null, token: null };
    },
    async writeIfUnchanged(code, value, token) {
      // Compare-and-set against the exact previous serialization. Redis runs the
      // script atomically, so two writers can't both win.
      const script = [
        "local cur = redis.call('GET', KEYS[1])",
        "if (cur == false and ARGV[2] == '') or cur == ARGV[2] then",
        "  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])",
        "  return 1",
        "end",
        "return 0",
      ].join("\n");
      const ok = await call([
        "EVAL", script, "1", `meet:${code}`,
        JSON.stringify(value), token == null ? "" : token, String(TTL_SECONDS),
      ]);
      return Number(ok) === 1;
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
/** Why Blobs wasn't used, if it wasn't. Surfaced by the health endpoint — storage
 *  failing over is invisible otherwise, and the logs aren't always reachable. */
let blobsUnavailable = null;

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
      blobsUnavailable = `${err.name || "Error"}: ${err.message}`;
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
 * Load, apply `fn`, save — safely against other writers.
 *
 * The in-process queue below only orders writers that share a process. Two people
 * answering at the same moment can easily land in different Netlify containers (or
 * different dev-server function invocations), where a plain read-then-write silently
 * drops one of the answers. So the actual guarantee comes from a compare-and-set
 * against the value we read, retried on conflict; the queue just keeps a single
 * process from wasting retries on itself.
 *
 * `fn` may return `null` to abort without writing.
 */
const chains = new Map();
const MAX_ATTEMPTS = 6;

export async function getMeeting(code) {
  return pickAdapter().get(code);
}

export async function putMeeting(code, value) {
  return pickAdapter().put(code, value);
}

export async function mutateMeeting(code, fn) {
  const previous = chains.get(code) || Promise.resolve();

  const next = previous.then(async () => {
    const store = pickAdapter();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const { value: meeting, token } = await store.read(code);
      if (!meeting) return null;

      const updated = await fn(meeting);
      if (!updated) return meeting;

      if (await store.writeIfUnchanged(code, updated, token)) return updated;

      // Someone else wrote first. Re-read and re-apply rather than clobbering them;
      // back off a little so a burst of writers doesn't livelock.
      await new Promise((r) => setTimeout(r, 15 * (attempt + 1)));
    }

    const err = new Error("That meeting is being updated by too many people at once.");
    err.statusCode = 409;
    throw err;
  });

  const tail = next.then(
    () => undefined,
    () => undefined
  );
  chains.set(code, tail);

  try {
    return await next;
  } finally {
    // Drop only this code's link once it is the tail, so the map can't grow without
    // bound while other writers queued behind it keep their ordering.
    if (chains.get(code) === tail) chains.delete(code);
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
  if (blobsUnavailable) status.blobsUnavailable = blobsUnavailable;
  // Which of the signals Blobs relies on actually reached this runtime. Presence only
  // — never the values, which carry a token.
  status.env = {
    NETLIFY: Boolean(process.env.NETLIFY),
    NETLIFY_BLOBS_CONTEXT: Boolean(process.env.NETLIFY_BLOBS_CONTEXT),
    SITE_ID: Boolean(process.env.SITE_ID),
    DEPLOY_ID: Boolean(process.env.DEPLOY_ID),
  };
  try {
    status.reachable = await store.ping();
  } catch (err) {
    status.error = err.message;
  }
  return status;
}

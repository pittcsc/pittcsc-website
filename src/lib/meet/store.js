/**
 * Persistence for /meet. Server-side only — never import this from a component.
 *
 * The whole surface is get / put / mutate on a JSON document keyed by meeting code,
 * which is small enough that swapping the backing store is a twenty-line adapter. Two
 * ship today:
 *
 *   file     zero config, the default. Great for `gatsby develop` and for anyone
 *            self-hosting on a box with a real disk.
 *   upstash  set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN and it takes over.
 *            Plain REST over fetch, so no dependency and it works on any serverless
 *            host.
 *
 * On an ephemeral serverless filesystem the file adapter still *works*, it just won't
 * outlive the instance — so it warns loudly at boot rather than silently losing data.
 */

import fs from "fs/promises";
import os from "os";
import path from "path";

const TTL_SECONDS = 60 * 60 * 24 * 180; // meetings are ephemeral by nature

/* --------------------------------- file --------------------------------- */

function fileAdapter() {
  const dir =
    process.env.MEET_DATA_DIR || path.join(os.tmpdir(), "pittcsc-meet");

  const fileFor = (code) => path.join(dir, `${code}.json`);

  return {
    name: "file",
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
    describe() {
      return `file store at ${dir}`;
    },
  };
}

/* -------------------------------- upstash -------------------------------- */

function upstashAdapter(url, token) {
  const call = async (command) => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      throw new Error(`Upstash ${res.status}: ${await res.text()}`);
    }
    return (await res.json()).result;
  };

  return {
    name: "upstash",
    async get(code) {
      const raw = await call(["GET", `meet:${code}`]);
      return raw ? JSON.parse(raw) : null;
    },
    async put(code, value) {
      await call(["SET", `meet:${code}`, JSON.stringify(value), "EX", TTL_SECONDS]);
    },
    describe() {
      return "Upstash Redis";
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
    adapter = fileAdapter();
    const ephemeral =
      process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (ephemeral && !process.env.MEET_DATA_DIR) {
      console.warn(
        "[meet] Using the local file store on a serverless host — meetings will not " +
          "survive between instances. Set UPSTASH_REDIS_REST_URL and " +
          "UPSTASH_REDIS_REST_TOKEN for durable storage."
      );
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

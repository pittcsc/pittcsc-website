// End-to-end local Auth/Go/Postgres points check with synthetic accounts.
// Tokens, keys, codes, and member data are never logged.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

let stage = "local configuration";
const clients = [];
const userIDs = [];
function check(condition, message) {
  if (!condition) throw new Error(message);
}
function localURL(value) {
  const url = new URL(value);
  check(
    url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Nonlocal service refused",
  );
  return url.origin;
}
function sql(query) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_pittcsc-website",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

async function main() {
  const frontend = parse(
    readFileSync(new URL("../.env.development", import.meta.url)),
  );
  const backend = parse(
    readFileSync(new URL("../backend/.env", import.meta.url)),
  );
  const authURL = localURL(frontend.GATSBY_SUPABASE_URL);
  const apiURL = localURL(process.env.TEST_API_URL || frontend.GATSBY_API_URL);
  const databaseURL = process.env.DATABASE_URL || backend.DATABASE_URL;
  check(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseURL).hostname),
    "Nonlocal database refused",
  );
  const key = frontend.GATSBY_SUPABASE_PUBLISHABLE_KEY;
  check(key, "Public Auth key missing");
  const suffix = randomUUID();
  const mailURL = "http://127.0.0.1:54324";
  async function fixture(name) {
    const email = `csc-points-test-${name}-${suffix}@pitt.edu`;
    const client = createClient(authURL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: email,
      },
    });
    clients.push(client);
    check(
      !(await client.auth.signInWithOtp({ email })).error,
      "OTP request failed",
    );
    let code;
    for (let attempt = 0; attempt < 30 && !code; attempt++) {
      const result = await (
        await fetch(
          `${mailURL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        )
      ).json();
      if (result.messages?.length) {
        const message = await (
          await fetch(`${mailURL}/api/v1/message/${result.messages[0].ID}`)
        ).json();
        code = (message.Text || message.HTML || "").match(/\b\d{6}\b/)?.[0];
      }
      if (!code) await delay(250);
    }
    check(code, "OTP mail not received");
    const verified = await client.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    check(!verified.error && verified.data.session, "OTP verification failed");
    const id = verified.data.user.id;
    check(/^[a-f0-9-]{36}$/.test(id), "Invalid fixture ID");
    userIDs.push(id);
    return { id, email, client, token: verified.data.session.access_token };
  }
  const api = (user, path, method = "GET", body) =>
    fetch(`${apiURL}${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
    });
  try {
    stage = "unauthenticated routes";
    for (const path of [
      "/points/me",
      "/points/leaderboard",
      "/staff/points/claims",
    ])
      check(
        (await api(null, path)).status === 401,
        "Anonymous points access accepted",
      );
    stage = "synthetic users";
    const member = await fixture("member");
    const staff = await fixture("staff");
    check(
      (await api(member, "/auth/session")).status === 200,
      "Member provisioning failed",
    );
    check(
      (await api(staff, "/auth/session")).status === 200,
      "Staff provisioning failed",
    );
    check(
      (
        await api(member, "/profile", "PUT", {
          firstName: "PointsFixtureMember",
        })
      ).status === 200,
      "Member name setup failed",
    );
    check(
      (await api(staff, "/profile", "PUT", { firstName: "PointsFixtureStaff" }))
        .status === 200,
      "Staff name setup failed",
    );
    execFileSync(
      "go",
      [
        "run",
        "./cmd/grant-staff",
        "--email",
        staff.email,
        "--operator",
        "local-points-test",
      ],
      {
        cwd: new URL("../backend/", import.meta.url),
        env: { ...process.env, DATABASE_URL: databaseURL },
        stdio: "pipe",
      },
    );
    stage = "category and link validation";
    const catalog = await (await api(member, "/points/categories")).json();
    check(catalog.categories?.length === 3, "Point categories unavailable");
    check(
      (
        await api(member, "/points/claims", "POST", {
          category: "leetcode",
          url: "https://leetcode.com/problems/two-sum",
          affirmed: true,
        })
      ).status === 400,
      "Problem page earned points",
    );
    check(
      (
        await api(member, "/points/claims", "POST", {
          category: "paper",
          url: "https://example.org/paper",
          affirmed: false,
        })
      ).status === 400,
      "Unconfirmed activity earned points",
    );
    const link = `https://example.org/csc-points-test/${suffix}`;
    const submitted = await api(member, "/points/claims", "POST", {
      category: "paper",
      url: `${link}?utm_source=first`,
      affirmed: true,
    });
    check(submitted.status === 201, "Member award failed");
    const claim = await submitted.json();
    check(
      claim.points === 10 && claim.status === "awarded",
      "Wrong award value",
    );
    check(
      (
        await api(member, "/points/claims", "POST", {
          category: "paper",
          url: `${link}#variant`,
          affirmed: true,
        })
      ).status === 409,
      "Normalized duplicate earned points",
    );
    check(
      (
        await api(staff, "/points/claims", "POST", {
          category: "paper",
          url: link,
          affirmed: true,
        })
      ).status === 201,
      "Collaborator could not claim same link",
    );
    stage = "owner and leaderboard reads";
    const own = await (await api(member, "/points/me")).json();
    check(
      own.allTime === 10 &&
        own.last30Days === 10 &&
        own.claims[0].id === claim.id,
      "Owner points incorrect",
    );
    const board = await (
      await api(member, "/points/leaderboard?period=30d")
    ).json();
    check(
      board.entries.some((entry) => entry.isYou && entry.points === 10),
      "Leaderboard omitted award",
    );
    check(
      (await api(member, "/staff/points/claims")).status === 403,
      "Member reached staff claims",
    );
    check(
      (await api(member, `/points/claims/${randomUUID()}`, "DELETE")).status ===
        404,
      "Member could remove another claim",
    );
    stage = "staff moderation and owner visibility";
    const listed = await (await api(staff, "/staff/points/claims")).json();
    check(
      listed.claims.some((item) => item.id === claim.id),
      "Staff cannot inspect claims",
    );
    check(
      (
        await api(staff, `/staff/points/claims/${claim.id}/revoke`, "POST", {
          reason: "Invalid fixture",
        })
      ).status === 200,
      "Staff revoke failed",
    );
    const revoked = await (await api(member, "/points/me")).json();
    check(
      revoked.allTime === 0 &&
        revoked.claims[0].statusReason === "Invalid fixture",
      "Revocation not visible to owner",
    );
    check(
      (
        await api(staff, `/staff/points/claims/${claim.id}/restore`, "POST", {
          reason: "Reviewed",
        })
      ).status === 200,
      "Staff restore failed",
    );
    stage = "suspended account";
    sql(
      `update csc.profiles set account_status = 'suspended' where auth_user_id = '${member.id}'::uuid;`,
    );
    try {
      check(
        (await api(member, "/points/me")).status === 403,
        "Suspended account read points",
      );
      const suspendedBoard = await (
        await api(staff, "/points/leaderboard")
      ).json();
      check(
        !suspendedBoard.entries.some(
          (entry) => entry.name === "PointsFixtureMember",
        ),
        "Suspended member stayed on leaderboard",
      );
    } finally {
      sql(
        `update csc.profiles set account_status = 'active' where auth_user_id = '${member.id}'::uuid;`,
      );
    }
    stage = "owner withdrawal and lifetime uniqueness";
    check(
      (await api(member, `/points/claims/${claim.id}`, "DELETE")).status ===
        200,
      "Owner withdrawal failed",
    );
    check(
      (await api(member, `/points/claims/${claim.id}`, "DELETE")).status ===
        200,
      "Withdrawal retry was not safe",
    );
    check(
      (
        await api(member, "/points/claims", "POST", {
          category: "paper",
          url: link,
          affirmed: true,
        })
      ).status === 409,
      "Withdrawn link reused",
    );
    console.log("Local points API checks passed");
  } finally {
    for (const id of userIDs) {
      sql(`delete from csc.point_claims where auth_user_id = '${id}'::uuid;`);
    }
    await Promise.all(
      clients.map((client) => client.auth.signOut().catch(() => {})),
    );
  }
}

main().catch((error) => {
  console.error(
    `Local points API check failed during ${stage}: ${error?.cause?.code || error?.name || "unknown error"}`,
  );
  process.exitCode = 1;
});

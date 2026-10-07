// Real local Auth/Go/Postgres fixtures. No tokens, keys, or member data are logged.
// Creates synthetic accounts through Auth, never by editing managed Auth tables.
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync, execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const clients = [];
let stage = "local configuration";
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
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
const runFile = promisify(execFile);
const buildDir = mkdtempSync(join(tmpdir(), "csc-staff-test-"));
async function main() {
  const config = parse(
    readFileSync(new URL("../.env.development", import.meta.url)),
  );
  const authURL = localURL(config.GATSBY_SUPABASE_URL);
  const apiURL = localURL(process.env.TEST_API_URL || config.GATSBY_API_URL);
  const mailURL = "http://127.0.0.1:54324";
  const key = config.GATSBY_SUPABASE_PUBLISHABLE_KEY;
  check(key, "Public key missing");
  const suffix = randomUUID();
  async function fixture(name) {
    const email = `csc-staff-test-${name}-${suffix}@pitt.edu`;
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
    check(code, "Mail not received");
    const verified = await client.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    check(!verified.error && verified.data.session, "Verification failed");
    const id = verified.data.user.id;
    check(/^[a-f0-9-]{36}$/.test(id), "Invalid fixture ID");
    return { id, email, client, token: verified.data.session.access_token };
  }
  const api = (
    user,
    path,
    method = "GET",
    body,
    contentType = "application/json",
  ) =>
    fetch(`${apiURL}${path}`, {
      method,
      body,
      headers: {
        ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
        "Content-Type": contentType,
      },
    });
  // Refuse hosted credentials before invoking the trusted operator command.
  const backend = parse(
    readFileSync(new URL("../backend/.env", import.meta.url)),
  );
  const databaseURL = process.env.DATABASE_URL || backend.DATABASE_URL;
  check(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseURL).hostname),
    "Nonlocal database refused",
  );
  const binary = join(buildDir, "grant-staff");
  execFileSync("go", ["build", "-o", binary, "./cmd/grant-staff"], {
    cwd: new URL("../backend/", import.meta.url),
    stdio: "pipe",
  });
  const grant = (email) =>
    runFile(binary, ["--email", email, "--operator", "local-staff-test"], {
      cwd: new URL("../backend/", import.meta.url),
      env: { ...process.env, DATABASE_URL: databaseURL },
    });
  const expectGrantFailure = async (email) => {
    let failed = false;
    try {
      await grant(email);
    } catch {
      failed = true;
    }
    check(failed, "Ineligible grant accepted");
  };
  stage = "unauthenticated staff requests";
  check(
    (await api(null, "/staff/access")).status === 401,
    "Anonymous access accepted",
  );
  stage = "synthetic account and concurrent default provisioning";
  const user = await fixture("roles");
  const uses = await Promise.all(
    Array.from({ length: 16 }, () => api(user, "/auth/session")),
  );
  check(
    uses.every((r) => r.status === 200),
    "Concurrent profile provisioning failed",
  );
  const initial = await uses[0].json();
  check(JSON.stringify(initial.roles) === '["member"]', "Wrong default roles");
  check(
    sql(
      `select count(*) from csc.user_roles where auth_user_id = '${user.id}'`,
    ) === "1",
    "Duplicate default role",
  );
  stage = "non-staff combinations and self-escalation";
  for (const role of [null, "foundry", "alumni"]) {
    if (role)
      sql(
        `insert into csc.user_roles (auth_user_id, role) values ('${user.id}', '${role}')`,
      );
    check(
      (await api(user, "/staff/access?role=staff")).status === 403,
      "Non-staff access accepted",
    );
  }
  check(
    (await api(user, "/profile", "PUT", JSON.stringify({ roles: ["staff"] })))
      .status === 400,
    "Profile self-escalation accepted",
  );
  stage = "operator input and account eligibility";
  await expectGrantFailure(`csc-staff-test-unknown-${suffix}@pitt.edu`);
  await expectGrantFailure("fixture@example.com");
  stage = "concurrent idempotent grants and audit";
  await Promise.all(Array.from({ length: 6 }, () => grant(user.email)));
  const roles = await (await api(user, "/auth/session")).json();
  check(
    JSON.stringify(roles.roles) === '["alumni","foundry","member","staff"]',
    "Grant replaced additive roles",
  );
  check(
    sql(
      `select count(*) from csc.role_audit where target_user_id = '${user.id}' and role = 'staff' and action = 'grant' and operator = 'local-staff-test' and database_actor <> ''`,
    ) === "1",
    "Audit duplicated or missing",
  );
  check(
    (await api(user, "/staff/access")).status === 204,
    "Staff access denied",
  );
  stage = "suspension and recovery with same token";
  sql(
    `update csc.profiles set account_status = 'suspended' where auth_user_id = '${user.id}'`,
  );
  try {
    for (const path of ["/staff/access", "/auth/session", "/profile"])
      check((await api(user, path)).status === 403, "Suspension ignored");
    await expectGrantFailure(user.email);
  } finally {
    sql(
      `update csc.profiles set account_status = 'active' where auth_user_id = '${user.id}'`,
    );
  }
  check((await api(user, "/staff/access")).status === 204, "Recovery failed");
  stage = "role revocation with same token";
  // Only this synthetic local fixture is changed; no role-removal product API exists.
  sql(
    `delete from csc.user_roles where auth_user_id = '${user.id}' and role = 'staff'`,
  );
  check(
    (await api(user, "/staff/access")).status === 403,
    "Revocation ignored",
  );
  const revoked = await (await api(user, "/auth/session")).json();
  check(!revoked.roles.includes("staff"), "Session roles were stale");
  // Default roles are only assigned on creation, never restored by reads.
  sql(
    `delete from csc.user_roles where auth_user_id = '${user.id}' and role = 'member'`,
  );
  check(
    !(await (await api(user, "/auth/session")).json()).roles.includes("member"),
    "Removed role restored on read",
  );
  stage = "logout";
  check(
    !(await user.client.auth.signOut({ scope: "local" })).error,
    "Logout failed",
  );
  check(
    (await api(user, "/staff/access")).status === 401,
    "Signed-out token accepted",
  );
  console.log(
    "PASS: default roles, concurrent provisioning/grants, additive roles, operator validation, audit idempotency, self-escalation denial, suspension, revocation, and logout",
  );
}

try {
  await main();
} catch {
  console.error(`FAIL: ${stage}. Inspect the local implementation and rerun.`);
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      /* best effort */
    }
    client.auth.stopAutoRefresh();
  }
  rmSync(buildDir, { recursive: true, force: true });
}

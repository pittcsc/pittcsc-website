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
  await roleManagement({ fixture, api, grant });
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
    "PASS: default roles, concurrent provisioning/grants, additive roles, operator validation, audit idempotency, self-escalation denial, suspension, revocation, dashboard role management, and logout",
  );
}

// Dashboard role management through the Go API with synthetic accounts only.
async function roleManagement({ fixture, api, grant }) {
  const json = async (response, status, message) => {
    check(response.status === status, `${message} (${response.status})`);
    return status === 204 ? null : response.json();
  };
  const audits = (target, role, action, actor) =>
    sql(
      `select count(*) from csc.role_audit where target_user_id = '${target}' and role = '${role}' and action = '${action}' and actor_user_id = '${actor}' and operator is null`,
    );
  const rolePath = (target, role) => `/staff/users/${target.id}/roles/${role}`;
  stage = "role management fixtures";
  const [a, b, c] = await Promise.all(
    ["manager-a", "manager-b", "target"].map(fixture),
  );
  for (const account of [a, b, c])
    await json(await api(account, "/auth/session"), 200, "Session failed");
  await grant(a.email);
  await grant(b.email);
  const marker = c.email.split("@")[0].slice(-12);
  await json(
    await api(
      c,
      "/profile",
      "PUT",
      JSON.stringify({ firstName: "Ada", lastName: `Fixture${marker}` }),
    ),
    200,
    "Fixture profile not saved",
  );

  stage = "role management denies non-staff";
  for (const [method, path] of [
    ["GET", "/staff/roles"],
    ["GET", "/staff/users"],
    ["PUT", rolePath(c, "staff")],
    ["DELETE", rolePath(a, "staff")],
  ]) {
    check(
      (await api(null, path, method)).status === 401,
      "Anonymous role access",
    );
    check((await api(c, path, method)).status === 403, "Non-staff role access");
  }
  check(
    sql(
      `select count(*) from csc.user_roles where auth_user_id = '${c.id}' and role = 'staff'`,
    ) === "0",
    "Self-escalation changed roles",
  );

  stage = "role catalog";
  const { roles } = await json(
    await api(a, "/staff/roles"),
    200,
    "Catalog failed",
  );
  const byName = Object.fromEntries(roles.map((role) => [role.name, role]));
  check(
    !byName.member.editable &&
      byName.staff.editable &&
      byName.staff.confirm &&
      byName.foundry.editable &&
      !byName.foundry.confirm &&
      byName.alumni.editable &&
      roles.every((role) => role.label),
    "Unexpected catalog policy",
  );

  stage = "member search";
  const search = async (query) =>
    (await json(await api(a, `/staff/users?${query}`), 200, "Search failed"))
      .users;
  const byEmail = await search(
    `q=${encodeURIComponent(c.email.toUpperCase())}`,
  );
  check(
    byEmail.length === 1 &&
      byEmail[0].id === c.id &&
      byEmail[0].email === c.email,
    "Email search failed",
  );
  const byName2 = await search(
    `q=${encodeURIComponent(`ada fixture${marker}`)}`,
  );
  check(
    byName2.length === 1 && byName2[0].firstName === "Ada",
    "Full-name search failed",
  );
  const staffOnly = await search(
    `q=${encodeURIComponent(a.email.split("@")[0].slice(-36))}&role=staff`,
  );
  check(
    staffOnly.length === 2 &&
      [a.id, b.id].every((id) => staffOnly.some((m) => m.id === id)),
    "Role filter failed",
  );
  check(
    (await search(`q=${encodeURIComponent(`%${marker}`)}`)).length === 0,
    "LIKE wildcards were not escaped",
  );
  const firstPage = await json(
    await api(a, "/staff/users"),
    200,
    "Browse failed",
  );
  check(
    firstPage.users.length <= 25 && firstPage.pageSize === 25,
    "Page size not enforced",
  );
  for (const query of ["role=nonexistent", "page=0", "role=Staff"])
    check(
      (await api(a, `/staff/users?${query}`)).status === 400,
      "Invalid search accepted",
    );

  stage = "concurrent idempotent dashboard grants";
  const grants = await Promise.all(
    Array.from({ length: 6 }, () => api(a, rolePath(c, "foundry"), "PUT")),
  );
  check(
    grants.every((r) => r.status === 200),
    "Concurrent grant failed",
  );
  check(
    (await grants[0].json()).roles.join() === "foundry,member",
    "Grant response stale",
  );
  check(audits(c.id, "foundry", "grant", a.id) === "1", "Grant audit wrong");
  await json(
    await api(a, rolePath(c, "alumni"), "DELETE"),
    200,
    "No-op revoke failed",
  );
  check(
    sql(
      `select count(*) from csc.role_audit where target_user_id = '${c.id}' and role = 'alumni'`,
    ) === "0",
    "No-op change audited",
  );
  await json(
    await api(b, rolePath(c, "foundry"), "DELETE"),
    200,
    "Revoke failed",
  );
  check(audits(c.id, "foundry", "revoke", b.id) === "1", "Revoke audit wrong");

  stage = "read-only, unknown, and invalid targets";
  await json(
    await api(a, rolePath(c, "member"), "DELETE"),
    403,
    "Member removable",
  );
  await json(
    await api(a, rolePath(c, "admin"), "PUT"),
    404,
    "Unknown role accepted",
  );
  await json(
    await api(a, "/staff/users/not-a-uuid/roles/foundry", "PUT"),
    404,
    "Invalid target accepted",
  );
  check(
    sql(
      `select count(*) from csc.user_roles where auth_user_id = '${c.id}'`,
    ) === "1",
    "Rejected change modified roles",
  );

  stage = "protected staff role";
  await json(
    await api(a, rolePath(a, "staff"), "DELETE"),
    409,
    "Self-revoke accepted",
  );
  const promoted = await json(
    await api(a, rolePath(c, "staff"), "PUT"),
    200,
    "Staff grant failed",
  );
  check(promoted.roles.includes("staff"), "Staff not granted");
  await json(await api(c, "/staff/access"), 204, "Granted staff denied");
  await json(
    await api(a, rolePath(c, "staff"), "DELETE"),
    200,
    "Staff revoke failed",
  );
  await json(
    await api(c, "/staff/access"),
    403,
    "Revoked staff retained access",
  );

  stage = "suspended accounts";
  sql(
    `update csc.profiles set account_status = 'suspended' where auth_user_id = '${c.id}'`,
  );
  try {
    check(
      (await search(`q=${encodeURIComponent(c.email)}`)).length === 0,
      "Suspended account listed",
    );
    await json(
      await api(a, rolePath(c, "alumni"), "PUT"),
      404,
      "Suspended target changed",
    );
  } finally {
    sql(
      `update csc.profiles set account_status = 'active' where auth_user_id = '${c.id}'`,
    );
  }

  stage = "concurrent mutual staff revocation";
  // Each actor passes the request guard, but the locked recheck lets only one win.
  const mutual = await Promise.all([
    api(a, rolePath(b, "staff"), "DELETE"),
    api(b, rolePath(a, "staff"), "DELETE"),
  ]);
  const statuses = mutual.map((r) => r.status).sort();
  check(
    statuses[0] === 200 && statuses[1] === 403,
    `Mutual revocation not serialized (${statuses})`,
  );
  const survivor = mutual[0].status === 200 ? a : b;
  await json(await api(survivor, "/staff/access"), 204, "Survivor lost staff");

  stage = "revoked actor cannot change roles";
  const loser = survivor === a ? b : a;
  await json(
    await api(loser, rolePath(c, "alumni"), "PUT"),
    403,
    "Revoked actor changed roles",
  );
  await json(
    await api(survivor, rolePath(survivor, "staff"), "DELETE"),
    409,
    "Self-revoke accepted",
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

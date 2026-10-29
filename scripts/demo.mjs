// Local demo of the signed-in site: brings the development servers up and keeps
// one member account and one staff account available so both dashboards can be
// compared side by side. Local only; it refuses nonlocal services, prints no
// keys, tokens, or raw `supabase status` output, and preserves existing env
// files and database data. Accounts are created through Auth and roles through
// the audited grant-staff command, never by editing managed tables.
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { createServer, connect } from "node:net";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAIL_URL = "http://127.0.0.1:54324";
const OPERATOR = "local-demo";
// Stable addresses keep reruns idempotent: existing accounts are reused instead
// of requesting another code, which Auth rate-limits to one per minute.
const ACCOUNTS = [
  { view: "Member view", email: "csc-demo-member@pitt.edu", staff: false },
  { view: "Staff view", email: "csc-demo-staff@pitt.edu", staff: true },
];
const WEB_PORTS = Array.from({ length: 20 }, (_, index) => 8000 + index);
const PITT_EMAIL = /^[a-z0-9][a-z0-9._%+-]*@pitt\.edu$/;

let stage = "local configuration";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

// Every service this command touches must be a loopback address, so a hosted
// Supabase project can never be reached from here.
export function localOrigin(value) {
  const url = new URL(value);
  check(
    url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
    `Refusing to run the demo against a nonlocal service (${url.protocol}//${url.hostname}). The demo is for local development only.`,
  );
  return url.origin;
}

export function pittEmail(value) {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  check(
    PITT_EMAIL.test(email),
    "Provide a Pitt email address, for example csc-demo-member@pitt.edu.",
  );
  return email;
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

function launch(command, args, env = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    detached: true,
    env: { ...process.env, ...env },
  });
}

function finished(child) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise((done) => {
    child.once("error", (error) => done({ code: 1, error }));
    child.once("close", (code, signal) => done({ code, signal }));
  });
}

function terminateGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function responds(url, headers = {}) {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(2000) });
  } catch {
    return null;
  }
}

async function waitFor(label, ready, attempts) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await ready()) return;
    await delay(500);
  }
  throw new Error(`${label} did not become ready. Check the output above.`);
}

function connects(host, port) {
  return new Promise((done) => {
    const socket = connect({ host, port });
    socket.setTimeout(500);
    const settle = (value) => {
      socket.destroy();
      done(value);
    };
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

// Gatsby listens on IPv6 loopback only, so both families have to be checked
// before a port counts as unused.
async function listening(port) {
  for (const host of ["127.0.0.1", "::1"])
    if (await connects(host, port)) return true;
  return false;
}

function bindable(port) {
  return new Promise((done) => {
    const probe = createServer();
    probe.once("error", () => done(false));
    probe.listen(port, () => probe.close(() => done(true)));
  });
}

function readLocalConfig() {
  const config = parse(readFileSync(resolve(root, ".env.development")));
  const key = config.GATSBY_SUPABASE_PUBLISHABLE_KEY;
  check(
    Boolean(key),
    "GATSBY_SUPABASE_PUBLISHABLE_KEY is missing from .env.development; run `mise run setup`.",
  );
  return {
    authURL: localOrigin(config.GATSBY_SUPABASE_URL),
    apiURL: localOrigin(config.GATSBY_API_URL),
    key,
  };
}

function pendingMigrations() {
  const applied = new Set(
    sql("select version from supabase_migrations.schema_migrations")
      .split("\n")
      .filter(Boolean),
  );
  return readdirSync(resolve(root, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.split("_")[0])
    .filter((version) => !applied.has(version));
}

async function supabaseServing(authURL) {
  const health = await responds(`${authURL}/auth/v1/health`);
  if (!health?.ok) return false;
  try {
    return pendingMigrations().length === 0;
  } catch {
    return false;
  }
}

// Reuse local Supabase when it is already serving every local migration.
// Versions applied from other branches do not block the demo; only a missing
// local migration goes through the shared startup path, which applies it.
async function ensureSupabase() {
  const existing = existsSync(resolve(root, ".env.development"))
    ? readLocalConfig()
    : null;
  if (existing && (await supabaseServing(existing.authURL))) {
    console.log("Reusing the local Supabase already running");
    return existing;
  }
  const started = spawnSync(
    process.execPath,
    ["scripts/local-dev.mjs", "start"],
    { cwd: root, stdio: "inherit" },
  );
  check(
    !started.error && started.status === 0,
    "Local Supabase did not start. Make sure Docker is running and check the output above.",
  );
  return readLocalConfig();
}

async function gatsbyServes(origin) {
  const response = await responds(`${origin}/login`);
  if (!response?.ok) return false;
  return (await response.text()).includes('id="___gatsby"');
}

// Reuse a website already serving the dashboard routes; otherwise take the
// first port that is both unused and bindable, since the documented 8000 is
// often occupied by another project.
async function ensureWebsite(children) {
  for (const port of WEB_PORTS) {
    const origin = `http://localhost:${port}`;
    if ((await listening(port)) && (await gatsbyServes(origin))) {
      console.log(`Reusing the website already running at ${origin}`);
      return origin;
    }
  }
  for (const port of WEB_PORTS) {
    if ((await listening(port)) || !(await bindable(port))) continue;
    const origin = `http://localhost:${port}`;
    console.log(
      `Starting the website on ${origin}; the first build is slow...`,
    );
    children.push(launch("npm", ["run", "develop"], { PORT: String(port) }));
    await waitFor("The website", () => gatsbyServes(origin), 480);
    return origin;
  }
  throw new Error(
    `No free port for the website in ${WEB_PORTS[0]}-${WEB_PORTS.at(-1)}. Stop another server and retry.`,
  );
}

// The API allows exactly one browser origin, so a reused API has to already
// allow the website's origin; its env file is never rewritten here.
async function ensureAPI(apiURL, webOrigin, children) {
  const existing = await responds(`${apiURL}/health`, { Origin: webOrigin });
  if (existing?.ok) {
    check(
      existing.headers.get("access-control-allow-origin") === webOrigin,
      `The API already running at ${apiURL} does not allow ${webOrigin}, so the browser would be blocked. Stop it and rerun \`mise run demo\`, or set FRONTEND_ORIGIN to ${webOrigin} and restart it.`,
    );
    console.log(`Reusing the API already running at ${apiURL}`);
    return;
  }
  console.log(`Starting the API on ${apiURL} for ${webOrigin}...`);
  children.push(
    launch("npm", ["run", "dev:api"], { FRONTEND_ORIGIN: webOrigin }),
  );
  await waitFor(
    "The API",
    async () => {
      const response = await responds(`${apiURL}/health`, {
        Origin: webOrigin,
      });
      return Boolean(response?.ok);
    },
    120,
  );
}

async function codeFromMail(email, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(
      `${MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    check(
      response.ok,
      `Mailpit is unavailable at ${MAIL_URL}. Run \`mise run db:start\` and retry.`,
    );
    const result = await response.json();
    const latest = (result.messages || []).sort(
      (a, b) => Date.parse(b.Created) - Date.parse(a.Created),
    )[0];
    if (latest) {
      const messageResponse = await fetch(
        `${MAIL_URL}/api/v1/message/${latest.ID}`,
      );
      check(messageResponse.ok, "Mailpit could not return the message.");
      const message = await messageResponse.json();
      const code = (message.Text || message.HTML || "").match(/\b\d{6}\b/)?.[0];
      check(
        Boolean(code),
        `No 6-digit code in the latest message to ${email}.`,
      );
      return code;
    }
    await delay(250);
  }
  throw new Error(
    `No sign-in code has arrived for ${email}. Request one on the website's /login page first.`,
  );
}

function accountState(email) {
  const row = sql(`
    select
      case when p.auth_user_id is null then 'unprovisioned' else 'ready' end,
      coalesce(
        (select string_agg(r.role::text, ', ' order by r.role)
         from csc.user_roles r where r.auth_user_id = p.auth_user_id),
        'none'
      ),
      coalesce(p.account_status::text, 'unknown')
    from auth.users u
    left join csc.profiles p on p.auth_user_id = u.id
    where lower(u.email) = '${email}'
  `);
  if (!row) return { state: "absent", roles: "none", status: "unknown" };
  const [state, roles, status] = row.split("|");
  return { state, roles, status };
}

async function createAccount(email, { authURL, apiURL, key }) {
  const client = createClient(authURL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `demo-${email}`,
    },
  });
  try {
    const requested = await client.auth.signInWithOtp({ email });
    check(
      !requested.error,
      `Could not send a sign-in code to ${email}. Auth allows one code per minute for an address; wait and rerun.`,
    );
    const code = await codeFromMail(email);
    const verified = await client.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    check(
      !verified.error && verified.data.session,
      `Could not verify the sign-in code for ${email}.`,
    );
    // The first authenticated request provisions the profile and default member
    // role, which the staff grant then requires.
    const provisioned = await responds(`${apiURL}/auth/session`, {
      Authorization: `Bearer ${verified.data.session.access_token}`,
    });
    check(
      Boolean(provisioned?.ok),
      `The API did not provision an account for ${email}.`,
    );
    await client.auth.signOut({ scope: "local" });
  } finally {
    client.auth.stopAutoRefresh();
  }
}

function grantStaff(email) {
  const result = spawnSync(
    "go",
    ["run", "./cmd/grant-staff", "--email", email, "--operator", OPERATOR],
    { cwd: resolve(root, "backend"), stdio: "inherit" },
  );
  check(
    !result.error && result.status === 0,
    `Granting staff to ${email} failed. Check the output above.`,
  );
}

async function ensureAccount(account, config) {
  let state = accountState(account.email);
  if (state.state !== "ready") {
    console.log(`Creating the ${account.view.toLowerCase()} account...`);
    await createAccount(account.email, config);
    state = accountState(account.email);
    check(
      state.state === "ready",
      `${account.email} was not provisioned; open the dashboard once as that user and rerun.`,
    );
  }
  if (account.staff && !state.roles.split(", ").includes("staff")) {
    grantStaff(account.email);
    state = accountState(account.email);
  }
  check(
    state.status === "active",
    `${account.email} is ${state.status}, so it cannot be used for the demo.`,
  );
  return { ...account, roles: state.roles };
}

function report(webOrigin, apiURL, accounts) {
  const label = Math.max(...accounts.map((item) => item.view.length));
  const width = Math.max(...accounts.map((item) => item.email.length));
  console.log("\nThe signed-in demo is ready.\n");
  console.log(`  Website        ${webOrigin}`);
  console.log(`  API health     ${apiURL}/health`);
  console.log(`  Mailpit inbox  ${MAIL_URL}\n`);
  for (const account of accounts)
    console.log(
      `  ${account.view.padEnd(label)}    ${account.email.padEnd(width)}  roles: ${account.roles}`,
    );
  console.log(`
To see one of the views:
  1. Open ${webOrigin}/login in a new private window, one window per view.
  2. Type the address for that view and click "Send code".
  3. Run  mise run demo:code ${accounts[0].email}  and paste the 6 digits.

  The member view has /dashboard and /dashboard/account.
  The staff view adds Staff tools at /dashboard/staff, with
  /dashboard/staff/user-management and /dashboard/staff/events.

Each address can request a new code only once a minute. Sign out from
My Account on /dashboard/account, or just use a separate private window.`);
}

async function hold(children) {
  if (children.length === 0) {
    console.log(
      "\nThis command started no servers, so nothing stops when it exits.",
    );
    return 0;
  }
  console.log(
    "\nLeave this running while you browse. Ctrl+C stops only the servers started here; local Supabase keeps running.",
  );
  let interrupted = false;
  let wakeUp;
  const interrupt = new Promise((done) => {
    wakeUp = done;
  });
  const onSignal = () => {
    interrupted = true;
    wakeUp();
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
    process.on(signal, onSignal);
  try {
    const first = await Promise.race([
      ...children.map((child) => finished(child)),
      interrupt,
    ]);
    if (interrupted) return 0;
    console.error("A development server stopped.");
    return first.error || first.code !== 0 ? 1 : 0;
  } finally {
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
      process.off(signal, onSignal);
    const running = children.filter(
      (child) => child.exitCode === null && child.signalCode === null,
    );
    // Signal the process groups: npm may exit before the server it started.
    for (const child of running) terminateGroup(child, "SIGINT");
    await Promise.race([
      Promise.all(running.map(finished)),
      delay(7000).then(() => {
        for (const child of running) terminateGroup(child, "SIGTERM");
      }),
    ]);
  }
}

async function start() {
  const children = [];
  try {
    stage = "local Supabase";
    localOrigin(MAIL_URL);
    const config = await ensureSupabase();

    stage = "website";
    const webOrigin = await ensureWebsite(children);
    stage = "Go API";
    await ensureAPI(config.apiURL, webOrigin, children);

    stage = "demo accounts";
    const accounts = [];
    for (const account of ACCOUNTS)
      accounts.push(await ensureAccount(account, config));

    report(webOrigin, config.apiURL, accounts);
    return await hold(children);
  } catch (error) {
    for (const child of children) terminateGroup(child, "SIGINT");
    throw error;
  }
}

async function printCode(value) {
  localOrigin(MAIL_URL);
  const email = pittEmail(value);
  const code = await codeFromMail(email, 20);
  console.log(`Sign-in code for ${email}: ${code}`);
  console.log(
    "Paste it into the website's verification step. Codes are single-use; request another on /login if it is rejected.",
  );
}

async function main([mode, value]) {
  if (mode === "code") {
    stage = "sign-in code";
    return await printCode(value);
  }
  check(
    mode === undefined || mode === "start",
    "Usage: node scripts/demo.mjs [start|code <pitt-email>]",
  );
  return await start();
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = (await main(process.argv.slice(2))) || 0;
  } catch (error) {
    // Message only: SDK errors and responses can carry private payloads.
    console.error(`Demo setup failed at ${stage}: ${error.message}`);
    process.exitCode = 1;
  }
}

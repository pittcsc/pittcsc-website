// Local-only, synthetic Auth fixtures. No tokens, keys, or personal records are
// logged. Exercises real HTTP authorization, Postgres, and a fake calendar.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const clients = [];
let stage = "local configuration";
const check = (condition, message) => {
  if (!condition)
    throw Object.assign(new Error(message), { testFailure: true });
};
function localURL(raw) {
  const url = new URL(raw);
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
    {
      input: query,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
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
  const mailURL = "http://127.0.0.1:54324";
  const databaseURL = process.env.DATABASE_URL || backend.DATABASE_URL;
  check(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseURL).hostname),
    "Nonlocal database refused",
  );
  check(
    (process.env.GOOGLE_CALENDAR_MODE ||
      backend.GOOGLE_CALENDAR_MODE ||
      "disabled") === "disabled",
    "Use disabled calendar mode for local API fixtures",
  );
  const suffix = randomUUID();
  async function fixture(name) {
    const email = `csc-events-test-${name}-${suffix}@pitt.edu`;
    const client = createClient(
      authURL,
      frontend.GATSBY_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: email,
        },
      },
    );
    clients.push(client);
    const sent = await client.auth.signInWithOtp({ email });
    check(!sent.error, `OTP request failed (${sent.error?.code || sent.error?.status || "unknown"})`);
    let code;
    for (let n = 0; n < 30 && !code; n++) {
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
    check(!verified.error && verified.data.session, "OTP verification failed");
    const id = verified.data.user.id;
    check(/^[a-f0-9-]{36}$/.test(id), "Invalid fixture ID");
    return { id, email, client, token: verified.data.session.access_token };
  }
  const api = (user, path, method = "GET", body) =>
    fetch(`${apiURL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(user && { Authorization: `Bearer ${user.token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  const json = async (response, code = 200) => {
    check(
      response.status === code,
      `Unexpected HTTP status ${response.status}`,
    );
    return response.json();
  };

  stage = "synthetic staff and member fixtures";
  const [a, b, member] = await Promise.all(["a", "b", "member"].map(fixture));
  for (const account of [a, b, member])
    await json(await api(account, "/auth/session"));
  for (const account of [a, b]) {
    execFileSync(
      "go",
      [
        "run",
        "./cmd/grant-staff",
        "--email",
        account.email,
        "--operator",
        "local-events-test",
      ],
      {
        cwd: new URL("../backend/", import.meta.url),
        env: { ...process.env, DATABASE_URL: databaseURL },
        stdio: "pipe",
      },
    );
  }
  check(
    (await json(await api(a, "/staff/events"))).calendarEnabled === false,
    "The running API must have calendar delivery disabled before fixture writes",
  );
  const id = randomUUID();
  const path = `/staff/events/${id}`;
  const input = {
    title: "[Local fixture] Upcoming workshop",
    location: "Test room",
    description: "Synthetic local event",
    start: "2040-10-20T18:00",
    end: "2040-10-20T19:00",
    version: 0,
  };

  stage = "anonymous and non-staff access denial";
  const operations = [
    ["GET", "/staff/events"],
    ["GET", path],
    ["GET", `${path}/history`],
    ["PUT", path, input],
    ["POST", `${path}/sync`],
    ["POST", `${path}/cancel`, { version: 1 }],
  ];
  for (const [method, route, body] of operations) {
    check(
      (await api(null, route, method, body)).status === 401,
      "Anonymous event access",
    );
    check(
      (await api(member, route, method, body)).status === 403,
      "Member event access",
    );
  }
  for (const role of ["foundry", "alumni"]) {
    sql(
      `insert into csc.user_roles (auth_user_id, role) values ('${member.id}', '${role}')`,
    );
    check(
      (await api(member, "/staff/events")).status === 403,
      "Non-staff role combination allowed",
    );
  }

  stage = "validation and trusted fields";
  for (const invalid of [
    { ...input, role: "staff" },
    { ...input, calendarId: "other" },
    { ...input, timezone: "UTC" },
    { ...input, location: "" },
    { ...input, end: input.start },
    { ...input, start: "2027-03-14T02:30", end: "2027-03-14T04:00" },
  ])
    check(
      (await api(a, path, "PUT", invalid)).status === 400,
      "Invalid event accepted",
    );

  stage = "real Postgres with simulated Google failure, retry, and concurrency";
  execFileSync(
    "go",
    [
      "test",
      "-race",
      "./internal/events",
      "-run",
      "TestStoreIntegration",
      "-count=1",
    ],
    {
      cwd: new URL("../backend/", import.meta.url),
      env: {
        ...process.env,
        EVENTS_TEST_DATABASE_URL: databaseURL,
        EVENTS_TEST_ACTOR_ID: a.id,
        EVENTS_TEST_ACTOR_B_ID: b.id,
        EVENTS_TEST_MEMBER_ID: member.id,
      },
      stdio: "pipe",
    },
  );

  stage = "concurrent creation and disabled integration";
  const writes = await Promise.all(
    Array.from({ length: 6 }, () => api(a, path, "PUT", input)),
  );
  check(
    writes.every((response) => response.status === 200),
    "Concurrent creation failed",
  );
  let event = await writes[0].json();
  check(
    event.syncStatus === "disabled" && event.status === "active",
    "Start the test API with GOOGLE_CALENDAR_MODE=disabled",
  );
  check(
    event.timezone === "America/New_York" &&
      event.startsAt === "2040-10-20T22:00:00Z",
    "Incorrect timezone",
  );
  let history = await json(await api(a, `${path}/history`));
  check(
    history.entries.filter((entry) => entry.action === "created").length === 1,
    "Duplicate creation audit",
  );

  stage = "attendance URL, explicit check-in, and private roster";
  const attendancePath = `/attendance/${id}`;
  check(
    event.attendanceUrl ===
      `${localURL(backend.FRONTEND_ORIGIN || "http://localhost:8000")}${attendancePath}`,
    "Attendance QR destination must use the configured frontend origin",
  );
  check((await api(null, attendancePath)).status === 401, "Anonymous attendance read");
  check((await api(null, attendancePath, "POST")).status === 401, "Anonymous check-in");
  const initial = await json(await api(member, attendancePath));
  check(initial.title === event.title && !initial.checkedInAt, "GET recorded attendance");
  const submissions = await Promise.all(
    Array.from({ length: 6 }, () => api(member, attendancePath, "POST")),
  );
  check(submissions.every((response) => response.status === 200), "Concurrent check-ins failed");
  const submitted = await Promise.all(submissions.map((response) => response.json()));
  check(
    submitted.every((value) => value.checkedInAt === submitted[0].checkedInAt),
    "Retry changed the original check-in time",
  );
  check(
    (await api(member, `${path}/attendance`)).status === 403,
    "Member reached private roster",
  );
  const roster = await json(await api(a, `${path}/attendance`));
  check(
    roster.count === 1 && roster.attendees.length === 1 &&
      roster.attendees[0].email === member.email,
    "Roster lost or duplicated attendance",
  );
  check(
    !("attendees" in (await json(await api(member, attendancePath)))),
    "Member response leaked roster",
  );

  stage = "other staff edits and stale version conflicts";
  const edit = {
    ...input,
    title: "[Local fixture] Updated workshop",
    description: "",
    version: event.version,
  };
  event = await json(await api(b, path, "PUT", edit));
  check(event.title === edit.title && event.version === 2, "Edit failed");
  check(
    event.attendanceUrl.endsWith(attendancePath) &&
      (await json(await api(member, attendancePath))).title === edit.title,
    "Event edit broke stable attendance link",
  );
  check(
    (await api(a, path, "PUT", { ...edit, title: "Stale change" })).status ===
      409,
    "Stale write accepted",
  );
  history = await json(await api(a, `${path}/history`));
  check(
    history.entries.some(
      (entry) =>
        entry.action === "updated" &&
        entry.actorId === b.id &&
        entry.snapshot.title === edit.title,
    ),
    "Edit audit missing actor or snapshot",
  );
  await json(await api(a, `${path}/sync`, "POST"));

  stage = "cancellation and retained history";
  event = await json(
    await api(a, `${path}/cancel`, "POST", { version: event.version }),
  );
  check(event.status === "cancelled", "Cancellation not saved");
  check(
    (await api(b, attendancePath, "POST")).status === 409 &&
      (await json(await api(member, attendancePath))).status === "cancelled" &&
      (await json(await api(a, `${path}/attendance`))).count === 1,
    "Cancellation did not close check-in and retain roster",
  );
  await json(await api(a, `${path}/cancel`, "POST", { version: 1 }));
  check(
    (await api(a, path, "PUT", { ...edit, version: event.version })).status ===
      409,
    "Cancelled event editable",
  );
  await json(await api(b, `${path}/sync`, "POST"));
  check(
    (await json(await api(a, "/staff/events?filter=cancelled"))).events.some(
      (value) => value.id === id,
    ),
    "Cancelled event hidden",
  );

  stage = "upcoming and past local fixtures";
  for (const [title, start, end] of [
    [
      "[Local fixture] Upcoming workshop",
      "2040-11-20T18:00",
      "2040-11-20T19:00",
    ],
    ["[Local fixture] Past workshop", "2020-01-20T18:00", "2020-01-20T19:00"],
  ])
    await json(
      await api(a, `/staff/events/${randomUUID()}`, "PUT", {
        ...input,
        title,
        start,
        end,
      }),
    );
  for (const filter of ["upcoming", "past", "cancelled", "all"]) {
    const list = await json(await api(a, `/staff/events?filter=${filter}`));
    check(
      list.events.length <= 25 && list.pageSize === 25,
      "Unbounded event list",
    );
    if (filter === "upcoming" || filter === "past")
      check(
        list.events.every((value) => value.status === "active"),
        "Cancelled event in active list",
      );
  }
  for (const query of ["filter=draft", "page=0", "page=bad"])
    check(
      (await api(a, `/staff/events?${query}`)).status === 400,
      "Invalid list query accepted",
    );

  stage = "staff revocation, suspension, and logout";
  sql(
    `delete from csc.user_roles where auth_user_id='${b.id}' and role='staff'`,
  );
  check(
    (await api(b, `${path}/sync`, "POST")).status === 403,
    "Revoked staff retained event access",
  );
  sql(
    `update csc.profiles set account_status='suspended' where auth_user_id='${a.id}'`,
  );
  try {
    check(
      (await api(a, "/staff/events")).status === 403,
      "Suspended staff retained event access",
    );
  } finally {
    sql(
      `update csc.profiles set account_status='active' where auth_user_id='${a.id}'`,
    );
  }
  check(
    !(await a.client.auth.signOut({ scope: "local" })).error,
    "Logout failed",
  );
  check(
    (await api(a, "/staff/events")).status === 401,
    "Logged-out session accepted",
  );
  console.log(
    "PASS: event and attendance authorization, stable QR destinations, explicit and concurrent check-in, private roster, staff edits, cancellation, fixtures, disabled mode, simulated Google retries, revocation, suspension, and logout",
  );
}

try {
  await main();
} catch (error) {
  console.error(
    `FAIL: ${stage}. ${error.status ? `Subprocess exited ${error.status}.` : "Inspect the local implementation and rerun."}`,
  );
  if (error.testFailure) console.error(error.message);
  // Go test diagnostics contain only synthetic fixture assertions; never print
  // child process configuration, environment, Auth responses, or credentials.
  if (stage.startsWith("real Postgres") && error.stdout)
    console.error(error.stdout.toString());
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
}

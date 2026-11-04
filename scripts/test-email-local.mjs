// Synthetic accounts only. Refuses nonlocal services and never prints credentials.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
let stage = "configuration";
const clients = [];
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
function local(raw) {
  const u = new URL(raw);
  check(
    ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname),
    "Nonlocal test service refused",
  );
  return u;
}
try {
  const front = parse(
    readFileSync(new URL("../.env.development", import.meta.url)),
  );
  const back = parse(readFileSync(new URL("../backend/.env", import.meta.url)));
  const auth = local(front.GATSBY_SUPABASE_URL).origin,
    api = local(process.env.TEST_API_URL || front.GATSBY_API_URL).origin;
  const dsn = process.env.DATABASE_URL || back.DATABASE_URL;
  local(dsn);
  const mail = local(
    process.env.TEST_MAIL_URL || "http://127.0.0.1:54324",
  ).origin;
  async function fixture(label) {
    const email = `csc-email-test-${label}-${randomUUID()}@pitt.edu`;
    const c = createClient(auth, front.GATSBY_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: email,
      },
    });
    clients.push(c);
    const sent = await c.auth.signInWithOtp({ email });
    check(!sent.error, "Fixture OTP request failed");
    let code;
    for (let i = 0; i < 40 && !code; i++) {
      const result = await (
        await fetch(
          `${mail}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        )
      ).json();
      if (result.messages?.length) {
        const m = await (
          await fetch(`${mail}/api/v1/message/${result.messages[0].ID}`)
        ).json();
        code = (m.Text || m.HTML || "").match(/\b\d{6}\b/)?.[0];
      }
      if (!code) await delay(250);
    }
    check(code, "Fixture code not received");
    const verified = await c.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    check(
      !verified.error && verified.data.session,
      "Fixture OTP verification failed",
    );
    return {
      id: verified.data.user.id,
      email,
      token: verified.data.session.access_token,
    };
  }
  async function req(user, path, method = "GET", body, expected = 200) {
    const r = await fetch(api + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    check(
      r.status === expected,
      `${method} ${path}: expected ${expected}, got ${r.status}`,
    );
    return r;
  }
  stage = "synthetic account provisioning";
  const a = await fixture("officer"),
    member = await fixture("member");
  for (const u of [a, member]) {
    await req(u, "/auth/session");
    await req(u, "/profile", "PUT", {
      firstName: "CampaignFixture",
      lastName: "Synthetic",
      graduationYear: 2028,
      majors: ["Computer Science"],
    });
  }
  execFileSync(
    "go",
    [
      "run",
      "./cmd/grant-staff",
      "--email",
      a.email,
      "--operator",
      "local-email-test",
    ],
    {
      cwd: new URL("../backend/", import.meta.url),
      env: { ...process.env, DATABASE_URL: dsn },
      stdio: "pipe",
    },
  );
  stage = "HTTP authorization, drafts, preview, and public preferences";
  await req(null, "/staff/email/contacts", "GET", undefined, 401);
  await req(member, "/staff/email/contacts", "GET", undefined, 403);
  const draft = {
    name: "Synthetic API draft",
    subject: "Newsletter",
    preheader: "",
    blocks: [{ type: "text", text: "Hi {{firstName}}" }],
    audience: { mode: "all", conditions: [], exclusions: [] },
    version: 0,
  };
  const id = randomUUID();
  let d = await (
    await req(a, `/staff/email/campaigns/${id}`, "PUT", draft)
  ).json();
  check(d.id === id, "Draft ID changed");
  await req(a, `/staff/email/campaigns/${id}`, "PUT", {
    ...draft,
    version: d.version,
  });
  await req(
    a,
    `/staff/email/campaigns/${id}`,
    "PUT",
    { ...draft, version: d.version },
    409,
  );
  const html = await (
    await req(a, "/staff/email/preview", "POST", draft)
  ).json();
  check(html.html.includes("Hi Alex"), "Preview did not personalize");
  const contact = await (
    await req(a, "/staff/email/contacts/new", "PUT", {
      firstName: "External",
      lastName: "Fixture",
      email: `external-${randomUUID()}@example.test`,
      graduationYear: null,
      majors: [],
      tags: [],
      archived: false,
      version: 0,
    })
  ).json();
  check(contact.graduationYear === null, "Optional year not null");
  await req(member, "/profile/email-subscription", "PUT", {
    subscribed: false,
  });
  let subscription = await (
    await req(member, "/profile/email-subscription")
  ).json();
  check(!subscription.subscribed, "Member unsubscribe failed");
  await req(member, "/profile/email-subscription", "PUT", { subscribed: true });
  const exportResponse = await req(a, "/staff/email/export/contacts");
  check(
    exportResponse.headers.get("content-type").includes("text/csv"),
    "CSV export unavailable",
  );
  await req(
    null,
    "/email/ses-events",
    "POST",
    { Type: "Notification", TopicArn: "forged" },
    403,
  );
  stage = "durable delivery database integration";
  execFileSync(
    "go",
    [
      "test",
      "-count=1",
      "./internal/campaigns",
      "-run",
      "TestCampaignStoreIntegration",
      "-v",
    ],
    {
      cwd: new URL("../backend/", import.meta.url),
      env: {
        ...process.env,
        CAMPAIGNS_TEST_DATABASE_URL: dsn,
        CAMPAIGNS_TEST_ACTOR_ID: a.id,
        CAMPAIGNS_TEST_MEMBER_ID: member.id,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  console.log(
    "PASS: campaign staff authorization, shared draft conflicts, nullable contacts, subscriptions, imports, frozen audiences, cancellation, concurrent dispatch, uncertain sends, SES event deduplication, delivery blocks, image persistence, and test snapshots.",
  );
} catch (e) {
  console.error(
    `Email integration failed during ${stage}: ${e.status ? "backend integration assertions failed" : e.message}`,
  );
  if (e.stdout)
    console.error(
      String(e.stdout).replace(/csc-email-test-[^\s]+/g, "[synthetic fixture]"),
    );
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map((c) => c.auth.signOut().catch(() => {})));
}

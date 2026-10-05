// Real local Auth/Go/Postgres fixtures. No tokens, keys, or member data are logged.
// Creates synthetic accounts through Auth, never by editing managed Auth tables.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
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
function fixturePDF(label) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  ];
  const stream = `BT /F1 12 Tf 72 720 Td (${label}) Tj ET`;
  objects.push(
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function main() {
  const config = parse(
    readFileSync(new URL("../.env.development", import.meta.url)),
  );
  const authURL = localURL(config.GATSBY_SUPABASE_URL);
  const apiURL = localURL(config.GATSBY_API_URL);
  const mailURL = "http://127.0.0.1:54324";
  const key = config.GATSBY_SUPABASE_PUBLISHABLE_KEY;
  check(key, "Public key missing");
  const suffix = randomUUID();
  async function fixture(name) {
    const email = `csc-profile-test-${name}-${suffix}@pitt.edu`;
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
  const put = (user, input) =>
    api(user, "/profile", "PUT", JSON.stringify(input));
  const count = (table, id) =>
    Number(
      sql(
        `select count(*) from csc.${table} where auth_user_id = '${id}'::uuid;`,
      ),
    );

  stage = "unauthenticated requests";
  for (const path of ["/profile", "/profile/resume"])
    check((await api(null, path)).status === 401, "Missing token accepted");
  stage = "synthetic Auth fixtures";
  const owner = await fixture("owner");
  const other = await fixture("other");
  stage = "concurrent first-use provisioning";
  check(
    count("profiles", owner.id) === 0,
    "Profile existed before authenticated API use",
  );
  const firstUses = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      api(owner, i % 2 ? "/auth/session" : "/profile"),
    ),
  );
  check(
    firstUses.every((response) => response.status === 200),
    "Concurrent provisioning failed",
  );
  check(count("profiles", owner.id) === 1, "Duplicate profile created");
  const initial = await (await api(owner, "/profile")).json();
  check(
    !("hasAvatar" in initial) &&
      initial.firstName === null &&
      !initial.complete &&
      initial.majors.length === 0 &&
      initial.email === owner.email,
    "Initial profile was not empty",
  );
  stage = "partial and complete saves";
  const partial = await put(owner, { firstName: "Fixture" });
  check(
    partial.status === 200 && !(await partial.json()).complete,
    "Partial save failed",
  );
  const complete = {
    firstName: "Fixture",
    lastName: "Member",
    preferredName: "Test",
    graduationYear: 2028,
    majors: ["Computer Science", "Mathematics"],
  };
  const saved = await put(owner, complete);
  check(
    saved.status === 200 && (await saved.json()).complete,
    "Complete save failed",
  );
  check(
    (await put(owner, complete)).status === 200 &&
      count("profiles", owner.id) === 1,
    "Retry duplicated profile",
  );
  check(
    (await api(owner, "/profile")).headers.get("cache-control") === "no-store",
    "Private cache policy missing",
  );
  stage = "protected fields and ownership";
  for (const input of [
    { roles: ["staff"] },
    { account_status: "suspended" },
    { email: other.email },
    { auth_user_id: other.id },
    { resume_asset_id: other.id },
    { graduationYear: 2028.5 },
    { majors: ["Math", "math"] },
  ]) {
    check(
      (await put(owner, input)).status === 400,
      "Invalid or protected field accepted",
    );
  }
  const ownOnly = await (
    await api(other, `/profile?userId=${owner.id}`)
  ).json();
  check(
    ownOnly.firstName === null && ownOnly.email === other.email,
    "Another profile was exposed",
  );
  check(
    (await api(other, `/profile/${owner.id}`)).status === 404,
    "Other-profile route available",
  );

  stage = "resume uploads and concurrent replacement";
  const pdf = fixturePDF("Synthetic CSC resume fixture");
  const replacements = await Promise.all(
    Array.from({ length: 8 }, () =>
      api(owner, "/profile/resume", "PUT", pdf, "application/pdf"),
    ),
  );
  check(
    replacements.every((response) => response.status === 204) &&
      count("profile_assets", owner.id) === 1,
    "File upload duplicated records",
  );
  const downloaded = await api(owner, "/profile/resume");
  check(
    downloaded.status === 200 &&
      downloaded.headers.get("content-disposition").includes("attachment"),
    "Resume was not a private download",
  );
  check(
    Buffer.from(await downloaded.arrayBuffer()).equals(pdf),
    "Resume bytes changed",
  );
  check(
    (await api(other, "/profile/resume")).status === 404,
    "Another member received the resume",
  );
  const replacementPDF = fixturePDF("Replacement CSC resume fixture");
  check(
    (
      await api(
        owner,
        "/profile/resume",
        "PUT",
        replacementPDF,
        "application/pdf",
      )
    ).status === 204,
    "Resume replacement failed",
  );
  check(
    Buffer.from(
      await (await api(owner, "/profile/resume")).arrayBuffer(),
    ).equals(replacementPDF),
    "Old resume remained after replacement",
  );
  stage = "removed image routes and rejected-file preservation";
  for (const method of ["GET", "PUT", "DELETE", "OPTIONS"]) {
    check(
      (await api(owner, "/profile/avatar", method)).status === 404,
      "Removed image route remains available",
    );
  }
  for (const [path, data, media, status] of [
    ["resume", "<svg/>", "image/svg+xml", 415],
    ["resume", "not a PDF", "image/png", 415],
    ["resume", "not a PDF", "application/pdf", 400],
    ["resume", Buffer.alloc(10 * 1024 * 1024 + 1), "application/pdf", 413],
  ])
    check(
      (await api(owner, `/profile/${path}`, "PUT", data, media)).status ===
        status,
      "Invalid file accepted",
    );
  check(
    Buffer.from(
      await (await api(owner, "/profile/resume")).arrayBuffer(),
    ).equals(replacementPDF) && count("profile_assets", owner.id) === 1,
    "Rejected upload damaged saved files",
  );
  stage = "current database account status";
  sql(
    `update csc.profiles set account_status = 'suspended' where auth_user_id = '${owner.id}'::uuid;`,
  );
  try {
    for (const [path, method] of [
      ["/auth/session", "GET"],
      ["/profile", "GET"],
      ["/profile", "PUT"],
      ["/profile/resume", "GET"],
      ["/profile/resume", "PUT"],
      ["/profile/resume", "DELETE"],
    ]) {
      check(
        (await api(owner, path, method, method === "PUT" ? "{}" : undefined))
          .status === 403,
        "Suspended profile remained accessible",
      );
    }
  } finally {
    sql(
      `update csc.profiles set account_status = 'active' where auth_user_id = '${owner.id}'::uuid;`,
    );
  }
  stage = "idempotent file removal";
  for (const kind of ["resume"]) {
    for (let i = 0; i < 2; i++)
      check(
        (await api(owner, `/profile/${kind}`, "DELETE")).status === 204,
        "File removal failed",
      );
    check(
      (await api(owner, `/profile/${kind}`)).status === 404,
      "Removed file still downloadable",
    );
  }
  const removed = await (await api(owner, "/profile")).json();
  check(
    !removed.hasResume && count("profile_assets", owner.id) === 0,
    "File references or bytes remained",
  );
  stage = "immediate logout rejection";
  check(
    !(await owner.client.auth.signOut({ scope: "local" })).error,
    "Logout failed",
  );
  check(
    (await api(owner, "/profile")).status === 401,
    "Revoked session could read profile",
  );
  stage = "disabled generated Data API";
  const rest = await fetch(`${authURL}/rest/v1/profiles?select=id`, {
    headers: { apikey: key },
  });
  check(
    [404, 503].includes(rest.status),
    "Generated Data API remains available",
  );
  console.log(
    "PASS: concurrent provisioning, partial saves, completion, protected fields, ownership, files, limits, replacements, deletion, suspension, revocation, and Data API isolation",
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
}

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
  const apiURL = localURL(process.env.TEST_API_URL || config.GATSBY_API_URL);
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
  for (const path of ["/profile", "/profile/avatar", "/profile/resume"]) {
    const response = await api(null, path);
    check(
      response.status === 401,
      `Missing token accepted at ${path} (${response.status})`,
    );
  }
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
    lastName: `Member${suffix.slice(0, 8)}`,
    preferredName: "Test",
    graduationYear: Number(new Intl.DateTimeFormat("en-US", {
      year: "numeric", timeZone: "America/New_York",
    }).format(new Date())),
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
  const career = {
    ...complete,
    currentCompany: "PNC Bank",
    jobTitle: "Software Engineer",
    location: "Pittsburgh",
    bio: "Happy to meet CSC members.",
    personalWebsite: "https://example.com/about",
    contactEmail: "fixture-contact@example.org",
    offersCoffee: true,
    offersMentorship: true,
  };
  check(
    (await put(owner, career)).status === 200,
    "Optional career details could not be saved",
  );
  check(
    (await put(owner, { ...career, personalWebsite: "javascript:alert(1)" })).status === 400,
    "Unsafe website accepted",
  );
  check(
    (await put(owner, { ...career, contactEmail: owner.email.toUpperCase() })).status === 400,
    "Sign-in email accepted as contact email",
  );
  check(
    (await put(owner, { ...career, contactEmail: "alternate@pitt.edu" })).status === 200 &&
      (await put(owner, career)).status === 200,
    "An alternate Pitt contact address was rejected",
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
    { avatar_asset_id: other.id },
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

  stage = "member directory and profile visibility";
  check(
    (await api(null, "/members")).status === 401,
    "Anonymous directory access accepted",
  );
  check(
    (await api(other, "/members")).status === 403,
    "Incomplete member reached directory",
  );
  check(
    (await api(other, `/members/${owner.id}`)).status === 403,
    "Incomplete member read a profile",
  );
  check(
    (await api(other, "/profile/sharing", "PUT", JSON.stringify({ shared: true }))).status === 403,
    "Incomplete member changed sharing",
  );
  check(
    (
      await put(other, {
        firstName: "Directory",
        lastName: `Viewer${suffix.slice(0, 8)}`,
        graduationYear: complete.graduationYear + 1,
        majors: ["Mathematics"],
      })
    ).status === 200,
    "Directory viewer setup failed",
  );
  for (const name of [
    `Fixture Member${suffix.slice(0, 8)}`,
    `Test Member${suffix.slice(0, 8)}`,
  ]) {
    const directory = await (
      await api(other, `/members?q=${encodeURIComponent(name)}`)
    ).json();
    check(
      directory.members.some((member) => member.id === owner.id),
      "First or preferred name search missed a member",
    );
  }
  const companyMatches = await (
    await api(other, "/members?company=pnC&alumni=1")
  ).json();
  check(companyMatches.total === 0, "Alumni filter included an unclaimed member");
  check(
    (await api(other, "/profile/alumni", "PUT")).status === 409,
    "Future graduation year was allowed to claim alumni status",
  );
  check(
    (await (await api(other, "/members?company=pnC")).json()).total === 0,
    "Unshared company leaked through search",
  );
  const hidden = await (await api(other, `/members/${owner.id}`)).json();
  check(
    hidden.currentCompany === null && hidden.contactEmail === null &&
      hidden.githubUsername === null && !hidden.offersMentorship && !hidden.hasAvatar,
    "Optional member details were visible before sharing",
  );
  for (const body of [JSON.stringify({ shared: true, userId: other.id }), JSON.stringify({ shared: "yes" })]) {
    check((await api(owner, "/profile/sharing", "PUT", body)).status === 400,
      "Invalid sharing body was accepted");
  }
  const share = (shared) => api(owner, "/profile/sharing", "PUT", JSON.stringify({ shared }));
  for (let i = 0; i < 2; i++) {
    check((await share(true)).status === 200, "Sharing retry failed");
  }
  const claims = await Promise.all(
    Array.from({ length: 8 }, () => api(owner, "/profile/alumni", "PUT")),
  );
  check(claims.every((response) => response.status === 200), "Concurrent alumni claims failed");
  check(
    sql(`select count(*) from csc.role_audit where target_user_id = '${owner.id}' and role = 'alumni' and action = 'grant'`) === "1",
    "Alumni claim was not idempotently audited",
  );
  const claimedSession = await (await api(owner, "/auth/session")).json();
  check(
    claimedSession.roles.includes("member") &&
      claimedSession.roles.includes("alumni") &&
      !claimedSession.roles.includes("staff") &&
      (await api(owner, "/profile/alumni", "PUT", JSON.stringify({ role: "staff" }))).status === 400,
    "Alumni self-service changed another role or accepted role fields",
  );
  const alumniMatches = await (
    await api(other, `/members?q=Test&company=pnC&alumni=1`)
  ).json();
  check(
    alumniMatches.members.some((member) => member.id === owner.id && member.currentCompany === "PNC Bank" && member.jobTitle === "Software Engineer" && member.isAlumni),
    "Combined alumni and partial company filter missed the member",
  );
  check((await put(owner, { ...career, graduationYear: complete.graduationYear + 1 })).status === 200,
    "Future-year profile edit failed");
  check(
    !(await (await api(owner, "/profile")).json()).isAlumni &&
      !(await (await api(other, "/members?alumni=1")).json()).members.some((member) => member.id === owner.id) &&
      (await (await api(other, `/members/${owner.id}`)).json()).currentCompany === "PNC Bank",
    "Future year kept alumni presentation or incorrectly hid shared member details",
  );
  check((await put(owner, career)).status === 200,
    "Eligible graduation year restore failed");
  check(
    (await (await api(other, "/members?company=google&alumni=1")).json()).total === 0,
    "Company filter included a different employer",
  );
  const privateSearch = await (
    await api(other, `/members?q=${encodeURIComponent(owner.email)}`)
  ).json();
  check(privateSearch.total === 0, "Email leaked into member search");
  const publicProfile = await (await api(other, `/members/${owner.id}`)).json();
  check(
    publicProfile.id === owner.id &&
      publicProfile.name === `Test Member${suffix.slice(0, 8)}` &&
      publicProfile.allTimePoints === 0 &&
      publicProfile.rank30Days === null &&
      publicProfile.currentCompany === "PNC Bank" &&
      publicProfile.location === "Pittsburgh" &&
      publicProfile.contactEmail === career.contactEmail &&
      publicProfile.offersMentorship === true &&
      !("email" in publicProfile) &&
      !("hasResume" in publicProfile),
    "Public profile exposed private fields or wrong points",
  );
  check((await share(false)).status === 200, "Unsharing failed");
  check(
    (await (await api(other, "/members?company=pnC")).json()).total === 0 &&
      (await (await api(other, `/members/${owner.id}`)).json()).contactEmail === null,
    "Unshared details leaked through search or profile",
  );
  check((await share(true)).status === 200, "Re-sharing failed");

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
  stage = "avatar uploads and rejected-file preservation";
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  check(
    (await api(owner, "/profile/avatar", "PUT", png, "image/png")).status ===
      204,
    "Avatar upload failed",
  );
  check(
    (await api(other, `/members/${owner.id}/avatar`)).status === 200,
    "Shared avatar was not available to members",
  );
  check((await share(false)).status === 200, "Unsharing photo failed");
  check(
    (await api(other, `/members/${owner.id}/avatar`)).status === 404 &&
      !(await (await api(other, `/members/${owner.id}`)).json()).hasAvatar &&
      (await api(owner, "/profile/avatar")).status === 200,
    "Unshared avatar remained visible or owner lost access",
  );
  check((await share(true)).status === 200, "Re-sharing photo failed");
  const image = await api(owner, "/profile/avatar");
  check(
    image.status === 200 && image.headers.get("content-type") === "image/png",
    "Avatar download failed",
  );
  check(
    (await api(other, "/profile/avatar")).status === 404,
    "Another member received the avatar",
  );
  const sharedAvatar = await api(other, `/members/${owner.id}/avatar`);
  check(
    sharedAvatar.status === 200 &&
      sharedAvatar.headers.get("content-type") === "image/png",
    "Member avatar unavailable",
  );
  for (const [path, data, media, status] of [
    ["avatar", "<svg/>", "image/svg+xml", 415],
    ["avatar", "not an image", "image/png", 400],
    ["resume", "not a PDF", "application/pdf", 400],
    ["avatar", Buffer.alloc(5 * 1024 * 1024 + 1), "image/png", 413],
    ["resume", Buffer.alloc(10 * 1024 * 1024 + 1), "application/pdf", 413],
  ])
    check(
      (await api(owner, `/profile/${path}`, "PUT", data, media)).status ===
        status,
      "Invalid file accepted",
    );
  check(
    (await api(owner, "/profile/avatar")).status === 200 &&
      count("profile_assets", owner.id) === 2,
    "Rejected upload damaged saved files",
  );
  stage = "current database account status";
  sql(
    `update csc.profiles set account_status = 'suspended' where auth_user_id = '${owner.id}'::uuid;`,
  );
  try {
    check(
      (await api(other, `/members/${owner.id}`)).status === 404,
      "Suspended member remained public",
    );
    for (const [path, method] of [
      ["/auth/session", "GET"],
      ["/profile", "GET"],
      ["/profile", "PUT"],
      ["/profile/resume", "GET"],
      ["/profile/avatar", "PUT"],
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
  check(
    !(await (await api(owner, "/profile")).json()).detailsShared &&
      (await (await api(other, `/members/${owner.id}`)).json()).contactEmail === null,
    "Reinstatement restored sharing without consent",
  );
  check((await share(true)).status === 200, "Sharing after reinstatement failed");
  stage = "idempotent file removal";
  for (const kind of ["avatar", "resume"]) {
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
    !removed.hasAvatar &&
      !removed.hasResume &&
      count("profile_assets", owner.id) === 0,
    "File references or bytes remained",
  );
  stage = "completion revocation";
  const incompleteAgain = await (
    await put(owner, { ...complete, majors: [] })
  ).json();
  check(
    !incompleteAgain.complete && !incompleteAgain.detailsShared,
    "Clearing a required field kept membership complete",
  );
  check(
    (await api(owner, "/points/categories")).status === 403,
    "Incomplete account retained points access",
  );
  check(
    (await api(other, `/members/${owner.id}`)).status === 404,
    "Incomplete account remained public",
  );
  check(
    (await put(owner, complete)).status === 200,
    "Completion recovery failed",
  );
  check(
    !(await (await api(owner, "/profile")).json()).detailsShared,
    "Completion restored sharing without consent",
  );
  check((await share(true)).status === 200, "Sharing after completion failed");
  const race = await Promise.all([
    share(true),
    put(owner, { ...complete, majors: [] }),
  ]);
  check(race.every((response) => response.status === 200 || response.status === 403),
    "Concurrent sharing/profile write failed unexpectedly");
  check(
    !(await (await api(owner, "/profile")).json()).detailsShared,
    "Concurrent write left an incomplete profile shared",
  );
  check((await put(owner, complete)).status === 200,
    "Recovery after concurrent write failed");
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
    "PASS: provisioning, completion gate, sharing consent and revocation, alumni year, contact email, hidden search/photo fields, files, suspension, revocation, and Data API isolation",
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

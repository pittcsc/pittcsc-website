import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { loadLeadershipData } from "../../src/lib/site/leadership.mjs";
import {
  buildAboutMarkdown,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildSponsorsMarkdown,
} from "../../src/lib/site/machineReadable.mjs";
import {
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  normalizeCanonicalPath,
  PAGE_SEO,
  summarizeDescription,
} from "../../src/lib/site/seo.mjs";
import {
  collectSitemapUrls,
  isPublicSitemapPath,
  renderSitemapXml,
} from "../../src/lib/site/sitemap.mjs";
import {
  CLUB_POSITIONING,
  CLUB_SOCIALS,
  CLUB_STATS,
  SITE_URL,
  SPONSORSHIP_DATA,
} from "../../src/lib/site/stats.mjs";

const REPO_ROOT = resolve(new URL("../..", import.meta.url).pathname);

function readRepoFile(relativePath) {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

test("shared stats module preserves conflicting figures with explicit unconfirmed flags", () => {
  assert.equal(CLUB_STATS.members.about, "750+");
  assert.equal(CLUB_STATS.members.sponsors, "1000+");
  assert.equal(CLUB_STATS.members.confirmed, false);
  assert.match(CLUB_STATS.members.conflictNote, /750\+.*1000\+/);

  assert.equal(CLUB_STATS.eventsPerYear.about, "70+");
  assert.equal(CLUB_STATS.eventsPerYear.sponsors, "75+");
  assert.equal(CLUB_STATS.eventsPerYear.confirmed, false);
  assert.match(CLUB_STATS.eventsPerYear.conflictNote, /70\+.*75\+/);

  assert.equal(CLUB_STATS.social.followers, "15K");
  assert.equal(CLUB_STATS.social.totalReelViews, "100M+");
  assert.equal(CLUB_STATS.social.averageVideoViews, "750K");
});

test("home, about, and sponsors pages all import from the single shared stats source", () => {
  for (const pageFile of [
    "src/pages/index.js",
    "src/pages/about.js",
    "src/pages/sponsors.js",
  ]) {
    const source = readRepoFile(pageFile);
    assert.match(
      source,
      /from "\.\.\/lib\/site\/stats\.mjs"/,
      `${pageFile} should import shared stats/positioning`,
    );
  }

  const aboutSource = readRepoFile("src/pages/about.js");
  assert.ok(!aboutSource.includes("750+"), "about.js should not hardcode 750+");
  assert.ok(!aboutSource.includes("70+"), "about.js should not hardcode 70+");
  assert.match(aboutSource, /CLUB_STATS\.members\.about/);
  assert.match(aboutSource, /CLUB_STATS\.eventsPerYear\.about/);
  assert.match(aboutSource, /CLUB_POSITIONING\.summarySentence/);

  const sponsorsSource = readRepoFile("src/pages/sponsors.js");
  assert.match(sponsorsSource, /CLUB_STATS\.members\.sponsors/);
  assert.match(sponsorsSource, /CLUB_STATS\.eventsPerYear\.sponsors/);
  assert.match(sponsorsSource, /CLUB_POSITIONING\.largestOrgClaim/);
});

test("core public pages have unique titles, descriptions, and updated positioning", () => {
  const keys = ["home", "about", "initiatives", "join", "sponsors"];
  const titles = new Set();
  const descriptions = new Set();

  for (const key of keys) {
    const entry = PAGE_SEO[key];
    assert.ok(entry?.title, `missing title for ${key}`);
    assert.ok(entry?.description, `missing description for ${key}`);
    assert.ok(!titles.has(entry.title), `duplicate title: ${entry.title}`);
    assert.ok(
      !descriptions.has(entry.description),
      `duplicate description: ${entry.description}`,
    );
    assert.doesNotMatch(
      entry.description,
      /largest computer science student organization/i,
    );
    titles.add(entry.title);
    descriptions.add(entry.description);
  }

  for (const file of ["gatsby-config.js", "src/components/seo.js"]) {
    assert.doesNotMatch(
      readRepoFile(file),
      /largest computer science student organization/i,
      `${file} should not retain stale narrow positioning`,
    );
  }
});

test("canonical URL normalization preserves Gatsby trailing slashes and file extensions", () => {
  assert.equal(normalizeCanonicalPath("/"), "/");
  assert.equal(normalizeCanonicalPath("/about"), "/about/");
  assert.equal(normalizeCanonicalPath("/about/"), "/about/");
  assert.equal(normalizeCanonicalPath("/sponsors?ref=test#tiers"), "/sponsors/");
  assert.equal(normalizeCanonicalPath("/about.md"), "/about.md");
  assert.equal(normalizeCanonicalPath("/llms.txt"), "/llms.txt");
  assert.equal(
    buildCanonicalUrl("https://pittcsc.org/", "/initiatives/foundry"),
    "https://pittcsc.org/initiatives/foundry/",
  );
  assert.equal(
    buildCanonicalUrl("https://pittcsc.org", "/sponsors.md"),
    "https://pittcsc.org/sponsors.md",
  );
});

test("summarizeDescription produces clean bounded snippets", () => {
  const short = "Short description.";
  assert.equal(summarizeDescription(short), short);
  const long =
    "Foundry is PittCSC's program for members who want structured practice with interviews, presentations, project building, mentorship, peer accountability, and a strong social community on campus.";
  const summary = summarizeDescription(long, 120);
  assert.ok(summary.length <= 120);
  assert.ok(summary.endsWith("…"));
});

test("Organization JSON-LD encodes confirmed identity, Pitt/SCI affiliation, socials, and SteelHacks", () => {
  const schema = buildOrganizationJsonLd(SITE_URL);
  assert.equal(schema["@context"], "https://schema.org");
  assert.equal(schema["@type"], "Organization");
  assert.equal(schema.name, "Computer Science Club at Pitt");
  assert.deepEqual(schema.alternateName, [
    "CSC at Pitt",
    "Pitt CSC",
    "Pitt Computer Science Club",
  ]);
  assert.equal(schema.url, "https://pittcsc.org/");
  assert.equal(schema.email, "pittcsc@gmail.com");
  assert.equal(schema.address.addressLocality, "Pittsburgh");
  assert.equal(schema.address.addressRegion, "PA");
  assert.match(
    schema.description,
    /largest student organization at the University of Pittsburgh/i,
  );
  assert.deepEqual(schema.sameAs, [
    "https://www.instagram.com/csc.at.pitt/",
    "https://x.com/CSC_at_Pitt",
    "https://www.linkedin.com/company/cscatpitt/",
    "https://github.com/pittcsc",
  ]);

  assert.ok(Array.isArray(schema.memberOf));
  assert.ok(
    schema.memberOf.some(
      (org) =>
        org["@type"] === "CollegeOrUniversity" &&
        org.name === "University of Pittsburgh",
    ),
  );
  assert.ok(
    schema.memberOf.some(
      (org) =>
        org["@type"] === "EducationalOrganization" &&
        org.name.includes("School of Computing and Information"),
    ),
  );

  assert.equal(schema.subOrganization.name, "SteelHacks");
  assert.equal(schema.subOrganization.url, "https://steelhacks.org/");
  assert.equal(schema.event, undefined);
  assert.doesNotMatch(JSON.stringify(schema), /2026-09-19|September 19/);
});

test("sitemap includes public pages, PDF, and machine-readable files while excluding private routes", () => {
  const samplePages = [
    "/",
    "/about/",
    "/initiatives/",
    "/initiatives/foundry/",
    "/initiatives/coming-soon/",
    "/join/",
    "/sponsors/",
    "/projects/",
    "/login/",
    "/dashboard/",
    "/dashboard/account/",
    "/attendance/",
    "/attendance/1234/",
    "/meet/",
    "/meet/[code]/",
    "/qr/",
    "/404/",
    "/404.html",
    "/dev-404-page/",
    "/api/attendance",
  ];

  const urls = collectSitemapUrls(SITE_URL, samplePages);
  assert.ok(urls.includes("https://pittcsc.org/"));
  assert.ok(urls.includes("https://pittcsc.org/about/"));
  assert.ok(urls.includes("https://pittcsc.org/initiatives/"));
  assert.ok(urls.includes("https://pittcsc.org/initiatives/foundry/"));
  assert.ok(urls.includes("https://pittcsc.org/join/"));
  assert.ok(urls.includes("https://pittcsc.org/sponsors/"));
  assert.ok(
    urls.includes("https://pittcsc.org/Pitt_CSC_Sponsorship_Package_2026-2027.pdf"),
  );
  assert.ok(urls.includes("https://pittcsc.org/llms.txt"));
  assert.ok(urls.includes("https://pittcsc.org/llms-full.txt"));
  assert.ok(urls.includes("https://pittcsc.org/about.md"));
  assert.ok(urls.includes("https://pittcsc.org/sponsors.md"));

  for (const excluded of [
    "/login",
    "/dashboard",
    "/attendance",
    "/meet",
    "/qr",
    "/projects",
    "/initiatives/coming-soon",
    "/404",
    "/dev-404-page",
    "/api",
  ]) {
    assert.equal(isPublicSitemapPath(excluded), false);
    assert.ok(
      !urls.some((url) => url.includes(excluded)),
      `sitemap must exclude ${excluded}`,
    );
  }

  const xml = renderSitemapXml(urls);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/pittcsc\.org\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/pittcsc\.org\/llms\.txt<\/loc>/);
});

test("robots.txt allows public pages, disallows private routes, and declares sitemap", () => {
  const robots = readRepoFile("static/robots.txt");
  assert.match(robots, /User-agent:\s*\*/);
  assert.match(robots, /Allow:\s*\//);
  for (const route of ["/login", "/dashboard", "/attendance", "/meet", "/qr", "/api/"]) {
    assert.match(robots, new RegExp(`Disallow:\\s*${route}`));
  }
  assert.match(robots, /Sitemap:\s*https:\/\/pittcsc\.org\/sitemap\.xml/);
});

test("static machine-readable files stay in sync with shared data and current leadership", () => {
  const leadership = loadLeadershipData(REPO_ROOT);
  assert.ok(leadership.officers.length > 0, "expected current officers from src/components/data.js");
  assert.ok(
    leadership.initiativeLeads.length > 0,
    "expected current initiative leads from src/components/data.js",
  );

  assert.equal(readRepoFile("static/llms.txt"), buildLlmsTxt());
  assert.equal(readRepoFile("static/llms-full.txt"), buildLlmsFullTxt(leadership));
  assert.equal(readRepoFile("static/about.md"), buildAboutMarkdown(leadership));
  assert.equal(readRepoFile("static/sponsors.md"), buildSponsorsMarkdown());

  assert.ok(
    existsSync(resolve(REPO_ROOT, "static", SPONSORSHIP_DATA.pdfPath.replace(/^\//, ""))),
    "sponsorship package PDF must exist in static/",
  );

  // Confirm stale content JSON entries are not present in generated summaries.
  for (const file of [
    "static/llms.txt",
    "static/llms-full.txt",
    "static/about.md",
    "static/sponsors.md",
  ]) {
    const text = readRepoFile(file);
    assert.doesNotMatch(text, /\bSAP\b/, `${file} must not pull stale content/sponsors.json`);
    assert.doesNotMatch(
      text,
      /Zhengming Wang/,
      `${file} must not pull stale content/officers.json`,
    );
  }
});

test("human UI links machine-readable summaries and Netlify serves them as plain text", () => {
  const footer = readRepoFile("src/components/Footer.js");
  for (const path of ["/llms.txt", "/llms-full.txt", "/about.md", "/sponsors.md"]) {
    assert.ok(footer.includes(`href="${path}"`), `Footer must link to ${path}`);
  }

  const about = readRepoFile("src/pages/about.js");
  assert.ok(about.includes('href="/about.md"'));
  assert.ok(about.includes('href="/llms.txt"'));

  const sponsors = readRepoFile("src/pages/sponsors.js");
  assert.ok(sponsors.includes('href="/sponsors.md"'));
  assert.ok(sponsors.includes('href="/llms.txt"'));

  const netlify = readRepoFile("netlify.toml");
  for (const path of ["/llms.txt", "/llms-full.txt", "/about.md", "/sponsors.md"]) {
    assert.match(
      netlify,
      new RegExp(`for = "${path.replace(".", "\\.")}"[\\s\\S]*?Content-Type = "text/plain; charset=utf-8"`),
      `netlify.toml must serve ${path} as text/plain; charset=utf-8`,
    );
  }

  // Verify official social links match required profiles.
  assert.equal(CLUB_SOCIALS.instagram, "https://www.instagram.com/csc.at.pitt/");
  assert.equal(CLUB_SOCIALS.x, "https://x.com/CSC_at_Pitt");
  assert.equal(CLUB_SOCIALS.linkedin, "https://www.linkedin.com/company/cscatpitt/");
  assert.equal(CLUB_SOCIALS.github, "https://github.com/pittcsc");
  assert.equal(
    CLUB_POSITIONING.largestOrgClaim,
    "the largest student organization at the University of Pittsburgh",
  );
});

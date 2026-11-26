import {
  buildCanonicalUrl,
  MACHINE_READABLE_PATHS,
  normalizeCanonicalPath,
} from "./seo.mjs";
import { SITE_URL, SPONSORSHIP_DATA } from "./stats.mjs";

export const EXCLUDED_SITEMAP_PREFIXES = [
  "/login",
  "/dashboard",
  "/attendance",
  "/meet",
  "/qr",
  "/api",
  "/projects",
  "/initiatives/coming-soon",
  "/404",
  "/dev-404-page",
  "/offline-plugin-app-shell-fallback",
];

export const STATIC_PUBLIC_SITEMAP_PATHS = [
  SPONSORSHIP_DATA.pdfPath,
  ...MACHINE_READABLE_PATHS,
];

function matchesExcludedPrefix(pathname, prefix) {
  return (
    pathname === prefix ||
    pathname === `${prefix}/` ||
    pathname.startsWith(`${prefix}/`) ||
    pathname.startsWith(`${prefix}.`)
  );
}

export function isPublicSitemapPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  const trimmed = pathname.trim();
  if (!trimmed) return false;
  if (trimmed.includes("[") || trimmed.includes("]") || trimmed.includes("*")) {
    return false;
  }
  const normalized = normalizeCanonicalPath(trimmed);
  for (const prefix of EXCLUDED_SITEMAP_PREFIXES) {
    if (matchesExcludedPrefix(normalized, prefix)) {
      return false;
    }
  }
  return true;
}

export function collectSitemapUrls(
  siteUrl = SITE_URL,
  pagePaths = [],
  extraPaths = STATIC_PUBLIC_SITEMAP_PATHS,
) {
  const uniquePaths = new Set();
  for (const rawPath of [...pagePaths, ...extraPaths]) {
    if (isPublicSitemapPath(rawPath)) {
      uniquePaths.add(normalizeCanonicalPath(rawPath));
    }
  }
  const sortedPaths = [...uniquePaths].sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });
  return sortedPaths.map((pathname) => buildCanonicalUrl(siteUrl, pathname));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemapXml(urls) {
  const items = urls
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

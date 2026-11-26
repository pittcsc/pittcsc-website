import {
  CLUB_CONTACT,
  CLUB_POSITIONING,
  CLUB_SOCIALS,
  DEFAULT_SOCIAL_IMAGE,
  SITE_URL,
} from "./stats.mjs";

export const PAGE_SEO = {
  home: {
    title: "Computer Science Club at Pitt | Largest Student Organization at Pitt",
    description:
      "The Computer Science Club at Pitt (Pitt CSC) is the largest student organization at the University of Pittsburgh and a partner of the School of Computing and Information. Open to all majors.",
  },
  about: {
    title: "About Us | Computer Science Club at Pitt",
    description:
      "Learn about the Computer Science Club at Pitt (Pitt CSC), the largest student organization at the University of Pittsburgh, our mission, officers, and initiative leads.",
  },
  initiatives: {
    title: "Initiatives | Computer Science Club at Pitt",
    description:
      "Explore Pitt CSC programs at the University of Pittsburgh, including Zero to Offer, Foundry, Mock Interviews, Consulting, CSC Hacks, SteelHacks, Bit/Byte, and Fireside Chats.",
  },
  join: {
    title: "Join the Club | Computer Science Club at Pitt",
    description:
      "Join the Computer Science Club at Pitt, the largest student organization at the University of Pittsburgh. Open to all majors with meetings typically Mondays and Thursdays at 8pm.",
  },
  sponsors: {
    title: "Sponsors & Partnerships | Computer Science Club at Pitt",
    description:
      "Partner with the Computer Science Club at Pitt, the largest student organization at the University of Pittsburgh and a partner of SCI. View current sponsors, tiers, and the 2026-2027 package.",
  },
};

export const LLMS_TXT_PATH = "/llms.txt";

export const MARKDOWN_ALTERNATES = {
  "/about/": "/about.md",
  "/initiatives/": "/initiatives.md",
  "/join/": "/join.md",
  "/sponsors/": "/sponsors.md",
};

export const MACHINE_READABLE_PATHS = [
  LLMS_TXT_PATH,
  "/llms-full.txt",
  ...Object.values(MARKDOWN_ALTERNATES),
];

const FILE_EXTENSION_RE = /\.[a-z0-9]{1,8}$/i;

// Gatsby 5 serves pages with a trailing slash, so canonicals without one point at a
// redirect. Static files such as /llms.txt must keep their exact path.
export function normalizeCanonicalPath(pathname = "/") {
  if (!pathname) return "/";
  const clean = pathname.split(/[?#]/)[0].trim();
  if (!clean || clean === "/") return "/";
  const withLeading = clean.startsWith("/") ? clean : `/${clean}`;
  const collapsed = withLeading.replace(/\/{2,}/g, "/");
  if (FILE_EXTENSION_RE.test(collapsed)) {
    return collapsed;
  }
  return collapsed.endsWith("/") ? collapsed : `${collapsed}/`;
}

export function buildCanonicalUrl(siteUrl = SITE_URL, pathname = "/") {
  const base = (siteUrl || SITE_URL).replace(/\/+$/, "");
  return `${base}${normalizeCanonicalPath(pathname)}`;
}

export function getMarkdownAlternatePath(pathname = "/") {
  return MARKDOWN_ALTERNATES[normalizeCanonicalPath(pathname)] || null;
}

export function resolveImageUrl(siteUrl = SITE_URL, imagePath = DEFAULT_SOCIAL_IMAGE) {
  const target = imagePath || DEFAULT_SOCIAL_IMAGE;
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  const base = (siteUrl || SITE_URL).replace(/\/+$/, "");
  const normalized = target.startsWith("/") ? target : `/${target}`;
  return `${base}${normalized}`;
}

export function summarizeDescription(text, maxLength = 155) {
  if (!text || typeof text !== "string") return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  if (collapsed.length <= maxLength) return collapsed;
  const sliced = collapsed.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const boundary = lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced;
  return `${boundary.replace(/[.,;:\s]+$/, "")}…`;
}

// No Event JSON-LD: the repository stores no confirmed upcoming event dates, and
// stale dates in structured data would mislead search results.
export function buildOrganizationJsonLd(siteUrl = SITE_URL) {
  const base = (siteUrl || SITE_URL).replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: CLUB_POSITIONING.name,
    alternateName: CLUB_POSITIONING.alternateNames,
    url: `${base}/`,
    logo: resolveImageUrl(base, DEFAULT_SOCIAL_IMAGE),
    image: resolveImageUrl(base, DEFAULT_SOCIAL_IMAGE),
    email: CLUB_CONTACT.email,
    description: `${CLUB_POSITIONING.summarySentence} ${CLUB_POSITIONING.openTo}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: CLUB_CONTACT.location.city,
      addressRegion: CLUB_CONTACT.location.region,
      addressCountry: CLUB_CONTACT.location.country,
    },
    memberOf: [
      {
        "@type": "CollegeOrUniversity",
        name: CLUB_POSITIONING.universityName,
        url: CLUB_POSITIONING.universityUrl,
      },
      {
        "@type": "EducationalOrganization",
        name: `${CLUB_POSITIONING.schoolPartnerName}, ${CLUB_POSITIONING.universityName}`,
        url: CLUB_POSITIONING.schoolPartnerUrl,
        parentOrganization: {
          "@type": "CollegeOrUniversity",
          name: CLUB_POSITIONING.universityName,
          url: CLUB_POSITIONING.universityUrl,
        },
      },
    ],
    sameAs: CLUB_SOCIALS.sameAs,
    subOrganization: {
      "@type": "Organization",
      name: "SteelHacks",
      url: `${CLUB_SOCIALS.steelhacks}/`,
      description:
        "Annual hackathon at the University of Pittsburgh, hosted by the Computer Science Club at Pitt in partnership with the School of Computing and Information.",
    },
  };
}

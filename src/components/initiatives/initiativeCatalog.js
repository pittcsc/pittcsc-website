export const INITIATIVE_CATEGORIES = [
  "All",
  "Career",
  "Project Teams",
  "Hackathons",
  "Mentorship",
  "Guest Speakers",
  "Social",
];

export const INITIATIVE_CATALOG = [
  {
    slug: "z2o",
    name: "Zero to Offer",
    link: "/initiatives/z2o",
    external: false,
    category: "Career",
    imagePath: "initiatives/Z2O/Z2O-speaker.jpg",
    defaultBlurb:
      "Student-run fall workshop series covering resumes, recruiting, and interviews for your first tech internship.",
  },
  {
    slug: "foundry",
    name: "Foundry",
    link: "/initiatives/foundry",
    external: false,
    category: "Career",
    imagePath: "initiatives/foundry/CSC_CGI_Code_Comp-032.jpg",
    defaultBlurb:
      "A smaller community for consistent builders: interview practice, project work, presentations, and peer accountability.",
  },
  {
    slug: "mock-interviews",
    name: "Mock Interviews",
    link: "/initiatives/mock-interviews",
    external: false,
    category: "Career",
    imagePath: "initiatives/mock-interviews/mock-interviews.jpg",
    defaultBlurb:
      "Practice technical, behavioral, and company-specific interviews with experienced peers and get honest feedback.",
  },
  {
    slug: "industry-recruiting",
    name: "Industry Recruiting Events",
    link: "/initiatives/industry-recruiting",
    external: false,
    category: "Career",
    imagePath: "initiatives/industry-recruiting/industry-recruiting.jpg",
    defaultBlurb:
      "Meet engineers and recruiters on campus through company tech talks, info sessions, and coding competitions.",
  },
  {
    slug: "site-visits",
    name: "Site Visits",
    link: "/initiatives/site-visits",
    external: false,
    category: "Career",
    imagePath: "initiatives/site-visits/google.jpg",
    defaultBlurb:
      "Tour Pittsburgh tech offices like Google, Duolingo, and Aurora and talk directly with local engineers.",
  },
  {
    slug: "launchpad",
    name: "Launchpad",
    link: "/initiatives/launchpad",
    external: false,
    category: "Career",
    imagePath: "initiatives/launchpad.jpg",
    defaultBlurb:
      "Hands-on software engineering workshops covering dev setup, data, UIs, and deployment to get you ready to build.",
  },
  {
    slug: "dev-lab",
    name: "Dev Lab",
    link: "https://pittcs.wiki/guides/skills/csc-dev-lab",
    external: true,
    category: "Project Teams",
    imagePath: "initiatives/dev-lab/dev-lab-placeholder.jpg",
    defaultBlurb:
      "Pitch or join a semester-long project team and practice Git, PR reviews, testing, and deployments.",
  },
  {
    slug: "consulting",
    name: "Consulting",
    link: "/initiatives/consulting",
    external: false,
    category: "Project Teams",
    imagePath: "initiatives/csc-consulting.jpg",
    defaultBlurb:
      "Apply to work on a small semester-long engineering team building and delivering real software for a partner company.",
  },
  {
    slug: "csc-hacks",
    name: "CSC Hacks",
    link: "/initiatives/csc-hacks",
    external: false,
    category: "Hackathons",
    imagePath: "initiatives/csc-hacks/csc-hacks.jpg",
    cardFit: "contain",
    cardBg: "#d1e2f3",
    defaultBlurb:
      "Pitt CSC's 48-hour internal hackathon for teams of up to three, wrapping up with 5-minute live demos and prizes.",
  },
  {
    slug: "steelhacks",
    name: "SteelHacks",
    link: "https://steelhacks.org",
    external: true,
    category: "Hackathons",
    imagePath: "initiatives/steelhacks-team.jpg",
    defaultBlurb:
      "Pitt's free annual hackathon hosted by CSC and SCI. Spend a weekend on campus building, learning, and demoing.",
  },
  {
    slug: "bit-byte",
    name: "Bit/Byte",
    link: "/initiatives/bit-byte",
    external: false,
    category: "Mentorship",
    imagePath: "initiatives/bit-byte/bit-byte.jpg",
    defaultBlurb:
      "Get paired with a Pitt CS upperclassman for class advice, resume help, and a friendly face in the club.",
  },
  {
    slug: "fireside-chats",
    name: "Fireside Chats",
    link: "/initiatives/fireside-chats",
    external: false,
    category: "Guest Speakers",
    imagePath: "initiatives/fireside_chats/fschat.jpg",
    defaultBlurb:
      "Live on-campus Q&A nights where Pitt alumni, startup founders, and tech creators talk candidly with students.",
  },
  {
    slug: "social-events",
    name: "Social Events",
    link: "/initiatives/social-events",
    external: false,
    category: "Social",
    imagePath: "initiatives/social_events/soc_event.jpg",
    defaultBlurb:
      "Jeopardy nights, game nights, outings, and the Tech Club Formal so you can actually meet people outside class.",
  },
  {
    slug: "social-media",
    name: "Social Media",
    link: "/initiatives/social-media",
    external: false,
    category: "Social",
    imagePath: "initiatives/social-media/social-media.jpg",
    cardFit: "contain",
    cardBg: "#0d1115",
    defaultBlurb:
      "Follow @csc.at.pitt for event updates, intern takeovers, member spotlights, and CS reels, or help us make them.",
  },
];

export function findCatalogEntry({ slug, title }) {
  if (slug) {
    const bySlug = INITIATIVE_CATALOG.find((item) => item.slug === slug);
    if (bySlug) return bySlug;
  }
  if (title) {
    const normalized = title.trim().toLowerCase();
    return (
      INITIATIVE_CATALOG.find(
        (item) => item.name.toLowerCase() === normalized
      ) || null
    );
  }
  return null;
}

export function getRelatedInitiatives({ slug, title, category, count = 3 }) {
  const current = findCatalogEntry({ slug, title });
  const currentSlug = current?.slug || slug;
  const targetCategory = category || current?.category;

  const candidates = INITIATIVE_CATALOG.filter(
    (item) => item.slug !== currentSlug
  );
  const sameCategory = candidates.filter(
    (item) => targetCategory && item.category === targetCategory
  );
  const others = candidates.filter(
    (item) => !targetCategory || item.category !== targetCategory
  );

  return [...sameCategory, ...others].slice(0, count);
}

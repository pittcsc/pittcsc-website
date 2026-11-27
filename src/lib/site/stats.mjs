export const SITE_URL = "https://pittcsc.org";
export const DEFAULT_SOCIAL_IMAGE = "/Pitt_CSC_Social_Card.png";

export const CLUB_POSITIONING = {
  name: "Computer Science Club at Pitt",
  shortName: "CSC at Pitt",
  alternateNames: [
    "CSC at Pitt",
    "Pitt CSC",
    "Pitt Computer Science Club",
  ],
  homeTagline: "Pitt's Largest Student Organization.",
  largestOrgClaim:
    "the largest student organization at the University of Pittsburgh",
  summarySentence:
    "The Computer Science Club at Pitt (Pitt CSC) is the largest student organization at the University of Pittsburgh and a partner of the School of Computing and Information.",
  universityName: "University of Pittsburgh",
  universityUrl: "https://www.pitt.edu/",
  schoolPartnerName: "School of Computing and Information",
  schoolPartnerUrl: "https://www.sci.pitt.edu/",
  openTo: "Open to all majors.",
  meetingSchedule: "Meetings are typically held Mondays and Thursdays at 8pm.",
};

// Every page and summary reads these figures from here so they cannot drift apart.
// The 2026-2027 package PDF is generated outside this repo and still prints 1000+
// members. The SteelHacks 300+ email blast counts recipients, not members.
// TODO(e-board): confirm one events/year figure; /about/ shows 70+, /sponsors/ 75+.
export const CLUB_STATS = {
  members: {
    value: "750+",
    confirmed: true,
    pdfNote:
      "static/Pitt_CSC_Sponsorship_Package_2026-2027.pdf still prints 1000+ until regenerated externally.",
  },
  eventsPerYear: {
    about: "70+",
    sponsors: "75+",
    confirmed: false,
    conflictNote:
      "UNCONFIRMED — /about/ currently shows 70+ events while /sponsors/ and the 2026-2027 sponsorship package PDF show 75+ events/year.",
  },
  social: {
    followers: "15K",
    totalReelViews: "100M+",
    averageVideoViews: "750K",
  },
};

export const CLUB_CONTACT = {
  email: "pittcsc@gmail.com",
  sorcEmail: "sorc@pitt.edu",
  giveUrl: "https://give.pitt.edu",
  mailingAddressLines: [
    "University of Pittsburgh",
    "PO Box 640093",
    "Pittsburgh, PA 15264-0093",
  ],
  location: {
    city: "Pittsburgh",
    region: "PA",
    country: "US",
  },
};

export const CLUB_SOCIALS = {
  instagram: "https://www.instagram.com/csc.at.pitt/",
  x: "https://x.com/CSC_at_Pitt",
  xHandle: "@CSC_at_Pitt",
  linkedin: "https://www.linkedin.com/company/cscatpitt/",
  github: "https://github.com/pittcsc",
  discord: "https://discord.gg/wzPeq2GCRT",
  wiki: "https://pittcs.wiki/",
  steelhacks: "https://steelhacks.org",
  emailListUrl: "http://eepurl.com/bgY5c9",
  calendarAddUrl:
    "https://calendar.google.com/calendar/u/0/render?cid=f64u131to44gn3tn8g62ov2u1s%40group.calendar.google.com",
  sameAs: [
    "https://www.instagram.com/csc.at.pitt/",
    "https://x.com/CSC_at_Pitt",
    "https://www.linkedin.com/company/cscatpitt/",
    "https://github.com/pittcsc",
  ],
};

export const CLUB_INITIATIVES = [
  {
    title: "Zero to Offer",
    link: "/initiatives/z2o",
    external: false,
    category: "Career",
    description:
      "Student-run fall workshop series covering resumes, recruiting, and interviews for your first tech internship.",
  },
  {
    title: "Foundry",
    link: "/initiatives/foundry",
    external: false,
    category: "Career",
    description:
      "A smaller community for consistent builders: interview practice, project work, presentations, and peer accountability.",
  },
  {
    title: "Mock Interviews",
    link: "/initiatives/mock-interviews",
    external: false,
    category: "Career",
    description:
      "Practice technical, behavioral, and company-specific interviews with experienced peers and get honest feedback.",
  },
  {
    title: "Industry Recruiting Events",
    link: "/initiatives/industry-recruiting",
    external: false,
    category: "Career",
    description:
      "Meet engineers and recruiters on campus through company tech talks, info sessions, and coding competitions.",
  },
  {
    title: "Site Visits",
    link: "/initiatives/site-visits",
    external: false,
    category: "Career",
    description:
      "Tour Pittsburgh tech offices like Google, Duolingo, and Aurora and talk directly with local engineers.",
  },
  {
    title: "Launchpad",
    link: "/initiatives/launchpad",
    external: false,
    category: "Career",
    description:
      "Hands-on software engineering workshops covering dev setup, data, UIs, and deployment to get you ready to build.",
  },
  {
    title: "Dev Lab",
    link: "https://pittcs.wiki/guides/skills/csc-dev-lab",
    external: true,
    category: "Project Teams",
    description:
      "Pitch or join a semester-long project team and practice Git, PR reviews, testing, and deployments.",
  },
  {
    title: "Consulting",
    link: "/initiatives/consulting",
    external: false,
    category: "Project Teams",
    description:
      "Apply to work on a small semester-long engineering team building and delivering real software for a partner company.",
  },
  {
    title: "CSC Hacks",
    link: "/initiatives/csc-hacks",
    external: false,
    category: "Hackathons",
    description:
      "Pitt CSC's 48-hour internal hackathon for teams of up to three, wrapping up with 5-minute live demos and prizes.",
  },
  {
    title: "SteelHacks",
    link: "https://steelhacks.org",
    external: true,
    category: "Hackathons",
    description:
      "Pitt's free annual hackathon hosted by CSC and SCI. Spend a weekend on campus building, learning, and demoing.",
  },
  {
    title: "Bit/Byte",
    link: "/initiatives/bit-byte",
    external: false,
    category: "Mentorship",
    description:
      "Get paired with a Pitt CS upperclassman for class advice, resume help, and a friendly face in the club.",
  },
  {
    title: "Fireside Chats",
    link: "/initiatives/fireside-chats",
    external: false,
    category: "Guest Speakers",
    description:
      "Live on-campus Q&A nights where Pitt alumni, startup founders, and tech creators talk candidly with students.",
  },
  {
    title: "Social Events",
    link: "/initiatives/social-events",
    external: false,
    category: "Social",
    description:
      "Jeopardy nights, game nights, outings, and the Tech Club Formal so you can actually meet people outside class.",
  },
  {
    title: "Social Media",
    link: "/initiatives/social-media",
    external: false,
    category: "Social",
    description:
      "Follow @csc.at.pitt for event updates, intern takeovers, member spotlights, and CS reels, or help us make them.",
  },
];

export const SPONSORSHIP_DATA = {
  pdfPath: "/Pitt_CSC_Sponsorship_Package_2026-2027.pdf",
  packageYear: "2026-2027",
  validityPeriod: "September 1 to August 31",
  sponsors: [
    { name: "BNY", alt: "BNY Logo", href: "https://www.bny.com/" },
    { name: "CGI", alt: "CGI Logo", href: "https://www.cgi.com/" },
    { name: "Roblox", alt: "Roblox Logo", href: "https://www.roblox.com/" },
    {
      name: "Naval Nuclear Lab",
      alt: "Naval Nuclear Lab Logo",
      href: "https://navalnuclearlab.energy.gov/",
    },
    {
      name: "Stevens Capital Management",
      alt: "Stevens Capital Management",
      href: "https://www.scm-lp.com/",
    },
    {
      name: "Aerotech",
      alt: "Aerotech Logo",
      href: "https://www.aerotech.com/",
    },
    {
      name: "FAST Enterprises",
      alt: "FAST Enterprises Logo",
      href: "https://www.fastenterprises.com/",
    },
    { name: "Wesco", alt: "Wesco Logo", href: "https://www.wesco.com/" },
  ],
  tiers: [
    {
      name: "Ada Lovelace",
      tier: "Tier 1",
      price: "$1,000",
      inherits: null,
      benefits: [
        "Logo on the CSC website and Wiki",
        "Recruiting & campus outreach featured in weekly newsletters",
        "Ability to promote campus visits",
      ],
    },
    {
      name: "Alan Turing",
      tier: "Tier 2",
      price: "$1,500",
      inherits: "Tier 1",
      benefits: [
        "Logo on CSC at Pitt t-shirts",
        "Invitation to host one (1) custom company event",
      ],
    },
    {
      name: "John von Neumann",
      tier: "Tier 3",
      price: "$2,500",
      inherits: "Tier 2",
      benefits: [
        "Host up to two (2) custom company events",
        "Exclusive access to the club's member resume book",
      ],
    },
    {
      name: "Grace Hopper",
      tier: "Tier 4",
      price: "$5,000",
      inherits: "Tier 3",
      featured: true,
      benefits: [
        "Host up to three (3) custom company events",
        "Exclusively sponsor a CSC initiative (Zero to Offer, Foundry, mentorship, etc.)",
        "Present at an event during Zero to Offer or Foundry",
      ],
    },
  ],
  addOns: [
    {
      name: "1-Day Story Takeover",
      price: "$100",
      points: [
        "Post stories on the CSC Instagram for a day",
        "Highlight posted stories for a semester (+$200)",
      ],
    },
    {
      name: "Single Reel Video",
      price: "$500",
      points: [
        "Feature in a custom Instagram reel",
        "Reach thousands of engaged followers",
      ],
    },
  ],
};

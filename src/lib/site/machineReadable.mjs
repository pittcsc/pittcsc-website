import { buildCanonicalUrl } from "./seo.mjs";
import {
  CLUB_CONTACT,
  CLUB_INITIATIVES,
  CLUB_POSITIONING,
  CLUB_SOCIALS,
  CLUB_STATS,
  SITE_URL,
  SPONSORSHIP_DATA,
} from "./stats.mjs";

function formatInitiativeUrl(item) {
  return item.external ? item.link : buildCanonicalUrl(SITE_URL, item.link);
}

/**
 * Generates /llms.txt following the llms.txt plain-text summary convention.
 * Only confirmed facts appear here; unconfirmed stat discrepancies are noted transparently.
 */
export function buildLlmsTxt() {
  const pdfUrl = buildCanonicalUrl(SITE_URL, SPONSORSHIP_DATA.pdfPath);
  const initiativeNames = CLUB_INITIATIVES.map((item) => item.title).join(", ");
  const sponsorNames = SPONSORSHIP_DATA.sponsors.map((s) => s.name).join(", ");

  return `# ${CLUB_POSITIONING.name}

> ${CLUB_POSITIONING.summarySentence} ${CLUB_POSITIONING.openTo}

Also known as: ${CLUB_POSITIONING.alternateNames.join(", ")}.

## Quick Facts

- Location: ${CLUB_CONTACT.location.city}, ${CLUB_CONTACT.location.region} (${CLUB_POSITIONING.universityName})
- Affiliation: Student organization at the ${CLUB_POSITIONING.universityName}; partner of the ${CLUB_POSITIONING.schoolPartnerName}
- Membership: ${CLUB_POSITIONING.openTo} ${CLUB_POSITIONING.meetingSchedule}
- Scale (note on site figures): The Sponsors page and ${SPONSORSHIP_DATA.packageYear} sponsorship package report ${CLUB_STATS.members.sponsors} active members, ${CLUB_STATS.eventsPerYear.sponsors} events/year, ${CLUB_STATS.social.followers} social followers, ${CLUB_STATS.social.totalReelViews} total reel views, and ${CLUB_STATS.social.averageVideoViews} average views per video. The About page currently displays ${CLUB_STATS.members.about} members and ${CLUB_STATS.eventsPerYear.about} events (pending e-board confirmation).
- Flagship hackathon: SteelHacks (${CLUB_SOCIALS.steelhacks}), Pitt's annual hackathon hosted by Pitt CSC in partnership with the ${CLUB_POSITIONING.schoolPartnerName}.
- Initiatives: ${initiativeNames}.
- Current sponsors on /sponsors/: ${sponsorNames}.
- Contact: ${CLUB_CONTACT.email}

## Public Pages

- [Home](${buildCanonicalUrl(SITE_URL, "/")}): Club overview, mission, social channels, and Google Calendar.
- [About Us](${buildCanonicalUrl(SITE_URL, "/about/")}): Club mission, member/event overview, current officers, and initiative leads.
- [Initiatives](${buildCanonicalUrl(SITE_URL, "/initiatives/")}): Career, project team, hackathon, mentorship, speaker, and social programs.
- [Join the Club](${buildCanonicalUrl(SITE_URL, "/join/")}): Email list, Google Calendar, community links, and meeting schedule.
- [Sponsors & Partnerships](${buildCanonicalUrl(SITE_URL, "/sponsors/")}): Current sponsors, at-a-glance reach, annual tiers, social add-ons, and giving instructions.
- [${SPONSORSHIP_DATA.packageYear} Sponsorship Package (PDF)](${pdfUrl}): Downloadable partnership overview and tier details.

## Plain-Text & Markdown Versions

- [Full plain-text site summary (/llms-full.txt)](${buildCanonicalUrl(SITE_URL, "/llms-full.txt")}): Detailed club overview, initiatives, leadership, and sponsorship information in one document.
- [About page in Markdown (/about.md)](${buildCanonicalUrl(SITE_URL, "/about.md")}): Plain-text version of the About Us page.
- [Sponsors page in Markdown (/sponsors.md)](${buildCanonicalUrl(SITE_URL, "/sponsors.md")}): Plain-text version of the Sponsors & Partnerships page.

## Official Profiles & Links

- Website: ${buildCanonicalUrl(SITE_URL, "/")}
- Instagram: ${CLUB_SOCIALS.instagram}
- X (Twitter): ${CLUB_SOCIALS.x} (${CLUB_SOCIALS.xHandle})
- LinkedIn: ${CLUB_SOCIALS.linkedin}
- GitHub: ${CLUB_SOCIALS.github}
- Discord: ${CLUB_SOCIALS.discord}
- Pitt CS Wiki: ${CLUB_SOCIALS.wiki}
- SteelHacks: ${CLUB_SOCIALS.steelhacks}
- Email: mailto:${CLUB_CONTACT.email}
`;
}

/**
 * Generates /about.md matching the visible facts on /about/.
 */
export function buildAboutMarkdown({ officers = [], initiativeLeads = [] } = {}) {
  const officerLines = officers
    .map((person) => `- **${person.name}** — ${person.title}`)
    .join("\n");
  const leadLines = initiativeLeads
    .map((person) => `- **${person.name}** — ${person.title}`)
    .join("\n");

  return `# About the Computer Science Club at Pitt (Pitt CSC)

HTML version: ${buildCanonicalUrl(SITE_URL, "/about/")}
Site summary: ${buildCanonicalUrl(SITE_URL, "/llms.txt")}

## Overview

${CLUB_POSITIONING.summarySentence}

The Computer Science Club at Pitt, shortened as CSC at Pitt, is the largest and premier technology-related student organization at the University of Pittsburgh. Open to all majors, we host a variety of events that help build a welcoming and inclusive community of motivated students interested in computer science, information science, digital design, and related fields.

## At a Glance (as shown on /about/)

- Members: ${CLUB_STATS.members.about}
- Events: ${CLUB_STATS.eventsPerYear.about}

*Note: The /sponsors/ page and ${SPONSORSHIP_DATA.packageYear} sponsorship package report ${CLUB_STATS.members.sponsors} active members and ${CLUB_STATS.eventsPerYear.sponsors} events/year; e-board confirmation is pending to align both pages.*

## Meetings & Joining

- ${CLUB_POSITIONING.openTo}
- ${CLUB_POSITIONING.meetingSchedule}
- Join page: ${buildCanonicalUrl(SITE_URL, "/join/")}
- Contact: ${CLUB_CONTACT.email}

## Current Officers

${officerLines}

## Initiative Leads

${leadLines}

## Official Links

- Home: ${buildCanonicalUrl(SITE_URL, "/")}
- Initiatives: ${buildCanonicalUrl(SITE_URL, "/initiatives/")}
- Sponsors: ${buildCanonicalUrl(SITE_URL, "/sponsors/")}
- Sponsors (Markdown): ${buildCanonicalUrl(SITE_URL, "/sponsors.md")}
- Pitt CS Wiki: ${CLUB_SOCIALS.wiki}
- SteelHacks: ${CLUB_SOCIALS.steelhacks}
- Instagram: ${CLUB_SOCIALS.instagram}
- X: ${CLUB_SOCIALS.x}
- LinkedIn: ${CLUB_SOCIALS.linkedin}
- GitHub: ${CLUB_SOCIALS.github}
- Discord: ${CLUB_SOCIALS.discord}
`;
}

/**
 * Generates /sponsors.md matching the visible facts on /sponsors/.
 */
export function buildSponsorsMarkdown() {
  const pdfUrl = buildCanonicalUrl(SITE_URL, SPONSORSHIP_DATA.pdfPath);
  const sponsorLines = SPONSORSHIP_DATA.sponsors
    .map((sponsor) => `- [${sponsor.name}](${sponsor.href})`)
    .join("\n");

  const tierBlocks = SPONSORSHIP_DATA.tiers
    .map((tier) => {
      const inheritsLine = tier.inherits
        ? `\nIncludes everything in ${tier.inherits}, plus:\n`
        : "\n";
      const benefits = tier.benefits.map((b) => `- ${b}`).join("\n");
      return `### ${tier.tier}: ${tier.name} — ${tier.price} / year${inheritsLine}${benefits}`;
    })
    .join("\n\n");

  const addOnBlocks = SPONSORSHIP_DATA.addOns
    .map((addOn) => {
      const points = addOn.points.map((p) => `- ${p}`).join("\n");
      return `### ${addOn.name} — ${addOn.price}\n${points}`;
    })
    .join("\n\n");

  return `# Sponsors & Partnerships — Computer Science Club at Pitt (Pitt CSC)

HTML version: ${buildCanonicalUrl(SITE_URL, "/sponsors/")}
Site summary: ${buildCanonicalUrl(SITE_URL, "/llms.txt")}
${SPONSORSHIP_DATA.packageYear} Sponsorship Package (PDF): ${pdfUrl}

## Overview

${CLUB_POSITIONING.summarySentence} CSC gives partners direct access to a deep, engaged pipeline of computer science talent on campus and online.

## CSC at a Glance (${SPONSORSHIP_DATA.packageYear} Partnership Package)

- ${CLUB_STATS.members.sponsors} active members
- Largest student organization at the University of Pittsburgh and partner of the School of Computing and Information
- ${CLUB_STATS.eventsPerYear.sponsors} events / year, including workshops, site visits, and socials
- ${CLUB_STATS.social.followers} followers across social platforms
- ${CLUB_STATS.social.totalReelViews} total views on reels
- ${CLUB_STATS.social.averageVideoViews} average views per video

*Note: The /about/ page currently displays ${CLUB_STATS.members.about} members and ${CLUB_STATS.eventsPerYear.about} events; e-board confirmation is pending to align both pages.*

## Current Sponsors

${sponsorLines}

## Why Sponsor?

- **Collaborative:** We work with sponsors to reach students and create a stronger community.
- **Connected:** Through our alumni network, we build connections between underclassmen, upperclassmen, and alumni.

## Annual Sponsorship Tiers

Every tier includes all benefits of the tiers below it. Benefits are valid for one year, from ${SPONSORSHIP_DATA.validityPeriod}.

${tierBlocks}

## Social Media Add-Ons

Purchasable on top of any tier:

${addOnBlocks}

## How to Partner or Give

- **Download the full package:** ${pdfUrl}
- **Give online:** Visit ${CLUB_CONTACT.giveUrl}, enter an amount, search "Computer Science Club" under designation, and complete your gift.
- **Give by mail:** ${CLUB_CONTACT.mailingAddressLines.join(", ")}
- **Questions:** Email ${CLUB_CONTACT.email} or contact SORC at ${CLUB_CONTACT.sorcEmail}.

## Related Pages

- Home: ${buildCanonicalUrl(SITE_URL, "/")}
- About Us: ${buildCanonicalUrl(SITE_URL, "/about/")}
- About (Markdown): ${buildCanonicalUrl(SITE_URL, "/about.md")}
- Initiatives: ${buildCanonicalUrl(SITE_URL, "/initiatives/")}
- Full site summary: ${buildCanonicalUrl(SITE_URL, "/llms-full.txt")}
`;
}

/**
 * Generates /llms-full.txt combining confirmed site-wide information into a single plain-text file.
 */
export function buildLlmsFullTxt({ officers = [], initiativeLeads = [] } = {}) {
  const initiativeLines = CLUB_INITIATIVES.map(
    (item) =>
      `- **${item.title}** (${item.category}): ${item.description} (${formatInitiativeUrl(item)})`,
  ).join("\n");

  const officerLines = officers
    .map((person) => `- ${person.name} — ${person.title}`)
    .join("\n");
  const leadLines = initiativeLeads
    .map((person) => `- ${person.name} — ${person.title}`)
    .join("\n");

  const sponsorNames = SPONSORSHIP_DATA.sponsors
    .map((s) => `${s.name} (${s.href})`)
    .join(", ");

  const tierLines = SPONSORSHIP_DATA.tiers
    .map(
      (tier) =>
        `- ${tier.tier} — ${tier.name} (${tier.price}/year): ${tier.inherits ? `Includes ${tier.inherits}, plus ` : ""}${tier.benefits.join("; ")}.`,
    )
    .join("\n");

  const addOnLines = SPONSORSHIP_DATA.addOns
    .map((addOn) => `- ${addOn.name} (${addOn.price}): ${addOn.points.join("; ")}.`)
    .join("\n");

  return `# ${CLUB_POSITIONING.name} — Full Plain-Text Summary

Website: ${buildCanonicalUrl(SITE_URL, "/")}
Concise index: ${buildCanonicalUrl(SITE_URL, "/llms.txt")}
About (Markdown): ${buildCanonicalUrl(SITE_URL, "/about.md")}
Sponsors (Markdown): ${buildCanonicalUrl(SITE_URL, "/sponsors.md")}

## Identity & Positioning

${CLUB_POSITIONING.summarySentence}

- Official name: ${CLUB_POSITIONING.name}
- Alternate names: ${CLUB_POSITIONING.alternateNames.join(", ")}
- Location: ${CLUB_CONTACT.location.city}, ${CLUB_CONTACT.location.region} (${CLUB_POSITIONING.universityName})
- Partner school: ${CLUB_POSITIONING.schoolPartnerName}, ${CLUB_POSITIONING.universityName}
- Mission: To help create an engaging atmosphere for students to learn more about the field of computer science and develop professionally.
- Membership: ${CLUB_POSITIONING.openTo} ${CLUB_POSITIONING.meetingSchedule}
- Contact email: ${CLUB_CONTACT.email}

## Club Scale & Reach

- ${SPONSORSHIP_DATA.packageYear} sponsorship package and /sponsors/ page: ${CLUB_STATS.members.sponsors} active members, ${CLUB_STATS.eventsPerYear.sponsors} events/year, ${CLUB_STATS.social.followers} followers across social platforms, ${CLUB_STATS.social.totalReelViews} total reel views, ${CLUB_STATS.social.averageVideoViews} average views per video.
- /about/ page: ${CLUB_STATS.members.about} members and ${CLUB_STATS.eventsPerYear.about} events.
- Status: E-board confirmation is pending to align the /about/ and /sponsors/ member and event counts.

## Initiatives & Programs

${initiativeLines}

## Leadership (as listed on /about/)

### Officers

${officerLines}

### Initiative Leads

${leadLines}

## Sponsorship & Partnerships

- Current sponsors on /sponsors/: ${sponsorNames}
- Sponsorship validity: ${SPONSORSHIP_DATA.validityPeriod}
- ${SPONSORSHIP_DATA.packageYear} Partnership Package PDF: ${buildCanonicalUrl(SITE_URL, SPONSORSHIP_DATA.pdfPath)}

### Tiers

${tierLines}

### Social Media Add-Ons

${addOnLines}

### How to Give

- Online: ${CLUB_CONTACT.giveUrl} (search "Computer Science Club" under designation)
- Mail: ${CLUB_CONTACT.mailingAddressLines.join(", ")}
- Contact: ${CLUB_CONTACT.email} or SORC at ${CLUB_CONTACT.sorcEmail}

## Joining & Official Channels

- Join page: ${buildCanonicalUrl(SITE_URL, "/join/")}
- Email list: ${CLUB_SOCIALS.emailListUrl}
- Google Calendar: ${CLUB_SOCIALS.calendarAddUrl}
- Discord: ${CLUB_SOCIALS.discord}
- Pitt CS Wiki: ${CLUB_SOCIALS.wiki}
- SteelHacks: ${CLUB_SOCIALS.steelhacks}
- Instagram: ${CLUB_SOCIALS.instagram}
- X (Twitter): ${CLUB_SOCIALS.x} (${CLUB_SOCIALS.xHandle})
- LinkedIn: ${CLUB_SOCIALS.linkedin}
- GitHub: ${CLUB_SOCIALS.github}
`;
}

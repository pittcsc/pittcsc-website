import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { GatsbyImage } from "gatsby-plugin-image";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import Layout from "../layouts/layout";
import { PAGE_SEO } from "../lib/site/seo.mjs";
import { CLUB_SOCIALS } from "../lib/site/stats.mjs";
import { useInitiativeImages } from "../components/initiatives/useInitiativeImages";
import { INITIATIVE_CATEGORIES } from "../components/initiatives/initiativeCatalog";
import { z2oContent } from "../data/z2oContent";
import { foundryContent } from "../data/foundryContent";
import { mockInterviewsContent } from "../data/mockInterviewsContent";
import { industryRecruitingContent } from "../data/industryRecruitingContent";
import { siteVisitsContent } from "../data/siteVisitsContent";
import { launchpadContent } from "../data/launchpadContent";
import { devLabContent } from "../data/devLabContent";
import { consultingContent } from "../data/consultingContent";
import { cscHacksContent } from "../data/cscHacksContent";
import { bitByteContent } from "../data/bitByteContent";
import { firesideChatsContent } from "../data/firesideChatsContent";
import { socialEventsContent } from "../data/socialEventsContent";
import { socialMediaContent } from "../data/socialMediaContent";

const HOTJAR_ID = 2276434;
const HOTJAR_VERSION = 6;
const GA_TRACKING_ID = "UA-58446605-1";

// Keep exact title and link literals aligned with CLUB_INITIATIVES in src/lib/site/stats.mjs.
const initiatives = [
  {
    title: "Zero to Offer",
    imagePath: "initiatives/Z2O/Z2O-speaker.jpg",
    link: "/initiatives/z2o",
    external: false,
    category: "Career",
    description:
      z2oContent?.cardBlurb ||
      "Student-run fall workshop series covering resumes, recruiting, and interviews for your first tech internship.",
  },
  {
    title: "Foundry",
    imagePath: "initiatives/foundry/CSC_CGI_Code_Comp-032.jpg",
    link: "/initiatives/foundry",
    external: false,
    category: "Career",
    description:
      foundryContent?.cardBlurb ||
      "A smaller community for consistent builders: interview practice, project work, presentations, and peer accountability.",
  },
  {
    title: "Mock Interviews",
    imagePath: "initiatives/mock-interviews/mock-interviews.jpg",
    link: "/initiatives/mock-interviews",
    external: false,
    category: "Career",
    description:
      mockInterviewsContent?.cardBlurb ||
      "Practice technical, behavioral, and company-specific interviews with experienced peers and get honest feedback.",
  },
  {
    title: "Industry Recruiting Events",
    imagePath: "initiatives/industry-recruiting/industry-recruiting.jpg",
    link: "/initiatives/industry-recruiting",
    external: false,
    category: "Career",
    description:
      industryRecruitingContent?.cardBlurb ||
      "Meet engineers and recruiters on campus through company tech talks, info sessions, and coding competitions.",
  },
  {
    title: "Site Visits",
    imagePath: "initiatives/site-visits/google.jpg",
    link: "/initiatives/site-visits",
    external: false,
    category: "Career",
    description:
      siteVisitsContent?.cardBlurb ||
      "Tour Pittsburgh tech offices like Google, Duolingo, and Aurora and talk directly with local engineers.",
  },
  {
    title: "Launchpad",
    imagePath: "initiatives/launchpad.jpg",
    link: "/initiatives/launchpad",
    external: false,
    category: "Career",
    description:
      launchpadContent?.cardBlurb ||
      "Hands-on software engineering workshops covering dev setup, data, UIs, and deployment to get you ready to build.",
  },
  {
    title: "Dev Lab",
    imagePath: "initiatives/dev-lab/dev-lab-placeholder.jpg",
    link: "https://pittcs.wiki/guides/skills/csc-dev-lab",
    external: true,
    externalHost: "pittcs.wiki",
    category: "Project Teams",
    description:
      devLabContent?.cardBlurb ||
      "Pitch or join a semester-long project team and practice Git, PR reviews, testing, and deployments.",
  },
  {
    title: "Consulting",
    imagePath: "initiatives/csc-consulting.jpg",
    link: "/initiatives/consulting",
    external: false,
    category: "Project Teams",
    description:
      consultingContent?.cardBlurb ||
      "Apply to work on a small semester-long engineering team building and delivering real software for a partner company.",
  },
  {
    title: "CSC Hacks",
    imagePath: "initiatives/csc-hacks/csc-hacks.jpg",
    cardFit: "contain",
    cardBg: "#d1e2f3",
    link: "/initiatives/csc-hacks",
    external: false,
    category: "Hackathons",
    description:
      cscHacksContent?.cardBlurb ||
      "Pitt CSC's 48-hour internal hackathon for teams of up to three, wrapping up with 5-minute live demos and prizes.",
  },
  {
    title: "SteelHacks",
    imagePath: "initiatives/steelhacks-team.jpg",
    link: "https://steelhacks.org",
    external: true,
    externalHost: "steelhacks.org",
    category: "Hackathons",
    description:
      "Pitt's free annual hackathon hosted by CSC and SCI. Spend a weekend on campus building, learning, and demoing.",
  },
  {
    title: "Bit/Byte",
    imagePath: "initiatives/bit-byte/bit-byte.jpg",
    link: "/initiatives/bit-byte",
    external: false,
    category: "Mentorship",
    description:
      bitByteContent?.cardBlurb ||
      "Get paired with a Pitt CS upperclassman for class advice, resume help, and a friendly face in the club.",
  },
  {
    title: "Fireside Chats",
    imagePath: "initiatives/fireside_chats/fschat.jpg",
    link: "/initiatives/fireside-chats",
    external: false,
    category: "Guest Speakers",
    description:
      firesideChatsContent?.cardBlurb ||
      "Live on-campus Q&A nights where Pitt alumni, startup founders, and tech creators talk candidly with students.",
  },
  {
    title: "Social Events",
    imagePath: "initiatives/social_events/soc_event.jpg",
    link: "/initiatives/social-events",
    external: false,
    category: "Social",
    description:
      socialEventsContent?.cardBlurb ||
      "Jeopardy nights, game nights, outings, and the Tech Club Formal so you can actually meet people outside class.",
  },
  {
    title: "Social Media",
    imagePath: "initiatives/social-media/social-media.jpg",
    cardFit: "contain",
    cardBg: "#0d1115",
    link: "/initiatives/social-media",
    external: false,
    category: "Social",
    description:
      socialMediaContent?.cardBlurb ||
      "Follow @csc.at.pitt for event updates, intern takeovers, member spotlights, and CS reels, or help us make them.",
  },
];

const InitiativePage = () => {
  const prefersReducedMotion = useReducedMotion();
  const images = useInitiativeImages();
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    hotjar.initialize(HOTJAR_ID, HOTJAR_VERSION);
    ReactGA.initialize(GA_TRACKING_ID);
    ReactGA.pageview("/initiatives");
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = { All: initiatives.length };
    for (const item of initiatives) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, []);

  const visibleInitiatives = useMemo(() => {
    if (activeCategory === "All") return initiatives;
    return initiatives.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  return (
    <Layout
      title={PAGE_SEO.initiatives.title}
      description={PAGE_SEO.initiatives.description}
      header="initiatives"
    >
      <div className="bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 md:pt-10 pb-20">
          {/* Header */}
          <header className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900">
              <span className="relative inline-block pb-2">
                Initiatives
                <svg
                  className="svg-underline absolute bottom-0 left-0 w-full"
                  viewBox="0 0 422 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  {prefersReducedMotion ? (
                    <path
                      d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                      stroke="#FFB81C"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  ) : (
                    <motion.path
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.65 }}
                      d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                      stroke="#FFB81C"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-600">
              Student-run programs at Pitt CSC across career prep, project teams,
              hackathons, mentorship, guest speakers, and campus socials. Open to
              all majors.
            </p>
          </header>

          {/* Category Filter Bar */}
          <div
            role="group"
            aria-label="Filter initiatives by category"
            className="mt-8 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-6"
          >
            {INITIATIVE_CATEGORIES.map((category) => {
              const isSelected = activeCategory === category;
              const count = categoryCounts[category] || 0;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setActiveCategory(category)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900"
                  }`}
                  style={isSelected ? { backgroundColor: "#243E8B" } : undefined}
                >
                  <span>{category}</span>
                  <span
                    className={`text-xs tabular-nums ${
                      isSelected ? "text-blue-200" : "text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Initiatives Grid */}
          <section aria-label="Pitt CSC initiatives" className="mt-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
              {visibleInitiatives.map((item, index) => {
                const resolved = images.resolve(item.imagePath);
                const useContain = item.cardFit === "contain";
                const gatsbyImg = useContain
                  ? resolved?.galleryImage
                  : resolved?.cardImage;

                const cardContent = (
                  <>
                    <div
                      className="relative aspect-video w-full overflow-hidden bg-slate-100"
                      style={
                        item.cardBg
                          ? { backgroundColor: item.cardBg }
                          : undefined
                      }
                    >
                      {gatsbyImg && (
                        <GatsbyImage
                          image={gatsbyImg}
                          alt={item.title}
                          loading={index < 4 ? "eager" : "lazy"}
                          objectFit={useContain ? "contain" : "cover"}
                          className="h-full w-full"
                          imgClassName={
                            useContain
                              ? "p-2"
                              : "transition-transform duration-300 group-hover:scale-[1.03]"
                          }
                        />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <span className="inline-flex w-fit rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {item.category}
                      </span>

                      <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary">
                        {item.title}
                      </h2>

                      <p className="mt-2 flex-1 text-sm sm:text-[15px] leading-relaxed text-slate-600">
                        {item.description}
                      </p>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-sm font-semibold text-primary">
                        <span>
                          {item.external
                            ? `Visit ${item.externalHost || "site"}`
                            : "View program"}
                        </span>
                        <FontAwesomeIcon
                          icon={
                            item.external
                              ? faArrowUpRightFromSquare
                              : faChevronRight
                          }
                          className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </>
                );

                const cardClassName =
                  "group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 hover:border-primary/45 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

                return item.external ? (
                  <a
                    key={item.title}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClassName}
                  >
                    {cardContent}
                  </a>
                ) : (
                  <Link
                    key={item.title}
                    to={item.link}
                    className={cardClassName}
                  >
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Getting started callout */}
          <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 sm:px-8 sm:py-9 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h2 className="text-xl font-bold text-slate-900">
                Not sure where to start?
              </h2>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed text-slate-600">
                Meetings are typically Mondays and Thursdays at 8pm. Drop into
                any session or hop in the Pitt CSC Discord to see what is running
                this week.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
              <Link
                to="/join"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                style={{ backgroundColor: "#243E8B" }}
              >
                How to join
              </Link>
              <a
                href={CLUB_SOCIALS.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span>Join Discord</span>
                <FontAwesomeIcon
                  icon={faArrowUpRightFromSquare}
                  className="h-3 w-3 opacity-80"
                  aria-hidden="true"
                />
              </a>
            </div>
          </section>

          {/* Plain-text / machine-readable footer */}
          <p className="mt-8 text-center text-xs text-slate-500">
            <a href="/initiatives.md" className="underline hover:text-primary">
              Plain-text version (/initiatives.md)
            </a>
            {" · "}
            <a href="/llms.txt" className="underline hover:text-primary">
              Machine-readable summary (/llms.txt)
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default InitiativePage;

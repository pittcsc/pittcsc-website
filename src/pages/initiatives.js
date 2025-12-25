import React, { useEffect, useState, useMemo } from "react";
import Z2OImg from "../images/initiatives/Z2O/Z2O-speaker.jpg";
import SocialEventsImg from "../images/initiatives/social_events/soc_event-4.jpg";
import FiresideChatsImg from "../images/initiatives/fireside_chats/fschat.jpg";
import ConsultingImg from "../images/initiatives/csc-consulting.jpg";
import SteelHacksImg from "../images/initiatives/steelhacks-team.jpg";
import DevLabImg from "../images/initiatives/dev-lab-placeholder.jpg";
import LaunchpadImg from "../images/initiatives/launchpad.jpg";
import SiteVisitsImg from "../images/initiatives/site-visits/google.jpg";
import OfferPlusImg from "../images/initiatives/offer-plus/offer-plus.jpg";
import MockInterviewsImg from "../images/initiatives/mock-interviews/mock-interviews.jpg";
import IndustryRecruitingImg from "../images/initiatives/industry-recruiting/industry-recruiting.jpg";
import CSCHacksImg from "../images/initiatives/csc-hacks/csc-hacks.png";
import BitByteImg from "../images/initiatives/bit-byte/bit-byte.jpg";
import SocialMediaImg from "../images/initiatives/social-media/social-media.png";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faSearch } from "@fortawesome/free-solid-svg-icons";
import Layout from "../layouts/layout";

// Constants
const HOTJAR_ID = 2276434;
const HOTJAR_VERSION = 6;
const GA_TRACKING_ID = "UA-58446605-1";

const initiatives = [
  {
    title: "Zero to Offer",
    image: Z2OImg,
    link: "/initiatives/z2o",
    external: false,
    category: "Career",
    description: "Our premier internship training program helping students land top-tier tech offers through mentorship and practice.",
  },
  {
    title: "Offer++",
    image: OfferPlusImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Career",
    description: "Advanced career preparation program for students seeking full-time positions and return offers.",
  },
  {
    title: "Mock Interviews",
    image: MockInterviewsImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Career",
    description: "Practice technical and behavioral interviews with experienced peers and industry professionals.",
  },
  {
    title: "Industry Recruiting Events",
    image: IndustryRecruitingImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Career",
    description: "Exclusive recruiting sessions and networking opportunities with top tech companies and sponsors.",
  },
  {
    title: "Site Visits",
    image: SiteVisitsImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Career",
    description: "Visit local tech companies and offices to see real-world engineering environments and culture.",
  },
  {
    title: "Launchpad",
    image: LaunchpadImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Career",
    description: "An incubator program to help you launch your own startup or big idea from scratch.",
  },
  {
    title: "Dev Lab",
    image: DevLabImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Project Teams",
    description: "A hands-on development lab for students to build and collaborate on projects.",
  },
  {
    title: "Consulting",
    image: ConsultingImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Project Teams",
    description: "Gain real-world experience building software solutions for local non-profits and startups in our community.",
  },
  {
    title: "CSC Hacks",
    image: CSCHacksImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Hackathons",
    description: "Our internal hackathon event designed to help members learn and collaborate on innovative projects.",
  },
  {
    title: "SteelHacks",
    image: SteelHacksImg,
    link: "https://steelhacks.com",
    external: true,
    category: "Hackathons",
    description: "Pitt's largest annual hackathon, bringing together hundreds of hackers for a weekend of building and learning.",
  },
  {
    title: "Bit/Byte",
    image: BitByteImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Mentorship",
    description: "Peer mentorship program connecting upperclassmen with underclassmen for academic and career guidance.",
  },
  {
    title: "Fireside Chats",
    image: FiresideChatsImg,
    link: "/initiatives/fireside-chats",
    external: false,
    category: "Guest Speakers",
    description: "Intimate Q&A sessions connecting you with industry leaders, successful alumni, and tech visionaries.",
  },
  {
    title: "Social Events",
    image: SocialEventsImg,
    link: "/initiatives/social-events",
    external: false,
    category: "Social",
    description: "Fun gatherings, game nights, and outings to build a tight-knit community and make lasting friendships.",
  },
  {
    title: "Social Media",
    image: SocialMediaImg,
    link: "/initiatives/coming-soon",
    external: false,
    category: "Social",
    description: "Stay connected with the club through our active social media presence and community updates.",
  },
];

const categories = ["All", "Career", "Project Teams", "Hackathons", "Mentorship", "Guest Speakers", "Social"];

const InitiativePage = () => {
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    hotjar.initialize(HOTJAR_ID, HOTJAR_VERSION);
    ReactGA.initialize(GA_TRACKING_ID);
    ReactGA.pageview("/initiatives");
  }, []);

  const displayedItems = useMemo(() => {
    return initiatives.filter((item) => {
      return activeCategory === "All" || item.category === activeCategory;
    });
  }, [activeCategory]);

  // Memoize category counts to avoid recalculating on every render
  const categoryCounts = useMemo(() => {
    const counts = {};
    categories.forEach((category) => {
      if (category === "All") {
        counts[category] = initiatives.length;
      } else {
        counts[category] = initiatives.filter((item) => item.category === category).length;
      }
    });
    return counts;
  }, []);

  const getCategoryCount = (category) => {
    return categoryCounts[category] || 0;
  };

  const clearFilters = () => {
    setActiveCategory("All");
  };

  // Memoize results count to avoid creating new object on every render
  const resultsCount = useMemo(() => {
    return {
      filteredCount: displayedItems.length,
      totalCount: initiatives.length,
    };
  }, [displayedItems.length]);

  return (
    <Layout
      title="Initiatives | Computer Science Club @ Pitt"
      header="initiatives"
    >
      <div
        className="overflow-hidden relative"
      >
        <div className="mt-24 my-8 min-h-screen space-y-16 xl:my-24">
          <section className="max-w-7xl mx-auto px-4 relative z-10">
            {/* Header Section */}
            <div className="flex flex-col items-center justify-center mb-16">
              <h1 className="relative z-10 mb-4 text-center text-4xl font-bold lg:text-6xl">
                Initiatives
                <svg
                  className="svg-underline absolute -bottom-2 left-1/2 transform -translate-x-1/2 z-0 w-64 lg:w-full max-w-sm"
                  viewBox="0 0 422 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                    stroke="#FFB81C"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </h1>
            </div>

            {/* Filter Bar */}
            <div className="sticky top-0 z-50 bg-white py-6 shadow-sm" style={{ willChange: 'transform' }}>
              <div className="max-w-7xl mx-auto mb-10 px-4">
                {/* Filters & Counter Row */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Category Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setActiveCategory(category)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                          activeCategory === category
                            ? "bg-blue-600 text-white"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {category} ({getCategoryCount(category)})
                      </button>
                    ))}
                  </div>

                  {/* Results Count */}
                  <div className="text-sm font-medium text-slate-500 whitespace-nowrap">
                    Showing <span className="font-bold">{resultsCount.filteredCount}</span> of {resultsCount.totalCount} initiatives
                  </div>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {displayedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="w-12 h-12 text-slate-300 mb-6"
                />
                <p className="text-slate-900 font-bold text-lg mb-2 text-center">
                  No initiatives found
                  {activeCategory !== "All" && ` in ${activeCategory}`}
                </p>
                <p className="text-slate-600 text-sm mb-6 text-center max-w-md">
                  Try selecting a different category to find what you're looking for
                </p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              /* Grid Layout */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 pb-24" style={{ contain: 'layout style paint' }}>
                  {displayedItems.map((item, index) => {
                    return (
                    <a
                      key={item.title}
                      {...(item.link && { href: item.link })}
                      onClick={(e) => {
                        if (!item.link) {
                          e.preventDefault();
                        }
                      }}
                      target={item.external ? "_blank" : "_self"}
                      rel={item.external ? "noopener noreferrer" : ""}
                      className={`group flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden 
                        hover:-translate-y-1 hover:shadow-xl hover:border-yellow-400 transition-transform transition-shadow`}
                      style={{ willChange: 'transform', contain: 'layout style paint' }}
                    >
                      {/* Image Container */}
                      <div className="relative w-full aspect-video overflow-hidden" style={{ contain: 'layout' }}>
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                          style={{ willChange: 'transform', contentVisibility: 'auto' }}
                        />
                      </div>

                      {/* Content Container */}
                      <div className="flex flex-col flex-grow p-5">
                        {/* Category Badge */}
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2 block">
                          {item.category}
                        </span>

                        {/* Title */}
                        <h2 className="text-lg font-bold text-slate-900 mb-1">
                          {item.title}
                        </h2>

                        {/* Description */}
                        <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed flex-grow mb-4">
                          {item.description}
                        </p>

                        {/* CTA Link */}
                        {item.link && (
                          <div className="mt-auto">
                            <span className="text-blue-600 hover:text-yellow-500 font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                              Learn More
                              <FontAwesomeIcon
                                icon={faArrowRight}
                                className="w-3 h-3 group-hover:translate-x-1 transition-transform"
                              />
                            </span>
                          </div>
                        )}
                      </div>
                    </a>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default InitiativePage;

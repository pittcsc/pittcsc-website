import React, { useEffect } from "react";
import { StaticImage } from "gatsby-plugin-image";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import Layout from "../layouts/layout";

// Constants
const HOTJAR_ID = 2276434;
const HOTJAR_VERSION = 6;
const GA_TRACKING_ID = "UA-58446605-1";

const initiatives = [
  {
    title: "Zero to Offer",
    image: (
      <StaticImage
        src="../images/initiatives/Z2O/Z2O-speaker.jpg"
        alt="Zero to Offer"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/z2o",
    external: false,
    category: "Career",
    description: "Our premier internship training program helping students land top-tier tech offers through mentorship and practice.",
  },
  {
    title: "Foundry",
    image: (
      <StaticImage
        src="../images/initiatives/foundry/CSC_CGI_Code_Comp-032.jpg"
        alt="Foundry"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/foundry",
    external: false,
    category: "Career",
    description: "A committed community for growth through interview practice, presentations, project building, mentorship, and peer accountability.",
  },
  {
    title: "Mock Interviews",
    image: (
      <StaticImage
        src="../images/initiatives/mock-interviews/mock-interviews.jpg"
        alt="Mock Interviews"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/mock-interviews",
    external: false,
    category: "Career",
    description: "Practice technical and behavioral interviews with experienced peers and industry professionals.",
  },
  {
    title: "Industry Recruiting Events",
    image: (
      <StaticImage
        src="../images/initiatives/industry-recruiting/industry-recruiting.jpg"
        alt="Industry Recruiting Events"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/industry-recruiting",
    external: false,
    category: "Career",
    description: "Exclusive recruiting sessions and networking opportunities with top tech companies and sponsors.",
  },
  {
    title: "Site Visits",
    image: (
      <StaticImage
        src="../images/initiatives/site-visits/google.jpg"
        alt="Site Visits"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/site-visits",
    external: false,
    category: "Career",
    description: "Visit local tech companies and offices to see real-world engineering environments and culture.",
  },
  {
    title: "Launchpad",
    image: (
      <StaticImage
        src="../images/initiatives/launchpad.jpg"
        alt="Launchpad"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/launchpad",
    external: false,
    category: "Career",
    description: "An incubator program to help you launch your own startup or big idea from scratch.",
  },
  {
    title: "Dev Lab",
    image: (
      <StaticImage
        src="../images/initiatives/dev-lab/dev-lab-placeholder.jpg"
        alt="Dev Lab"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "https://pittcs.wiki/guides/skills/csc-dev-lab",
    external: true,
    category: "Project Teams",
    description: "A hands-on development lab for students to build and collaborate on projects.",
  },
  {
    title: "Consulting",
    image: (
      <StaticImage
        src="../images/initiatives/csc-consulting.jpg"
        alt="Consulting"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/consulting",
    external: false,
    category: "Project Teams",
    description: "Gain real-world experience building software solutions for local non-profits and startups in our community.",
  },
  {
    title: "CSC Hacks",
    image: (
      <StaticImage
        src="../images/initiatives/csc-hacks/csc-hacks.jpg"
        alt="CSC Hacks"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/csc-hacks",
    external: false,
    category: "Hackathons",
    description: "Our internal hackathon event designed to help members learn and collaborate on innovative projects.",
  },
  {
    title: "SteelHacks",
    image: (
      <StaticImage
        src="../images/initiatives/steelhacks-team.jpg"
        alt="SteelHacks"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "https://steelhacks.org",
    external: true,
    category: "Hackathons",
    description: "Pitt's largest annual hackathon, bringing together hundreds of hackers for a weekend of building and learning.",
  },
  {
    title: "Bit/Byte",
    image: (
      <StaticImage
        src="../images/initiatives/bit-byte/bit-byte.jpg"
        alt="Bit/Byte"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/bit-byte",
    external: false,
    category: "Mentorship",
    description: "Peer mentorship program connecting upperclassmen with underclassmen for academic and career guidance.",
  },
  {
    title: "Fireside Chats",
    image: (
      <StaticImage
        src="../images/initiatives/fireside_chats/fschat.jpg"
        alt="Fireside Chats"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/fireside-chats",
    external: false,
    category: "Guest Speakers",
    description: "Intimate Q&A sessions connecting you with industry leaders, successful alumni, and tech visionaries.",
  },
  {
    title: "Social Events",
    image: (
      <StaticImage
        src="../images/initiatives/social_events/soc_event.jpg"
        alt="Social Events"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/social-events",
    external: false,
    category: "Social",
    description: "Fun gatherings, game nights, and outings to build a tight-knit community and make lasting friendships.",
  },
  {
    title: "Social Media",
    image: (
      <StaticImage
        src="../images/initiatives/social-media/social-media.jpg"
        alt="Social Media"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ willChange: "transform", contentVisibility: "auto" }}
      />
    ),
    link: "/initiatives/social-media",
    external: false,
    category: "Social",
    description: "Stay connected with the club through our active social media presence and community updates.",
  },
];

const InitiativePage = () => {
  useEffect(() => {
    hotjar.initialize(HOTJAR_ID, HOTJAR_VERSION);
    ReactGA.initialize(GA_TRACKING_ID);
    ReactGA.pageview("/initiatives");
  }, []);

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

            {/* Grid Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 pb-24" style={{ contain: 'layout style paint' }}>
              {initiatives.map((item, index) => {
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
                      {item.image}
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
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default InitiativePage;

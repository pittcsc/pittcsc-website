import React, { useEffect } from "react";
import Z2O from "../images/initiatives/Z2O/Z2O.png";
import SocEvent from "../images/initiatives/social_events/soc_event-4.png";
import FSChat from "../images/initiatives/fireside_chats/fschat.png";
import Consulting from "../images/initiatives/csc-consulting.jpg";
import SH from "../images/initiatives/steelhacks-team.png";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import Layout from "../layouts/layout";

const initiatives = [
  {
    title: "Zero to Offer",
    image: Z2O,
    link: "/initiatives/z2o",
    external: false,
    description: "Our premier internship training program helping students land top-tier tech offers through mentorship and practice.",
  },
  {
    title: "Fireside Chats",
    image: FSChat,
    link: "/initiatives/fireside-chats",
    external: false,
    description: "Intimate Q&A sessions connecting you with industry leaders, successful alumni, and tech visionaries.",
  },
  {
    title: "Social Events",
    image: SocEvent,
    link: "/initiatives/social-events",
    external: false,
    description: "Fun gatherings, game nights, and outings to build a tight-knit community and make lasting friendships.",
  },
  {
    title: "SteelHacks",
    image: SH,
    link: "https://steelhacks.com",
    external: true,
    description: "Pitt's largest annual hackathon, bringing together hundreds of hackers for a weekend of building and learning.",
  },
  {
    title: "Consulting",
    image: Consulting,
    link: "", // Assuming no link as per original code
    external: false,
    description: "Gain real-world experience building software solutions for local non-profits and startups in our community.",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
    },
  }),
};

const InitiativePage = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/initiatives");
  }, []);

  return (
    <Layout
      title="Initiatives | Computer Science Club @ Pitt"
      header="initiatives"
    >
      <motion.div
        className="overflow-hidden relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-16 xl:my-24">
          <section className="container relative z-10 mx-auto px-4 w-full md:px-0 lg:w-10/12">
            {/* Header Section */}
            <div className="flex flex-col items-center justify-center mb-16 relative z-20">
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

            {/* Flex Layout for Centering */}
            <div className="flex flex-wrap justify-center gap-8 pb-24 relative z-20">
              {initiatives.map((item, index) => (
                <motion.a
                  key={item.title}
                  href={item.link}
                  target={item.external ? "_blank" : "_self"}
                  rel={item.external ? "noopener noreferrer" : ""}
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  variants={cardVariants}
                  className="group flex-none flex flex-col bg-primary border-4 border-yellow-400 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] w-full md:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.3333rem)] h-[32rem]"
                >
                  {/* Image Container */}
                  <div className="relative w-full h-48 lg:h-56 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  </div>

                  {/* Content Container */}
                  <div className="flex flex-col flex-grow p-6">
                    <h2 className="mb-2 text-white text-2xl font-bold border-b-2 border-yellow-400 pb-2 inline-block self-start">
                      {item.title}
                    </h2>
                    <p className="mb-6 text-gray-100 text-sm lg:text-base leading-relaxed flex-grow">
                      {item.description}
                    </p>

                    {/* CTA Button */}
                    <div className="mt-auto self-start">
                      <span className="inline-block px-6 py-2 bg-yellow-400 text-primary font-bold rounded-full transition-transform duration-300 group-hover:translate-x-1">
                        Learn More &rarr;
                      </span>
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>

            {/* Polka Dot Patterns */}
            <div className="polka-background absolute top-10 -left-10 z-0 opacity-50 hidden lg:block"></div>
            <div className="polka-background absolute bottom-10 -right-10 z-0 opacity-50 hidden lg:block" style={{ transform: 'rotate(180deg)' }}></div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default InitiativePage;

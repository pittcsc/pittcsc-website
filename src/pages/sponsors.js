import React, { useEffect } from "react";

import SCM from "../images/sponsors/SCM_Logo.svg";
import FAST from "../images/sponsors/FAST_logo.png";
import NNL from "../images/sponsors/naval_nuclear_lab.jpeg";
import BNY from "../images/sponsors/BNY_logo_2024.svg";
import ROBLOX from "../images/sponsors/roblox_logo.png";
import CGI from "../images/sponsors/CGI_logo.svg";
import AEROTECH from "../images/sponsors/aerotech_logo.png";

import SpringReportImage from "../images/hero_image.png";

import { motion } from "framer-motion";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";

import Layout from "../layouts/layout";

const imageContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0 },
};

// imgClass sets a fixed height per logo so perceived visual weight is equal.
// Wide flat logos (BNY, Roblox) need more height; square logos (CGI) need less.
const sponsors = [
  { src: BNY,      alt: "BNY Logo",                    href: "https://www.bny.com/",                   imgClass: "h-10" },
  { src: CGI,      alt: "CGI Logo",                    href: "https://www.cgi.com/",                   imgClass: "h-9"  },
  { src: ROBLOX,   alt: "Roblox Logo",                 href: "https://www.roblox.com/",                imgClass: "h-10" },
  { src: NNL,      alt: "Naval Nuclear Lab Logo",       href: "https://navalnuclearlab.energy.gov/",    imgClass: "h-16" },
  { src: SCM,      alt: "Stevens Capital Management",  href: "https://www.scm-lp.com/",                imgClass: "h-20" },
  { src: AEROTECH, alt: "Aerotech Logo",               href: "https://www.aerotech.com/",              imgClass: "h-24" },
  { src: FAST,     alt: "FAST Enterprises Logo",       href: "https://www.fastenterprises.com/",       imgClass: "h-12" },
];

const SponsorPage = ({ data }) => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/sponsors");
  }, []);

  return (
    <Layout title="Sponsors | Computer Science Club at Pitt" header="sponsors">
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-16 lg:space-y-24 xl:my-24">
          <section className="container flex flex-col items-center justify-center mx-auto w-full">
            <div>
              <h1 className="relative z-10 mb-8 mt-4 w-full text-3xl font-bold lg:text-6xl">
                We Love Our Sponsors
                <svg
                  className="svg-underline relative z-10 w-full"
                  viewBox="0 0 422 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                  />
                </svg>
              </h1>
            </div>

            <div className="flex flex-col items-center gap-16 w-full px-4 mt-8">
              {[sponsors.slice(0, 4), sponsors.slice(4)].map((row, rowIndex) => (
                <motion.div
                  key={rowIndex}
                  variants={imageContainer}
                  initial="hidden"
                  animate="show"
                  className="flex items-center justify-center flex-wrap gap-12 md:gap-16 xl:gap-24"
                >
                  {row.map((sponsor) => (
                    <motion.a
                      key={sponsor.alt}
                      variants={item}
                      href={sponsor.href}
                      target="_blank"
                      aria-label={sponsor.alt}
                      className="flex items-center justify-center"
                    >
                      <img
                        className={`w-auto object-contain ${sponsor.imgClass}`}
                        src={sponsor.src}
                        alt={sponsor.alt}
                      />
                    </motion.a>
                  ))}
                </motion.div>
              ))}
            </div>
          </section>

          <motion.div
            className="w-screen bg-gradient-to-r from-primary to-blue-800 mt-16"
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <section className="container flex flex-col items-center justify-center mx-auto py-24 w-full lg:py-32">
              <div className="flex flex-col items-center justify-center w-9/12 lg:flex-row lg:justify-around lg:w-full">
                <div className="mb-4 lg:mb-0">
                  <h2 className="mb-8 max-w-lg text-center text-white text-2xl font-bold lg:text-5xl">
                    Why Sponsor?
                    <svg
                      className="svg-underline my-2 w-full"
                      viewBox="0 0 470 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M467 9.00001C323.851 9.00006 37.5532 -4.49999 3.00001 8.99995" />
                    </svg>
                  </h2>
                  <h3 className="my-2 text-white text-2xl font-semibold">
                    Collaborative
                  </h3>
                  <p className="mb-8 max-w-lg text-white text-base leading-loose">
                    We work with you in order to help reach amazing students an
                    create a stronger community.
                  </p>
                  <h3 className="my-2 text-white text-2xl font-semibold">
                    Connected
                  </h3>
                  <p className="max-w-lg text-white text-base leading-loose">
                    With our Alumni program, we actively give back and form
                    connections between underclassmen, upperclassmen, and
                    alumni.
                  </p>
                </div>

                <div className="relative flex flex-col items-center justify-center mt-4 w-full lg:mt-0 lg:w-1/2">
                  <svg
                    className="absolute -bottom-10 -left-10 w-32 md:w-48 lg:left-0"
                    viewBox="0 0 306 200"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M29 3C71.5 3.5 152.3 10.3 183.5 73.5C214.7 136.7 281.5 155.167 305 151.5"
                      stroke="#FFB81C"
                      strokeWidth="5"
                    />
                    <path
                      d="M1 48C43.5 48.5 124.3 55.3 155.5 118.5C186.7 181.7 253.5 200.167 277 196.5"
                      stroke="#FFB81C"
                      strokeWidth="5"
                    />
                  </svg>
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    href={"/initiatives"}
                    target="_self"
                    className="min-w-300 absolute -bottom-6 px-4 py-2 text-black font-bold bg-white border-4 border-secondary-100 rounded-full focus:outline-none hover:shadow-lg shadow-md transition lg:right-10"
                  >
                    View Our Initiatives!
                  </motion.a>
                  <img
                    className="mx-auto w-full rounded-3xl shadow-lg lg:w-9/12"
                    src={SpringReportImage}
                    alt="Fall Report 2022"
                  />
                </div>
              </div>
            </section>
          </motion.div>
        </div>
      </motion.div>
    </Layout>
  );
};

export default SponsorPage;

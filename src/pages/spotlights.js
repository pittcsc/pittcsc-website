import React, { useEffect } from "react";

import ArgoAI from "../images/sponsors/Argo-AI-logo.png";
import NS from "../images/sponsors/norfolk_southern_logo.png";
import PNC from "../images/sponsors/PNC_logo.png";
import SAP from "../images/sponsors/SAP-Logo.svg";

import SpringReportImage from "../images/Spring_Report_Image.png";

import SpringReport from "../downloads/Pitt_CSC_Spring_Report.pdf";

import { motion } from "framer-motion";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";

import Layout from "../layouts/layout";

const imageContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.4,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 100 },
  show: { opacity: 1, y: 0 },
};

const Spotlights = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/sponsors");
  }, []);

  return (
    <Layout title="Sponsors | Pitt Computer Science Club" header="sponsors">
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-24 xl:my-24">
          <section className="container flex flex-col items-center justify-center mx-auto w-full">
            <div>
              <h1 className="relative z-10 mb-8 mt-4 w-full text-3xl font-bold lg:text-6xl">
                Get Noticed
                <svg
                  className="svg-underline relative z-10 w-full"
                  viewBox="0 0 422 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path
                    initial={{
                      pathLength: 0,
                      opacity: 0,
                    }}
                    animate={{
                      pathLength: 1,
                      opacity: 1,
                    }}
                    transition={{
                      delay: 0.2,
                      duration: 0.8,
                    }}
                    d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                  />
                </svg>
              </h1>
            </div>
            <motion.div
              variants={imageContainer}
              initial="hidden"
              animate="show"
              className="grid gap-4 grid-cols-2 place-items-center w-full lg:gap-8 lg:grid-cols-4"
            >
              <motion.a
                variants={item}
                href="https://www.argo.ai/"
                target="_blank"
              >
                <img
                  className="m-4 w-32 md:w-48 lg:m-8 lg:w-64 xl:w-80"
                  src={ArgoAI}
                  alt="Argo AI Logo"
                />
              </motion.a>
              <motion.a
                variants={item}
                href="https://www.pnc.com/en/personal-banking.html"
                target="_blank"
              >
                <img
                  className="m-4 w-32 md:w-48 lg:m-8 lg:w-64 xl:w-80"
                  src={PNC}
                  alt="PNC Logo"
                />
              </motion.a>
              <motion.a
                variants={item}
                href="https://www.sap.com/index.html"
                target="_blank"
              >
                <img
                  className="m-4 w-32 md:w-48 lg:m-8 lg:w-64 xl:w-80"
                  src={SAP}
                  alt="SAP Logo"
                />
              </motion.a>
              <motion.a
                variants={item}
                href="http://www.nscorp.com/content/nscorp/en.html"
                target="_blank"
              >
                <img
                  className="m-4 w-32 md:w-48 lg:m-8 lg:w-64 xl:w-80"
                  src={NS}
                  alt="Norfolk Southern Logo"
                />
              </motion.a>
            </motion.div>
          </section>
          <div className="w-screen bg-gradient-to-r from-primary to-blue-800">
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
                      stroke-width="5"
                    />
                    <path
                      d="M1 48C43.5 48.5 124.3 55.3 155.5 118.5C186.7 181.7 253.5 200.167 277 196.5"
                      stroke="#FFB81C"
                      stroke-width="5"
                    />
                  </svg>
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    href={SpringReport}
                    target="_blank"
                    className="min-w-300 absolute -bottom-6 px-4 py-2 text-black font-bold bg-white border-4 border-secondary-100 rounded-full focus:outline-none hover:shadow-lg shadow-md transition lg:right-10"
                  >
                    See Spring Report
                  </motion.a>
                  <img
                    className="mx-auto w-full rounded-3xl shadow-lg lg:w-9/12"
                    src={SpringReportImage}
                    alt="Spring Report 2021"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
};

export default Spotlights;

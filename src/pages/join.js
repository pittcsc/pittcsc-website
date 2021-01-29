import React from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faGithub,
  faLinkedin,
  faSlack,
} from "@fortawesome/free-brands-svg-icons";

import { motion } from "framer-motion";

import Header from "../components/Header";
import Footer from "../components/Footer";
import heroImage from "../images/hero-img2-cropped.png";
import MaskImage from "../images/Pitt_CSC_Mask.jpg";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.6,
    },
  },
};

const text = {
  hidden: {
    opacity: 0,
    y: 25,
  },
  show: {
    opacity: 1,
    y: 0,
  },
};

const JoinPage = () => (
  <div className="overflow-hidden">
    <Header />
    <main className="space-y-24 min-h-screen my-8 mt-24 xl:my-24">
      <section className="container mx-auto flex w-full flex-col justify-center items-center">
        <div>
          <h2 className="text-4xl lg:text-6xl font-bold font-body mb-8 mt-4 w-full z-10 relative">
            Join Pitt CSC
            <svg
              className="relative z-10 w-64 lg:w-full"
              viewBox="0 0 422 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                stroke="#FFB81C"
                stroke-width="5"
                stroke-linecap="round"
              />
            </svg>
          </h2>
        </div>
        <div className="w-full flex flex-col justify-center items-center xl:w-5/6 lg:flex-row">
          <ul className="grid grid-cols-3 place-items-center w-9/10 gap-4 lg:gap-4 mx-auto px-4 box-border">
            <span className="text-3xl lg:text-4xl font-bold font-body col-span-1">
              1.
            </span>
            <li className="flex justify-center items-center col-span-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="bg-primary font-body transition text-white font-bold py-2 px-4 rounded-full min-width-btn shadow-md hover:shadow-lg"
              >
                Join the email list
              </motion.button>
            </li>
            <span className="text-3xl font-bold font-body col-span-1">2.</span>
            <li className="flex justify-center items-center col-span-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="bg-primary font-body transition text-white font-bold py-2 px-4 rounded-full min-width-btn shadow-md hover:shadow-lg"
              >
                Join our Slack
              </motion.button>
            </li>
            <span className="text-3xl lg:text-4xl font-bold font-body col-span-1">
              3.
            </span>
            <li className="flex justify-center items-center col-span-2">
              <span className="text-2xl lg:text-4xl font-bold font-body relative">
                Keep in contact!
                <svg
                  width="196"
                  height="60"
                  className="absolute hidden lg:block top-12 -right-12"
                  viewBox="0 0 196 60"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1.33948 4.86905C0.30719 3.95213 0.213665 2.37198 1.13059 1.33969C2.04751 0.307404 3.62765 0.213878 4.65994 1.1308L1.33948 4.86905ZM190.757 22.0117C192.132 21.878 193.354 22.8835 193.488 24.2577L195.668 46.6519C195.802 48.0261 194.796 49.2486 193.422 49.3823C192.048 49.5161 190.825 48.5106 190.691 47.1363L188.754 27.2305L168.848 29.1683C167.473 29.3021 166.251 28.2966 166.117 26.9223C165.983 25.5481 166.989 24.3256 168.363 24.1919L190.757 22.0117ZM4.65994 1.1308C52.2275 43.3822 92.2444 56.1331 123.25 54.7839C154.275 53.4338 176.699 37.9501 189.069 22.9118L192.93 26.0881C179.801 42.0499 156.119 58.3583 123.467 59.7792C90.7949 61.201 49.5617 47.7019 1.33948 4.86905L4.65994 1.1308Z"
                    fill="#FFB81C"
                  />
                </svg>
              </span>
            </li>
          </ul>
          <div className="w-3/4 max-w-lg lg:w-full h-32 lg:h-48 p-8 my-8 mx-auto rounded-2xl bg-secondary-200 mx-auto flex justify-around items-center shadow-md">
            <a
              href="https://github.com/pittcsc"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon
                icon={faGithub}
                className="text-primary text-6xl lg:text-7xl xl:text-8xl"
              />
            </a>
            <a
              href="https://www.linkedin.com/company/pittcsc/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon
                icon={faLinkedin}
                className="text-primary text-6xl lg:text-7xl xl:text-8xl"
              />
            </a>
            <a
              href="http://pittcsc.slack.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon
                icon={faSlack}
                className="text-primary text-6xl lg:text-7xl xl:text-8xl"
              />
            </a>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </div>
);

export default JoinPage;

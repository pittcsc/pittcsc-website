import React from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faGithub,
  faLinkedin,
  faSlack,
} from "@fortawesome/free-brands-svg-icons";

import { faVideo, faEnvelope } from "@fortawesome/free-solid-svg-icons";

import { motion } from "framer-motion";

import Layout from "../layouts/layout";

// import heroImage from "../images/hero-img2-cropped.png";
// import MaskImage from "../images/Pitt_CSC_Mask.jpg";

// const container = {
//   hidden: { opacity: 0 },
//   show: {
//     opacity: 1,
//     transition: {
//       when: "beforeChildren",
//       staggerChildren: 0.6,
//     },
//   },
// };

// const text = {
//   hidden: {
//     opacity: 0,
//     y: 25,
//   },
//   show: {
//     opacity: 1,
//     y: 0,
//   },
// };

const JoinPage = () => (
  <Layout title="Join the Club | Pitt Computer Science Club ">
    <motion.div
      className="overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="space-y-24 min-h-screen my-8 mt-24 xl:my-24">
        <section className="container mx-auto flex w-full flex-col justify-center items-center">
          <div>
            <h1 className="text-4xl lg:text-6xl font-bold font-body mb-8 mt-4 w-full z-10 relative text-center">
              Join Pitt CSC
              <svg
                className="relative z-10 w-64 lg:w-full svg-underline"
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
          <div className="w-full flex flex-col justify-center items-center xl:w-5/6 lg:flex-row py-8 relative">
            <ul className="relative z-10 grid grid-cols-3 place-items-center w-11/12 md:w-auto gap-4 lg:gap-8 mx-auto box-border">
              <span className="text-3xl lg:text-4xl font-bold font-body col-span-1">
                1.
              </span>
              <li className="flex justify-center items-center col-span-2">
                <a
                  href="http://eepurl.com/bgY5c9"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="bg-primary font-body transition text-white font-bold py-2 px-4 rounded-full min-width-btn shadow-md hover:shadow-lg focus:outline-none"
                  >
                    Join the email list
                  </motion.button>
                </a>
              </li>
              <span className="text-3xl font-bold font-body col-span-1">
                2.
              </span>
              <li className="flex justify-center items-center col-span-2">
                <a
                  href="http://pittcsc.slack.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="bg-primary font-body transition text-white font-bold py-2 px-4 rounded-full min-width-btn shadow-md hover:shadow-lg focus:outline-none"
                  >
                    Join our Slack
                  </motion.button>
                </a>
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
            <motion.div
              initial={{
                opacity: 0,
                x: 100,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: 0.4,
              }}
              className="polka-background-subPage absolute top-0 -right-48 lg:-right-24"
            ></motion.div>
            <div className="relative w-5/6 max-w-md lg:w-3/4 xl:max-w-lg h-32 lg:h-48 p-6 my-8 mx-auto rounded-2xl bg-secondary-200 mx-auto flex justify-around items-center shadow-md">
              <motion.a
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                href="https://github.com/pittcsc"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pitt Computer Science Club GitHub"
              >
                <FontAwesomeIcon
                  icon={faGithub}
                  className="text-primary text-5xl lg:text-7xl"
                />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                href="https://www.linkedin.com/company/pittcsc/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pitt Computer Science Club LinkedIn"
              >
                <FontAwesomeIcon
                  icon={faLinkedin}
                  className="text-primary text-5xl lg:text-7xl"
                />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                href="http://pittcsc.slack.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pitt Computer Science Club Slack"
              >
                <FontAwesomeIcon
                  icon={faSlack}
                  className="text-primary text-5xl lg:text-7xl"
                />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                href="mailto:pittcsc@gmail.com"
                aria-label="Pitt Computer Science Club Email"
              >
                <FontAwesomeIcon
                  icon={faEnvelope}
                  className="text-primary text-5xl lg:text-7xl"
                />
              </motion.a>
            </div>
          </div>
        </section>
        <div className="w-screen bg-gradient-to-r from-primary to-blue-800">
          <section className="container mx-auto w-full flex flex-col justify-center items-center py-24 lg:py-32">
            <div className="w-full flex flex-row justify-around items-center flex-wrap">
              <div className="w-full mb-8 lg:w-1/2 p-4 bg-secondary-200 rounded-2xl flex flex-col justify-center items-center font-body relative">
                <svg
                  className="w-32 absolute -bottom-10 -left-10 lg:-left-20 lg:w-64"
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
                <iframe
                  src="https://calendar.google.com/calendar/embed?src=f64u131to44gn3tn8g62ov2u1s%40group.calendar.google.com&ctz=America%2FNew_York"
                  title="Pitt CSC Google Calendar"
                  frameborder="0"
                  scrolling="no"
                  height="600"
                  className="w-full"
                ></iframe>
                <div className="flex justify-center items-center text-lg my-4">
                  <p className="mx-2"> Join our zoom meetings: </p>
                  <a
                    href="https://pitt.zoom.us/my/zhw78"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-center items-center"
                    aria-label="Pitt Computer Science Club Zoom Meetings"
                  >
                    <FontAwesomeIcon
                      icon={faVideo}
                      className="text-primary text-lg lg:text-xl xl:text-2xl"
                    />
                  </a>
                </div>
              </div>
              <div className="w-9/12 lg:w-auto p-4">
                <h2 className="text-2xl lg:text-5xl font-bold font-body text-white my-4">
                  Pop in to an event
                  <svg
                    width="156"
                    height="12"
                    viewBox="0 0 156 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M153 9.00001C106.723 9.00006 14.1702 -4.49999 3 8.99995"
                      stroke="#FFB81C"
                      stroke-width="5"
                      stroke-linecap="round"
                    />
                  </svg>
                </h2>
                <p className="font-body text-white text-base max-w-lg leading-loose">
                  There are always a variety of different things to attend
                  including hackathons, talks, and coffee chats! We typically
                  host meetings on Mondays and Wednesdays at 8pm.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  </Layout>
);

export default JoinPage;

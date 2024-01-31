import React, { useEffect } from "react";
import { graphql } from "gatsby";
import { Link } from "gatsby";
import Lottie from "react-lottie";
import { StaticImage } from "gatsby-plugin-image";
import { getAcademicYear } from "../utils/dates";

import animationData from "../animations/pittcscLogoAnimation.json";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faGithub,
  faLinkedin,
  faDiscord,
} from "@fortawesome/free-brands-svg-icons";

import { faVideo, faEnvelope } from "@fortawesome/free-solid-svg-icons";

import { motion, useAnimation } from "framer-motion";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import FallReport from "../downloads/gbm-fall-2022.pdf";

import { useInView } from "react-intersection-observer";

import Layout from "../layouts/layout";

import EventItem from "../components/eventItem";

const logoAnimationOptions = {
  loop: false,
  autoplay: true,
  animationData: animationData,
  renderSettings: {
    preserveAspectRatio: "xMidYMid slice",
  },
};

const container = {
  hidden: { opacity: 0 },
  homeShow: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.4,
    },
  },
};

const text = {
  hidden: {
    opacity: 0,
    y: 25,
  },
  homeShow: {
    opacity: 1,
    y: 0,
  },
};

const maskAnimate = {
  hidden: {
    opacity: 0,
    x: -25,
  },
  missionShow: {
    opacity: 1,
    x: 0,
  },
};

const missionAnimate = {
  hidden: {
    opacity: 0,
    x: 25,
  },
  missionShow: {
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.2,
    },
  },
};

const socialAnimate = {
  hidden: {
    opacity: 0,
    y: 25,
  },
  socialShow: {
    opacity: 1,
    y: 0,
  },
};

const underlineAnimate = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  homeShow: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.8,
    },
  },
};

const swirlyAnimate = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  missionShow: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.8,
    },
  },
};
const hitUnderlineAnimate = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  socialShow: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.8,
    },
  },
};

const IndexPage = ({ data }) => {
  const site = (data || {})?.site;
  const futureEvents = site.edges
    .slice()
    .filter(
      (event) =>
        new Date(event.node.content.properties.Date.date.start).getTime() >=
        new Date().getTime()
    );
  console.log(futureEvents);

  const windowGlobal = typeof window !== `undefined` && window;
  const controls = useAnimation();
  const { ref: homeRef, inView: homeInView } = useInView({ triggerOnce: true });
  const { ref: missionRef, inView: missionInView } = useInView({
    triggerOnce: true,
    rootMargin: "-100px 0px",
  });
  const { ref: socialRef, inView: socialInView } = useInView({
    triggerOnce: true,
    rootMargin: "-150px 0px",
  });

  useEffect(() => {
    if (homeInView) {
      controls.start("homeShow");
    }
    if (missionInView) {
      controls.start("missionShow");
    }
    if (socialInView) {
      controls.start("socialShow");
    }

    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/");
  }, [controls, homeInView, missionInView, socialInView]);

  return (
    <Layout
      title="Supporting the CS Community | Computer Science Club @ Pitt"
      header="home"
    >
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-24 lg:space-y-40 xl:my-32">
          <section className="container flex flex-col items-center justify-center mx-auto px-8 w-full lg:flex-row lg:px-0 lg:w-10/12">
            <motion.div
              variants={container}
              initial="hidden"
              animate={controls}
              ref={homeRef}
              className="relative break-normal xl:w-3/4"
            >
              <motion.p
                variants={text}
                className="relative z-10 text-lg font-light xl:text-xl"
              >
                {getAcademicYear()} SCHOOL YEAR
              </motion.p>
              <motion.h1
                variants={text}
                className="relative z-10 my-2 w-full whitespace-pre text-4xl 2xl:text-8xl font-bold md:text-5xl lg:my-4 lg:text-7xl"
              >
                Computer Science
                <br />
                Club at Pitt
                <svg
                  className="svg-underline relative z-10 w-64 md:w-1/2 lg:w-3/4"
                  viewBox="0 0 422 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path
                    variants={underlineAnimate}
                    d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                  />
                </svg>
              </motion.h1>

              <motion.p
                variants={text}
                className="relative z-10 w-3/4 2xl:text-lg text-sm leading-loose 2xl:leading-loose md:text-base md:leading-loose xl:w-3/4 xl:leading-loose"
              >
                The University of Pittsburgh's largest tech-related student
                organization. Proudly pushing the boundaries on what it means to
                be a Pitt student.
              </motion.p>
              <motion.div
                variants={text}
                className="relative z-20 py-4 space-x-4 xl:space-x-8"
              >
                <Link to="/join">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="min-w-300 px-4 py-2 text-white font-bold bg-primary rounded-full focus:outline-none hover:shadow-lg shadow-md transition"
                  >
                    Join the Club
                  </motion.button>
                </Link>
                <Link to="/about">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="min-w-300 px-4 py-2 font-bold bg-white border-4 border-primary rounded-full focus:outline-none hover:shadow-lg shadow-md transition"
                  >
                    What We Do
                  </motion.button>
                </Link>
              </motion.div>
              <div className="absolute z-0 -left-20 top-0 w-40 h-40 bg-secondary-200 rounded-2xl transform-gpu -rotate-12 lg:-left-40 lg:-top-8 xl:w-80 xl:h-80"></div>
            </motion.div>
            <div className="relative flex flex-col items-center justify-center w-full lg:w-1/2">
              <motion.div
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                transition={{
                  delay: 0.4,
                }}
                className="svg-lottie relative z-20"
              >
                <Lottie options={logoAnimationOptions} className="" />
              </motion.div>

              <motion.div
                initial={{
                  opacity: 0,
                  x: 50,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                transition={{
                  delay: 0.4,
                }}
                className="polka-background absolute z-10 -right-10 -top-10 lg:-top-20"
              ></motion.div>
            </div>
          </section>
          <div className="w-screen bg-gradient-to-r from-primary to-blue-800">
            <section className="container relative z-10 flex flex-col items-center justify-center mx-auto px-4 py-24 w-full md:px-0 lg:flex-row lg:py-32">
              <div className="relative flex flex-col items-center justify-center my-4 w-full h-full text-center lg:w-1/2 xl:my-0">
                <motion.svg
                  className="svg-underline absolute z-10 -top-10 right-0 w-32 md:-top-20 md:w-64 lg:w-48 xl:w-64"
                  viewBox="0 0 306 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path
                    variants={swirlyAnimate}
                    initial="hidden"
                    animate={controls}
                    d="M29 3C71.5 3.5 152.3 10.3 183.5 73.5C214.7 136.7 281.5 155.167 305 151.5"
                  />
                  <motion.path
                    variants={swirlyAnimate}
                    initial="hidden"
                    animate={controls}
                    d="M1 48C43.5 48.5 124.3 55.3 155.5 118.5C186.7 181.7 253.5 200.167 277 196.5"
                  />
                </motion.svg>
                <motion.div
                  ref={missionRef}
                  variants={maskAnimate}
                  initial="hidden"
                  animate={controls}
                  className="mx-auto xl:w-9/12"
                >
                  <StaticImage
                    src="../images/Pitt_CSC_Mask.jpg"
                    alt="Masked CSC Members"
                    placeholder="blurred"
                    imgClassName="mx-auto w-full rounded-3xl shadow-lg"
                    width={1388}
                    height={734}
                  />
                </motion.div>
                <motion.a
                  variants={maskAnimate}
                  initial="hidden"
                  animate={controls}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  href={"#"} // FallReport
                  target="_blank"
                  className="absolute z-20 -bottom-4 inline-block"
                >
                  <button className="min-w-300 px-4 py-2 text-center text-black font-bold bg-white border-4 border-secondary-100 rounded-full focus:outline-none hover:shadow-lg shadow-md transition">
                    Initiatives - Fall 2023 (Coming Soon)
                  </button>
                </motion.a>
              </div>
              <motion.div
                className="relative w-full lg:w-1/2"
                variants={missionAnimate}
                initial="hidden"
                animate={controls}
              >
                <div className="mx-auto my-4 p-6 max-w-lg bg-secondary-200 rounded-3xl shadow-lg md:p-8 xl:my-0 xl:px-8 xl:py-12 xl:w-full">
                  <h2 className="mb-4 text-3xl font-bold lg:my-4 xl:text-4xl">
                    Our Mission
                  </h2>
                  <p className="xl:text-md block leading-loose">
                    To help create an engaging atmosphere for students to learn
                    more about the field of computer science and develop
                    professionally.
                  </p>
                  <h3 className="mb-2 mt-4 font-bold lg:text-lg">
                    Upcoming Events
                  </h3>
                  <ul className="flex flex-col items-start justify-center text-sm space-y-2 lg:text-base">
                    {futureEvents.length !== 0 &&
                      windowGlobal &&
                      futureEvents
                        .sort(
                          (a, b) =>
                            new Date(
                              a.node.content.properties?.Date?.date?.start
                            ) -
                            new Date(
                              b.node.content.properties?.Date?.date?.start
                            )
                        )
                        .slice(0, 2)
                        .map((event, i) => (
                          <EventItem
                            key={i}
                            index={i}
                            name={
                              event.node.content.properties?.Name?.title[0]
                                ?.plain_text
                            }
                            startDate={
                              event.node.content.properties?.Date?.date?.start
                            }
                            endDate={
                              event.node.content.properties?.Date?.date?.end
                            }
                            description={
                              event.node.content.properties?.Description
                                ?.rich_text[0]?.plain_text
                            }
                            url={event.node.content.properties?.Link?.url}
                            tags={
                              event.node.content.properties?.Tags?.multi_select
                            }
                            time={
                              event.node.content.properties?.Time?.rich_text[0]
                                ?.plain_text
                            }
                            id={event.node.content.id}
                            attendance={
                              event.node.content.properties?.Attendance?.number
                            }
                            shouldOpen={
                              decodeURIComponent(
                                windowGlobal.location.hash.split("#")[1]
                              ) ===
                              event.node.content.properties?.Name?.title[0]
                                ?.plain_text
                            }
                          />
                        ))}
                    {futureEvents.length === 0 && (
                      <p className="px-4 py-2 text-left text-white bg-primary rounded-full">
                        None right now but stay tuned!
                      </p>
                    )}
                  </ul>
                </div>
              </motion.div>
            </section>
          </div>

          <motion.section
            className="container flex flex-col items-center justify-center mx-auto px-4 py-8 w-full md:px-0 lg:flex-row"
            variants={socialAnimate}
            ref={socialRef}
            initial="hidden"
            animate={controls}
          >
            <div className="my-4 w-full lg:my-0 lg:w-1/2">
              <h2 className="text-center text-4xl 2xl:text-7xl font-bold lg:text-5xl xl:text-6xl">
                Hit us up
              </h2>
              <svg
                className="svg-underline mb-8 mx-auto w-48 md:w-64 lg:mb-16 lg:w-1/2"
                viewBox="0 0 479 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <motion.path
                  variants={hitUnderlineAnimate}
                  initial="hidden"
                  animate={controls}
                  d="M2.5 11.4996C106.5 -17.5 411.5 37.9996 476 7.49968"
                />
              </svg>
              <div className="grid gap-2 grid-cols-2 items-center place-items-center mb-8 mx-auto p-6 max-w-md bg-secondary-200 rounded-2xl shadow-lg md:flex md:flex-wrap md:gap-0 md:justify-around lg:mb-0 lg:px-6 lg:py-12 xl:max-w-lg">
                <motion.a
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  href="https://discord.gg/wzPeq2GCRT"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Computer Science Club at Pitt Discord"
                  className="p-2"
                >
                  <FontAwesomeIcon
                    icon={faDiscord}
                    className="text-primary text-6xl xl:text-7xl"
                  />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  href="https://www.linkedin.com/company/cscatpitt/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Computer Science Club at Pitt LinkedIn"
                  className="p-2"
                >
                  <FontAwesomeIcon
                    icon={faLinkedin}
                    className="text-primary text-6xl xl:text-7xl"
                  />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  href="https://github.com/pittcsc"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Computer Science Club at Pitt GitHub"
                  className="p-2"
                >
                  <FontAwesomeIcon
                    icon={faGithub}
                    className="text-primary text-6xl xl:text-7xl"
                  />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  href="mailto:pittcsc@gmail.com"
                  aria-label="Computer Science Club at Pitt Email"
                  className="p-2"
                >
                  <FontAwesomeIcon
                    icon={faEnvelope}
                    className="text-primary text-6xl xl:text-7xl"
                  />
                </motion.a>
              </div>
            </div>
            <div className="relative flex flex-col items-center justify-center mb-8 p-4 w-full bg-secondary-200 rounded-2xl shadow-lg lg:w-1/2">
              <svg
                className="absolute -bottom-10 -left-10 w-32 lg:-left-20 lg:w-64"
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
              <iframe
                src="https://calendar.google.com/calendar/embed?src=f64u131to44gn3tn8g62ov2u1s%40group.calendar.google.com&ctz=America%2FNew_York"
                title="CSC Google Calendar"
                frameborder="0"
                scrolling="no"
                height="600"
                className="w-full"
              ></iframe>
              <div className="flex flex-wrap items-center justify-center">
                <div className="flex items-center justify-center mx-2 my-2 text-lg">
                  <a
                    href="https://pitt.zoom.us/my/pittcsc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                    aria-label="Computer Science Club at Pitt Zoom Meetings"
                  >
                    <p className="mx-2"> Join our zoom meetings: </p>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="flex items-center justify-center"
                    >
                      <FontAwesomeIcon
                        icon={faVideo}
                        className="text-primary text-lg lg:text-xl xl:text-2xl"
                      />
                    </motion.div>
                  </a>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default IndexPage;

export const query = graphql`
  {
    site: allNotionEvent {
      edges {
        node {
          content {
            id
            properties {
              Attendance {
                number
              }
              Date {
                date {
                  start
                  end
                }
              }
              Description {
                rich_text {
                  plain_text
                }
              }
              Link {
                url
              }
              Name {
                title {
                  plain_text
                }
              }
              Tags {
                multi_select {
                  color
                  name
                }
              }
              Time {
                rich_text {
                  plain_text
                }
              }
            }
          }
        }
      }
    }
  }
`;

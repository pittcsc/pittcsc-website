import React, { useEffect } from "react";
import { graphql } from "gatsby";
import { format } from "date-fns";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faGithub,
  faLinkedin,
  faDiscord,
} from "@fortawesome/free-brands-svg-icons";

import { faVideo, faEnvelope } from "@fortawesome/free-solid-svg-icons";

import { motion } from "framer-motion";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";

import Layout from "../layouts/layout";

import EventItem from "../components/eventItem";

const JoinPage = ({ data }) => {
  const site = (data || {})?.site;
  const futureEvents = site.edges.filter(
    (event) =>
      Date.parse(event.node.content.properties.Date.date.start) > new Date()
  );
  const windowGlobal = typeof window !== `undefined` && window;
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/join");
  }, []);
  return (
    <Layout title="Join the Club | Computer Science Club @ Pitt" header="join">
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-24 xl:my-24">
          <section className="container flex flex-col items-center justify-center mx-auto w-full">
            <div>
              <h1 className="relative z-10 mb-8 mt-4 w-full text-center text-4xl font-bold lg:text-6xl">
                Join CSC at Pitt
                <svg
                  className="svg-underline relative z-10 w-64 lg:w-full"
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
            <div className="relative flex flex-col items-center justify-center py-8 w-full lg:flex-row xl:w-5/6">
              <ul className="relative z-10 grid gap-4 grid-cols-3 place-items-center mx-auto w-11/12 box-border md:w-auto lg:gap-8">
                <span className="col-span-1 text-3xl font-bold lg:text-4xl">
                  1.
                </span>
                <li className="flex col-span-2 items-center justify-center">
                  <a
                    href="http://eepurl.com/bgY5c9"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="min-width-btn px-4 py-2 text-white font-bold bg-primary rounded-full focus:outline-none hover:shadow-lg shadow-md transform-gpu transition"
                    >
                      Join the email list
                    </motion.button>
                  </a>
                </li>
                <span className="col-span-1 text-3xl font-bold">2.</span>
                <li className="flex col-span-2 items-center justify-center">
                  <a
                    href="https://calendar.google.com/calendar/u/0/render?cid=f64u131to44gn3tn8g62ov2u1s%40group.calendar.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="min-width-btn px-4 py-2 text-white font-bold bg-primary rounded-full focus:outline-none hover:shadow-lg shadow-md transform-gpu transition"
                    >
                      Add Google Calendar
                    </motion.button>
                  </a>
                </li>
                <span className="col-span-1 text-3xl font-bold lg:text-4xl">
                  3.
                </span>
                <li className="flex col-span-2 items-center justify-center">
                  <span className="relative text-2xl font-bold lg:text-4xl">
                    Keep in contact!
                    <svg
                      width="196"
                      height="60"
                      className="absolute -right-12 top-12 hidden lg:block"
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
                className="polka-background-subPage absolute -right-48 top-0 lg:-right-24"
              ></motion.div>
              <div className="relative grid gap-2 grid-cols-2 items-center place-items-center mx-auto my-8 p-4 w-5/6 max-w-md bg-secondary-200 rounded-2xl shadow-md md:flex md:flex-wrap md:gap-0 md:justify-around lg:px-6 lg:py-12 lg:w-3/4 xl:max-w-lg">
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
          </section>
          <div className="w-screen bg-gradient-to-r from-primary to-blue-800">
            <section className="container flex items-center justify-center mx-auto px-4 py-24 w-full md:px-0 lg:py-32">
              <div className="flex flex-wrap gap-4 items-center justify-center w-full lg:justify-around">
                <div className="relative flex flex-col items-center justify-center mb-8 p-4 w-full bg-secondary-200 rounded-2xl shadow-lg xl:w-1/2">
                  <svg
                    className="absolute -bottom-10 -left-10 w-32 lg:-left-20 lg:w-64"
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
                <div className="mx-auto">
                  <div className="mx-auto p-4">
                    <h2 className="my-4 text-white text-2xl font-bold lg:text-5xl">
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
                    <p className="max-w-lg text-white text-base leading-loose">
                      There are always a variety of different things to attend
                      including hackathons, talks, and coffee chats! We
                      typically host meetings on Mondays and Thursdays at 8pm.
                    </p>
                  </div>
                  <div className="mt-4 mx-auto p-6 bg-secondary-200 rounded-2xl shadow-lg md:p-8">
                    <h3 className="mb-2 font-bold lg:text-lg">
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
                                event.node.content.properties?.Tags
                                  ?.multi_select
                              }
                              time={
                                event.node.content.properties?.Time
                                  ?.rich_text[0]?.plain_text
                              }
                              id={event.node.content.id}
                              attendance={
                                event.node.content.properties?.Attendance
                                  ?.number
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
                </div>
              </div>
            </section>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
};

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

export default JoinPage;

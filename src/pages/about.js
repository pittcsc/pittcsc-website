import React, { useEffect } from "react";
import { officerList } from "../components/data";
import { initiativeLeadList } from "../components/data";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import FallReport from "../downloads/gbm-fall-2022.pdf";

import Layout from "../layouts/layout";
import TeamCard from "../components/TeamCard";
import { StaticImage } from "gatsby-plugin-image";

const AboutPage = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/about");
  }, []);

  return (
    <Layout title="About Us | Pitt Computer Science Club" header="about">
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
                About the Club
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
            <div className="flex flex-col items-center justify-center py-4 w-10/12 text-center lg:py-8 lg:text-left xl:w-3/4">
              <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
                <motion.div
                  initial={{
                    opacity: 0,
                    x: -100,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  transition={{
                    delay: 0.4,
                  }}
                  className="polka-background-subPage absolute -left-10 -top-10"
                ></motion.div>
                <div className="relative flex flex-col items-center justify-center my-4 p-8 w-5/6 h-32 bg-primary rounded-2xl shadow-md lg:my-2 lg:w-96 lg:h-48">
                  <span className="text-white text-6xl font-bold lg:text-8xl">
                    400+
                  </span>
                  <span className="text-white text-lg lg:text-xl">Members</span>
                </div>
                <div className="relative flex flex-col items-center justify-center my-4 p-8 w-5/6 h-32 bg-primary rounded-2xl shadow-md lg:my-2 lg:w-96 lg:h-48">
                  <span className="text-white text-6xl font-bold lg:text-8xl">
                    30+
                  </span>
                  <span className="text-white text-lg lg:text-xl">Events</span>
                </div>
              </div>
            </div>
          </section>
          <div className="w-screen bg-gradient-to-r from-primary to-blue-800">
            <section className="container relative flex flex-col items-center justify-center mx-auto py-24 w-full lg:py-32">
              <div className="flex flex-col items-center justify-center w-9/12 lg:flex-row lg:justify-around lg:w-full">
                <div className="mb-4 lg:mb-0">
                  <h2 className="my-4 max-w-xl text-white text-2xl font-bold lg:text-4xl xl:text-5xl">
                    Supporting Tech at Pitt
                    <svg
                      className="my-2 w-full"
                      viewBox="0 0 470 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M467 9.00001C323.851 9.00006 37.5532 -4.49999 3.00001 8.99995"
                        stroke="#FFB81C"
                        stroke-width="5"
                        stroke-linecap="round"
                      />
                    </svg>
                  </h2>
                  <p className="max-w-lg text-white text-base leading-loose">
                    The University of Pittsburgh Computer Science Club,
                    shortened as Pitt CSC, is the University of Pittsburgh's
                    largest and premier technology-related student organization.
                  </p>
                  <br />
                  <p className="max-w-lg text-white text-base leading-loose">
                    Open to all majors, we host a variety of events that help us
                    build a welcoming and inclusive community of motivated
                    students interested in fields such as computer science,
                    information science, digital design, and much more.
                  </p>
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    href={"#"} // FallReport
                    target="_blank"
                    className="inline-block my-4 px-4 py-2 min-w-min text-center text-black font-bold bg-white border-4 border-secondary-100 rounded-full focus:outline-none hover:shadow-lg shadow-md transition"
                  >
                    Initiatives - Fall 2023 (Coming Soon)
                  </motion.a>
                </div>
                <div className="relative flex flex-col items-center justify-center mt-4 w-full lg:mt-0 lg:w-1/2">
                  <svg
                    className="absolute z-10 -bottom-10 -left-10 w-32 md:w-48 lg:left-0"
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
                  <div className="w-full lg:w-9/12">
                    <StaticImage
                      src="../images/uber_csc_image.jpg"
                      alt="Club at Uber"
                      imgClassName="mx-auto w-full rounded-3xl shadow-lg"
                      placeholder="blurred"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
          <section className="container flex flex-col items-center justify-center mx-auto w-full">
            <h2 className="mb-8 mt-4 max-w-lg text-2xl font-bold lg:text-5xl">
              The Officers
            </h2>
            <div className="grid gap-24 2xl:gap-32 grid-cols-1 my-8 md:grid-cols-2 lg:grid-cols-3">
              {officerList.map(
                ({ name, title, linkedIn, email, image, bio }) => (
                  <TeamCard
                    image={image}
                    name={name}
                    title={title}
                    linkedIn={linkedIn}
                    email={email}
                    bio={bio}
                    key={email}
                  />
                )
              )}
            </div>
          </section>
          <section className="container flex flex-col items-center justify-center mx-auto w-full">
            <h2 className="mb-8 mt-4 max-w-lg text-2xl font-bold lg:text-5xl">
              The Initiative Leads
            </h2>
            <div className="grid gap-24 2xl:gap-32 grid-cols-1 my-8 md:grid-cols-2 lg:grid-cols-3">
              {initiativeLeadList.map(
                ({ name, title, linkedIn, email, image, bio }) => (
                  <TeamCard
                    image={image}
                    name={name}
                    title={title}
                    linkedIn={linkedIn}
                    email={email}
                    bio={bio}
                    key={email}
                  />
                )
              )}
            </div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default AboutPage;

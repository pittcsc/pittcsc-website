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
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-24 xl:my-24">
          <section className="container flex flex-col items-center justify-center mx-auto w-full">
            <div>
              <h1 className="relative z-10 mb-8 mt-4 w-full text-center text-4xl font-bold lg:text-6xl">
                Initiatives
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
            <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
              <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
                <a
                  href={"/initiatives/z2o"}
                  className="lg:w-100 relative flex flex-col items-center my-4 p-8 w-5/6 h-60 bg-primary border-4 border-yellow-400 rounded-2xl hover:shadow-2xl shadow-md lg:my-2 lg:h-96"
                >
                  <span className="text-white text-2xl font-bold lg:text-6xl lg:text-6xl">
                    Zero to Offer
                  </span>

                  <span>
                    <img
                      src={Z2O}
                      alt=""
                      class="m-4 mx-auto w-48 rounded-lg lg:w-5/6"
                    />
                  </span>
                </a>
              </div>
              <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
                <a
                  href="/initiatives/fireside-chats"
                  className="lg:w-100 relative flex flex-col items-center my-4 p-8 w-5/6 h-60 bg-primary border-4 border-yellow-400 rounded-2xl hover:shadow-2xl shadow-md lg:my-2 lg:h-96"
                >
                  <span className="text-white text-2xl font-bold lg:text-6xl lg:text-6xl">
                    Fireside Chats
                  </span>
                  <span>
                    <img
                      src={FSChat}
                      alt=""
                      class="m-4 mx-auto w-48 rounded-lg lg:w-5/6"
                    />
                  </span>
                </a>
              </div>
            </div>
            <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
              <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
                <a
                  href="/initiatives/social-events"
                  className="lg:w-100 relative flex flex-col items-center my-4 p-8 w-5/6 h-60 bg-primary border-4 border-yellow-400 rounded-2xl hover:shadow-2xl shadow-md lg:my-2 lg:h-96"
                >
                  <span className="text-white text-2xl font-bold lg:text-6xl lg:text-6xl">
                    Social Events
                  </span>
                  <span>
                    <img
                      src={SocEvent}
                      alt=""
                      class="m-4 mx-auto h-32 rounded-lg object-cover object-top lg:h-60"
                    />
                  </span>
                </a>
              </div>
              <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
                <a
                  href="https://steelhacks.com"
                  target="_blank"
                  className="lg:w-100 relative flex flex-col items-center my-4 p-8 w-5/6 h-60 bg-primary border-4 border-yellow-400 rounded-2xl hover:shadow-2xl shadow-md lg:my-2 lg:h-96"
                >
                  <span className="text-white text-2xl font-bold lg:text-6xl lg:text-6xl">
                    SteelHacks
                  </span>
                  <span>
                    <img
                      src={SH}
                      alt=""
                      class="m-4 mx-auto w-48 rounded-lg lg:w-5/6"
                    />
                  </span>
                </a>
              </div>
            </div>
            <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
              <div className="relative flex flex-col items-center justify-around w-full lg:flex-row">
                <a
                  href=""
                  className="lg:w-100 relative flex flex-col items-center my-4 p-8 w-5/6 h-60 bg-primary border-4 border-yellow-400 rounded-2xl shadow-md lg:my-2 lg:h-96"
                >
                  <span className="text-white text-2xl font-bold lg:text-6xl lg:text-6xl">
                    Consulting
                  </span>
                  <span>
                    <img
                      src={Consulting}
                      alt=""
                      class="m-4 mx-auto h-32 rounded-lg object-cover object-top lg:h-60"
                    />
                  </span>
                </a>
              </div>
              <div className="flex flex-col items-center justify-around w-full invisible lg:flex-row">
                <div className="lg:w-100 relative flex flex-col items-center my-4 p-8 w-5/6 h-60 bg-primary border-4 border-yellow-400 rounded-2xl hover:shadow-2xl shadow-md lg:my-2 lg:h-96">
                  <span className="text-white text-2xl font-bold lg:text-6xl lg:text-6xl"></span>
                  <span>
                    <img
                      src={SH}
                      alt=""
                      class="m-4 mx-auto w-48 rounded-lg lg:w-5/6"
                    />
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default InitiativePage;

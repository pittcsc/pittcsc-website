import React, { useEffect } from "react";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import SE1 from "../../images/initiatives/social_events/soc_event-1.png";
import SE2 from "../../images/initiatives/social_events/soc_event-2.png";
import SE3 from "../../images/initiatives/social_events/soc_event-3.png";
import SE4 from "../../images/initiatives/social_events/soc_event-4.png";
import SE5 from "../../images/initiatives/social_events/soc_event-5.png";
import SE6 from "../../images/initiatives/social_events/soc_event-6.JPG";
import { motion } from "framer-motion";
import { useState } from "react";
import Layout from "../../layouts/layout";

const SocialEventsPage = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/social-events");
  }, []);

  const [selectedImage, setSelectedImage] = useState(null);

  const images = [SE1, SE2, SE3, SE4, SE5, SE6];
  return (
    <Layout
      title="Social Events| Computer Science Club @ Pitt"
      header="Social Events"
    >
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-8 xl:my-4">
          <section className="items-left container flex flex-col justify-center mx-auto w-full">
            <div>
              <h1 className="relative z-10 mt-4 mx-auto w-full text-center text-4xl font-bold lg:text-6xl">
                Social Events
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
          </section>
          <section className="container relative flex flex-col items-center justify-center mx-auto w-full">
            <div className="flex flex-col w-9/12 h-auto lg:flex-row lg:justify-around lg:w-full">
              <div className="mb-4 my-4 p-8 h-3/4 text-white bg-primary rounded-2xl lg:mb-0">
                <p className="max-w-lg text-base leading-loose">
                  As the largest student organization at Pitt, community is
                  important to us. We run several social/community focused
                  events to help strengthen this.
                </p>
              </div>
              <div className="relative flex flex-col items-center justify-center mt-4 w-full lg:mt-0 lg:w-1/2">
                <div className="container mx-auto p-4">
                  {/* Gallery Grid */}
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
                    {images.map((src, index) => (
                      <img
                        key={index}
                        src={src}
                        alt={`Gallery image ${index + 1}`}
                        className="object-toprounded-lg w-full h-48 rounded-lg shadow-lg cursor-pointer object-cover hover:scale-105 transition-transform duration-300"
                        onClick={() => setSelectedImage(src)}
                      />
                    ))}
                  </div>

                  {/* Modal for Enlarged Image */}
                  {selectedImage && (
                    <div
                      className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-black bg-opacity-75"
                      onClick={() => setSelectedImage(null)}
                    >
                      <img
                        src={selectedImage}
                        alt="Enlarged"
                        className="w-auto rounded-lg shadow-lg sm:h-1/4 lg:h-3/4"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div></div>
        </div>
      </motion.div>
    </Layout>
  );
};

export default SocialEventsPage;

import React, { useEffect, useState } from "react";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import Layout from "../../layouts/layout";
import SE1 from "../../images/initiatives/social_events/soc_event-1.png";
import SE2 from "../../images/initiatives/social_events/soc_event-2.png";
import SE3 from "../../images/initiatives/social_events/soc_event-3.png";
import SE4 from "../../images/initiatives/social_events/soc_event-4.png";
import SE5 from "../../images/initiatives/social_events/soc_event-5.png";

const SocialEventsPage = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/social-events");
  }, []);

  const [selectedImage, setSelectedImage] = useState(null);
  const images = [SE1, SE2, SE3, SE4, SE5];

  return (
    <Layout
      title="Social Events | Computer Science Club @ Pitt"
      header="Social Events"
    >
      <motion.div
        className="overflow-hidden relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-16 xl:my-24">
          <section className="container relative z-10 mx-auto px-4 w-full md:px-0 lg:w-8/12">
            {/* Hero Section */}
            <div className="flex flex-col items-center justify-center mb-12">
              <h1 className="relative z-10 mb-4 text-center text-4xl font-bold lg:text-6xl">
                Social Events
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

            {/* Content Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 lg:p-12 shadow-sm border border-gray-100 mb-16 text-center relative z-10">
              <p className="text-lg leading-relaxed text-gray-700 max-w-3xl mx-auto">
                As the largest student organization at Pitt, community is
                important to us. We run several social/community focused
                events to help strengthen this. From game nights to outings,
                we're building a tight-knit community where you can find friends
                who share your passions.
              </p>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {images.map((src, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-xl overflow-hidden shadow-lg h-64 bg-gray-100 cursor-pointer"
                  onClick={() => setSelectedImage(src)}
                >
                  <img
                    src={src}
                    alt={`Social Event Gallery ${index + 1}`}
                    className="w-full h-full object-cover object-top hover:opacity-90 transition-opacity duration-300"
                  />
                </motion.div>
              ))}
            </div>

            {/* Modal */}
            {selectedImage && (
              <div
                className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                onClick={() => setSelectedImage(null)}
              >
                <img
                  src={selectedImage}
                  alt="Enlarged view"
                  className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                />
              </div>
            )}

            {/* Polka Dot Patterns */}
            <div className="polka-background absolute top-0 -left-20 z-0 opacity-30 hidden lg:block"></div>
            <div className="polka-background absolute bottom-0 -right-20 z-0 opacity-30 hidden lg:block" style={{ transform: 'rotate(180deg)' }}></div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default SocialEventsPage;

import React, { useEffect, useState } from "react";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import Layout from "../../layouts/layout";
import FSC1 from "../../images/initiatives/fireside_chats/fschat.jpg";
import FSC2 from "../../images/initiatives/fireside_chats/fs_chat-jeff.jpg";
import FSC3 from "../../images/initiatives/fireside_chats/fs_chat-varun.jpg";
import FSC4 from "../../images/initiatives/fireside_chats/fs_chat-audience.jpg";

const FiresideChatsPage = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/fireside-chats");
  }, []);

  const [selectedImage, setSelectedImage] = useState(null);
  const images = [FSC1, FSC2, FSC3, FSC4];

  return (
    <Layout
      title="Fireside Chats | Computer Science Club @ Pitt"
      header="Fireside Chats"
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
                Fireside Chats
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
                In the Fall Semester of 2024, we started our new "Fireside
                Chats" Initiative, where we fly out prominent alumni and tech
                personalities for a public chat/interview with our club
                president. So far, we've hosted{" "}
                <a
                  href="https://www.tiktok.com/@varun_rana_?lang=en"
                  className="text-primary font-bold hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Varun Rana
                </a>{" "}
                and{" "}
                <a
                  href="https://www.linkedin.com/in/jvngyn/"
                  className="text-primary font-bold hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Jeff Nguyen
                </a>
                . Much more to come!
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
                    alt={`Fireside Chat Gallery ${index + 1}`}
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

export default FiresideChatsPage;

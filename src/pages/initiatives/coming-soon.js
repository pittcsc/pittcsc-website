import React, { useEffect } from "react";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import Layout from "../../layouts/layout";

const ComingSoonPage = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/initiatives/coming-soon");
  }, []);

  return (
    <Layout
      title="Coming Soon | Computer Science Club @ Pitt"
      header="Coming Soon"
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
                Coming Soon
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
                This initiative page is currently under development. Check back soon for more information!
              </p>
            </div>

            {/* Polka Dot Patterns */}
            <div className="polka-background absolute top-0 -left-20 z-0 opacity-30 hidden lg:block"></div>
            <div className="polka-background absolute bottom-0 -right-20 z-0 opacity-30 hidden lg:block" style={{ transform: 'rotate(180deg)' }}></div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default ComingSoonPage;


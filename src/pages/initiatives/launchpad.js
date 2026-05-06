import React, { useEffect } from "react";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import Layout from "../../layouts/layout";

const LaunchpadPage = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/launchpad");
  }, []);

  return (
    <Layout
      title="Launchpad | Computer Science Club @ Pitt"
      header="Launchpad"
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
                Launchpad
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
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 lg:p-12 shadow-sm border border-gray-100 mb-16 relative z-10">
              <div className="space-y-8">
                {/* Introduction */}
                <div>
                  <h2 className="text-3xl font-bold text-primary mb-4">
                    What is Launchpad?
                  </h2>
                  <p className="text-lg leading-relaxed text-gray-700">
                    Launchpad is our innovative initiative designed to help students launch their ideas and projects.
                    Whether you're passionate about building a startup, creating open-source software, or developing
                    solutions to real-world problems, Launchpad provides the resources, mentorship, and community
                    support you need to turn your vision into reality.
                  </p>
                </div>

                {/* What We Offer */}
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-6">What We Offer</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-yellow-50 to-white p-6 rounded-xl border-2 border-yellow-400">
                      <h4 className="text-xl font-bold text-primary mb-3 flex items-center">
                        <span className="mr-2">🚀</span>
                        Project Mentorship
                      </h4>
                      <p className="text-gray-700">
                        Connect with experienced mentors who guide you through the entire development lifecycle,
                        from ideation to deployment.
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-white p-6 rounded-xl border-2 border-yellow-400">
                      <h4 className="text-xl font-bold text-primary mb-3 flex items-center">
                        <span className="mr-2">💡</span>
                        Technical Workshops
                      </h4>
                      <p className="text-gray-700">
                        Hands-on workshops covering modern tech stacks, cloud deployment, agile methodologies,
                        and best practices in software development.
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-white p-6 rounded-xl border-2 border-yellow-400">
                      <h4 className="text-xl font-bold text-primary mb-3 flex items-center">
                        <span className="mr-2">🤝</span>
                        Team Formation
                      </h4>
                      <p className="text-gray-700">
                        Find like-minded teammates with complementary skills or join existing projects
                        that align with your interests and goals.
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-white p-6 rounded-xl border-2 border-yellow-400">
                      <h4 className="text-xl font-bold text-primary mb-3 flex items-center">
                        <span className="mr-2">🎯</span>
                        Demo Days
                      </h4>
                      <p className="text-gray-700">
                        Showcase your projects to the CSC community, potential investors, and industry professionals
                        during our quarterly demo days.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Who Should Join */}
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-6">Who Should Join?</h3>
                  <div className="bg-gradient-to-r from-primary/5 to-yellow-50 p-6 rounded-xl border-l-4 border-yellow-400">
                    <ul className="space-y-3">
                      <li className="flex items-start space-x-3">
                        <span className="text-yellow-400 font-bold text-xl">✓</span>
                        <span className="text-gray-700">
                          <strong>Aspiring Entrepreneurs</strong> looking to build the next big startup
                        </span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <span className="text-yellow-400 font-bold text-xl">✓</span>
                        <span className="text-gray-700">
                          <strong>Open Source Enthusiasts</strong> wanting to contribute to meaningful projects
                        </span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <span className="text-yellow-400 font-bold text-xl">✓</span>
                        <span className="text-gray-700">
                          <strong>Developers</strong> seeking to build their portfolio with real-world projects
                        </span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <span className="text-yellow-400 font-bold text-xl">✓</span>
                        <span className="text-gray-700">
                          <strong>Anyone</strong> with an idea they're passionate about turning into reality
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Program Structure */}
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-6">Program Structure</h3>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-4 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-yellow-400 transition-colors duration-300">
                      <div className="flex-shrink-0 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                        1
                      </div>
                      <div>
                        <h4 className="font-bold text-primary mb-1">Kickoff & Ideation</h4>
                        <p className="text-gray-700">
                          Pitch your idea or find a team. We help you refine your concept and define clear objectives.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-yellow-400 transition-colors duration-300">
                      <div className="flex-shrink-0 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                        2
                      </div>
                      <div>
                        <h4 className="font-bold text-primary mb-1">Development Sprint</h4>
                        <p className="text-gray-700">
                          Work on your project with regular check-ins, technical support, and access to workshops.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-yellow-400 transition-colors duration-300">
                      <div className="flex-shrink-0 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                        3
                      </div>
                      <div>
                        <h4 className="font-bold text-primary mb-1">Demo Day Presentation</h4>
                        <p className="text-gray-700">
                          Present your finished project to the community and receive valuable feedback from peers and professionals.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="bg-gradient-to-r from-primary to-primary/90 rounded-2xl p-8 text-center text-white">
                  <h3 className="text-2xl font-bold mb-4">Ready to Launch Your Idea?</h3>
                  <p className="text-lg mb-6 text-gray-100">
                    Join Launchpad and turn your vision into reality with the support of the CSC community.
                  </p>
                  <a
                    href="https://discord.gg/pittcsc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-8 py-3 bg-yellow-400 text-primary font-bold rounded-full hover:bg-yellow-300 transition-colors duration-300 shadow-lg hover:shadow-xl"
                  >
                    Get Started on Discord
                  </a>
                </div>
              </div>
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

export default LaunchpadPage;

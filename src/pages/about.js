import React from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faGithub,
  faLinkedin,
  faSlack,
} from "@fortawesome/free-brands-svg-icons";

import { motion } from "framer-motion";

import Header from "../components/Header";
import Footer from "../components/Footer";

const AboutPage = () => (
  <div className="overflow-hidden">
    <Header />
    <main className="space-y-24 min-h-screen my-8 mt-24 xl:my-24">
      <section className="container mx-auto flex w-full flex-col justify-center items-center">
        <div>
          <h2 className="text-4xl lg:text-6xl font-bold font-body mb-8 mt-4 w-full z-10 relative text-center">
            About Us
            <svg
              className="relative z-10 w-64 lg:w-full"
              viewBox="0 0 422 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                stroke="#FFB81C"
                stroke-width="5"
                stroke-linecap="round"
              />
            </svg>
          </h2>
        </div>
        <div className="w-10/12 flex flex-col justify-center items-center xl:w-3/4">
          <h3 className="text-2xl font-semibold font-body lg:justify-self-start lg:mr-auto">
            Supporting the Pitt CS Community
          </h3>
          <div className="w-full flex flex-col justify-between items-center lg:flex-row">
            <div className="w-96 h-32 lg:h-48 p-8 rounded-2xl my-4 bg-primary flex justify-center items-center shadow-md lg:my-2">
              <span className="text-white text-8xl font-body font-bold">
                48%
              </span>
            </div>
            <div className="w-96 h-32 lg:h-48 p-8 my-4 rounded-2xl bg-primary flex justify-center items-center shadow-md lg:my-2">
              <span className="text-white text-8xl font-body font-bold">
                48%
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </div>
);

export default AboutPage;

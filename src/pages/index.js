import React from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faGithub,
  faLinkedin,
  faSlack,
} from "@fortawesome/free-brands-svg-icons";

import Header from "../components/Header";
import Footer from "../components/Footer";
import heroImage from "../images/hero-img2-cropped.png";
import MaskImage from "../images/Pitt_CSC_Mask.jpg";

const IndexPage = () => (
  <div className="overflow-hidden">
    <Header />
    <main className="space-y-24 min-h-screen my-8 xl:my-24">
      <section className="container mx-auto flex w-full flex-col xl:flex-row justify-center items-center px-8 xl:px-0">
        <div className="xl:w-1/2 break-normal relative">
          <p className="font-light text-lg font-body z-10 relative">
            2020-2021 SCHOOL YEAR
          </p>
          <h2 className="text-4xl lg:text-8xl font-bold font-body mt-4 w-full z-10 relative">
            Pitt Computer <br /> Science Club
          </h2>
          <svg
            className="relative z-10 mb-8 w-64 lg:w-5/6"
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
          <h3 className="font-body w-3/4 xl:w-3/4 lg:text-lg z-10 relative ">
            The University of Pittsburgh's largest CS-related student
            organization. Proudly pushing the boundaries on what it means to be
            a Pitt student.
          </h3>
          <div className="py-4 space-x-4 xl:space-x-8 z-10 relative">
            <button className="bg-primary font-body transition text-white font-bold py-2 px-4 rounded-full min-w-300 shadow-md hover:shadow-lg">
              Join the Club
            </button>
            <button className="border-4 font-body transition border-primary font-bold py-2 px-4 rounded-full min-w-300 shadow-md hover:shadow-lg">
              What We Do
            </button>
          </div>
          <div className="w-40 h-40 xl:w-80 xl:h-80 absolute bg-secondary-200 rounded-2xl top-0 -left-20 z-0 transform -rotate-12"></div>
        </div>
        <div className="w-full xl:w-1/2 relative flex justify-center items-center flex-col">
          <img
            className="w-3/4 xl:w-9/12 z-20 mx-auto relative"
            src={heroImage}
            alt="pitt_csc_logo"
          />
          <div className="polka-background absolute z-10 -top-10 -right-10"></div>
        </div>
      </section>
      <div className="w-screen bg-gradient-to-r from-primary to-blue-800">
        <section className="container mx-auto flex w-full flex-col lg:flex-row justify-center items-center py-24 lg:py-32">
          <div className="w-full lg:w-1/2 text-center my-4 xl:my-0 relative">
            <svg
              className="w-32 absolute -top-10 right-0 md:w-64 md:-top-20"
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
            <img
              src={MaskImage}
              alt="Members_with_masks"
              className="w-3/4 xl:w-9/12 rounded-3xl mx-auto shadow-lg"
            />
          </div>
          <div className="w-full lg:w-1/2">
            <div className="w-3/4 xl:w-full bg-secondary-200 rounded-3xl p-8 xl:py-12 xl:px-8 max-w-lg my-4 xl:my-0 shadow-lg mx-auto">
              <h3 className="font-bold text-2xl xl:text-4xl font-body my-4">
                Our Mission
              </h3>
              <p className="font-body xl:text-md">
                To grow and strengthen the student developer community here at
                the University of Pittsburgh.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="container mx-auto flex w-full flex-col lg:flex-row justify-center items-center py-16">
        <div className="w-full my-4 lg:my-0 lg:w-1/2 text-center relative">
          <h3 className="font-bold text-2xl lg:text-3xl xl:text-4xl font-body">
            Hit us up while you're here
          </h3>
          <svg
            className="mx-auto w-80 lg:w-4/6"
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
        </div>
        <div className="w-full my-4 lg:my-0 lg:w-1/2">
          <div className="w-3/4 h-32 lg:h-48 p-8 rounded-2xl bg-secondary-200 mx-auto flex justify-around items-center shadow-md">
            <a
              href="https://github.com/pittcsc"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon
                icon={faGithub}
                className="text-primary text-6xl lg:text-7xl xl:text-8xl"
              />
            </a>
            <a
              href="https://www.linkedin.com/company/pittcsc/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon
                icon={faLinkedin}
                className="text-primary text-6xl lg:text-7xl xl:text-8xl"
              />
            </a>
            <a
              href="http://pittcsc.slack.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon
                icon={faSlack}
                className="text-primary text-6xl lg:text-7xl xl:text-8xl"
              />
            </a>
          </div>
        </div>
      </section>
      <section className="w-screen bg-gradient-to-r from-primary to-blue-800">
        <div className="w-full h-64 mx-auto whitespace-nowwrap overflow-hidden flex flex-col justify-center items-center">
          <h3 className="font-bold font-body text-white text-4xl my-4">
            Members
          </h3>
          <div className="track font-body text-2xl text-white my-4">
            Zhengming Wang - Olivia Wininsky - Gordon Lu - Janet Majekodunmi -
            Richie Goulazian - Ryan Yang - Justin Kramer - Ashley Sokol - Alex
            Zharichenko - Mat Varughese
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </div>
);

export default IndexPage;

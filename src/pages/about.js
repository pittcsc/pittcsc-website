import React, { useEffect, useState } from "react";

import groupImage from "../images/uber_csc_image.jpg";
import ming from "../images/officers/ming.jpg";
import olivia from "../images/officers/olivia.png";
import gordon from "../images/officers/gordon.jpg";
import janet from "../images/officers/janet.jpeg";
import richie from "../images/officers/richie.jpg";
import ryan from "../images/officers/ryan.jpg";
import justin from "../images/officers/justin.jpg";
import courtney from "../images/officers/courtney.jpg";
import jamir from "../images/officers/jamir.jpg";
import dylan from "../images/officers/dylan.jpg";
import alexander from "../images/officers/Alexander_Grattan_Picture.jpg";

import { motion } from "framer-motion";

import SwiperCore, { Navigation, Pagination, A11y, Mousewheel } from "swiper";

import { Swiper, SwiperSlide } from "swiper/react";

import Layout from "../layouts/layout";

// import {
//   faGithub,
//   faLinkedin,
//   faSlack,
// } from "@fortawesome/free-brands-svg-icons";

// import { motion } from "framer-motion";

import TeamCard from "../components/TeamCard";

SwiperCore.use([Navigation, Pagination, Mousewheel, A11y]);

const AboutPage = () => {
  const [swiperNum, setSwiperNum] = useState(1);

  useEffect(() => {
    let swiperQuery = window.matchMedia("(min-width: 768px)");

    if (swiperQuery.matches) {
      setSwiperNum(3);
    }
  }, []);

  return (
    <Layout title="About Us | Pitt Computer Science Club">
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="space-y-24 min-h-screen my-8 mt-24 xl:my-24">
          <section className="container mx-auto flex w-full flex-col justify-center items-center">
            <div>
              <h1 className="text-4xl lg:text-6xl font-bold font-body mb-8 mt-4 w-full z-10 relative text-center">
                About the Club
                <svg
                  className="relative z-10 w-64 lg:w-full svg-underline"
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
            <div className="w-10/12 flex flex-col justify-center items-center xl:w-3/4 py-4 text-center lg:text-left lg:py-8">
              <div className="w-full flex flex-col justify-around items-center lg:flex-row relative">
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
                  className="polka-background-subPage absolute -top-10 -left-10"
                ></motion.div>
                <div className="w-5/6 lg:w-96 h-32 lg:h-48 p-8 relative rounded-2xl my-4 bg-primary flex flex-col justify-center items-center shadow-md lg:my-2">
                  <span className="text-white font-body text-6xl lg:text-8xl font-bold">
                    214
                  </span>
                  <span className="text-white font-body text-lg lg:text-xl">
                    Members
                  </span>
                </div>
                <div className="w-5/6 lg:w-96 h-32 lg:h-48 p-8 relative rounded-2xl my-4 bg-primary flex flex-col justify-center items-center shadow-md lg:my-2">
                  <span className="text-white text-6xl lg:text-8xl font-body font-bold">
                    30+
                  </span>
                  <span className="text-white font-body text-lg lg:text-xl">
                    Events
                  </span>
                </div>
              </div>
            </div>
          </section>
          <div className="w-screen bg-gradient-to-r from-primary to-blue-800">
            <section className="container relative mx-auto w-full flex flex-col justify-center items-center py-24 lg:py-32">
              <div className="w-9/12  lg:w-full flex flex-col lg:flex-row justify-center lg:justify-around items-center">
                <div className="mb-4 lg:mb-0">
                  <h2 className="text-2xl lg:text-5xl max-w-lg font-bold font-body text-white my-4">
                    Supporting CS at Pitt
                    <svg
                      className="w-full my-2"
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
                  <p className="font-body text-white text-base max-w-lg leading-loose">
                    The University of Pittsburgh Computer Science Club,
                    shortened as Pitt CSC, is the University of Pittsburgh's
                    largest and premier computer science student organization.
                    Open to all majors, we host a variety of events that help us
                    build a welcoming and inclusive community of motivated
                    students interested in computer science at Pitt.
                  </p>
                </div>
                <div className="w-full lg:w-1/2 mt-4 lg:mt-0 flex flex-col justify-center items-center font-body relative">
                  <svg
                    className="w-32 absolute -bottom-10 -left-10 lg:left-0 md:w-48"
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
                    className="w-full lg:w-9/12 rounded-3xl mx-auto shadow-lg"
                    src={groupImage}
                    alt="Club at Uber"
                  />
                </div>
              </div>
            </section>
          </div>
          <section className="container mx-auto flex w-full flex-col justify-center items-center">
            <h2 className="text-2xl lg:text-5xl max-w-lg font-bold font-body mt-4 mb-8">
              The Officers
            </h2>
            <div className="grid gap-24 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 my-8">
              <TeamCard
                image={ming}
                name="Zhengming Wang"
                title="President"
                linkedIn="https://www.linkedin.com/in/zhengmingwang/"
                email="zhw78@pitt.edu"
              />
              <TeamCard
                image={olivia}
                name="Olivia Wininsky"
                title="Vice President"
                linkedIn="https://www.linkedin.com/in/oliviawininsky/"
                email="onw5@pitt.edu"
              />
              <TeamCard
                image={gordon}
                name="Gordon Lu"
                title="Business Manager"
                linkedIn="https://www.linkedin.com/in/gordon-lu-aa1008152/"
                email="gol6@pitt.edu"
              />
              <TeamCard
                image={janet}
                name="Janet Majekodunmi"
                title="PR Manager"
                linkedIn="https://www.linkedin.com/in/janet-majekodunmi-5a8474190/"
                email="jam580@pitt.edu"
              />
              <TeamCard
                image={justin}
                name="Justin Kramer"
                title="Internal Affairs Coordinator"
                linkedIn="https://www.linkedin.com/in/kjustin2/"
                email="jpk91@pitt.edu"
              />
              <TeamCard
                image={richie}
                name="Richie Goulazian"
                title="Director of Initiatives"
                linkedIn="https://www.linkedin.com/in/rgoulazian/"
                email="rhg13@pitt.edu"
              />
              <TeamCard
                image={ryan}
                name="Ryan Yang"
                title="Event Coordinator"
                linkedIn="https://www.linkedin.com/in/ruzakiff/"
                email="rcy7@pitt.edu"
              />
              <TeamCard
                image={courtney}
                name="Courtney Sheridan"
                title="Outreach Director"
                linkedIn="https://www.linkedin.com/in/courtneyrsheridan/"
                email="crs173@pitt.edu"
              />
              <TeamCard
                image={jamir}
                name="Jamir Grier"
                title="Initiative Lead"
                linkedIn="https://www.linkedin.com/in/jamir-grier-594518182/"
                email="jlg21@pitt.edu"
              />
              <TeamCard
                image={dylan}
                name="Dylan Feehan"
                title="Director of Partnerships"
                linkedIn="https://www.linkedin.com/in/dylan-feehan/"
                email="djf92@pitt.edu"
              />
              <TeamCard
                image={alexander}
                name="Alexander Grattan"
                title="Software Developer"
                linkedIn="https://www.linkedin.com/in/alexander-grattan-11a187149/"
                email="ajg162@pitt.edu"
              />
            </div>
            {/* <Swiper
              slidesPerView={swiperNum}
              navigation
              pagination={{ clickable: true }}
              mousewheel
            >
              <SwiperSlide>
                <TeamCard
                  image={ming}
                  name="Zhengming Wang"
                  title="President"
                  linkedIn="https://www.linkedin.com/in/zhengmingwang/"
                  email="zhw78@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={olivia}
                  name="Olivia Wininsky"
                  title="Vice President"
                  linkedIn="https://www.linkedin.com/in/oliviawininsky/"
                  email="onw5@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={gordon}
                  name="Gordon Lu"
                  title="Business Manager"
                  linkedIn="https://www.linkedin.com/in/gordon-lu-aa1008152/"
                  email="gol6@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={janet}
                  name="Janet Majekodunmi"
                  title="PR Manager"
                  linkedIn="https://www.linkedin.com/in/janet-majekodunmi-5a8474190/"
                  email="jam580@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={justin}
                  name="Justin Kramer"
                  title="Internal Affairs Coordinator"
                  linkedIn="https://www.linkedin.com/in/kjustin2/"
                  email="jpk91@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={richie}
                  name="Richie Goulazian"
                  title="Director of Initiatives"
                  linkedIn="https://www.linkedin.com/in/rgoulazian/"
                  email="rhg13@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={ryan}
                  name="Ryan Yang"
                  title="Event Coordinator"
                  linkedIn="https://www.linkedin.com/in/ruzakiff/"
                  email="rcy7@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={courtney}
                  name="Courtney Sheridan"
                  title="Outreach Director"
                  linkedIn="https://www.linkedin.com/in/courtneyrsheridan/"
                  email="crs173@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={jamir}
                  name="Jamir Grier"
                  title="Initiative Lead"
                  linkedIn="https://www.linkedin.com/in/jamir-grier-594518182/"
                  email="jlg21@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={dylan}
                  name="Dylan Feehan"
                  title="Director of Partnerships"
                  linkedIn="https://www.linkedin.com/in/dylan-feehan/"
                  email="djf92@pitt.edu"
                />
              </SwiperSlide>
              <SwiperSlide>
                <TeamCard
                  image={alexander}
                  name="Alexander Grattan"
                  title="Software Developer"
                  linkedIn="https://www.linkedin.com/in/alexander-grattan-11a187149/"
                  email="ajg162@pitt.edu"
                />
              </SwiperSlide>
            </Swiper> */}
          </section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default AboutPage;

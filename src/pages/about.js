import React, { useEffect, useState } from "react";

import groupImage from "../images/uber_csc_image.jpg";
import ming from "../images/officers/ming.jpg";
import olivia from "../images/officers/olivia.png";
import gordon from "../images/officers/gordon.jpg";
import janet from "../images/officers/janet.jpeg";
import richie from "../images/officers/richie.jpg";
import ryan from "../images/officers/ryan.jpg";
import justin from "../images/officers/justin.jpg";
import alexander from "../images/officers/Alexander_Grattan_Picture.jpg";

import { motion } from "framer-motion";

import SwiperCore, { Navigation, Pagination, Scrollbar, A11y } from "swiper";

import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/swiper.scss";
import "swiper/components/navigation/navigation.scss";
import "swiper/components/pagination/pagination.scss";
import "swiper/components/scrollbar/scrollbar.scss";

// import {
//   faGithub,
//   faLinkedin,
//   faSlack,
// } from "@fortawesome/free-brands-svg-icons";

// import { motion } from "framer-motion";

import Header from "../components/Header";
import Footer from "../components/Footer";
import TeamCard from "../components/TeamCard";

const AboutPage = () => {
  SwiperCore.use([Navigation, Pagination, Scrollbar, A11y]);

  const [swiperNum, setSwiperNum] = useState(1);

  useEffect(() => {
    let swiperQuery = window.matchMedia("(min-width: 768px)");

    if (swiperQuery.matches) {
      setSwiperNum(3);
    }
  }, []);

  return (
    <motion.div
      className="overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Header />
      <main className="space-y-24 min-h-screen my-8 mt-24 xl:my-24">
        <section className="container mx-auto flex w-full flex-col justify-center items-center">
          <div>
            <h2 className="text-4xl lg:text-6xl font-bold font-body mb-8 mt-4 w-full z-10 relative text-center">
              About the Club
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
          <div className="w-10/12 flex flex-col justify-center items-center xl:w-3/4 py-4 text-center lg:text-left lg:py-8">
            <div className="w-full flex flex-col justify-around items-center lg:flex-row relative">
              <div className="polka-background-subPage absolute -top-10 -left-10"></div>
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
                <h3 className="text-2xl lg:text-5xl max-w-lg font-bold font-body text-white my-4">
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
                </h3>
                <p className="font-body text-white text-base max-w-lg leading-loose">
                  The University of Pittsburgh Computer Science Club, shortened
                  as Pitt CSC, is the University of Pittsburgh's largest and
                  premier computer science student organization. Open to all
                  majors, we host a variety of events that help us build a
                  welcoming and inclusive community of motivated students
                  interested in computer science at Pitt.
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
          <h3 className="text-2xl lg:text-5xl max-w-lg font-bold font-body mt-4 mb-8">
            The Officers
          </h3>
          {/* <div className="grid gap-16 grid-cols-4 my-8">
            <TeamCard image={ming} name="Zhengming Wang" title="President" />
            <TeamCard
              image={olivia}
              name="Olivia Wininsky"
              title="Vice President"
            />
            <TeamCard
              image={gordon}
              name="Gordon Lu"
              title="Business Manager"
            />
            <TeamCard
              image={janet}
              name="Janet Majekodunmi"
              title="PR Manager"
            />
            <TeamCard
              image={justin}
              name="Justin Kramer"
              title="Internal Affairs Coordinator"
            />
            <TeamCard
              image={richie}
              name="Richie Goulazian"
              title="Director of Initiatives"
            />
            <TeamCard image={ryan} name="Ryan Yang" title="Event Coordinator" />
            <TeamCard
              image={ming}
              name="Courtney Sheridan"
              title="Outreach Director"
            />
            <TeamCard image={ming} name="Jamir Grier" title="Initiative Lead" />
            <TeamCard
              image={ming}
              name="Dylan Feehan"
              title="Director of Partnerships"
            />
            <TeamCard
              image={ming}
              name="Alexander Grattan"
              title="Software Engineer"
            />
          </div> */}
          <Swiper
            className="w-full lg:w-10/12 h-96"
            navigation
            pagination={{ clickable: true }}
            slidesPerView={swiperNum}
            onSwiper={(swiper) => console.log(swiper)}
            onSlideChange={() => console.log("slide change")}
          >
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard image={ming} name="Zhengming Wang" title="President" />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={olivia}
                name="Olivia Wininsky"
                title="Vice President"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={gordon}
                name="Gordon Lu"
                title="Business Manager"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={janet}
                name="Janet Majekodunmi"
                title="PR Manager"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={justin}
                name="Justin Kramer"
                title="Internal Affairs Coordinator"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={richie}
                name="Richie Goulazian"
                title="Director of Initiatives"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={ryan}
                name="Ryan Yang"
                title="Event Coordinator"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={ming}
                name="Courtney Sheridan"
                title="Outreach Director"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={ming}
                name="Jamir Grier"
                title="Initiative Lead"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={ming}
                name="Dylan Feehan"
                title="Director of Partnerships"
              />
            </SwiperSlide>
            <SwiperSlide className="flex justify-center items-center">
              <TeamCard
                image={alexander}
                name="Alexander Grattan"
                title="Software Engineer"
              />
            </SwiperSlide>
          </Swiper>
        </section>
      </main>
      <Footer />
    </motion.div>
  );
};

export default AboutPage;

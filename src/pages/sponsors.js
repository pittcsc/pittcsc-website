import React, { useEffect } from "react";

import SCM from "../images/sponsors/SCM_Logo.svg";
import FAST from "../images/sponsors/FAST_logo.png";
import NNL from "../images/sponsors/naval_nuclear_lab.jpeg";
import BNY from "../images/sponsors/BNY_logo_2024.svg";
import ROBLOX from "../images/sponsors/roblox_logo.png";
import CGI from "../images/sponsors/CGI_logo.svg";
import AEROTECH from "../images/sponsors/aerotech_logo.png";
import WESCO from "../images/sponsors/wesco_logo.png";

import SpringReportImage from "../images/hero_image.png";

import { motion } from "framer-motion";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faArrowRight, faFilePdf } from "@fortawesome/free-solid-svg-icons";

import Layout from "../layouts/layout";
import {
  CLUB_POSITIONING,
  CLUB_STATS,
  SPONSORSHIP_DATA,
} from "../lib/site/stats.mjs";
import { PAGE_SEO } from "../lib/site/seo.mjs";

// Sponsorship package PDF lives in /static, so it is served from the site root.
const SPONSORSHIP_PDF = SPONSORSHIP_DATA.pdfPath;

const imageContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0 },
};

// imgClass sets a fixed height per logo so perceived visual weight is equal.
// Wide flat logos (BNY, Roblox) need more height; square logos (CGI) need less.
const SPONSOR_VISUALS = {
  BNY: { src: BNY, imgClass: "h-10" },
  CGI: { src: CGI, imgClass: "h-9" },
  Roblox: { src: ROBLOX, imgClass: "h-10" },
  "Naval Nuclear Lab": { src: NNL, imgClass: "h-16" },
  "Stevens Capital Management": { src: SCM, imgClass: "h-20" },
  Aerotech: { src: AEROTECH, imgClass: "h-24" },
  "FAST Enterprises": { src: FAST, imgClass: "h-12" },
  Wesco: { src: WESCO, imgClass: "h-16" },
};

const sponsors = SPONSORSHIP_DATA.sponsors.map((sponsor) => ({
  ...sponsor,
  ...SPONSOR_VISUALS[sponsor.name],
}));

// "At a Glance" stats pulled from the shared stats module (see TODO in src/lib/site/stats.mjs).
// accent alternates blue / yellow to echo the printed one-pager.
const stats = [
  { value: CLUB_STATS.members.value, label: "active members", accent: "blue" },
  { value: "Largest", label: "student org at Pitt & partner of the School of Computing and Information", accent: "yellow" },
  { value: CLUB_STATS.social.totalReelViews, label: "total views on reels", accent: "yellow" },
  { value: CLUB_STATS.eventsPerYear.sponsors, label: "events / year, including workshops, site visits & socials", accent: "blue" },
  { value: CLUB_STATS.social.followers, label: "followers across social platforms", accent: "blue" },
  { value: CLUB_STATS.social.averageVideoViews, label: "average views per video", accent: "yellow" },
];

// Sponsorship tiers, named after computing pioneers, from the shared module.
const tiers = SPONSORSHIP_DATA.tiers;

// Instagram / social add-ons, purchasable on top of any tier.
const addOns = SPONSORSHIP_DATA.addOns;

const SponsorPage = ({ data }) => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/sponsors");
  }, []);

  return (
    <Layout
      title={PAGE_SEO.sponsors.title}
      description={PAGE_SEO.sponsors.description}
      header="sponsors"
    >
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-16 lg:space-y-24 xl:my-24">
          {/* ---------- At a Glance ---------- */}
          <section className="max-w-6xl mx-auto px-4 w-full">
            <div className="flex flex-col items-center mb-12">
              <h2 className="relative z-10 text-center text-3xl font-bold lg:text-6xl">
                CSC at a Glance
                <svg
                  className="svg-underline my-2 w-full"
                  viewBox="0 0 470 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M467 9.00001C323.851 9.00006 37.5532 -4.49999 3.00001 8.99995" />
                </svg>
              </h2>
              <p className="mt-4 max-w-2xl text-center text-slate-600 leading-relaxed">
                {`As ${CLUB_POSITIONING.largestOrgClaim} and a partner of the ${CLUB_POSITIONING.schoolPartnerName}, Pitt CSC gives partners direct access to a deep, engaged pipeline of computer science talent — on campus and online.`}
              </p>
            </div>

            <motion.div
              variants={imageContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3"
            >
              {stats.map((stat) => {
                const isBlue = stat.accent === "blue";
                return (
                  <motion.div
                    key={stat.label}
                    variants={item}
                    className={`flex flex-col justify-center rounded-2xl p-6 shadow-md ${
                      isBlue
                        ? "bg-primary text-white"
                        : "bg-secondary-100 text-primary"
                    }`}
                    style={
                      isBlue
                        ? { backgroundColor: "#243E8B" }
                        : { backgroundColor: "#FFB81C" }
                    }
                  >
                    <span className="text-3xl font-extrabold leading-none lg:text-5xl">
                      {stat.value}
                    </span>
                    <span
                      className={`mt-2 text-sm font-medium leading-snug ${
                        isBlue ? "text-blue-100" : "text-primary"
                      }`}
                    >
                      {stat.label}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          </section>

          {/* ---------- Hero + logo wall ---------- */}
          <section className="container flex flex-col items-center justify-center mx-auto w-full">
            <div>
              <h1 className="relative z-10 mb-8 mt-4 w-full text-3xl font-bold lg:text-6xl">
                We Love Our Sponsors
                <svg
                  className="svg-underline relative z-10 w-full"
                  viewBox="0 0 422 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                  />
                </svg>
              </h1>
            </div>

            <div className="flex flex-col items-center gap-16 w-full px-4 mt-8">
              {[sponsors.slice(0, 4), sponsors.slice(4)].map((row, rowIndex) => (
                <motion.div
                  key={rowIndex}
                  variants={imageContainer}
                  initial="hidden"
                  animate="show"
                  className="flex items-center justify-center flex-wrap gap-12 md:gap-16 xl:gap-24"
                >
                  {row.map((sponsor) => (
                    <motion.a
                      key={sponsor.alt}
                      variants={item}
                      href={sponsor.href}
                      target="_blank"
                      aria-label={sponsor.alt}
                      className="flex items-center justify-center"
                    >
                      <img
                        className={`w-auto object-contain ${sponsor.imgClass}`}
                        src={sponsor.src}
                        alt={sponsor.alt}
                      />
                    </motion.a>
                  ))}
                </motion.div>
              ))}
            </div>
          </section>

          {/* ---------- Why Sponsor ---------- */}
          <motion.div
            className="w-screen bg-gradient-to-r from-primary to-blue-800 mt-16"
            // Solid-blue fallback so text-white is never left on a white
            // background if the gradient utilities ever fail to load.
            style={{ backgroundColor: "#243E8B" }}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <section className="container flex flex-col items-center justify-center mx-auto py-24 w-full lg:py-32">
              <div className="flex flex-col items-center justify-center w-11/12 sm:w-9/12 lg:flex-row lg:justify-around lg:w-full">
                <div className="mb-4 lg:mb-0">
                  <h2 className="mb-8 max-w-lg text-center text-white text-2xl font-bold lg:text-5xl">
                    Why Sponsor?
                    <svg
                      className="svg-underline my-2 w-full"
                      viewBox="0 0 470 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M467 9.00001C323.851 9.00006 37.5532 -4.49999 3.00001 8.99995" />
                    </svg>
                  </h2>
                  <h3 className="my-2 text-white text-2xl font-semibold">
                    Collaborative
                  </h3>
                  <p className="mb-8 max-w-lg text-white text-base leading-loose">
                    We work with you in order to help reach amazing students and
                    create a stronger community.
                  </p>
                  <h3 className="my-2 text-white text-2xl font-semibold">
                    Connected
                  </h3>
                  <p className="max-w-lg text-white text-base leading-loose">
                    With our Alumni program, we actively give back and form
                    connections between underclassmen, upperclassmen, and
                    alumni.
                  </p>
                </div>

                <div className="relative flex flex-col items-center justify-center mt-8 w-full lg:mt-0 lg:w-1/2">
                  {/* Decorative squiggle: desktop-only accent behind the button. */}
                  <svg
                    className="hidden lg:block absolute -bottom-10 left-0 w-48"
                    viewBox="0 0 306 200"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M29 3C71.5 3.5 152.3 10.3 183.5 73.5C214.7 136.7 281.5 155.167 305 151.5"
                      stroke="#FFB81C"
                      strokeWidth="5"
                    />
                    <path
                      d="M1 48C43.5 48.5 124.3 55.3 155.5 118.5C186.7 181.7 253.5 200.167 277 196.5"
                      stroke="#FFB81C"
                      strokeWidth="5"
                    />
                  </svg>
                  <img
                    className="mx-auto w-full rounded-3xl shadow-lg lg:w-9/12"
                    src={SpringReportImage}
                    alt="CSC at Pitt panther illustration"
                  />
                  {/* Button flows below the image on mobile; overlaps it on desktop. */}
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    href={"/initiatives"}
                    target="_self"
                    className="min-w-300 mt-6 px-4 py-2 text-black font-bold bg-white border-4 border-secondary-100 rounded-full focus:outline-none hover:shadow-lg shadow-md transition lg:mt-0 lg:absolute lg:-bottom-6 lg:right-10"
                  >
                    View Our Initiatives!
                  </motion.a>
                </div>
              </div>
            </section>
          </motion.div>

          {/* ---------- Sponsorship Tiers ---------- */}
          <section className="max-w-7xl mx-auto px-4 w-full">
            <div className="flex flex-col items-center mb-12">
              <h2 className="relative z-10 text-center text-2xl font-bold lg:text-5xl">
                Sponsorship Tiers
                <svg
                  className="svg-underline my-2 w-full"
                  viewBox="0 0 470 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M467 9.00001C323.851 9.00006 37.5532 -4.49999 3.00001 8.99995" />
                </svg>
              </h2>
              <p className="mt-4 max-w-2xl text-center text-slate-600 leading-relaxed">
                Every tier includes all the benefits of the tiers below it.
                Benefits are valid for one year, from September 1 to August 31.
              </p>
            </div>

            <motion.div
              variants={imageContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {tiers.map((t) => (
                <motion.div
                  key={t.tier}
                  variants={item}
                  className={`relative flex flex-col rounded-2xl border p-6 shadow-md transition duration-200 hover:-translate-y-1 ${
                    t.featured
                      ? "border-secondary-100 bg-primary text-white hover:shadow-2xl hover:ring-4 hover:ring-secondary-100/60"
                      : "border-slate-200 bg-white text-slate-900 hover:border-yellow-400 hover:shadow-xl"
                  }`}
                  style={t.featured ? { backgroundColor: "#243E8B" } : undefined}
                >
                  {t.featured && (
                    <span className="absolute -top-3 right-6 rounded-full bg-secondary-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                      Most Impact
                    </span>
                  )}
                  <span
                    className={`text-xs font-bold uppercase tracking-widest ${
                      t.featured ? "text-secondary-100" : "text-blue-600"
                    }`}
                  >
                    {t.tier}
                  </span>
                  <h3 className="mt-1 text-xl font-bold">{t.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{t.price}</span>
                    <span
                      className={`text-sm ${
                        t.featured ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      / year
                    </span>
                  </div>

                  {t.inherits && (
                    <p
                      className={`mt-4 text-sm font-semibold ${
                        t.featured ? "text-secondary-100" : "text-blue-600"
                      }`}
                    >
                      Everything in {t.inherits}, plus:
                    </p>
                  )}

                  <ul className="mt-3 space-y-3">
                    {t.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <FontAwesomeIcon
                          icon={faCheck}
                          className={`mt-1 h-3.5 w-3.5 flex-shrink-0 ${
                            t.featured ? "text-secondary-100" : "text-blue-600"
                          }`}
                        />
                        <span
                          className={`text-sm leading-relaxed ${
                            t.featured ? "text-blue-50" : "text-slate-600"
                          }`}
                        >
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>

            {/* Add-ons */}
            <div className="mt-12">
              <h3 className="mb-6 text-center text-xl font-bold text-slate-900 lg:text-2xl">
                Social Media Add-Ons
              </h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:mx-auto lg:max-w-3xl">
                {addOns.map((addOn) => (
                  <div
                    key={addOn.name}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-md transition duration-200 hover:-translate-y-1 hover:border-yellow-400 hover:shadow-xl"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-lg font-bold text-slate-900">
                        {addOn.name}
                      </h4>
                      <span className="text-2xl font-extrabold text-blue-600">
                        {addOn.price}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {addOn.points.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <FontAwesomeIcon
                            icon={faCheck}
                            className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-blue-600"
                          />
                          <span className="text-sm leading-relaxed text-slate-600">
                            {point}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- How to Sponsor / CTA ---------- */}
          <section className="max-w-5xl mx-auto px-4 w-full">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-md lg:p-12">
              <div className="flex flex-col items-center text-center">
                <h2 className="text-2xl font-bold text-slate-900 lg:text-4xl">
                  Ready to Partner With Us?
                </h2>
                <p className="mt-4 max-w-2xl text-slate-600 leading-relaxed">
                  Grab the full 2026-2027 partnership package for tier details
                  and the sponsorship form, or reach out and we'll help you find
                  the right fit.
                </p>

                <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href={SPONSORSHIP_PDF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:shadow-lg"
                    style={{ backgroundColor: "#243E8B" }}
                  >
                    <FontAwesomeIcon icon={faFilePdf} className="h-5 w-5" />
                    Download the Package (PDF)
                  </motion.a>
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href="mailto:pittcsc@gmail.com?subject=CSC%20at%20Pitt%20Sponsorship"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-6 py-3 font-bold text-primary transition hover:bg-primary hover:text-white"
                  >
                    Contact Us
                    <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4" />
                  </motion.a>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-8 border-t border-slate-200 pt-8 text-center md:grid-cols-3">
                <div>
                  <h3 className="font-bold text-slate-900">Give online</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Visit{" "}
                    <a
                      href="https://give.pitt.edu"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      give.pitt.edu
                    </a>
                    , enter an amount, search "Computer Science Club" under
                    designation, and complete your gift.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Give by mail</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    University of Pittsburgh
                    <br />
                    PO Box 640093
                    <br />
                    Pittsburgh, PA 15264-0093
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Questions?</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Email us at{" "}
                    <a
                      href="mailto:pittcsc@gmail.com"
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      pittcsc@gmail.com
                    </a>{" "}
                    or contact SORC at{" "}
                    <a
                      href="mailto:sorc@pitt.edu"
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      sorc@pitt.edu
                    </a>
                    .
                  </p>
                </div>
              </div>
              <p className="mt-6 text-center text-xs text-slate-500">
                <a href="/sponsors.md" className="underline hover:text-primary">
                  Plain-text version (/sponsors.md)
                </a>
                {" · "}
                <a href="/llms.txt" className="underline hover:text-primary">
                  Machine-readable summary (/llms.txt)
                </a>
              </p>
            </div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default SponsorPage;

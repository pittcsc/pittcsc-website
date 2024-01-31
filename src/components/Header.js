import React, { useState, useEffect } from "react";
import { Link } from "gatsby";

import logo from "../images/hero_image.png";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faBars,
  faTimes,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";

import { motion } from "framer-motion";

function Header({ title }) {
  const [nav, setNav] = useState(false);
  const [resourcesNav, setResourcesNav] = useState(false);
  const [shadow, setShadow] = useState(false);

  const handleScroll = () => {
    if (window) {
      const currentScrollPos = window.pageYOffset;
      if (currentScrollPos > 0) {
        setShadow(true);
      } else {
        setShadow(false);
      }
    }
  };

  useEffect(() => {
    if (window) {
      window.addEventListener(`scroll`, handleScroll);
    }
    return () => {
      window.removeEventListener(`scroll`, handleScroll);
    };
  }, []);

  return (
    <header
      className={`mx-auto w-full p-4 header-max-width transition-shadow ${
        nav || shadow ? "shadow-md" : "shadow-none"
      } md:shadow-none md:w-10/12 md:p-0 md:py-4 fixed bg-white z-30 md:relative md:bg-none md:flex md:justify-between md:items-center md:text-center`}
    >
      <div className="flex items-center justify-between mx-auto md:block md:mx-0">
        <Link to="/">
          <img
            src={logo}
            alt="CSC at Pitt Logo"
            className="relative w-12"
            width={64}
          />
        </Link>

        <button
          className={`cursor-pointer md:hidden z-40 focus:outline-none 
          `}
          onClick={() => setNav(!nav)}
          aria-label="Home"
        >
          {nav ? (
            <FontAwesomeIcon icon={faTimes} className="text-xl" />
          ) : (
            <FontAwesomeIcon icon={faBars} className="text-xl" />
          )}
        </button>
      </div>
      <nav
        className={`transition-all relative bg-white pointer-events-none max-h-0 opacity-0 ${
          nav ? "nav-max-height opacity-100 p-4 pointer-events-auto" : ""
        } md:max-h-full md:bg-none md:opacity-100 md:pointer-events-auto`}
      >
        <ul
          className={`flex flex-col justify-center items-center space-y-2 md:flex-row md:items-center md:space-x-8 md:space-y-0`}
        >
          <li className="py-2 md:py-0">
            <Link to="/about">
              <div className="relative w-full text-lg font-bold text-center group md:text-base">
                About Us
                <svg
                  className={`svg-underline absolute bottom-0 left-1/2 mx-auto w-full opacity-0 group-hover:opacity-100 transform-gpu -translate-x-1/2 transition ${
                    title === "about" && "opacity-100"
                  }`}
                  viewBox="0 0 479 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M2.5 11.4996C106.5 -17.5 411.5 37.9996 476 7.49968" />
                </svg>
              </div>
            </Link>
          </li>
          <li className="relative group">
            <div
              className={`flex items-center justify-center px-4 py-2 text-black  ${
                resourcesNav
                  ? "bg-primary text-white md:bg-none md:text-black"
                  : "bg-none text-black"
              } group-hover:bg-primary group-hover:text-white rounded-lg md:py-0 md:block`}
            >
              <div className="relative z-50 w-full text-lg font-bold text-center group md:text-base">
                Resources
                <svg
                  className={`svg-underline absolute bottom-0 left-1/2 mx-auto w-full opacity-0 group-hover:opacity-100 transform-gpu -translate-x-1/2 transition ${
                    title === "resources" && "opacity-100"
                  }`}
                  viewBox="0 0 479 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M2.5 11.4996C106.5 -17.5 411.5 37.9996 476 7.49968" />
                </svg>
              </div>
              <button
                className={`cursor-pointer md:hidden z-40 focus:outline-none ml-2 -mb-1`}
                onClick={() => setResourcesNav(!resourcesNav)}
              >
                {resourcesNav ? (
                  <FontAwesomeIcon icon={faChevronUp} className="text-xl" />
                ) : (
                  <FontAwesomeIcon icon={faChevronDown} className="text-xl" />
                )}
              </button>
            </div>

            <div
              className={`max-h-0 opacity-0 pointer-events-none text-white w-40 px-8 transition-all rounded-2xl ${
                resourcesNav
                  ? "nav-max-height opacity-100  pb-8 -mt-10 pt-12 pointer-events-auto bg-primary"
                  : ""
              } md:absolute md:pointer-events-auto md:max-h-96 md:px-8 md:pb-8 md:pt-12 md:bg-primary md:hidden md:opacity-100 md:-left-4 md:-mt-8 group-hover:block z-40`}
            >
              <ul className="flex flex-col space-y-4 font-bold text-left md:text-white">
                <a
                  href="https://pittcsc-blog.netlify.app/"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <li className="hover:text-secondary-200">Blog</li>
                </a>
                <a
                  href="https://branches.pittcsc.org/"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <li className="hover:text-secondary-200">Branches</li>
                </a>
                <a
                  href="https://pittcs.wiki/"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <li className="hover:text-secondary-200">Pitt CS Wiki</li>
                </a>
              </ul>
            </div>
          </li>
          <li className="py-2 md:py-0">
            <Link to="/sponsors">
              <div className="relative w-full text-lg font-bold text-center group md:text-base">
                Sponsors
                <svg
                  className={`svg-underline absolute bottom-0 left-1/2 mx-auto w-full opacity-0 group-hover:opacity-100 transform-gpu -translate-x-1/2 transition ${
                    title === "sponsors" && "opacity-100"
                  }`}
                  viewBox="0 0 479 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M2.5 11.4996C106.5 -17.5 411.5 37.9996 476 7.49968" />
                </svg>
              </div>
            </Link>
          </li>
          <li>
            <Link to="/join">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-32 px-4 py-2 text-lg font-bold text-white transition rounded-full shadow-md bg-primary focus:outline-none hover:shadow-lg md:w-24 md:text-base"
              >
                Join
              </motion.button>
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;

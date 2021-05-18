import React, { useState } from "react";
import { Link } from "gatsby";

import logo from "../images/horizontal-logo.svg";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";

import { motion } from "framer-motion";

function Header({ title }) {
  const [nav, setNav] = useState(false);

  return (
    <header
      className={`mx-auto w-full p-4 header-max-width ${
        nav ? "shadow-md" : ""
      } md:shadow-none md:w-10/12 md:p-0 md:py-4 fixed bg-white z-30 md:relative md:bg-none md:flex md:justify-between md:items-center md:text-center`}
    >
      <div className="flex items-center justify-between mx-auto md:block md:mx-0">
        <Link to="/">
          <img
            src={logo}
            alt="Pitt CSC Logo"
            className="relative w-32"
            width={128}
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
          nav ? "max-h-96 opacity-100 p-4 pointer-events-auto" : ""
        } md:max-h-96 md:bg-none md:opacity-100 md:pointer-events-auto`}
      >
        <ul
          className={`flex flex-col justify-center items-center space-y-4  md:flex md:flex-row md:block md:items-center md:space-x-8 md:space-y-0`}
        >
          <li>
            <Link to="/about">
              <div className="group relative w-full text-center text-lg font-bold md:text-base">
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
          <li>
            <a
              href="https://pittcsc.medium.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="group relative w-full text-center text-lg font-bold md:text-base">
                Blog
                <svg
                  className={`svg-underline absolute bottom-0 left-1/2 mx-auto w-full opacity-0 group-hover:opacity-100 transform-gpu -translate-x-1/2 transition ${
                    title === "blog" && "opacity-100"
                  }`}
                  viewBox="0 0 479 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M2.5 11.4996C106.5 -17.5 411.5 37.9996 476 7.49968" />
                </svg>
              </div>
            </a>
          </li>
          <li>
            <Link to="/sponsors">
              <div className="group relative w-full text-center text-lg font-bold md:text-base">
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
                className="px-4 py-2 w-32 text-white text-lg font-bold bg-primary rounded-full focus:outline-none hover:shadow-lg shadow-md transition md:w-24 md:text-base"
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

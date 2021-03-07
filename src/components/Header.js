import React, { useState } from "react";
import { Link } from "gatsby";

import logo from "../images/horizontal-logo.svg";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";

import { motion } from "framer-motion";

function Header() {
  const [nav, setNav] = useState(false);

  return (
    <header
      className={`container mx-auto w-full p-4 ${
        nav ? "shadow-md" : ""
      } md:* md:w-10/12 md:p-0 md:py-4 fixed bg-white z-30 md:relative md:bg-none md:flex md:justify-between md:items-center md:text-center`}
    >
      <div className="flex justify-between items-center mx-auto md:block md:mx-0">
        <Link to="/">
          <img src={logo} alt="pitt-csc-logo" className="w-32 relative" />
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
        className={`transition-all relative bg-white max-h-0 opacity-0 ${
          nav ? "max-h-96 opacity-100 p-4" : ""
        } md:max-h-96 md:bg-none md:opacity-100`}
      >
        <ul
          className={`flex flex-col justify-center items-center space-y-4 font-body md:flex md:flex-row md:block md:items-center md:space-x-8 md:space-y-0`}
        >
          <li>
            <Link to="/about">
              <div className="font-bold text-lg md:text-base">About Us</div>
            </Link>
          </li>
          <li>
            <a
              href="https://pittcsc.medium.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="font-bold text-lg md:text-base">Blog</div>
            </a>
          </li>
          <li>
            <Link to="/sponsors">
              <div className="font-bold text-lg md:text-base">Sponsors</div>
            </Link>
          </li>
          <li>
            <Link to="/join">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="bg-primary text-lg md:text-base w-32 md:w-24 text-white font-bold font-body py-2 px-4 rounded-full shadow-md hover:shadow-lg transition focus:outline-none"
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

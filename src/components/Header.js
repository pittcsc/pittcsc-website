import React, { useState } from "react";

import logo from "../images/horizontal-logo.svg";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";

import { motion } from "framer-motion";

function Header() {
  const [nav, setNav] = useState(false);

  return (
    <motion.header
      initial={{
        opacity: 0,
        y: -100,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay: 0.2,
      }}
      className="container mx-auto w-full p-4 fixed bg-white z-30 md:relative md:bg-none md:flex md:justify-between md:items-center md:text-center"
    >
      <div className="flex justify-between items-center mx-auto md:block md:mx-0">
        <img src={logo} alt="pitt-csc-logo" className="w-32 relative" />
        <button
          className={`cursor-pointer md:hidden z-40 
          `}
          onClick={() => setNav(!nav)}
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
          <li className="font-bold">About Us</li>
          <li className="font-bold">Blog</li>
          <li className="font-bold">Sponsors</li>
          <li>
            <button className="bg-primary w-24 text-white font-bold font-body py-2 px-4 rounded-full shadow-md hover:shadow-lg transition">
              Join
            </button>
          </li>
        </ul>
      </nav>
    </motion.header>
  );
}

export default Header;

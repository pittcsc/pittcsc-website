import React, { useState } from "react";

import logo from "../images/horizontal-logo.svg";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";

function Header() {
  const [nav, setNav] = useState(false);

  return (
    <header className="container mx-auto flex w-full justify-between items-start p-4 relative z-30">
      <img src={logo} alt="pitt-csc-logo" className="w-32 relative" />
      <nav className="flex flex-col items-end">
        <div
          className={`cursor-pointer md:hidden z-40 
          `}
          onClick={() => setNav(!nav)}
        >
          {nav ? (
            <FontAwesomeIcon icon={faTimes} className="text-xl" />
          ) : (
            <FontAwesomeIcon icon={faBars} className="text-xl" />
          )}
        </div>
        <ul
          className={`flex flex-col justify-center items-end md:flex md:flex-row md:block md:items-center md:space-x-8 font-body ${
            nav ? "block" : "hidden"
          }`}
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
    </header>
  );
}

export default Header;

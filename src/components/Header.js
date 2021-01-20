import React from "react";

import logo from "../images/horizontal-logo.svg";

function Header() {
  return (
    <header className="container mx-auto flex h-16 w-full justify-between items-center">
      <img src={logo} alt="pitt-csc-logo" className="w-32" />
      <nav>
        <ul className="flex space-x-8 justify-center items-center font-body">
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

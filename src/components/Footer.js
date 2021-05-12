import React from "react";
import { Link } from "gatsby";

function Footer() {
  return (
    <footer className="container mx-auto flex justify-center items-center h-32 w-full text-center">
      <nav className="w-full space-y-2">
        <ul className="flex justify-center items-center space-x-4 lg:space-x-8 mx-auto font-bold ">
          <Link to="/about">
            <li>About Us</li>
          </Link>
          <a
            href="https://pittcsc.medium.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <li>Blog</li>
          </a>
          <Link to="/sponsors">
            <li>Sponsors</li>
          </Link>
          <Link to="/join">
            <li>Join</li>
          </Link>
        </ul>
        <p className="">
          Email us at{" "}
          <a
            href="mailto:pittcsc@gmail.com"
            className=" text-blue-500 underline"
          >
            pittcsc@gmail.com
          </a>
        </p>
        <p className="">
          Built with <span className="text-red-500">❤</span> by{" "}
          <span className="font-bold">Pitt CSC</span>
        </p>
      </nav>
    </footer>
  );
}

export default Footer;

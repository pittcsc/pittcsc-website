import React from "react";
import { Link } from "gatsby";

function Footer() {
  return (
    <footer className="container mx-auto flex justify-center items-center h-32 w-full text-center">
      <nav className="w-full">
        <ul className="flex justify-center items-center space-x-4 lg:space-x-8 my-4 mx-auto font-bold font-body">
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
        <p className="font-body">
          Built with <span className="text-red-500">❤</span> by Pitt CSC
        </p>
      </nav>
    </footer>
  );
}

export default Footer;

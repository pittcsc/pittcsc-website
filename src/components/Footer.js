import React from "react";

function Footer() {
  return (
    <footer className="container mx-auto flex justify-center items-center h-32 w-full text-center">
      <nav className="w-full">
        <ul className="flex justify-center items-center space-x-4 my-4 mx-auto font-bold font-body">
          <li>About Us</li>
          <li>Blog</li>
          <li>Sponsors</li>
        </ul>
        <p className="font-body">Built with ❤ by Pitt CSC</p>
      </nav>
    </footer>
  );
}

export default Footer;

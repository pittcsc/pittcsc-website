import React from "react";

function Header() {
  return (
    <header className="container mx-auto flex h-16 w-full justify-between items-center">
      <h1>Logo</h1>
      <nav>
        <ul className="flex space-x-4 justify-center items-center">
          <li className="font-bold">About Us</li>
          <li className="font-bold">Blog</li>
          <li className="font-bold">Sponsors</li>
          <li>
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
              Join
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;

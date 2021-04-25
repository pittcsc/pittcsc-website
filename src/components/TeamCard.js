import React from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons";
import { motion } from "framer-motion";

function TeamCard({ image, name, title, linkedIn, email }) {
  return (
    <figure className="relative bg-gray-100 rounded-2xl p-8 shadow-md w-64 md:w-72 transform transition hover:shadow-lg hover:scale-105">
      <img
        className="w-48 h-48 object-cover object-center rounded-full -mt-16 mx-auto"
        src={image}
        alt={`Portrait of ${name}`}
      />
      <figcaption className="text-center font-body">
        <div className="font-medium text-lg md:text-xl pt-4">{name}</div>
        <div className="text-xs px-2">{title}</div>
      </figcaption>
      <motion.a
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        href={linkedIn}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute flex justify-center items-center left-4 bottom-4 text-2xl"
      >
        <FontAwesomeIcon icon={faLinkedin} />
      </motion.a>
      <motion.a
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        href={`mailto:${email}`}
        rel="noopener noreferrer"
        className="absolute right-4 bottom-4 text-2xl"
      >
        <FontAwesomeIcon icon={faPaperPlane} />
      </motion.a>
    </figure>
  );
}

export default TeamCard;

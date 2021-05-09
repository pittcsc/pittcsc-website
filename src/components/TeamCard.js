import React, { useState } from "react";
import Modal from "./Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons";
import { motion } from "framer-motion";

function TeamCard({ image, name, title, linkedIn, email }) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="rounded-2xl p-4 md:p-8 max-w-5xl bg-gray-100 flex flex-col md:flex-row justify-center items-center space-x-8">
          <img
            className="w-48 h-48 object-cover object-center rounded-full shadow mx-auto"
            src={image}
            alt={`Portrait of ${name}`}
          />
          <figcaption className="text-left  max-w-lg">
            <div className="font-medium text-xl lg:text-2xl md:text-xl pt-4">
              {name}
            </div>
            <div className="text-sm">{title}</div>
            <div className="text-sm my-4">
              Lorem ipsum dolor sit amet consectetur adipisicing elit.
              Reiciendis cum sapiente quasi obcaecati. Officia id quo sunt, odio
              tempore similique quibusdam, incidunt, autem praesentium earum
              quasi suscipit optio quam nobis?
            </div>
            <div className="justify-start flex items-center space-x-8">
              <motion.a
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                href={linkedIn}
                target="_blank"
                rel="noopener noreferrer"
                className="flex justify-center items-center text-3xl"
              >
                <FontAwesomeIcon icon={faLinkedin} />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                href={`mailto:${email}`}
                rel="noopener noreferrer"
                className="flex justify-center items-center text-3xl"
              >
                <FontAwesomeIcon icon={faPaperPlane} />
              </motion.a>
            </div>
          </figcaption>
        </div>
      </Modal>
      <button
        className="relative bg-gray-100 rounded-2xl p-8 shadow-md w-64 md:w-72 transform transition cursor-pointer hover:shadow-lg hover:scale-105"
        onClick={() => setModalOpen(true)}
        onKeyDown={() => setModalOpen(true)}
      >
        <img
          className="w-48 h-48 object-cover object-center rounded-full shadow -mt-16 mx-auto"
          src={image}
          alt={`Portrait of ${name}`}
        />
        <figcaption className="text-center ">
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
      </button>
    </>
  );
}

export default TeamCard;

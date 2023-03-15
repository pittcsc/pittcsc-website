import React, { useState } from "react";
import Modal from "./Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons";
import { motion, AnimatePresence } from "framer-motion";

function TeamCard({ bio, image, name, title, linkedIn, email }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <AnimatePresence exitBeforeEnter>
        {modalOpen && (
          <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="flex flex-col items-center justify-center px-4 py-8 max-w-5xl bg-gray-100 rounded-2xl space-x-8 md:flex-row md:p-8">
              <img
                className="mx-auto w-48 h-48 rounded-full shadow-md object-cover object-center"
                src={image}
                alt={`Portrait of ${name}`}
              />
              <figcaption className="max-w-lg text-left">
                <div className="pt-4 text-xl font-medium md:text-xl lg:text-2xl">
                  {name}
                </div>
                <div className="text-sm">{title}</div>
                <div className="my-4 whitespace-pre-line text-sm leading-relaxed">
                  {bio}
                </div>
                <div className="flex items-center justify-start space-x-8">
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    href={linkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center text-3xl"
                  >
                    <FontAwesomeIcon icon={faLinkedin} />
                  </motion.a>
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    href={`mailto:${email}`}
                    rel="noopener noreferrer"
                    className="flex items-center justify-center text-3xl"
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </motion.a>
                </div>
              </figcaption>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      <div
        className={`relative p-8 w-64 bg-gray-100 rounded-2xl focus:outline-none hover:shadow-lg shadow-md ${
          bio !== undefined ? "cursor-pointer" : "cursor-default"
        } transform-gpu hover:scale-105 active:scale-95 transition md:w-72`}
        onClick={bio ? () => setModalOpen(true) : undefined}
        onKeyDown={bio ? () => setModalOpen(true) : undefined}
        role="button"
        tabIndex="0"
      >
        <img
          className="-mt-16 mx-auto w-48 h-48 rounded-full shadow-md object-cover object-center overflow-hidden"
          src={image}
          alt={`Portrait of ${name}`}
        />
        <figcaption className="text-center">
          <div className="pt-4 text-lg font-medium md:text-xl">{name}</div>
          <div className="px-2 text-xs">{title}</div>
        </figcaption>
        <motion.a
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          href={linkedIn}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 left-4 flex items-center justify-center text-2xl"
        >
          <FontAwesomeIcon icon={faLinkedin} />
        </motion.a>
        <motion.a
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          href={`mailto:${email}`}
          rel="noopener noreferrer"
          className="absolute bottom-4 right-4 text-2xl"
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </motion.a>
      </div>
    </>
  );
}

export default TeamCard;

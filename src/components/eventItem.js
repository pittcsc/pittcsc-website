import React, { useState } from "react";
import Modal from "./Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink } from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";

function EventItem({ name, startDate, endDate, url, description, tags }) {
  const [modalOpen, setModalOpen] = useState(false);
  console.log(endDate);
  return (
    <>
      <li>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 text-left text-white bg-primary rounded-full focus:outline-none"
        >
          <p className="font-medium">
            {name} - {startDate} {endDate && `to ${endDate}`}
          </p>
        </motion.button>
      </li>
      <AnimatePresence exitBeforeEnter>
        {modalOpen && (
          <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="items-left flex flex-col justify-center px-4 py-8 max-w-5xl bg-gray-100 rounded-2xl space-y-4 md:p-8 lg:p-16">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold lg:text-4xl">{name}</h2>
                <p>
                  {startDate} {endDate && `to ${endDate}`}
                </p>
                <div className="flex space-x-2">
                  {tags.map((tag) => (
                    <div
                      className={`text-sm lg:text-base px-4 py-2 bg-gray-300 bg-${tag.color}-300 rounded-full`}
                    >
                      {tag.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="max-w-lg text-left whitespace-pre-line text-sm leading-relaxed">
                {description}
              </div>
              {url && (
                <div className="flex items-center justify-start">
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    href={url}
                    rel="noopener noreferrer"
                    className="flex items-center justify-center text-3xl"
                  >
                    <FontAwesomeIcon icon={faLink} />
                  </motion.a>
                </div>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

export default EventItem;

import React from "react";
import ReactDom from "react-dom";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

function Modal({ open, children, onClose }) {
  const portalRoot =
    typeof document !== `undefined` ? document.getElementById("portal") : null;

  const backdrop = {
    hidden: { opacity: 0 },
    show: { opacity: 1 },
  };

  const modal = {
    hidden: {
      y: 100,
      opacity: 0,
    },
    show: {
      y: 0,
      opacity: 1,
    },
  };

  return ReactDom.createPortal(
    <>
      {open && (
        <motion.div
          variants={backdrop}
          initial="hidden"
          animate="show"
          exit="hidden"
          className="modal-overlay"
          onClick={onClose}
          onKeyDown={onClose}
          role="button"
          tabIndex="0"
        >
          <motion.div
            variants={modal}
            className="modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            role="button"
            tabIndex="-1"
          >
            {children}
            <button
              onClick={onClose}
              onKeyDown={onClose}
              className="absolute right-0 top-0 m-4 w-8 h-8 text-black text-2xl focus:outline-none"
              tabIndex="-1"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </>,
    portalRoot
  );
}

export default Modal;

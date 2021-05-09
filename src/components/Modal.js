import React from "react";
import ReactDom from "react-dom";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

function Modal({ open, children, onClose }) {
  const portalRoot =
    typeof document !== `undefined` ? document.getElementById("portal") : null;

  if (!open) return null;
  return ReactDom.createPortal(
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={onClose}
      role="button"
      tabIndex="0"
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
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
          className="absolute top-0 right-0 text-2xl m-4 text-black w-8 h-8 focus:outline-none"
          tabIndex="-1"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </motion.div>
    </motion.div>,
    portalRoot
  );
}

export default Modal;

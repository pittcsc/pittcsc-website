import React, { useEffect, useRef } from "react";
import { GatsbyImage } from "gatsby-plugin-image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

const LightboxModal = ({
  items,
  activeIndex,
  onClose,
  onSelectIndex,
  title,
}) => {
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  const isOpen = activeIndex !== null && activeIndex >= 0 && items[activeIndex];
  const current = isOpen ? items[activeIndex] : null;
  const hasMultiple = items.length > 1;

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (hasMultiple && event.key === "ArrowRight") {
        event.preventDefault();
        onSelectIndex((activeIndex + 1) % items.length);
      } else if (hasMultiple && event.key === "ArrowLeft") {
        event.preventDefault();
        onSelectIndex((activeIndex - 1 + items.length) % items.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function"
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, activeIndex, hasMultiple, items.length, onClose, onSelectIndex]);

  if (!current) return null;

  const handlePrev = (event) => {
    event.stopPropagation();
    onSelectIndex((activeIndex - 1 + items.length) % items.length);
  };

  const handleNext = (event) => {
    event.stopPropagation();
    onSelectIndex((activeIndex + 1) % items.length);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photo viewer`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4 sm:p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex w-full max-w-5xl items-center justify-between pb-3 text-sm text-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="font-medium">
          {hasMultiple
            ? `Photo ${activeIndex + 1} of ${items.length}`
            : current.caption || title}
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-100"
        >
          <span>Close</span>
          <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
        </button>
      </div>

      {/* Main image stage */}
      <div
        className="relative flex w-full max-w-5xl flex-1 items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        {hasMultiple && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous photo"
            className="absolute left-0 sm:left-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/75 text-white border border-white/15 transition-colors hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-100"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
          </button>
        )}

        <div className="flex max-h-[78vh] max-w-full items-center justify-center px-12 sm:px-16">
          {current.featureImage ? (
            <GatsbyImage
              image={current.featureImage}
              alt={current.alt}
              objectFit="contain"
              className="max-h-[78vh] rounded-xl shadow-2xl"
              imgStyle={{ maxHeight: "78vh", objectFit: "contain" }}
            />
          ) : (
            <img
              src={current.fallbackSrc}
              alt={current.alt}
              className="max-h-[78vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          )}
        </div>

        {hasMultiple && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next photo"
            className="absolute right-0 sm:right-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/75 text-white border border-white/15 transition-colors hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-100"
          >
            <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Caption */}
      {(current.caption || (hasMultiple && current.alt)) && (
        <p
          className="mt-3 max-w-2xl text-center text-sm text-slate-300"
          onClick={(event) => event.stopPropagation()}
        >
          {current.caption || current.alt}
        </p>
      )}
    </div>
  );
};

export default LightboxModal;

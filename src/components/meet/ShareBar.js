import React, { useState } from "react";
import { motion } from "framer-motion";
import { copyText } from "../../lib/meet/client";

/** The link is the product, so it gets one obvious control and no ceremony. */
export default function ShareBar({ url, title }) {
  const [copied, setCopied] = useState(false);
  const canShareNatively =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    if (!(await copyText(url))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const pretty = url.replace(/^https?:\/\//, "");
  const [host, ...rest] = pretty.split("/meet/");

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      <div
        className="flex flex-1 items-center min-w-0 px-4 py-3 text-gray-500 text-sm bg-gray-50 border border-gray-300 rounded-full overflow-hidden whitespace-nowrap"
        style={{ flexBasis: 220 }}
        title={url}
      >
        <span className="truncate">
          {host}/meet/<b className="text-gray-900">{rest.join("/meet/")}</b>
        </span>
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={copy}
        className="px-6 py-3 text-white font-bold bg-primary rounded-full focus:outline-none hover:shadow-lg shadow-md transition"
      >
        {copied ? "Copied" : "Copy link"}
      </motion.button>

      {canShareNatively && (
        <button
          type="button"
          className="px-5 py-3 font-bold bg-white border border-gray-300 rounded-full hover:border-gray-500 transition"
          onClick={() =>
            navigator.share({ title, text: title, url }).catch(() => {})
          }
        >
          Share
        </button>
      )}

      <span className="meet-sr" role="status" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink } from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";
import { useCookies } from "react-cookie";
import axios from "axios";

function EventItem({
  name,
  startDate,
  startDateShort,
  startDateLong,
  endDateShort,
  endDateLong,
  url,
  description,
  tags,
  time,
  id,
  attendance,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cookies, setCookie, removeCookie] = useCookies();
  console.log(cookies);

  const handleAttendance = () => {
    setLoading(true);
    if (!checked) {
      axios
        .post("/api/attendance", {
          add: 1,
          pageId: id,
        })
        .then((res) => {
          console.log(res);
          setLoading(false);
          setChecked(true);
          const windowGlobal = typeof window !== `undefined` && window;
          if (windowGlobal) {
            setCookie(id, true, {
              path: `/`,
              expires: new Date(startDate),
              sameSite: `lax`,
            });
          }
        })
        .catch((err) => {
          console.log(err);
          throw new Error();
        });
    } else {
      axios
        .post("/api/attendance", {
          add: -1,
          pageId: id,
        })
        .then((res) => {
          console.log(res);
          setLoading(false);
          setChecked(false);
          const windowGlobal = typeof window !== `undefined` && window;
          if (windowGlobal) {
            removeCookie(id);
          }
        })
        .catch((err) => {
          console.log(err);
          throw new Error();
        });
    }
  };

  useEffect(() => {
    const windowGlobal = typeof window !== `undefined` && window;
    if (windowGlobal) {
      setChecked(cookies[id]);
    }
  }, []);

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
            {name} - {startDateShort} {endDateShort && `to ${endDateShort}`}
          </p>
        </motion.button>
      </li>
      <AnimatePresence exitBeforeEnter>
        {modalOpen && (
          <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="items-left flex flex-col justify-center p-8 w-full max-w-5xl bg-gray-100 rounded-2xl md:p-12 lg:p-16">
              <div className="mb-4">
                <h2 className="mb-2 max-w-xs text-2xl font-bold md:text-3xl lg:max-w-full lg:text-4xl">
                  {name}
                </h2>
                <p className="mb-4">
                  {startDateLong}
                  {endDateLong && ` to ${endDateLong}`}
                  {time && `, ${time}`}
                </p>
                <div className="flex space-x-2">
                  {tags.map((tag, i) => (
                    <div
                      className={`text-sm px-4 py-2 ${
                        tag.color ? `bg-${tag.color}-300` : "bg-gray-300"
                      } rounded-full`}
                      key={i}
                    >
                      {tag.name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-8 max-w-lg text-left whitespace-pre-line text-sm leading-relaxed">
                {description}
              </div>
              <div className="flex flex-col justify-between space-y-2 lg:flex-row lg:items-center lg:space-y-0">
                {url && (
                  <div className="flex items-center">
                    <a
                      href={url}
                      rel="noopener noreferrer"
                      className="group flex items-center justify-center font-bold space-x-2"
                    >
                      <p className="group-hover:underline">Link</p>
                      <FontAwesomeIcon
                        className="text-2xl transform group-hover:scale-105 transition"
                        icon={faLink}
                      />
                    </a>
                  </div>
                )}
                {attendance && (
                  <div className="flex items-center space-x-2">
                    <label
                      htmlFor="attedance"
                      className="font-bold cursor-pointer"
                    >
                      Check the box to RSVP
                    </label>
                    <input
                      name="attendance"
                      type="checkbox"
                      className={`cursor-pointer rounded ${
                        loading ? "animate-pulse" : ""
                      }`}
                      checked={checked}
                      disabled={loading}
                      onChange={handleAttendance}
                    />
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

export default EventItem;

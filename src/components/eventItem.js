import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { format } from "date-fns";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink } from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";
import { useCookies } from "react-cookie";
import axios from "axios";

function EventItem({
  name,
  startDate,
  endDate,
  url,
  description,
  tags,
  time,
  id,
  attendance,
  shouldOpen,
}) {
  const [modalOpen, setModalOpen] = useState(shouldOpen);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkLabel, setCheckLabel] = useState("Check the box to RSVP");
  const [cookies, setCookie, removeCookie] = useCookies();

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
          setCheckLabel(
            checkLabel === "Hope you change your mind 😢"
              ? "That's more like it! 😊"
              : "You're RSVP'd!"
          );

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
          setCheckLabel("Hope you change your mind 😢");
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
      setCheckLabel(cookies[id] ? "You're RSVP'd!" : "Check the box to RSVP");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  console.log(new Date(startDate));

  const newStartDate = new Date(startDate);

  const newEndDate = new Date(endDate);

  const tomorrowStart = new Date();

  const tomorrowEnd = new Date();
  let startDateLong;
  let startDateShort;
  let endDateLong;
  let endDateShort;

  tomorrowStart.setDate(newStartDate.getDate() + 1);
  tomorrowEnd.setDate(newEndDate.getDate() + 1);

  if (startDate) {
    startDateLong = format(tomorrowStart, "MMMM do");
    startDateShort = format(tomorrowStart, "MM/dd");
  } else {
    startDateLong = false;
    startDateShort = false;
  }

  if (endDate) {
    endDateLong = format(tomorrowEnd, "MMMM do");
    endDateShort = format(tomorrowEnd, "MM/dd");
  } else {
    endDateLong = false;
    endDateShort = false;
  }

  return (
    <>
      <li>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setModalOpen(true)}
          className="p-4 text-left text-white bg-primary rounded-full focus:outline-none md:px-6 md:py-4"
        >
          <p className="font-medium">
            <span className="text-base md:text-lg lg:text-xl">{name}</span>
            <br />{" "}
            <span className="text-sm font-normal">
              {startDateLong} {endDateShort && `to ${endDateShort}`}{" "}
              {time && `, ${time}`}
            </span>
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

              <div className="flex flex-col justify-between space-y-2">
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
                {(attendance || attendance === 0) && (
                  <div className="flex items-center space-x-2">
                    <label
                      htmlFor="attendance"
                      className="block font-bold outline-none focus:outline-none cursor-pointer"
                    >
                      <span>{checkLabel}</span>
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

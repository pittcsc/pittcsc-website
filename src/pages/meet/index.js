import React, { useEffect, useState } from "react";
import { Link, navigate } from "gatsby";
import { motion } from "framer-motion";

import Layout from "../../layouts/layout";
import CreateForm from "../../components/meet/CreateForm";
import { recentMeetings, rememberMeeting } from "../../lib/meet/client";

export default function MeetHome() {
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    setRecent(recentMeetings());
  }, []);

  return (
    <Layout title="Meet | Computer Science Club @ Pitt">
      <motion.div
        className="meet overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 mb-16 min-h-screen md:mt-10">
          <section className="container flex flex-col items-center mx-auto w-full">
            <h1 className="relative z-10 mb-2 mt-4 px-4 text-center text-3xl font-bold sm:text-4xl lg:text-5xl">
              Find a time to meet.
              <svg
                className="svg-underline relative z-10 mx-auto w-48 sm:w-56 lg:w-full"
                viewBox="0 0 422 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                />
              </svg>
            </h1>

            <p className="mb-10 px-4 max-w-md text-gray-500 text-center">
              Share a link, add your availability, and find the best time for everyone.
            </p>

            <div className="w-11/12 max-w-xl">
              <CreateForm
                onCreated={({ code, meeting }) => {
                  rememberMeeting({ code, name: meeting.name });
                  navigate(`/meet/${code}?new=1`);
                }}
              />

              {recent.length > 0 && (
                <div className="mt-12">
                  <h2 className="mb-3 text-gray-400 text-xs font-bold tracking-wide uppercase">
                    Recent
                  </h2>
                  <ul className="space-y-2">
                    {recent.map((entry) => (
                      <li key={entry.code}>
                        <Link
                          to={`/meet/${entry.code}`}
                          className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-2xl hover:border-gray-400 transition"
                        >
                          <span className="font-bold truncate">
                            {entry.name || "Untitled meeting"}
                          </span>
                          <span className="flex-none ml-3 text-gray-400 text-sm">
                            /meet/{entry.code}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
}

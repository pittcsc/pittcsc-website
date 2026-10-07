import React from "react";
import UserManagement from "./user-management/UserManagement";

const icon = (paths) =>
  function ToolIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };

// Components and icons for each tool in lib/staff/tools.mjs, keyed by slug.
export const toolViews = {
  "user-management": {
    Component: UserManagement,
    Icon: icon(
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
        <path d="M16 3.5a4 4 0 0 1 0 9" />
        <path d="M19 21v-1a7 7 0 0 0-3-5.7" />
      </>,
    ),
  },
};

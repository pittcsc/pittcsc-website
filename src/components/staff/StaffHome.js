import React from "react";
import { Link } from "gatsby";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { staffToolPath, staffTools } from "../../lib/staff/tools.mjs";
import { toolViews } from "./tools";

export default function StaffHome() {
  return (
    <section className="csc-staff csc-staff-home">
      <p className="csc-staff-eyebrow">Staff tools</p>
      <h1>Staff Dashboard</h1>
      <ul className="csc-staff-tools">
        {staffTools
          .filter((tool) => toolViews[tool.slug])
          .map((tool) => (
            <li key={tool.slug} className="csc-staff-tool">
              <span className="csc-staff-tool-icon">
                <FontAwesomeIcon icon={toolViews[tool.slug].icon} />
              </span>
              <h2>
                {/* Stretched over the whole card so the card is the target. */}
                <Link to={staffToolPath(tool.slug)}>{tool.title}</Link>
              </h2>
              <p>{tool.description}</p>
            </li>
          ))}
      </ul>
    </section>
  );
}

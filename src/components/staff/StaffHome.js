import React from "react";
import { Link } from "gatsby";
import { staffToolPath, staffTools } from "../../lib/staff/tools.mjs";
import { toolViews } from "./tools";

export default function StaffHome({ identity }) {
  return (
    <section className="csc-staff csc-staff-home">
      <p className="csc-staff-eyebrow">Staff tools</p>
      <h1>Staff Dashboard</h1>
      <p className="csc-staff-intro">
        Signed in as <strong>{identity.email}</strong>
      </p>
      <ul className="csc-staff-tools">
        {staffTools
          .filter((tool) => toolViews[tool.slug])
          .map((tool) => {
            const { Icon } = toolViews[tool.slug];
            return (
              <li key={tool.slug} className="csc-staff-tool">
                <span className="csc-staff-tool-icon">
                  <Icon />
                </span>
                <h2 id={`csc-staff-tool-${tool.slug}`}>{tool.title}</h2>
                <p>{tool.description}</p>
                <Link
                  to={staffToolPath(tool.slug)}
                  className="csc-staff-tool-open"
                  aria-describedby={`csc-staff-tool-${tool.slug}`}
                >
                  {tool.action}
                </Link>
              </li>
            );
          })}
      </ul>
    </section>
  );
}

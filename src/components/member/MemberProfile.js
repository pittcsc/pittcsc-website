import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faBriefcase,
  faCode,
  faGraduationCap,
  faTerminal,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import {
  faCalendar,
  faPenToSquare,
  faStar,
} from "@fortawesome/free-regular-svg-icons";
import MemberAvatar from "./MemberAvatar";
import "../../styles/directory.scss";

export default function MemberProfile({ identity, memberID }) {
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );
  const [member, setMember] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const refresh = () => setRetry((value) => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setMember(null);
    setError("");
    setLoading(true);
    request(`/members/${memberID}`, {
      userID: identity.id,
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setMember(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identity.id, memberID, request, retry]);

  const links = member
    ? [
        member.githubUsername && {
          label: "GitHub",
          icon: faCode,
          href: `https://github.com/${member.githubUsername}`,
        },
        member.leetcodeUsername && {
          label: "LeetCode",
          icon: faTerminal,
          href: `https://leetcode.com/u/${member.leetcodeUsername}`,
        },
        member.linkedinUsername && {
          label: "LinkedIn",
          icon: faBriefcase,
          href: `https://www.linkedin.com/in/${member.linkedinUsername}`,
        },
        member.personalWebsite?.startsWith("https://") && {
          label: "Personal website",
          icon: faArrowUpRightFromSquare,
          href: member.personalWebsite,
        },
      ].filter(Boolean)
    : [];

  return (
    <article className="csc-member-profile">
      <div className="csc-profile-banner">
        <Link to="/dashboard/members">← Members</Link>
      </div>
      {loading ? (
        <p role="status">Loading profile…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : (
        member && (
          <>
            <header className="csc-profile-heading">
              <MemberAvatar
                member={member}
                request={request}
                userID={identity.id}
              />
              <div className="csc-profile-identity">
                <h1>{member.name || "CSC member"}</h1>
                <ul className="csc-profile-tags">
                  {member.majors.map((major) => (
                    <li key={major}>
                      <FontAwesomeIcon icon={faGraduationCap} />
                      {major}
                    </li>
                  ))}
                  {member.graduationYear && (
                    <li>
                      <FontAwesomeIcon icon={faCalendar} />
                      Class of {member.graduationYear}
                    </li>
                  )}
                  {member.isAlumni && <li>Alumni</li>}
                  {!member.complete && (
                    <li className="is-warning">
                      Profile incomplete · staff view
                    </li>
                  )}
                </ul>
              </div>
              {member.id === identity.id && (
                <Link className="csc-profile-edit" to="/dashboard/account">
                  <FontAwesomeIcon icon={faPenToSquare} />
                  Edit profile
                </Link>
              )}
            </header>
            <section className="csc-profile-stats" aria-label="Points">
              <div className="csc-profile-stat">
                <span className="csc-profile-stat-icon">
                  <FontAwesomeIcon icon={faStar} />
                </span>
                <div>
                  <h2>Total points</h2>
                  <p>
                    <strong>{member.allTimePoints}</strong>
                  </p>
                </div>
              </div>
              <div className="csc-profile-stat is-gold">
                <span className="csc-profile-stat-icon">
                  <FontAwesomeIcon icon={faTrophy} />
                </span>
                <div>
                  <h2>30-day leaderboard</h2>
                  <p>
                    <strong>
                      {member.rank30Days ? `#${member.rank30Days}` : "—"}
                    </strong>
                    {member.rank30Days === 1
                      ? "Top of the club"
                      : !member.rank30Days && "Unranked"}
                  </p>
                </div>
              </div>
            </section>
            {(member.jobTitle || member.currentCompany || member.location) && (
              <section className="csc-profile-details" aria-label="Career details">
                <h2 className="csc-profile-eyebrow">Career</h2>
                <dl>
                  {member.jobTitle && (
                    <div>
                      <dt>Job title</dt>
                      <dd>{member.jobTitle}</dd>
                    </div>
                  )}
                  {member.currentCompany && (
                    <div>
                      <dt>Current company</dt>
                      <dd>{member.currentCompany}</dd>
                    </div>
                  )}
                  {member.location && (
                    <div>
                      <dt>Location</dt>
                      <dd>{member.location}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
            {member.bio && (
              <section className="csc-profile-details" aria-label="About">
                <h2 className="csc-profile-eyebrow">About</h2>
                <p className="csc-profile-bio">{member.bio}</p>
              </section>
            )}
            {member.contactEmail && (
              <section className="csc-profile-details" aria-label="Contact">
                <h2 className="csc-profile-eyebrow">Contact</h2>
                <a href={`mailto:${member.contactEmail}`}>{member.contactEmail}</a>
              </section>
            )}
            {(member.offersCoffee ||
              member.offersMentorship ||
              member.offersReferrals ||
              member.offersResumeReview) && (
              <section className="csc-profile-details" aria-label="Help offered">
                <h2 className="csc-profile-eyebrow">Happy to help with</h2>
                <ul className="csc-profile-help">
                  {member.offersCoffee && <li>Coffee chats</li>}
                  {member.offersMentorship && <li>Mentorship</li>}
                  {member.offersReferrals && <li>Referrals</li>}
                  {member.offersResumeReview && <li>Résumé reviews</li>}
                </ul>
              </section>
            )}
            {links.length > 0 && (
              <section aria-labelledby="csc-profile-links-heading">
                <h2
                  id="csc-profile-links-heading"
                  className="csc-profile-eyebrow"
                >
                  Profiles
                </h2>
                <ul className="csc-profile-links">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FontAwesomeIcon icon={link.icon} />
                        {link.label}
                        <FontAwesomeIcon
                          className="csc-profile-link-arrow"
                          icon={faArrowUpRightFromSquare}
                        />
                        <span className="sr-only"> (opens in new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )
      )}
    </article>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
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

  return (
    <article className="csc-member-profile">
      <Link to="/dashboard/members">← Members</Link>
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
              <div>
                <h1>{member.name || "CSC member"}</h1>
                {member.isAlumni && (
                  <span className="csc-directory-badge">Alumni</span>
                )}
                {!member.complete && (
                  <span className="csc-directory-badge">
                    Profile incomplete · staff view
                  </span>
                )}
              </div>
            </header>
            {member.majors.length > 0 && (
              <p>
                <strong>Major{member.majors.length > 1 ? "s" : ""}:</strong>{" "}
                {member.majors.join(", ")}
              </p>
            )}
            {member.graduationYear && (
              <p>
                <strong>Graduation year:</strong> {member.graduationYear}
              </p>
            )}
            {(member.jobTitle || member.currentCompany || member.location) && (
              <section aria-label="Career details">
                <h2>Career</h2>
                {member.jobTitle && <p><strong>Job title:</strong> {member.jobTitle}</p>}
                {member.currentCompany && <p><strong>Current company:</strong> {member.currentCompany}</p>}
                {member.location && <p><strong>Location:</strong> {member.location}</p>}
              </section>
            )}
            {member.bio && (
              <section aria-label="About">
                <h2>About</h2>
                <p className="csc-profile-bio">{member.bio}</p>
              </section>
            )}
            {(member.offersCoffee || member.offersMentorship || member.offersReferrals || member.offersResumeReview) && (
              <section aria-label="Help offered">
                <h2>Happy to help with</h2>
                <ul>
                  {member.offersCoffee && <li>Coffee chats</li>}
                  {member.offersMentorship && <li>Mentorship</li>}
                  {member.offersReferrals && <li>Referrals</li>}
                  {member.offersResumeReview && <li>Résumé reviews</li>}
                </ul>
              </section>
            )}
            {(member.githubUsername ||
              member.leetcodeUsername ||
              member.linkedinUsername ||
              member.personalWebsite?.startsWith("https://")) && (
              <section aria-label="External profiles">
                <h2>Profiles</h2>
                <ul className="csc-profile-links">
                  {member.githubUsername && (
                    <li>
                      <a
                        href={`https://github.com/${member.githubUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        GitHub
                      </a>
                    </li>
                  )}
                  {member.leetcodeUsername && (
                    <li>
                      <a
                        href={`https://leetcode.com/u/${member.leetcodeUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        LeetCode
                      </a>
                    </li>
                  )}
                  {member.linkedinUsername && (
                    <li>
                      <a
                        href={`https://www.linkedin.com/in/${member.linkedinUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        LinkedIn
                      </a>
                    </li>
                  )}
                  {member.personalWebsite?.startsWith("https://") && (
                    <li>
                      <a href={member.personalWebsite} target="_blank" rel="noopener noreferrer">Personal website</a>
                    </li>
                  )}
                </ul>
              </section>
            )}
            <section className="csc-profile-points" aria-label="Points">
              <h2>Points</h2>
              <p>
                <strong>{member.allTimePoints}</strong> total points
              </p>
              <p>
                30-day leaderboard:{" "}
                <strong>
                  {member.rank30Days ? `#${member.rank30Days}` : "Unranked"}
                </strong>
              </p>
            </section>
            {member.id === identity.id && (
              <Link to="/dashboard/account">Edit your profile</Link>
            )}
          </>
        )
      )}
    </article>
  );
}

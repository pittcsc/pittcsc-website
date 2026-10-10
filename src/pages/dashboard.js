import React, { useEffect } from "react";
import { Link, navigate } from "gatsby";
import AuthFrame from "../components/auth/AuthFrame";
import SessionStatus, {
  logoutToWebsite,
} from "../components/auth/SessionStatus";
import { useAuth } from "../components/auth/AuthProvider";
import { loginURL } from "../lib/auth/policy.mjs";
import MyAccount from "../components/account/MyAccount";
import StaffDashboard from "../components/staff/StaffDashboard";

// Links reused from the public site so there is one source for each.
const NEXT_STEPS = [
  {
    title: "Join the Discord",
    sub: "Announcements and project chats",
    href: "https://discord.gg/wzPeq2GCRT",
  },
  {
    title: "Add the Google Calendar",
    sub: "Never miss a meeting",
    href: "https://calendar.google.com/calendar/embed?src=f64u131to44gn3tn8g62ov2u1s%40group.calendar.google.com&ctz=America%2FNew_York",
  },
  {
    title: "Browse initiatives",
    sub: "Dev Lab, Mock Interviews, SteelHacks and more",
    href: "/initiatives",
  },
];

export default function Dashboard({ location }) {
  const auth = useAuth();
  useEffect(() => {
    void auth.revalidate();
    const recheck = () => {
      void auth.revalidate();
    };
    const visible = () => {
      if (document.visibilityState === "visible") recheck();
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [location.pathname, auth.revalidate]);
  useEffect(() => {
    if (auth.status === "signedOut") {
      void navigate(
        loginURL(location.pathname + location.search + location.hash),
        { replace: true },
      );
    }
  }, [auth.status, location.pathname, location.search, location.hash]);

  const authenticated = auth.status === "authenticated";
  const account = /^\/dashboard\/account\/?$/.test(location.pathname);

  // Only My Account offers logout and the website link; status screens keep
  // the website link so users are never stuck.
  return (
    <AuthFrame dashboard websiteLink={!authenticated || account}>
      {authenticated ? (
        <>
          {/^\/dashboard\/staff(?:\/|$)/.test(location.pathname) ? (
            <StaffDashboard
              key={auth.identity.id}
              identity={auth.identity}
              revalidate={auth.revalidate}
              pathname={location.pathname}
            />
          ) : account ? (
            <MyAccount key={auth.identity.id} identity={auth.identity} />
          ) : (
            <div className="csc-dashboard">
              <span className="csc-dashboard-tick" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#213f9d"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
              <h1>You’re in</h1>
              <p>
                Signed in as <strong>{auth.identity.email}</strong>. Here’s how
                to get plugged in.
              </p>
              <ul className="csc-dashboard-next">
                {NEXT_STEPS.map((step, index) => (
                  <li key={step.title}>
                    <a href={step.href}>
                      <span className="csc-dashboard-num">{index + 1}</span>
                      <span className="csc-dashboard-copy">
                        <strong>{step.title}</strong>
                        <span>{step.sub}</span>
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#1b2a4a"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
              <Link className="csc-dashboard-cta" to="/dashboard/account">
                Go to My Account
              </Link>
            </div>
          )}
          {account && (
            <button
              className="csc-auth-secondary"
              onClick={() => void logoutToWebsite(auth.signOut)}
            >
              Log out
            </button>
          )}
        </>
      ) : auth.status === "signedOut" ? (
        <p role="status">Taking you to sign-in…</p>
      ) : (
        <SessionStatus auth={auth} />
      )}
    </AuthFrame>
  );
}

export const Head = () => (
  <>
    <title>Your account | Pitt CSC</title>
    <meta name="robots" content="noindex" />
  </>
);

import React, { useEffect } from "react";
import { navigate } from "gatsby";
import AuthFrame from "../components/auth/AuthFrame";
import SessionStatus, {
  logoutToWebsite,
} from "../components/auth/SessionStatus";
import { useAuth } from "../components/auth/AuthProvider";
import { loginURL, safeReturnTo } from "../lib/auth/policy.mjs";
import MyAccount from "../components/account/MyAccount";
import StaffDashboard from "../components/staff/StaffDashboard";
import MemberHome from "../components/member/MemberHome";
import PointsLeaderboard from "../components/points/PointsLeaderboard";
import PointsProfile from "../components/points/PointsProfile";
import MemberDirectory from "../components/member/MemberDirectory";
import MemberProfile from "../components/member/MemberProfile";
import Foundry from "../components/member/Foundry";

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

  useEffect(() => {
    if (authenticated && !auth.identity.complete && !account) {
      const returnTo = safeReturnTo(
        location.pathname + location.search + location.hash,
      );
      void navigate(`/dashboard/account?${new URLSearchParams({ returnTo })}`, {
        replace: true,
      });
    }
  }, [
    authenticated,
    auth.identity?.complete,
    account,
    location.pathname,
    location.search,
    location.hash,
  ]);

  const returnTo = safeReturnTo(
    new URLSearchParams(location.search).get("returnTo"),
  );
  const memberID = /^\/dashboard\/members\/([0-9a-fA-F-]{36})\/?$/.exec(
    location.pathname,
  )?.[1];

  // Only My Account offers logout and the website link; status screens keep
  // the website link so users are never stuck.
  return (
    <AuthFrame dashboard websiteLink={!authenticated || account}>
      {authenticated && !auth.identity.complete && !account ? (
        <p role="status">Taking you to profile setup…</p>
      ) : authenticated ? (
        <>
          {/^\/dashboard\/staff(?:\/|$)/.test(location.pathname) ? (
            <StaffDashboard
              key={auth.identity.id}
              identity={auth.identity}
              revalidate={auth.revalidate}
              pathname={location.pathname}
            />
          ) : account ? (
            <MyAccount
              key={auth.identity.id}
              identity={auth.identity}
              onSaved={auth.revalidate}
              returnTo={returnTo}
            />
          ) : memberID ? (
            <MemberProfile
              key={memberID}
              identity={auth.identity}
              memberID={memberID}
            />
          ) : /^\/dashboard\/members\/?$/.test(location.pathname) ? (
            <MemberDirectory key={auth.identity.id} identity={auth.identity} />
          ) : /^\/dashboard\/foundry\/?$/.test(location.pathname) ? (
            <Foundry key={auth.identity.id} identity={auth.identity} />
          ) : /^\/dashboard\/points\/submissions\/?$/.test(
              location.pathname,
            ) ? (
            <PointsProfile
              key={auth.identity.id}
              identity={auth.identity}
              variant="submissions"
            />
          ) : /^\/dashboard\/points\/?$/.test(location.pathname) ? (
            <PointsLeaderboard
              key={auth.identity.id}
              identity={auth.identity}
            />
          ) : (
            <MemberHome
              key={auth.identity.id}
              identity={auth.identity}
              revalidate={auth.revalidate}
            />
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

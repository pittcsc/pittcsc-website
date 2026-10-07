import React, { useEffect } from "react";
import { navigate } from "gatsby";
import AuthFrame from "../components/auth/AuthFrame";
import SessionStatus, {
  logoutToWebsite,
} from "../components/auth/SessionStatus";
import { useAuth } from "../components/auth/AuthProvider";
import { loginURL } from "../lib/auth/policy.mjs";
import MyAccount from "../components/account/MyAccount";
import StaffDashboard from "../components/staff/StaffDashboard";

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

  return (
    <AuthFrame dashboard>
      {auth.status === "authenticated" ? (
        <>
          {/^\/dashboard\/staff(?:\/|$)/.test(location.pathname) ? (
            <StaffDashboard
              key={auth.identity.id}
              identity={auth.identity}
              revalidate={auth.revalidate}
            />
          ) : /^\/dashboard\/account\/?$/.test(location.pathname) ? (
            <MyAccount key={auth.identity.id} identity={auth.identity} />
          ) : (
            <>
              <h1>Your CSC account</h1>
              <p>
                You're signed in as <strong>{auth.identity.email}</strong>.
              </p>
              <p>Manage your club profile from My Account.</p>
            </>
          )}
          <button onClick={() => void logoutToWebsite(auth.signOut)}>
            Log out
          </button>
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

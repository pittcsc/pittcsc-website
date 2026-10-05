import React, { useEffect } from "react";
import { Link, navigate } from "gatsby";
import AuthFrame from "../components/auth/AuthFrame";
import SessionStatus, {
  logoutToWebsite,
} from "../components/auth/SessionStatus";
import { useAuth } from "../components/auth/AuthProvider";
import { loginURL } from "../lib/auth/policy.mjs";
import MyAccount from "../components/account/MyAccount";

export default function Dashboard({ location }) {
  const auth = useAuth();
  useEffect(() => {
    if (auth.status === "signedOut") {
      void navigate(
        loginURL(location.pathname + location.search + location.hash),
        { replace: true },
      );
    }
  }, [auth.status, location.pathname, location.search, location.hash]);

  return (
    <AuthFrame>
      {auth.status === "authenticated" ? (
        <>
          {/^\/dashboard\/account\/?$/.test(location.pathname) ? (
            <MyAccount key={auth.identity.id} identity={auth.identity} />
          ) : (
            <>
              <h1>Your CSC account</h1>
              <p>
                You're signed in as <strong>{auth.identity.email}</strong>.
              </p>
              <p>Manage your club profile from My Account.</p>
              <Link to="/dashboard/account">My Account</Link>
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

import React, { useEffect } from "react";
import { navigate } from "gatsby";
import AuthFrame from "../components/auth/AuthFrame";
import SessionStatus, {
  logoutToWebsite,
} from "../components/auth/SessionStatus";
import { useAuth } from "../components/auth/AuthProvider";
import { loginURL } from "../lib/auth/policy.mjs";

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
      <h1>Your CSC account</h1>
      {auth.status === "authenticated" ? (
        <>
          <p>
            You're signed in as <strong>{auth.identity.email}</strong>.
          </p>
          <p>Your account is ready. Club dashboard features are coming soon.</p>
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

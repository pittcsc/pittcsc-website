import React from "react";

export async function logoutToWebsite(signOut) {
  if (await signOut()) window.location.assign("/");
}

export default function SessionStatus({ auth }) {
  if (auth.status === "loading" || auth.status === "signingOut") {
    return (
      <p role="status">
        {auth.status === "signingOut"
          ? "Signing out…"
          : "Checking your session…"}
      </p>
    );
  }
  return (
    <div>
      <p role="alert">{auth.error}</p>
      {auth.status === "error" && (
        <button onClick={() => void auth.retry()}>Retry connection</button>
      )}
      <button
        className="csc-auth-secondary"
        onClick={() => void logoutToWebsite(auth.signOut)}
      >
        {auth.status === "logoutError" ? "Retry sign-out" : "Sign out"}
      </button>
    </div>
  );
}

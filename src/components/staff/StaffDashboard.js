import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { hasStaffRole } from "../../lib/auth/roles.mjs";
import { createAccountClient } from "../../lib/account/client.mjs";

export default function StaffDashboard({ identity, revalidate }) {
  const [access, setAccess] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const staff = hasStaffRole(identity);
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );

  useEffect(() => {
    if (!staff) return;
    let pending;
    const check = async () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      setAccess("loading");
      try {
        await request("/staff/access", {
          userID: identity.id,
          signal: controller.signal,
          responseType: "empty",
        });
        if (!controller.signal.aborted) setAccess("allowed");
      } catch (error) {
        if (controller.signal.aborted) return;
        setAccess(error.status === 403 ? "restricted" : "error");
        if (error.status === 401 || error.status === 403) void revalidate();
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", visible);
    return () => {
      pending?.abort();
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [identity, staff, request, revalidate, attempt]);

  if (!staff || access === "restricted")
    return (
      <>
        <h1>Access restricted</h1>
        <p>You need the staff role to access this page.</p>
        <Link to="/dashboard/account">Go to My Account</Link>
      </>
    );
  if (access === "loading") return <p role="status">Checking staff access…</p>;
  if (access === "error")
    return (
      <>
        <p role="alert">We couldn't verify staff access. Please try again.</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          Retry staff access
        </button>
      </>
    );
  return <h1>Staff Dashboard</h1>;
}

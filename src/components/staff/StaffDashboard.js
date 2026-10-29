import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { hasStaffRole } from "../../lib/auth/roles.mjs";
import { createAccountClient } from "../../lib/account/client.mjs";
import { staffRoute, STAFF_BASE } from "../../lib/staff/tools.mjs";
import StaffHome from "./StaffHome";
import { toolViews } from "./tools";
import "../../styles/staff/dashboard.scss";

// Guards every staff page with the API access check, then shows the staff home
// or the tool for this path. Each tool's API routes are authorized in Go.
export default function StaffDashboard({ identity, revalidate, pathname }) {
  const [access, setAccess] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [verified, setVerified] = useState(false);
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
        if (!controller.signal.aborted) {
          setVerified(true);
          setAccess("allowed");
        }
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
  if (access === "loading" && !verified)
    return <p role="status">Checking staff access…</p>;
  if (access === "error")
    return (
      <>
        <p role="alert">We couldn't verify staff access. Please try again.</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          Retry staff access
        </button>
      </>
    );
  const route = staffRoute(pathname);
  const Tool = route.view === "tool" && toolViews[route.tool.slug]?.Component;
  if (Tool)
    return (
      <>
        {access === "loading" && <p role="status">Checking staff access…</p>}
        {/* Keep drafts mounted, but hidden and inert during a successful
            recheck. Denial/error above still unmounts private tools. */}
        <div hidden={access !== "allowed"}>
          <Tool identity={identity} request={request} revalidate={revalidate} />
        </div>
      </>
    );
  if (access === "loading") return <p role="status">Checking staff access…</p>;
  if (route.view === "home") return <StaffHome />;
  return (
    <>
      <h1>Page not found</h1>
      <p>There's no staff tool at this address.</p>
      <Link to={STAFF_BASE}>Go to the Staff Dashboard</Link>
    </>
  );
}

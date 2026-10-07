import React from "react";
import { Link } from "gatsby";
import { useAuth } from "./AuthProvider";
import { hasStaffRole } from "../../lib/auth/roles.mjs";
import logo from "../../images/hero_image.png";
import "../../styles/auth.scss";

export default function AuthFrame({
  children,
  dashboard = false,
  websiteLink = true,
}) {
  const { status, identity } = useAuth();
  const authenticated = status === "authenticated";

  return (
    <div className="csc-auth-layout">
      {authenticated && (
        <header className="csc-auth-header">
          <Link className="csc-auth-logo" to="/" aria-label="Pitt CSC home">
            <img src={logo} alt="CSC at Pitt Logo" width={48} height={48} />
          </Link>
          <nav aria-label="Account navigation">
            {dashboard && hasStaffRole(identity) && (
              <Link
                className="csc-auth-nav-link"
                to="/dashboard/staff"
                activeClassName="is-current"
                partiallyActive
              >
                Staff
              </Link>
            )}
            <Link className="csc-auth-account" to="/dashboard/account">
              My Account
            </Link>
          </nav>
        </header>
      )}
      <main className="csc-auth">
        <div className="csc-auth-card">
          {!authenticated && (
            <Link className="csc-auth-brand" to="/">
              Pitt CSC
            </Link>
          )}
          {children}
          {websiteLink && (
            <Link className="csc-auth-website" to="/">
              Back to Website
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

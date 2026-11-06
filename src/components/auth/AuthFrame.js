import React, { useEffect, useState } from "react";
import { Link } from "gatsby";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "./AuthProvider";
import { dashboardLinks } from "../../lib/auth/navigation.mjs";
import logo from "../../images/hero_image.png";
// White-tile version for dark pages, where the navy panther would disappear.
import tileLogo from "../../images/icon.svg";
import "../../styles/auth.scss";

export default function AuthFrame({
  children,
  dashboard = false,
  websiteLink = true,
}) {
  const { status, identity } = useAuth();
  const authenticated = status === "authenticated";
  const links = authenticated ? dashboardLinks(identity, dashboard) : [];
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      document.querySelector(".csc-auth-menu-toggle")?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <div className="csc-auth-layout">
      {authenticated && (
        <header
          className={`csc-auth-header${links.length ? " csc-auth-header--menu" : ""}`}
        >
          <Link className="csc-auth-logo" to="/">
            <img src={logo} alt="" width={64} height={49} />
            <img
              className="csc-auth-logo-tile"
              src={tileLogo}
              alt=""
              width={44}
              height={44}
            />
            PittCSC
          </Link>
          {links.length > 0 && (
            <button
              type="button"
              className="csc-auth-menu-toggle"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="csc-auth-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <FontAwesomeIcon icon={menuOpen ? faXmark : faBars} />
            </button>
          )}
          <nav
            id="csc-auth-nav"
            className={menuOpen ? "is-open" : undefined}
            aria-label="Account navigation"
            onClick={(event) => {
              if (event.target.closest("a")) setMenuOpen(false);
            }}
          >
            {links.map(({ to, label, partiallyActive }) => (
              <Link
                key={to}
                className="csc-auth-nav-link"
                to={to}
                activeClassName="is-current"
                partiallyActive={partiallyActive}
              >
                {label}
              </Link>
            ))}
            <Link className="csc-auth-account" to="/dashboard/account">
              My Account
            </Link>
          </nav>
        </header>
      )}
      <main className="csc-auth">
        <div className="csc-auth-cardwrap">
          <div className="csc-auth-card">
            {!authenticated && (
              <Link className="csc-auth-brand" to="/">
                PittCSC
              </Link>
            )}
            {children}
            {websiteLink && (
              <Link className="csc-auth-website" to="/">
                Back to Website
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

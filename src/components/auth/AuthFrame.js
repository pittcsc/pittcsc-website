import React from "react";
import { Link } from "gatsby";
import { useAuth } from "./AuthProvider";
import logo from "../../images/hero_image.png";
import "../../styles/auth.scss";

export default function AuthFrame({ children }) {
  const { status } = useAuth();
  const authenticated = status === "authenticated";

  return (
    <div className="csc-auth-layout">
      {authenticated && (
        <header className="csc-auth-header">
          <Link className="csc-auth-logo" to="/" aria-label="Pitt CSC home">
            <img src={logo} alt="CSC at Pitt Logo" width={48} height={48} />
          </Link>
          <nav aria-label="Account navigation">
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
          <Link className="csc-auth-website" to="/">
            Back to Website
          </Link>
        </div>
      </main>
    </div>
  );
}

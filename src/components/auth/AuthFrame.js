import React from "react";
import { Link } from "gatsby";
import "../../styles/auth.scss";

export default function AuthFrame({ children }) {
  return (
    <main className="csc-auth">
      <div className="csc-auth-card">
        <Link className="csc-auth-brand" to="/">
          Pitt CSC
        </Link>
        {children}
        <Link className="csc-auth-website" to="/">
          Back to Website
        </Link>
      </div>
    </main>
  );
}

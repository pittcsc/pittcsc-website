import React from "react";
import { Link } from "gatsby";

export default function MemberLink({ id, children, ...props }) {
  return (
    <Link to={`/dashboard/members/${id}`} {...props}>
      {children}
    </Link>
  );
}

import React from "react"
import SEO from "../components/seo"

const Layout = ({ title, children }) => (
  <div>
    <SEO title={title} />
    <main>{children}</main>
  </div>
);

Layout.propTypes = {
  title: PropTypes.string,
};

export default Layout;

import React from "react";
import SEO from "../components/seo";
import { AnimatePresence } from "framer-motion";

const Layout = ({ title, children }) => (
  <div>
    <SEO title={title} />
    <AnimatePresence exitBeforeEnter>
      <main>{children}</main>
    </AnimatePresence>
  </div>
);

Layout.propTypes = {
  title: PropTypes.string,
};

export default Layout;

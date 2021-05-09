import React from "react";
import SEO from "../components/seo";
import PropTypes from "prop-types";
import { AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";

const Layout = ({ title, children }) => (
  <div>
    <Header />
    <SEO title={title} />
    <AnimatePresence exitBeforeEnter>
      <main key="main">{children}</main>
    </AnimatePresence>
    <Footer />
  </div>
);

Layout.propTypes = {
  title: PropTypes.string,
};

export default Layout;

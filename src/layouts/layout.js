import React from "react";
import SEO from "../components/seo";
import PropTypes from "prop-types";
import { AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";

const Layout = ({ title, header, children }) => {
  config.autoAddCss = false;

  return (
    <div>
      <Header title={header} />
      <SEO title={title} />
      <AnimatePresence exitBeforeEnter>
        <main key="main">{children}</main>
      </AnimatePresence>
      <Footer />
    </div>
  );
};

Layout.propTypes = {
  title: PropTypes.string,
};

export default Layout;

import React from "react";
import Seo from "../components/seo";
import PropTypes from "prop-types";
import { AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";

const Layout = ({ title, header, children }) => {
  return (
    <div>
      <Header title={header} />
      <Seo title={title} />
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

import React from "react";
import Seo from "../components/seo";
import PropTypes from "prop-types";
import { AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { CookiesProvider } from "react-cookie";

const Layout = ({
  title,
  description,
  image,
  robots,
  canonical,
  ogType,
  includeOrgJsonLd = true,
  jsonLd,
  header,
  children,
  showFooter = true,
}) => {
  return (
    <CookiesProvider>
      <div>
        <Header title={header} />
        <Seo
          title={title}
          description={description}
          image={image}
          robots={robots}
          canonical={canonical}
          ogType={ogType}
          includeOrgJsonLd={includeOrgJsonLd}
          jsonLd={jsonLd}
        />
        <AnimatePresence mode="wait">
          <main key="main">{children}</main>
        </AnimatePresence>
        {showFooter && <Footer />}
      </div>
    </CookiesProvider>
  );
};

Layout.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  image: PropTypes.string,
  robots: PropTypes.string,
  canonical: PropTypes.string,
  ogType: PropTypes.string,
  includeOrgJsonLd: PropTypes.bool,
  jsonLd: PropTypes.object,
  header: PropTypes.string,
  showFooter: PropTypes.bool,
};

export default Layout;

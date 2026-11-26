/**
 * SEO component that queries for data with
 * Gatsby's useStaticQuery React hook.
 *
 * See: https://www.gatsbyjs.com/docs/use-static-query/
 */

import React from "react";
import PropTypes from "prop-types";
import { Helmet } from "react-helmet";
import { useLocation } from "@reach/router";
import { useStaticQuery, graphql } from "gatsby";
import {
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  resolveImageUrl,
} from "../lib/site/seo.mjs";

const Seo = ({
  title,
  description,
  image,
  robots,
  canonical,
  ogType = "website",
  includeOrgJsonLd = true,
  jsonLd = null,
}) => {
  const { pathname } = useLocation();
  const { site } = useStaticQuery(query);
  const {
    defaultTitle,
    defaultDescription,
    siteUrl,
    defaultImage,
    lang,
    twitterUsername,
  } = site.siteMetadata;

  const isNoindex = typeof robots === "string" && robots.includes("noindex");
  const pageUrl = canonical || buildCanonicalUrl(siteUrl, pathname);
  const seo = {
    title: title || defaultTitle,
    description: description || defaultDescription,
    image: resolveImageUrl(siteUrl, image || defaultImage),
    url: pageUrl,
    lang: lang || "en",
  };
  const orgJsonLd = includeOrgJsonLd ? buildOrganizationJsonLd(siteUrl) : null;

  return (
    <Helmet title={seo.title}>
      <html lang={seo.lang} />
      <meta name="description" content={seo.description} />
      <meta name="image" content={seo.image} />
      {robots && <meta name="robots" content={robots} />}
      {!isNoindex && seo.url && <link rel="canonical" href={seo.url} />}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={defaultTitle} />
      {seo.url && <meta property="og:url" content={seo.url} />}
      {seo.title && <meta property="og:title" content={seo.title} />}
      {seo.description && (
        <meta property="og:description" content={seo.description} />
      )}
      {seo.image && <meta property="og:image" content={seo.image} />}
      <meta name="twitter:card" content="summary_large_image" />
      {twitterUsername && (
        <meta name="twitter:site" content={twitterUsername} />
      )}
      {twitterUsername && (
        <meta name="twitter:creator" content={twitterUsername} />
      )}
      {seo.title && <meta name="twitter:title" content={seo.title} />}
      {seo.description && (
        <meta name="twitter:description" content={seo.description} />
      )}
      {seo.image && <meta name="twitter:image" content={seo.image} />}
      {orgJsonLd && (
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
      )}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default Seo;

Seo.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  image: PropTypes.string,
  robots: PropTypes.string,
  canonical: PropTypes.string,
  ogType: PropTypes.string,
  includeOrgJsonLd: PropTypes.bool,
  jsonLd: PropTypes.object,
};

Seo.defaultProps = {
  title: null,
  description: null,
  image: null,
  robots: null,
  canonical: null,
  ogType: "website",
  includeOrgJsonLd: true,
  jsonLd: null,
};

const query = graphql`
  query SEO {
    site {
      siteMetadata {
        defaultTitle: title
        defaultDescription: description
        defaultImage: image
        siteUrl: url
        lang
        twitterUsername
      }
    }
  }
`;

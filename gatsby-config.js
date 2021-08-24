require("dotenv").config({
  path: `.env.${process.env.NODE_ENV}`,
});

module.exports = {
  siteMetadata: {
    title: "Pitt Computer Science Club",
    description:
      "Website for the largest computer science student organization at the University of Pittsburgh.",
    image: "/Pitt_CSC_Social_Card.png",
    lang: "en",
    url: "https://pittcsc.org",
    twitterUsername: "@PittCSC",
  },
  plugins: [
    {
      resolve: "gatsby-plugin-google-analytics",
      options: {
        trackingId: "UA-58446605-1",
      },
    },
    {
      resolve: `gatsby-plugin-sass`,
      options: {
        postCssPlugins: [
          require("tailwindcss")(require("./tailwind.config.js")),
        ],
      },
    },
    "gatsby-plugin-react-helmet",
    `gatsby-plugin-image`,
    "gatsby-transformer-sharp",
    `gatsby-plugin-sharp`,
    "gatsby-transformer-json",
    `gatsby-plugin-portal`,
    `gatsby-plugin-netlify`,
    "gatsby-plugin-svgr",
    {
      resolve: "gatsby-source-filesystem",
      options: {
        name: "images",
        path: "./src/images/",
      },
      __key: "images",
    },
    {
      resolve: "gatsby-source-filesystem",
      options: {
        name: "content",
        path: "./content",
      },
    },
    {
      resolve: "gatsby-plugin-manifest",
      options: {
        name: "Pitt Computer Science Club",
        short_name: "Pitt CSC",
        description:
          "Website for the largest computer science student organization at the University of Pittsburgh.",
        lang: `en`,
        start_url: "/",
        background_color: "#FFFFFF",
        display: `standalone`,
        icon: "src/images/icon.svg",
      },
    },
  ],
};

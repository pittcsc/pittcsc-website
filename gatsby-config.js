module.exports = {
  siteMetadata: {
    title: "Pitt Computer Science Club",
    description:
      "Website for the largest computer science student organization at the University of Pittsburgh.",
    image: "/Dark_Pitt_CSC_Social_Card.png",
    lang: "en",
    url: "https://pittcsc-crashtestdummy.netlify.app",
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
    {
      resolve: `gatsby-plugin-netlify`,
      options: {
        headers: {
          "/*": [
            "Content-Security-Policy: default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self';",
          ],
        },
      },
    },
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

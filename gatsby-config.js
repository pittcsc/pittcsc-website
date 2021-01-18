module.exports = {
  siteMetadata: {
    title: "Pitt CSC",
    author: "Pitt CSC",
    description: "Website for the largest computer science student organization at the University of Pittsburgh.",
  },
  plugins: [
    {
      resolve: "gatsby-plugin-google-analytics",
      options: {
        trackingId: "UA-58446605-1",
      },
    },
    "gatsby-plugin-sharp",
    "gatsby-plugin-react-helmet",
    "gatsby-transformer-sharp",
    "gatsby-plugin-postcss",
    "gatsby-transformer-json",
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
        name: "Pitt CSC",
        short_name: "Pitt CSC",
        start_url: "/",
        background_color: "#FFFFFF",
        display: "browser",
        icon: "src/images/icon.svg",
      },
    }
  ],
};

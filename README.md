# Pitt CSC Website
The new Pitt CSC Website, now built with Gatsby, Tailwind, and Framer Motion.

## How to run locally

```console
npm install
npm run develop
```

## Accessing Data in Content Folder

JSON files added to the Content folder are accessible via [GraphQL](https://www.gatsbyjs.com/docs/graphql/) using the [JSON gatsby transformer plugin](https://www.gatsbyjs.com/plugins/gatsby-transformer-json/).

Accessing site content through GraphQL queries is preferred over directly importing the JSON files to components.

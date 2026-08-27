# Pitt CSC Website
The new Pitt CSC Website, now built with Gatsby, Tailwind, and Framer Motion.

## How to run locally

```console
npm install
npm run develop
```

## Environment variables

Copy `.env.example` to `.env.development` and fill in what you need. Everything is
optional for local development.

## /meet

Group scheduling at `/meet`. It is intentionally not in the navbar — the shareable link
is the entry point.

**Storage.** The store is picked automatically, first match wins:

1. **Upstash Redis** — only if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   are set. Explicit config beats inference.
2. **Netlify Blobs** — used automatically on Netlify. No account, no signup, no
   environment variables.
3. **Local file** — the default off-platform. Correct for `npm run develop` and for
   self-hosting; on serverless it works but won't outlive the instance, and it says so
   at boot.

So a Netlify deploy needs no storage configuration. Confirm it after deploying with:

```console
curl https://pittcsc.org/api/meet/health
```

You want `"durable": true`. The response contains no credentials, so it is safe to hit
in production.

**Google Calendar import** is optional. Set `GATSBY_GOOGLE_CLIENT_ID` to an OAuth 2.0
Web application client ID with the Google Calendar API enabled. Without it the button is
hidden; `.ics` upload and manual entry still work. Only the `calendar.freebusy` scope is
requested, so event details are never readable.

## Accessing Data in Content Folder

JSON files added to the Content folder are accessible via [GraphQL](https://www.gatsbyjs.com/docs/graphql/) using the [JSON gatsby transformer plugin](https://www.gatsbyjs.com/plugins/gatsby-transformer-json/).

Accessing site content through GraphQL queries is preferred over directly importing the JSON files to components.

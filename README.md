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

1. **Upstash Redis** — if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are
   set. Free tier; the credentials are scoped to a single database.
2. **Netlify Blobs** — if the Blobs context is present, or if `NETLIFY_BLOBS_TOKEN` is
   set alongside the `SITE_ID` Netlify already provides. Netlify auto-wires Blobs for
   its own function runtime, but Gatsby Functions compile to a format that does not
   receive that context, so on this stack Blobs needs a token supplied by hand.
3. **Local file** — the default off-platform. Correct for `npm run develop` and for
   self-hosting; on serverless it works but won't outlive the instance, and says so.

**Production needs option 1 or 2.** Without either, meetings are written to a container
local disk and disappear. Confirm after deploying with:

```console
curl https://pittcsc.org/api/meet/health
```

You want `"durable": true`. If it reports `"store": "file"` the response also explains
why the durable option was skipped. It never contains a credential, so it is safe to
hit in production.

**Google Calendar import** is optional. Set `GATSBY_GOOGLE_CLIENT_ID` to an OAuth 2.0
Web application client ID with the Google Calendar API enabled. Without it the button is
hidden; `.ics` upload and manual entry still work. Only the `calendar.freebusy` scope is
requested, so event details are never readable.

## Accessing Data in Content Folder

JSON files added to the Content folder are accessible via [GraphQL](https://www.gatsbyjs.com/docs/graphql/) using the [JSON gatsby transformer plugin](https://www.gatsbyjs.com/plugins/gatsby-transformer-json/).

Accessing site content through GraphQL queries is preferred over directly importing the JSON files to components.

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

**Storage.** Meetings are written to a local file by default, which is fine for
`npm run develop` but *not* for a serverless deploy: each request can run in a fresh
container with an empty disk, so saved meetings would disappear. Set both of these in
your host's dashboard (Netlify: Site configuration → Environment variables) to use
Upstash Redis instead:

```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Check `GET /api/meet/health` after deploying — it reports the live store and whether it
is durable, and returns no credentials, so it is safe to hit in production.

**Google Calendar import** is optional. Set `GATSBY_GOOGLE_CLIENT_ID` to an OAuth 2.0
Web application client ID with the Google Calendar API enabled. Without it the button is
hidden; `.ics` upload and manual entry still work. Only the `calendar.freebusy` scope is
requested, so event details are never readable.

## Accessing Data in Content Folder

JSON files added to the Content folder are accessible via [GraphQL](https://www.gatsbyjs.com/docs/graphql/) using the [JSON gatsby transformer plugin](https://www.gatsbyjs.com/plugins/gatsby-transformer-json/).

Accessing site content through GraphQL queries is preferred over directly importing the JSON files to components.

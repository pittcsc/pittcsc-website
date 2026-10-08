# Local development

This guide applies to the public Gatsby site on `master`. Go, Supabase, and CRM
setup are separate on `crm-expansion`; use that branch's docs for those systems.
See [AGENTS.md](../AGENTS.md) and the [repository guide](REPOSITORY.md) before editing.

## Setup and runtime

Use a Gatsby-compatible Node/npm runtime. The existing tests and production build
were exercised with Node 24.21.0. Current runtime files disagree: `.nvmrc` and
Netlify's `NODE_VERSION` specify Node 20, while `.tool-versions` contains a legacy
Node 14 entry. Do not rely on that legacy entry for Gatsby 5 or the Node tests.
Resolving the runtime pins is separate work; this documentation does not change them.
There are no mise tasks on `master`; use the existing npm scripts.

From the repository root:

```sh
npm ci --legacy-peer-deps
npm run develop
```

Open http://localhost:8000. Setup uses the existing lockfile; do not introduce
another package manager or regenerate it as unrelated cleanup. No global Gatsby,
Docker, Go, or Supabase is required. Gatsby reloads edits; Ctrl+C stops your server.

| Command | Purpose |
| --- | --- |
| `npm ci --legacy-peer-deps` | Install locked dependencies |
| `npm run develop` | Start Gatsby on localhost:8000 |
| `npm test` | Run existing JavaScript tests; HTTP tests may skip without Gatsby |
| `npm run build` | Production Gatsby build |
| `npm run clean` | Clear generated Gatsby cache/output when needed |

## Optional integrations

The public site works without production credentials. Notion-backed events are
omitted without Notion configuration. Google Calendar import is hidden without
its client ID. Meeting storage uses local files without Upstash credentials;
production serverless meeting storage needs a durable adapter.

The root `.env.example` lists integration variables. If needed, create a
gitignored `.env.development` with relevant local/test values. Never overwrite
existing env files or copy production credentials for tests. Restart Gatsby
after configuration changes.

`GATSBY_*` variables are public browser configuration, not a place for privileged
keys. Legacy Notion credential names use that prefix; never import the token into
browser code or extend that naming pattern. See the repository guide's separate
security follow-ups. Do not paste private records, calendars, tokens, or env
contents into logs, screenshots, or issues.

## Verification

Run `npm test` for code changes and `npm run build` for frontend/runtime/build
changes. Docs changes need local link/content review and credential review.
Always run `git diff --check`. See the repository guide's verification matrix
for focused and manual checks; a build does not prove appearance, accessibility,
or QR scannability.

The existing HTTP suite writes data and skips without a reachable Gatsby server.
For meeting changes, use your own server with isolated local storage. For example,
in one terminal with a compatible Node runtime:

```sh
meet_test_storage=$(mktemp -d)
MEET_DATA_DIR="$meet_test_storage" \
  UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= \
  GATSBY_NOTION_TOKEN= GATSBY_NOTION_DATABASE_ID= \
  GATSBY_GOOGLE_CLIENT_ID= npm run develop
```

Confirm the server uses that isolated file store, then run in a second terminal:

```sh
MEET_TEST_BASE=http://127.0.0.1:8000 node --test tests/meet/api.test.mjs
```

Never aim these tests at hosted data. The existing suite does not enforce
loopback targets, require execution, manage a server, or clean up storage.
Check that all 16 HTTP tests executed. Stop only your own server afterward and
clean up only the temporary data you created. Do not stop unknown processes or
change shared data to make a test pass.

Local integration testing found an existing concurrency failure: twelve
simultaneous submissions can exhaust six compare-and-set attempts and return
HTTP 409. Report failures and skips honestly; a fix is a separate application task.

## Scope and follow-ups

Public-site PRs target `master`; CRM PRs target `crm-expansion`. Propagating
shared instructions to the other branch is separate work. This guidance adds no
CI jobs, test infrastructure, runtime upgrades, or hosting changes.

The scheduled Netlify workflow currently embeds a build hook. Do not print or
reuse that deployment credential. Rotating it and moving the replacement to a
GitHub Actions secret require a separate security fix and maintainer rollout.
Instructions alone do not enforce behavior; automated checks and branch
protection require their own scoped tasks.

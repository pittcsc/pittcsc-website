# Repository guide

This map describes the active implementation in the `master` checkout.
CRM-specific implementation lives on a separate branch. See
[local development](DEVELOPMENT.md) for setup and testing procedures.

## Code map and boundaries

| Area | Implementation and source of truth |
| --- | --- |
| Public pages | `src/pages/`, shared `src/layouts/layout.js`, Header/Footer, SEO, Tailwind and `src/styles/` |
| Officers and initiative leads | `src/components/data.js`, consumed by `/about`; inspect consumers before editing `content/` JSON |
| Sponsors | Data and presentation in `src/pages/sponsors.js`; package PDF in `static/` |
| Initiatives | Route wrappers, `src/data/` content modules, and `src/components/InitiativeTemplate.js` |
| Public events and RSVP | Notion nodes in `gatsby-node.js`, public page GraphQL, `eventItem.js`, and Gatsby `/api/attendance` |
| Projects | GraphQL project schema and `/projects`; spreadsheet sourcing is currently commented out |
| Meeting scheduler | `/meet` pages/components, `src/lib/meet/`, Gatsby `src/api/meet/`, and `tests/meet/` |
| Branded QR generator | `/qr`, browser-loaded `qr-code-styling`, and the QR logo asset |
| CRM/auth | Separate `crm-expansion` branch; no Go API, Supabase setup, login or dashboard on `master` |
| Local tooling | Existing npm scripts in `package.json`, `package-lock.json`, and legacy runtime files |
| Hosting | `netlify.toml`, Gatsby route configuration, and scheduled Netlify hook |

`src/images/` assets are imported through Gatsby/Webpack. `static/` files are
served at root URLs, and PDFs under `src/downloads/` are imported by components.
Preserve filenames/case and existing external links. Gatsby's JSON transformer
makes sourced `content/` JSON available through GraphQL, but inspect page consumers
before editing: the sources in the table are the active ones. Use GraphQL where
content is already sourced that way; do not migrate sources as incidental work.

Keep browser-only imports and storage guarded or dynamically loaded so Gatsby
server rendering and hydration work. Preserve `/meet`, `/qr`, Gatsby functions,
and the `/zoom`, `/blog`, and initiative redirects. Future dashboard fallbacks
must be scoped, not a catch-all over public routes.

## Public tools

The [public-tools guide](PUBLIC_TOOLS.md) documents meeting semantics, calendar
privacy, persistence, and QR export requirements. Local integration setup is in
[development instructions](DEVELOPMENT.md#verification).

## CRM boundary

`master` does not contain the Go API, Supabase configuration, login, or dashboard.
Inspect `crm-expansion` and its architecture/authentication docs when assigned
CRM work. Do not merge CRM implementation into a public-site or shared-tooling PR.

Agreed CRM decisions are Supabase email OTP and additive roles: `member`,
`foundry`, `staff`, and `alumni`. Supabase Auth owns identities and sessions;
Go owns business logic and authorization. Database-backed roles, account status,
ownership, and permitted fields must be enforced server-side. Client guards
and user metadata are not security boundaries. New users cannot self-escalate.

Private data must be fetched at runtime, never embedded in Gatsby public pages.
Schema/policy changes require versioned migrations. CRM attendance requires an
explicit authenticated POST confirmation, never a GET, QR scan, or login side
effect. The existing Notion RSVP counter is not authenticated CRM attendance.

## Verification matrix

| Change | Required checks beyond diff/content review |
| --- | --- |
| Agent/docs guidance | Local link/content review and credential review |
| Application/tooling code | `npm test` and credential review |
| Frontend/runtime/build | Above plus `npm run build`; inspect direct navigation and hydration |
| Meeting APIs/model/storage | Above plus existing HTTP tests against isolated local Gatsby; exercise retries, duplicate names and concurrent writes |
| Meeting calendar/time UI | Meeting checks plus DST, multiple imports, manual edits and presets |
| Public UI/content/assets | Build plus changed pages at mobile/desktop widths, keyboard/focus, SEO and asset/download links |
| QR generator | Build plus scan PNG/SVG exports with transparent and white backgrounds on suitable backdrops |
| Routing/hosting config | Build plus direct visits/refreshes of affected routes, public/API routes and existing redirects |

Always run `git diff --check`. A Gatsby build and HTTP tests do not verify visual
appearance, keyboard behavior, or QR scannability. Report manual checks actually
performed and any unavailable checks. No new browser-test framework is required
by this setup.

For meeting HTTP integration, follow the
[isolated local testing procedure](DEVELOPMENT.md#verification). That procedure
covers server startup, integration configuration, storage isolation, and skips;
do not point these write tests at hosted data.

Review changed files and diffs for credentials without printing private env
contents or raw secrets. Automated secret scanning and new CI checks are separate
tooling follow-ups, not features provided by this documentation.

## Known limitations and separate follow-ups

- `src/api/attendance.js` is a legacy Notion RSVP counter, despite its filename.
  It accepts browser-supplied page IDs/increments without authentication or robust
  validation. Read-then-update can lose concurrent changes, and cookies do not
  establish identity or prevent duplicate writes. Do not reuse it for CRM attendance.
  Authentication, validation, idempotency and an explicit migration of RSVP behavior
  require a separate application task.
- Legacy Notion env names have the public `GATSBY_` prefix. They are used in
  Gatsby/server integration code but are unsuitable for privileged credentials.
  Rename and verify generated-bundle exposure in a dedicated credential migration;
  never extend this naming pattern or import the token into browser modules.
- Notion sourcing and the RSVP path log raw records/request bodies/responses and
  expose raw errors. Redact/remove these in a separate application fix; do not use
  real member data or hosted Notion credentials for tests or share these logs.
- Meeting creation checks code availability before an unconditional put; unlike
  response mutation, creation is not an atomic claim. Code collisions remain a
  separate correctness follow-up.
- The real `/meet` HTTP concurrency test currently fails: a twelve-submission
  burst can exhaust the store's six compare-and-set attempts and return HTTP 409.
  This was observed in local integration testing; ordinary tests can skip the
  HTTP suite without Gatsby. A rejected submission is not evidence that a
  successful write was lost. Fix burst handling or agree on a retry contract in a
  separate application task; do not hide the failure by weakening or skipping
  the test.
- The tracked `.cursor/debug.log` and `package.json.bak` are legacy artifacts,
  not implementation/configuration sources. Do not add agent transcripts, logs,
  credentials, or new backup files to source control; cleanup is separate work.
- The locked npm dependency tree reports security advisories and legacy plugin
  compatibility/deprecation warnings. Triage upgrades in a separate task with
  public-site compatibility checks; do not apply forced audit fixes as cleanup.

## Agent loading and maintainer rollout

`AGENTS.md` is canonical. `CLAUDE.md` imports it using `@AGENTS.md` so older and
current Claude Code sessions use the same rules. Codex discovers root instructions;
other agents must be configured to read this file. See official
[Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
and [Claude imports](https://code.claude.com/docs/en/memory). Check a new session's
loaded instructions (Claude `/context`); do not maintain copied rule sets.

Instructions guide agents; they do not enforce behavior. Authorization, privacy,
migration review, and UI quality still require focused tests and human review.
New CI, secret scanning, branch protection, and propagation to the CRM branch
are separate tasks. This PR adds no automated checks or runtime changes.

The scheduled Netlify workflow currently embeds a build hook. Treat it as a
deployment credential: do not print, quote, or reuse it. Rotating the hook and
moving its replacement to a GitHub Actions secret require a separate security
fix and maintainer rollout. This documentation does not modify the workflow,
rotate credentials, change hosted settings, or erase existing git history.

# Shared agent instructions

## Context and scope

- Read [CONTRIBUTING.md](CONTRIBUTING.md), the relevant sections of
  [docs/REPOSITORY.md](docs/REPOSITORY.md), and the relevant issue when supplied.
  For CRM/auth work on `crm-expansion`, also read that branch's architecture and
  authentication docs; do not assume those implementations exist on `master`.
- Inspect consumers, code, tests, and configuration before changing behavior.
  Code establishes what exists; issues and architecture describe requirements,
  including planned features. Resolve conflicting requirements before implementing.
- The public Gatsby site must retain its appearance and existing functionality.
  Build the CRM in separate dashboard routes; do not migrate frontend frameworks
  or replace existing Notion/meeting integrations without an explicit request.
- `master` contains the public Gatsby site and accountless tools, not the Go API
  or Supabase authentication setup. CRM development is on `crm-expansion`;
  inspect the target checkout to distinguish implemented behavior from plans.

## Development workflow

- Use the existing npm scripts for the public site. `master` has no mise tasks;
  its runtime files currently disagree. Read CONTRIBUTING.md for the tested
  runtime and setup instead of assuming the legacy pin is usable.
- `npm run develop` starts Gatsby at localhost:8000. No Docker, Go, or Supabase
  is required on `master`. Preserve existing env files; do not change runtime
  pins, deployment configuration, or tooling as incidental cleanup.
- Use npm and the existing `package-lock.json`; do not introduce another package
  manager or regenerate lockfiles as unrelated cleanup.
- Match nearby JS/JSX style; use `.mjs` for Node scripts/tests. Keep Gatsby's
  CommonJS configuration compatible; do not switch the root package to ESM just
  to silence Node's module-detection warnings.
- Keep changes scoped to the task. Inspect git status first and preserve unrelated
  changes. Avoid repo-wide formatting, dependency upgrades, or generated-file edits.
- CRM PRs target `crm-expansion`; public-site PRs target `master`. Shared tooling
  uses the task's requested target (otherwise the current branch); carrying it to
  the other branch and merging `crm-expansion` into `master` are separate actions.
- Commit, push, open/modify PRs or issues, deploy, or change hosted settings only
  when authorized. Discussion/review requests do not authorize implementation.

## Public site, content, and browser boundaries

- Preserve existing responsive layouts, branding, navigation, SEO, animations,
  analytics behavior, and asset URLs unless the task requests their change.
- Inspect the active data source: officers/leads use `src/components/data.js`,
  sponsors are defined in their page, and initiatives use `src/data/` with the
  shared template. Existing `content/` JSON is not automatically authoritative.
- Reuse the existing public layout, initiative template, Tailwind/SCSS conventions,
  and image pipeline. Preserve static download links and redirect destinations.
- Keep DOM/canvas-dependent imports and browser storage out of server rendering.
  Check direct visits, refreshes, and hydration as well as client navigation.
- Preserve existing redirects and Gatsby API routes. If adding dashboard routes
  in a CRM task, scope their fallbacks so they do not swallow `/meet`, public
  pages, or functions with a catch-all rewrite.
- Use semantic controls, labels, keyboard access, visible focus, and image alt
  text. Check changed UI at mobile and desktop widths. Do not send private
  identities or calendar data to analytics, logs, or screenshots in handoffs.

## Meeting and QR tools

- `/meet` is intentionally accountless. Its participant IDs/name-conflict flow
  are convenience identity, not CRM authentication; do not conflate the systems.
- Preserve 30-minute slots and the unavailable/if-needed/available states, pending
  vs submitted participants, timezone/DST projection, and ranking consistency.
- Combine calendar imports; preserve manual overrides and calendar-aware presets.
  Process ICS locally, request only Google free/busy access, revoke transient
  tokens, and send only derived availability to the meeting API.
- Keep meeting persistence server-side. Preserve compare-and-set retries and
  atomic writes across processes; an in-memory queue alone is insufficient.
  Production serverless storage must be durable; health must report failures and
  file-store limitations honestly, without credentials.
- Preserve QR logo placement, quiet margins, high error correction, PNG/SVG
  exports, and transparent/white backgrounds. Verify exported codes scan;
  generating or opening a QR must never create attendance.

## Security and future CRM boundaries

The CRM rules below apply when working on that system; they do not imply that
Go, Supabase, login, roles, or dashboard routes exist on `master`.

- Supabase Auth owns identities, OTP verification, and sessions. Go owns CRM
  business logic, authorization, and database access. Do not build custom OTP logic.
- Go must verify access tokens and enforce current database-backed roles, account
  status, ownership, and allowed fields on protected requests. UI guards are not
  security boundaries; browser-supplied roles/user IDs are not authoritative.
- Roles are additive, not mutually exclusive. New accounts default to `member`;
  users cannot self-assign `staff`, `foundry`, or `alumni`. Do not invent additional
  privileges for foundry/alumni without an agreed requirement.
- CRM login must enforce exact Pitt email domains, validated same-site return
  paths, current-session DB checks, and logout cleanup/retry behavior.
  Authentication proves identity only; CRM endpoints must also authorize access.
- Fetch private dashboard data at runtime. Never include private records in Gatsby
  build-time data or generated public pages.
- Commit every application schema/policy change as a Supabase migration. Add local
  fixtures where relevant; do not change Supabase-managed auth tables ad hoc.
- Keep local, staging, and production data/credentials separate. Never commit or
  print secrets, raw Supabase status output, access tokens, or personal member data.
  `GATSBY_*` variables are public; privileged keys belong server-side. Examples use
  placeholders. Preserve existing env files.
- Legacy Notion credential names start with `GATSBY_`; this is a known risk, not
  a naming precedent. Never import those credentials into browser code or extend
  their use. See the known limitations in the repository guide.
- Never reset/drop a database, delete shared files, or apply remote migrations
  without explicit authorization for the target and operation.

## Verification and handoff

- Add focused behavior tests; for bugs, add a regression test. Cover denied access,
  validation failures, retries, duplicate/concurrent writes, and role combinations
  when relevant, not only the happy path.
- Run `npm test` for code changes and `npm run build` for frontend, runtime,
  or build changes. On a branch containing Go, use its pinned toolchain and
  format changed Go files with `gofmt`. Documentation-only changes need local
  link/content review, credential review, and `git diff --check`.
- Meeting/API changes need the existing HTTP tests against local Gatsby with
  isolated local data and hosted integrations disabled; see the repository guide.
  Normal tests may skip them without Gatsby. Never report skipped tests as passing
  or aim write tests at hosted data; the existing suite does not enforce that guard.
- Auth/migration changes on the CRM branch also need its local OTP integration
  and SQL hook checks. UI changes need the guide's manual checks.
- Review the diff for unrelated changes and credential exposure. Report completed
  behavior, checks run, failures/skips, and remaining limitations accurately.
- Update docs when behavior/setup changes. Edit `docs/DEVELOPMENT.md` directly;
  root `CONTRIBUTING.md` is a symlink to it. Keep this file concise and link to
  detailed docs instead of duplicating them.

## Code Review Rules

- Flag missing server-side authorization, self-escalation paths, private data in
  public output, schema changes without migrations, and unsafe credential handling.
- CRM attendance requires an explicit authenticated confirmation. QR scans, GET
  requests, and login completion must not record attendance automatically.
- External Calendar/Drive retries and attendance submissions must be idempotent;
  failures must not silently lose the underlying event or create duplicate records.
- Legacy Notion RSVP counts are distinct from CRM attendance and lack its security
  guarantees. Flag unsafe legacy behavior; fix it only within an authorized task.
- Agent instructions are guidance, not enforcement. Do not weaken existing tests
  or claim they prove authorization, privacy, or UI quality. New CI and enforcement
  tooling require their own scoped task.

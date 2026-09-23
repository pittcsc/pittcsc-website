# Agent instructions

## Context and scope

- Read [CONTRIBUTING.md](CONTRIBUTING.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
  and the relevant issue before implementation. Inspect the code to distinguish
  implemented behavior from planned features; do not assume an issue is complete.
- The public Gatsby site must retain its appearance and existing functionality.
  Build the CRM in separate dashboard routes; do not migrate frontend frameworks
  or replace existing Notion/meeting integrations without an explicit request.
- Current decisions supersede the older architecture document where it still
  describes only two roles or an undecided sign-in method: use Supabase email OTP
  and multiple roles per user: `member`, `foundry`, `staff`, `alumni`.
- The Go skeleton and local development setup already exist. Authentication and
  CRM implementation status must be checked in code, not inferred from this file.

## Development workflow

- Use mise for the pinned Node and Go runtimes; `.tool-versions` is the shared
  version list. Use `mise exec -- <command>` for commands outside defined tasks.
- `mise run setup` installs locked dependencies, starts local Supabase, and creates
  missing env files. It preserves existing env files and does not reset the database.
- `mise run dev` starts Supabase, Gatsby, and Go. Docker must be running.
  See CONTRIBUTING.md for separate-server commands and local addresses.
- Use npm and the existing `package-lock.json`; do not introduce another package
  manager or regenerate lockfiles as unrelated cleanup.
- Keep changes scoped to the requested issue. Preserve unrelated worktree changes.
  Feature PRs target `crm-expansion`; merging that branch into `master` is separate.
- Commit, push, open/modify PRs or issues, deploy, or change hosted settings only
  when authorized. Discussion/review requests do not authorize implementation.

## Architecture and security

- Supabase Auth owns identities, OTP verification, and sessions. Go owns CRM
  business logic, authorization, and database access. Do not build custom OTP logic.
- Go must verify access tokens and enforce current database-backed roles, account
  status, ownership, and allowed fields on protected requests. UI guards are not
  security boundaries; browser-supplied roles/user IDs are not authoritative.
- Roles are additive, not mutually exclusive. New accounts default to `member`;
  users cannot self-assign `staff`, `foundry`, or `alumni`. Do not invent additional
  privileges for foundry/alumni without an agreed requirement.
- Fetch private dashboard data at runtime. Never include private records in Gatsby
  build-time data or generated public pages.
- Commit every application schema/policy change as a Supabase migration. Add local
  fixtures where relevant; do not change Supabase-managed auth tables ad hoc.
- Keep local, staging, and production data/credentials separate. Never commit or
  print secrets, raw Supabase status output, access tokens, or personal member data.
  `GATSBY_*` variables are public; privileged keys belong server-side. Examples use
  placeholders. Preserve existing env files.
- Never reset/drop a database, delete shared files, or apply remote migrations
  without explicit authorization for the target and operation.

## Verification and handoff

- Add focused behavior tests; for bugs, add a regression test. Cover denied access,
  validation failures, retries, duplicate/concurrent writes, and role combinations
  when relevant, not only the happy path.
- Run `mise run check` for code changes and `mise run build` for frontend, runtime,
  or build changes. Format changed Go files with `gofmt` using the mise toolchain.
  Documentation-only changes need link/content review and `git diff --check`.
- Existing `/meet` HTTP tests skip without Gatsby running. Do not report skipped
  tests as passing; perform relevant local integration checks for changed flows.
- Review the diff for unrelated changes and credential exposure. Report completed
  behavior, checks run, failures/skips, and remaining limitations accurately.
- Update docs when behavior/setup changes. Edit `docs/DEVELOPMENT.md` directly;
  root `CONTRIBUTING.md` is a symlink to it. Keep this file concise and link to
  detailed docs instead of duplicating them.

## Code Review Rules

- Flag missing server-side authorization, self-escalation paths, private data in
  public output, schema changes without migrations, and unsafe credential handling.
- Attendance requires an explicit authenticated confirmation. QR scans, GET
  requests, and login completion must not record attendance automatically.
- External Calendar/Drive retries and attendance submissions must be idempotent;
  failures must not silently lose the underlying event or create duplicate records.

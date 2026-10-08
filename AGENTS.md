# Repository agent guidance

Read [development instructions](docs/DEVELOPMENT.md) for setup and testing, and
the [repository guide](docs/REPOSITORY.md) for code boundaries and detailed invariants.

## Branches and tooling

- `master` contains the public Gatsby site and accountless tools. CRM development
  lives on `crm-expansion`; do not assume CRM, Go, or Supabase code exists on `master`.
- Public-site PRs target `master`; CRM PRs target `crm-expansion`.
  CRM-specific rules are documented with that branch, not specified here.
- Use npm and the existing `package-lock.json`; do not introduce another package manager.
- Do not change frameworks, runtime pins, deployment configuration, or dependencies
  as incidental cleanup. Runtime files currently disagree; see the development docs.
- `CONTRIBUTING.md` is a symlink to `docs/DEVELOPMENT.md`; edit the target directly.

## Public site and content

- Officers and initiative leads come from `src/components/data.js`.
- Sponsors are defined separately in `src/pages/sponsors.js`.
- Initiatives use `src/data/` and the shared initiative template.
- `content/` files are not automatically authoritative; inspect their consumers
  before editing or moving data sources.
- Preserve the public Gatsby site's appearance, asset URLs, and existing redirects.
  Keep browser-only imports and storage out of Gatsby server rendering.

## Meeting tools

- `/meet` is intentionally accountless and separate from CRM authentication.
  Its browser-held participant IDs are not authenticated club identities.
- Preserve 30-minute slots, unavailable/if-needed/available states, and the
  distinction between pending and submitted participants.
- Preserve calendar imports, manual overrides, calendar-aware presets, and
  timezone/DST projection; detailed behavior is in the repository guide.
- Keep persistence server-side, including atomic writes and compare-and-set retries.
- Never point meeting tests at hosted or production data. The existing HTTP suite
  does not enforce this; use the isolated local setup in the development docs.

## Environment boundaries

- `GATSBY_*` variables are browser-exposed and must never contain secrets.
- Legacy Notion credential names use that prefix: this is a documented risk, not
  a precedent. Never import those credentials into browser modules.

## Verification

- Normal code changes: `npm test`.
- Frontend, runtime, or build changes: also `npm run build`.
- Meeting changes: follow the [development testing instructions](docs/DEVELOPMENT.md#verification).
- Documentation-only changes: `git diff --check`.
- Explicitly report skipped tests. Meeting HTTP tests can skip when Gatsby is absent;
  skipped tests are not passing tests.

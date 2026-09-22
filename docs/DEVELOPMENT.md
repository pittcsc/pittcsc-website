# Local development

The existing Gatsby site runs alongside a Go API and local Supabase. The current
API implements database readiness at `/health`; authentication and CRM features
will be added separately. No database tables or seed accounts are needed yet.

## Quick start

One-time prerequisites:

- Git and [mise](https://mise.jdx.dev/installing-mise.html). On macOS with
  Homebrew: `brew install mise`.
- Docker Desktop (or a compatible engine), installed and running. Mise manages
  Node and Go; Docker runs local Supabase, not Gatsby or Go.
- macOS command-line developer tools if not already installed: `xcode-select --install`.
- macOS or Linux; on Windows use WSL2 with Docker Desktop's WSL integration.

After cloning, from the repository root:

```sh
mise trust
mise run setup
mise run dev
```

Open http://localhost:8000. The first run requires internet access and can take
several minutes to download runtimes, dependencies, and Docker images.

`mise trust` approves this checkout's task configuration; review it before trusting
an unfamiliar repository. Mise tasks automatically install/use the exact Node and
Go versions in `.tool-versions`. No nvm, separately installed Go, global npm
packages, or shell activation is required. To run an arbitrary command with the
project's runtimes, use `mise exec -- <command>`.

`mise run setup` checks Docker, runs `npm ci --legacy-peer-deps` and
`go mod download`, starts local Supabase, and reads its local connection details.
It creates `.env.development` and `backend/.env` from their examples only when
missing. Existing env files are never overwritten, and no database reset runs.
Both files are gitignored; admin and storage keys are not copied.

The public site works without production credentials. Notion-backed events are
omitted without Notion configuration; Google Calendar import is hidden without
its client ID; `/meet` uses local file storage without Upstash credentials.
Authentication and CRM features are not implemented yet.

## Daily commands

| Command | Purpose |
| --- | --- |
| `mise run dev` | Start local Supabase, Gatsby, and Go together |
| `mise run setup` | Reinstall locked dependencies after cloning or dependency changes |
| `mise run db:start` | Start only Supabase and create any missing env files |
| `mise run db:stop` | Stop Supabase, preserving local data |
| `mise run check` | Run JavaScript tests and Go tests, vet, and build; no Docker needed |
| `mise run build` | Production Gatsby build |
| `mise exec -- npm run clean` | Clear Gatsby's generated cache/output |

Ctrl+C stops the application servers. Supabase stays running in Docker until
`mise run db:stop`. Normal startup never deletes your database.
Gatsby reloads frontend edits automatically. The minimal Go server currently
needs a restart after backend code changes.

For frontend-only work without Docker: `mise exec -- npm ci --legacy-peer-deps`,
then `mise exec -- npm run develop`. The public site does not need the new API.

## Local configuration details

Setup fills the values below automatically. To inspect your local connection
details manually, use `mise exec -- npx supabase status`. Its output includes
secrets; do not paste it into issues or commit it.

### Frontend: `.env.development`

```dotenv
GATSBY_API_URL=http://localhost:8080
GATSBY_SUPABASE_URL=http://127.0.0.1:54321
GATSBY_SUPABASE_PUBLISHABLE_KEY=YOUR_LOCAL_PUBLISHABLE_KEY
```

Use the Publishable key printed by `npx supabase status`. These variables are
public browser configuration for the upcoming dashboard; adding them does not
yet initialize authentication or change the public website. Restart Gatsby after
editing them. Never put a Supabase secret/service-role key, database password, or
S3 credential in a `GATSBY_*` variable.

The root example also documents existing Gatsby integrations. Their server-side
credentials are separate from the new Go API configuration.

### Backend: `backend/.env`

```dotenv
HOST=127.0.0.1
PORT=8080
FRONTEND_ORIGIN=http://localhost:8000
DATABASE_URL=postgresql://postgres:YOUR_LOCAL_PASSWORD@127.0.0.1:54322/postgres?sslmode=disable
```

Use the database URL printed by `npx supabase status`, adding `sslmode=disable`
only for the local Docker database. The Go process loads `backend/.env` when
started with `npm run dev:api`; existing process environment variables take
precedence. It does not load Gatsby's environment file.

The health endpoint connects directly to Postgres and does not need Supabase
admin, storage, or S3 keys. Keep these unused credentials out of the frontend.

`FRONTEND_ORIGIN` is the single browser origin allowed by the API's CORS headers.
If you open Gatsby at `http://127.0.0.1:8000` instead of `http://localhost:8000`,
update this value to match. CORS is not authentication.

## Run the application

Use `mise run dev` for both servers. If you prefer separate terminals, keep
Supabase running and use:

```sh
# Terminal 1
mise exec -- npm run develop
```

```sh
# Terminal 2
mise exec -- npm run dev:api
```

Go dependencies are downloaded on the first run. Their versions and checksums
are tracked in `backend/go.mod` and `backend/go.sum`.

| Service | Local address |
| --- | --- |
| Gatsby | http://localhost:8000 |
| Go API health | http://localhost:8080/health |
| Supabase API/Auth | http://127.0.0.1:54321 |
| Postgres | 127.0.0.1:54322 |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit test inbox | http://127.0.0.1:54324 |

Verify the database connection:

```sh
curl --fail-with-body http://localhost:8080/health
```

A successful response is HTTP 200 with:

```json
{"database":"connected","status":"ok"}
```

If the database is unavailable, the API returns HTTP 503 with an `unavailable`
status. Each database check has a two-second timeout. Connection credentials and
raw database errors are not returned to clients. This endpoint is a readiness
check, not a database-independent liveness check.

Press Ctrl+C in each application terminal to stop Gatsby and Go. The API drains
requests and closes its database pool on shutdown. Stop Supabase separately with
`mise run db:stop`; no reset is needed for normal development.

## Backend checks

```sh
mise run check
```

Unit tests cover database availability, cancellation, HTTP routing, and allowed
browser origins without requiring a running database. Use the curl check above
to verify the real local database connection.
The existing `/meet` HTTP integration tests skip when Gatsby is not running;
the remaining JavaScript tests and Go tests run in `mise run check` and CI.

## Runtime versions and CI

`.tool-versions` is the shared Node/Go version list used by mise locally and in
the development-checks GitHub workflow. `.nvmrc` remains for compatibility with
nvm users, not as an onboarding requirement. Netlify's `NODE_VERSION` matches
the Node pin, and `backend/go.mod` currently matches the Go pin. Tests detect drift.
When upgrading, update the matching pins, run `mise install`, rerun setup to
reinstall native Node dependencies, and verify `mise run check` and `mise run build`.

PRs targeting `crm-expansion` or `master` run the same checks and a Gatsby build
using mise. They do not deploy, start Supabase, or need production credentials.

## Troubleshooting

- **`mise` not found:** install it using the link above, then open a new terminal.
- **Docker unavailable:** start Docker Desktop and wait for its engine to be ready,
  then rerun setup. Do not use `sudo` for project setup.
- **Ports in use:** stop the conflicting local process; defaults are listed above.
- **Old credentials or custom env files:** setup preserves them deliberately.
  Compare the files with the examples and update only the relevant fields from
  local Supabase status. Restart the app servers after changes.
- **Wrong Node/Go version in your terminal:** use `mise exec -- node --version`
  or `mise exec -- go version`. Bare commands may still use your Homebrew versions.
- **Missing dependency after pulling changes:** rerun `mise run setup`.

## Deployment configuration

Set backend environment variables through the hosting service rather than
copying local environment files. Cloud Run needs `HOST=0.0.0.0` and supplies
`PORT`. Set the deployed frontend origin and a database connection string with
the database provider's TLS settings. Keep local, staging, and production
credentials separate. The pool currently permits five connections per API
instance; account for that when configuring service instance limits.

Schema migrations and sample data will be added when the first CRM tables are
implemented. This setup does not modify the local Supabase schema or existing
application data.

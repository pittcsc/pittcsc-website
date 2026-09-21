# Local development

The existing Gatsby site runs alongside a Go API and local Supabase. The current
API implements database readiness at `/health`; authentication and CRM features
will be added separately. No database tables or seed accounts are needed yet.

## Prerequisites

- Node/npm for Gatsby and the project-pinned Supabase CLI.
- Docker Desktop (or a compatible engine), running before starting Supabase.
- Go 1.26.2 or newer, as declared in `backend/go.mod`.

## First-time configuration

From the repository root:

```sh
npm ci --legacy-peer-deps
npx supabase start
npx supabase status
```

If the files do not already exist, copy `.env.example` to `.env.development` and
`backend/.env.example` to `backend/.env`. Preserve existing configuration when
updating these files. Both destination files are gitignored.

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

Keep Supabase running in Docker. Start Gatsby and Go in separate terminals from
the repository root:

```sh
# Terminal 1
npm run develop
```

```sh
# Terminal 2
npm run dev:api
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
`npx supabase stop`; no reset is needed for normal development.

## Backend checks

```sh
npm run test:api
cd backend
go vet ./...
go build ./...
```

Unit tests cover database availability, cancellation, HTTP routing, and allowed
browser origins without requiring a running database. Use the curl check above
to verify the real local database connection.

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

# Local email authentication

Issue [#158](https://github.com/pittcsc/pittcsc-website/issues/158) implements local
Pitt email OTP authentication. Supabase owns identities, codes, and sessions; Go
verifies identities. Club profiles, role authorization, contact emails, and the
full dashboard are separate issues.

## Local Supabase configuration

Run `mise run setup` for a fresh checkout, or `mise run db:start` with dependencies
already installed. Startup creates an ignored, owner-readable ES256 signing-key
file once and applies pending migrations with `supabase migration up --local`.
It preserves existing env files, keys, and database data. No hosted credentials
are required. Never commit `supabase/signing_keys.json` or print its contents.

If Supabase was already running when `supabase/config.toml` changed, run
`mise run db:stop` then `mise run db:start` to load the new configuration. This
preserves the database; do not use `db reset`. Keep local keys stable across
restarts so existing sessions can continue to work.

Auth uses Gatsby at `http://localhost:8000` and sends six-digit codes to
[Mailpit](http://127.0.0.1:54324). Both signup and returning-user templates send a
code, not a magic link. Codes expire after 900 seconds; resending is limited to
once per 60 seconds. The local email budget is 100/hour; signup/verification and
refresh requests also have the limits in `supabase/config.toml`.

Private SQL hooks in `csc_auth` allow only exact `@pitt.edu` addresses (case
insensitive). Subdomains and suffix lookalikes are rejected. A creation hook
blocks direct signup requests; a token hook also rejects token issuance/refresh
after an out-of-band change to a non-Pitt login email. Only Supabase Auth can
execute these hooks. No managed Auth tables are modified by migrations.

Run the rollback-only SQL policy checks with:

```sh
docker exec -i supabase_db_pittcsc-website psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/auth_hooks.sql
```

The fixtures are synthetic hook payloads, not seeded member accounts.

## Go identity verification

`GET /auth/session` accepts `Authorization: Bearer <access token>` and returns
only the verified user's `id` and current login `email`. Missing/invalid/revoked
sessions return 401; dependency outages return a retryable 503. All responses
use `Cache-Control: no-store`. CORS allows the configured frontend origin.

`SUPABASE_AUTH_URL` is the exact expected issuer, defaulting locally to
`http://127.0.0.1:54321/auth/v1`; existing local env files need no rewrite. Hosted
environments must set their own HTTPS issuer explicitly. Go accepts ES256/RS256
keys from that issuer's `/.well-known/jwks.json`, checks signature, issuer,
audience, expiration, user/session IDs, and rejects anonymous/non-Pitt identities.
It never trusts a token-supplied key URL or browser-supplied user ID.

JWKS are cached for ten minutes. Unknown key IDs trigger a refresh, at most once
per five seconds; a newly rotated key may therefore require a retry within that
window. A failed fetch cannot extend an expired cache. Publish replacement keys
before switching signing keys; cached removed keys can live for up to ten minutes.

Each protected request reads `auth.sessions` and `auth.users` through Go's DB
connection, checking session ownership, confirmation, current Pitt email, bans,
deletion, and session expiry. These reads are not cached. Supabase alone mutates
these managed records. Removing a session through Auth logout rejects its old
JWT on subsequent API requests immediately, even before the JWT expires.

This endpoint proves identity only. Future CRM endpoints must additionally check
current application account status, roles, ownership, and allowed fields.

## Browser sessions

The Supabase browser SDK persists and refreshes sessions. No absolute lifetime,
inactivity timeout, or single-device restriction is configured, allowing sessions
to last six months or longer across restarts while browser storage remains intact.
Clearing site data, private-browser cleanup, revocation, or losing the refresh
token still requires signing in again. Access JWTs remain short-lived (one hour).

The shared browser session store exposes only the identity verified by Go, never
tokens. It clears identity data while restoring/verifying, on errors, and on
sign-out events from other tabs. Late requests cannot repopulate cleared private
state. Expired access tokens get one refresh/retry; outages offer a retry without
discarding the SDK session.

Logout explicitly uses Supabase's `local` scope (its default is global). It clears
private UI state immediately and returns to `/` after Auth confirms sign-out.
Failed/offline logout keeps private data hidden and offers retry; it does not
claim the remote session was revoked. Other independent browser sessions remain
active. Staff-triggered global logout is outside this issue.

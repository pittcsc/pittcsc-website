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

## Login and return navigation

`/login` offers email entry, code entry, loading, invalid/expired-code feedback,
resend countdown, retries, and change-email. New and returning users follow the
same path. A verified session reaches the minimal `/dashboard` landing page,
which displays the verified login email and logout. The full dashboard and
profile onboarding remain separate work. `/dashboard/*` has a Gatsby client-only
match and a scoped Netlify fallback, preserving existing public/API routes.

The public auth link reads **Sign in / Create account** or **Dashboard**. Public
content, `/join`, meeting tools, and Notion integrations remain available.

The `returnTo` query parameter accepts only relative paths in `/dashboard` or
`/attendance`, with query/hash preserved. Other inputs fall back to `/dashboard`.
External/protocol-relative URLs, encoded paths, backslashes, and public redirect
routes such as `/zoom` and `/blog` are rejected. Future attendance URLs should use
`/attendance/<event>` (or deliberately update the allowlist and tests). This issue
does not implement attendance routes or record attendance on login.

## Verification and manual walkthrough

With Docker running, start `mise run dev`, then run:

```sh
mise run check
mise run test:auth
mise run build
```

`test:auth` refuses nonlocal URLs and uses only public frontend configuration. It
creates synthetic `csc-auth-test-*` accounts in local Auth, reads their OTP emails
from local Mailpit in memory, and checks domain rejection, real resend limits,
invalid/reused codes, new/returning identity, persistence, refresh, and immediate
logout revocation while another session stays valid. It waits about a minute for
the real resend cooldown and signs out its sessions afterward. Synthetic accounts
and messages remain for inspection; the script does not delete or reset data.

Unit tests additionally cover expired/wrong-project/malformed tokens, JWKS cache
rotation and concurrent fetches, API outages, browser cleanup races, and redirect
validation. The real integration test does not wait 15 minutes for OTP expiry or
six months for session longevity; those settings and error paths have separate
configuration/unit coverage. The SQL checks above exercise hook permissions.

For the deeper browser testing pass:

1. Open `/login`; try a non-Pitt address, then a synthetic `@pitt.edu` address.
   Read its code in Mailpit, try an incorrect code, and then the correct code.
2. Check resend countdown, change-email, duplicate clicks, and request failure
   recovery. Request a code and wait over 15 minutes to check actual expiry.
3. Reload `/dashboard`, restart the browser, and open a second tab. Confirm the
   session restores without another code and no identity appears while loading.
4. Visit `/dashboard/events` directly while signed out; sign in and confirm the
   path is preserved. Try `/login?returnTo=https://example.com` and confirm the
   fallback is `/dashboard`. The nested page is still the minimal landing screen.
5. Sign out; confirm return to `/`, private data disappears in other tabs, and a
   separate browser stays signed in. Test offline logout and its retry action.
6. Check keyboard labels/focus, mobile widths, public navigation, and API-outage
   retries. Future attendance testing must confirm an explicit check-in click.

## Hosted test environment and rollout

Each Supabase project and Netlify deploy context needs its own configuration.
Repeat the one-time setup below for a new staging or production environment;
subsequent code builds do not require repeating Auth settings. Apply each new
database migration to each intended project. Never use local credentials or a
test project's database for production.

### Current test setup (2026-10-05)

- Supabase project `ryixupgxhsrwynescbez` (`pittcsc-website`): the private
  Pitt-email hook migration was applied, and a remote dry run reported no pending
  migrations. Its public JWKS endpoint exposes an ES256 signing key.
- In the Supabase dashboard, the Before User Created and Custom Access Token
  hooks, Gmail test SMTP, 900-second email OTP expiry, code-based Confirm signup
  and Magic link templates, six-digit email OTP length, and Site URL were
  configured. Hosted Auth initially sent eight-digit codes despite the
  six-digit template wording; changing **Email OTP length** to six resolved the
  mismatch. A user confirmed a fresh code worked in the hosted sign-in flow.
- Netlify branch deploy: `feat/user-auth` at
  `https://feat-user-auth--pittcsc-stinky-boy.netlify.app`. The URL returned HTTP
  200. Its branch-specific `GATSBY_SUPABASE_URL`,
  `GATSBY_SUPABASE_PUBLISHABLE_KEY`, and `GATSBY_API_URL` were included in a
  rebuilt Gatsby bundle. An accidental pair of literal backticks around the
  Supabase URL caused the initial connection error; removing them fixed it.
  `master` and `crm-expansion` do not contain this auth branch's changes.
- The Go API is deployed temporarily on Render Free at
  `https://pittcsc-api-test.onrender.com`. `/health` returned HTTP 200 with a
  connected database; `/auth/session` returned HTTP 401 without a token. Its
  first build failed because the command targeted `./cmd/app`; the working
  command is `go build -o app ./cmd/api`. Render Free sleeps after idle traffic,
  so the next request can be slow. The Render build log used Go 1.27.1 while
  the repository pins Go 1.26.2; pin `GO_VERSION` for repeatable builds. The
  remaining hosted walkthrough checks in step 8 have not all been performed.
  No production Auth environment was configured.

### Repeatable setup checklist

1. Create a separate Supabase project and record its project ref. From the repo,
   run `mise exec -- npx supabase link --project-ref <project-ref>`. Confirm the
   target before `mise exec -- npx supabase db push --dry-run`, then apply the
   reviewed migrations with `mise exec -- npx supabase db push`. Never reset a
   remote database. The current migration creates private `csc_auth` functions;
   it does not edit Supabase-managed Auth tables.
2. In **Authentication → Hooks**, enable **Before User Created** with
   `csc_auth.before_user_created` and **Custom Access Token** with
   `csc_auth.custom_access_token`. Configure an asymmetric signing key and check
   that `/auth/v1/.well-known/jwks.json` exposes an ES256 or RS256 public key.
   `supabase/config.toml` configures local Auth; a database migration alone does
   not turn on hosted Auth hooks or copy other Auth dashboard settings.
3. In **Authentication → Sign In / Providers → Email**, enable email signup and
   confirmation, explicitly set **Email OTP length** to six and expiration to
   900 seconds, and check the server-side resend interval is 60 seconds. The
   email template's wording does not control code length. In **URL
   Configuration**, set the test site's URL and any redirect URLs needed by
   that environment.
4. Configure custom SMTP before editing hosted email templates. For a small
   test, `pittcsc@gmail.com` uses `smtp.gmail.com` on port 465, the same address
   for sender and username, and a Google app password entered only in the
   Supabase dashboard. This is temporary test delivery. For public launch, use
   a dedicated provider and verified sending domain with SPF/DKIM and an
   appropriate DMARC policy. Supabase's default sender is restricted; see
   [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
5. In **Authentication → Email Templates**, set both **Confirm signup** and
   **Magic link** to the subject `Your Pitt CSC sign-in code` and the contents
   of [code.html](../supabase/templates/code.html). Keep `{{ .Token }}` in both:
   the browser asks for a code, while the default `{{ .ConfirmationURL }}` sends
   a link.
6. Create a Netlify branch deploy from a branch containing the auth code. Use
   its stable branch URL as Supabase's Site URL and Go's `FRONTEND_ORIGIN`.
   For that branch only, set `GATSBY_SUPABASE_URL` to the hosted project URL and
   `GATSBY_SUPABASE_PUBLISHABLE_KEY` to its public key. After deploying Go, set
   `GATSBY_API_URL` to its HTTPS origin and rebuild Netlify. `GATSBY_*` values
   are public browser configuration; never put SMTP, database, or service-role
   credentials there. Enter URLs without literal backticks or quotes. Netlify
   environment changes need a new build to take effect.
7. For temporary testing, create a Render Free Go web service from the auth
   branch with root directory `backend`, build command
   `go build -o app ./cmd/api`, and start command `./app`. Set `HOST=0.0.0.0`,
   the exact Netlify `FRONTEND_ORIGIN`, and
   `SUPABASE_AUTH_URL=https://<project-ref>.supabase.co/auth/v1`. Render
   supplies `PORT`. Store `DATABASE_URL` only in server-side environment
   settings: use the intended Supabase project's session-pooler connection
   string with `sslmode=require`. Render Free sleeps after 15 minutes idle and
   is for testing, not dependable club use. The planned Cloud Run deployment
   also needs `HOST=0.0.0.0` and receives `PORT` from its host. The API permits
   five database connections per instance; account for instance limits.
8. Verify `/health`, then test real Pitt inbox delivery, new and returning
   account codes, invalid/reused/expired codes, resend limits, session restore,
   `/dashboard` refresh, logout, and direct nested dashboard URLs. Check that
   the Go API rejects missing, invalid, and revoked tokens. Monitor delivery
   failures and rates; set hosted email/request budgets for meeting bursts and
   consider CAPTCHA if needed. The UI countdown is not an abuse boundary. See
   [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Before exposing private CRM features, finish database-backed profile, status,
and role enforcement and disable the generated Data API for application data.
Keep all hosted credentials out of this repository and these instructions.

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

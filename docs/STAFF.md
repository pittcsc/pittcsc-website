# Staff foundation

`/dashboard/staff` is an empty placeholder headed **Staff Dashboard**. The
dashboard navbar shows **Staff** only to active users with the staff role; the
original public website navbar is unchanged. Signed-out direct visits go through
login and return to the staff route. Signed-in non-staff users see **Access
restricted** with a link to My Account.

Dashboard navigation, window focus, and returning to a visible tab recheck roles
and account status. The staff page separately calls the protected access endpoint,
hides its placeholder during checks, and offers retry on failure. Revocation
removes the link and restricts the page; suspension clears authenticated UI.
This is request-driven revalidation, not a live push channel. An idle foreground
tab can retain its current UI until the next check; every API request still uses
current database authorization. Account drafts survive successful rechecks.

Application roles are additive: `member`, `foundry`, `staff`, and `alumni`.
The private `csc.roles` / `csc.user_roles` tables own assignments; Auth metadata
and browser input cannot assign roles. A migration gives existing profiles
`member`; a profile-insert trigger assigns it atomically to new profiles.
Subsequent profile reads do not restore intentionally removed roles.

`GET /auth/session` returns current database roles alongside verified identity.
`GET /staff/access` returns 204 for active staff, 403 for non-staff or suspended
accounts, 401 for invalid/revoked sessions, and 503 on dependency failure. Both
responses are private and uncached. The staff guard uses the existing verified
Auth session and current database profile/status/roles on every request.
Foundry and alumni confer no additional privileges.

## Provision staff

Have the user sign in and open the dashboard once to create their profile. A
trusted operator with database access can then run this from `backend/`:

```sh
mise exec -- go run ./cmd/grant-staff --email student@pitt.edu --operator "Setup operator"
```

Replace the example email and operator label. The command uses `DATABASE_URL`
from the environment or `backend/.env`; existing environment values win. Local
development uses the local database. Hosted execution requires separately
authorized access to the intended hosted database; do not copy hosted credentials
into local env files. No remote migration or grant is part of local setup.

Only existing, verified, active accounts are eligible. The command adds `staff`
without replacing other roles. Grant and audit commit in one transaction, and
retries/concurrent grants create one assignment and one audit entry. Audit records
contain the target, role, action, timestamp, supplied operator attribution, and
database login role. The operator label is attribution supplied by a trusted
operator, not proof of an authenticated application actor. The command prints
neither account details nor credentials. There is no browser grant endpoint.

This is the foundation from issues #160 and #162, not the complete role/member
administration feature: member lookup, role-management UI/API, suspension tools,
last-active-staff safeguards for future removal operations, and event tools
remain unimplemented. The foundation exposes no role removal operation.

Run `mise run check` for unit tests. With local Supabase and Go running, use
`mise run test:staff` to exercise default assignments, role combinations,
self-escalation denial, concurrent grants/audit idempotency, operator validation,
suspension, revocation, and logout using synthetic accounts. It leaves synthetic
accounts/mail and audit records for inspection, and signs out its sessions.
It refuses nonlocal services and database URLs. After local migrations, run the read-only
database assertions with:

```sh
docker exec -i supabase_db_pittcsc-website psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/roles.sql
```

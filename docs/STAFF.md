# Staff foundation

`/dashboard/staff` is the **Staff Dashboard**: a grid of cards, one per staff
tool. **User Management** at `/dashboard/staff/user-management` is the first
tool; it lets staff search members and edit their roles (see
[Manage roles](#manage-roles)). Unknown staff paths show a not-found message.
The dashboard navbar shows **Staff** only to active users with the staff role; the
original public website navbar is unchanged. Signed-out direct visits go through
login and return to the staff route. Signed-in non-staff users see **Access
restricted** with a link to My Account.

Dashboard navigation, window focus, and returning to a visible tab recheck roles
and account status. The staff page separately calls the protected access endpoint,
hides its tools during checks, and offers retry on failure. Revocation
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

## Add a staff tool

1. Add an entry (slug, title, description, button text) to the ordered registry
   in `src/lib/staff/tools.mjs`. Its page is `/dashboard/staff/<slug>`.
2. Put the tool's component in `src/components/staff/<slug>/`, its helpers in
   `src/lib/staff/<slug>.mjs` with tests in `tests/staff/`, and its styles in
   `src/styles/staff/<slug>.scss`.
3. Map the slug to the component and an icon in `src/components/staff/tools.js`.
4. Register its API routes in Go behind `withStaff`, plus any record-specific
   checks. The registry and staff access check only control presentation.

Tools receive the verified `identity`, an authenticated `request` client, and
`revalidate`, and render inside the shared staff access check.

## Manage roles

Staff search active accounts by email or by first, last, preferred, or full
name (case-insensitive, partial). An empty search lists everyone. Results are
25 per page, sorted by last name then email, and can be filtered by role. Each
row shows name, email, graduation year, and role toggles. Suspended,
unverified, and deleted accounts, and people who have never opened the
dashboard (no profile), are not listed and cannot be changed.

| Request | Purpose |
| --- | --- |
| `GET /staff/roles` | Role catalog with labels and, for the caller, `editable`/`confirm` |
| `GET /staff/users?q=&role=&page=` | Search; `q` up to 100 characters, `page` from 1 |
| `PUT /staff/users/{id}/roles/{role}` | Grant one role; returns the member's current roles |
| `DELETE /staff/users/{id}/roles/{role}` | Revoke one role; returns the member's current roles |

All four use the staff guard. The actor is always the verified session user;
request bodies and query parameters cannot name an actor. Grants and revokes are
idempotent: retries and concurrent identical requests converge on one change and
one audit row, and requests that change nothing write no audit row.

Who may change what is a policy table in `backend/internal/roles/policy.go`:

- Staff may grant and revoke `staff`, `foundry`, and `alumni`.
- `member` is permanent. Any catalog role without a policy rule, including roles
  added later, is read-only until a rule is added in code.
- `staff` is protected: the dashboard asks for confirmation, nobody can revoke
  their own staff role, and the last active staff account cannot be removed.

Role changes are serialized with a transaction-level advisory lock, and the actor's
active staff status is rechecked under that lock. If two staff revoke each other
at the same time, exactly one succeeds. Each change and its audit row (target,
role, action, `actor_user_id`, time) commit together. Operator grants record an
`operator` label instead; each audit row has exactly one of the two.

To add a role: add a migration that inserts it into `csc.roles` with a label and
description and widens the `csc.roles` name check. It then appears in the
dashboard read-only. To make it editable, add a rule to the Go policy with tests.

## Provision staff

Use this to bootstrap the first staff account; after that, staff can grant
staff from the dashboard.

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
database login role. Dashboard changes record the staff actor instead. The operator label is attribution supplied by a trusted
operator, not proof of an authenticated application actor. The command prints
neither account details nor credentials.

Still unimplemented: suspension/account status tools, a member detail view, a
role-change history viewer, and event tools.

Run `mise run check` for unit tests. With local Supabase and Go running, use
`mise run test:staff` to exercise default assignments, role combinations,
self-escalation denial, concurrent grants/audit idempotency, operator validation,
suspension, revocation, and logout using synthetic accounts. It also covers
dashboard role management: non-staff denial, catalog policy, email/name/role
search, wildcard escaping, concurrent idempotent grants, actor audit rows,
read-only/unknown roles, self-revoke refusal, suspended targets, and concurrent
mutual staff revocation. Set `TEST_API_URL` to target an API on another local
port. It leaves synthetic
accounts/mail and audit records for inspection, and signs out its sessions.
It refuses nonlocal services and database URLs. After local migrations, run the read-only
database assertions with:

```sh
docker exec -i supabase_db_pittcsc-website psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/roles.sql
```

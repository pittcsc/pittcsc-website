# Staff foundation

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

This is the foundation from issues #160 and #162, not the complete role/member
administration feature: member lookup, role-management UI/API, suspension tools,
last-active-staff safeguards for future removal operations, and event tools
remain unimplemented. The foundation exposes no role removal operation.

Run `mise run check` for unit tests. After local migrations, run the read-only
database assertions with:

```sh
docker exec -i supabase_db_pittcsc-website psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/roles.sql
```

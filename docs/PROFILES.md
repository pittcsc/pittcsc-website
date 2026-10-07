# Member profiles

Issue #159 adds **My Account** at `/dashboard/account`. Each signed-in user can
read and edit only their own profile. Signed-in app screens share a top-right
**My Account** button in the header that links to the editor and a top-left CSC
logo linking to the public website; direct
visits and refreshes use the existing Gatsby client route and Netlify fallback.
Data and files load at runtime and never enter Gatsby's public output.

## Fields and completion

First authenticated API use, including `/auth/session`, creates one empty profile
linked to the verified Supabase Auth user ID. A unique constraint and conflict-safe
insert make provisioning safe to retry and run concurrently. Email comes from the
current Auth identity and is read-only. The OTP/login workflow is unchanged.

Partial saves are allowed. Completion requires first name, last name, graduation
year, one major, and all three of the GitHub, LeetCode and LinkedIn usernames.
The incomplete-profile prompt does not gate dashboard access.

| Field | Rule |
| --- | --- |
| First, last, preferred name | Trimmed text, up to 100 characters each; preferred name is optional for completion |
| Graduation year | One integer from 1900 through 2100, or blank while incomplete |
| Majors | Up to eight free-text entries of 120 characters each; duplicates ignoring case are rejected |
| GitHub, LeetCode, LinkedIn | Bare usernames, never URLs; a pasted profile URL is reduced to its handle in the browser. All three are required for completion |
| Avatar | Optional JPEG, PNG, or WebP; at most 5 MiB, 4096 pixels per side and 16 megapixels |
| Resume | One optional PDF, at most 10 MiB |

An incomplete profile is filled in one question at a time, and each **Next**
saves, so leaving mid-flow keeps what was answered and returns to the first
unanswered question. Once complete, My Account becomes a single page where
names, year, majors, and the three usernames save together with **Save
profile**. The last successful
save wins if multiple tabs edit the same profile. Failures preserve edits for
retry. Routine token refresh preserves the editor; logout, account changes, and
failed identity verification hide private state and cancel requests.

Files have separate save, replace, and remove actions. Avatars are decoded and
re-encoded to strip metadata and trailing bytes; WebP is stored as PNG. The default
avatar uses preferred/first name and last-name initials, or a generic placeholder
for an empty profile. PDFs are checked for their header, end marker, and size,
then downloaded as attachments with their original bytes. This validates file
type; it does not scan for malware or repair malformed PDFs.

## Storage and authorization

Migrations create `csc.profiles` and `csc.profile_assets` in a private schema.
Browser roles have no schema/table privileges; both tables enable RLS without
browser policies. Local PostgREST is disabled through `[api].enabled`. Auth remains
available through the gateway. Setup derives its origin from the local storage
endpoint when CLI status omits `API_URL`; no storage keys are copied.

Files are bounded `bytea` values in Postgres, referenced from their profile. This
keeps replacement/removal and ownership constraints in one transaction without
new credentials. One file per user and kind is enforced by a unique constraint.
Replacement overwrites the old bytes; removal deletes the reference and bytes
atomically. Concurrent file writes serialize on the profile row. Database backups
include files; an object-storage migration may be warranted as file volume grows.

Go verifies Auth and current profile status on every protected request. Suspended
accounts receive 403. Payloads cannot change identity, status, email, roles, or
file references. Ownership always comes from the verified identity. Responses use
`Cache-Control: no-store`; file access also requires a bearer token.

| Endpoint | Behavior |
| --- | --- |
| `GET /auth/session` | Provision/check profile, return current verified Auth identity |
| `GET /profile` | Own fields, completion, email, file flags, and update timestamp |
| `PUT /profile` | Replace editable text/year/major fields; omitted or blank fields are cleared |
| `GET /profile/avatar`, `GET /profile/resume` | Retrieve own file; missing files return 404 |
| `PUT /profile/avatar`, `PUT /profile/resume` | Validate and replace own file from a raw binary request body |
| `DELETE /profile/avatar`, `DELETE /profile/resume` | Remove own file; repeated removal succeeds |

Role schema/assignment, staff access, discovery, secondary email, and shared
avatar access remain later work, including #160.

## Local verification and hosted handoff

With Docker running, use `mise run db:start` to apply pending local migrations
without resetting data. Restart local Supabase once when adopting the changed API
setting. Existing env files remain intact. With Go and Gatsby running:

```sh
mise run check
mise run test:auth
mise run test:profiles
docker exec -i supabase_db_pittcsc-website psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/profiles.sql
```

Stop Gatsby development before running `mise run build` so both processes do not
write the same cache/output directories.

`test:profiles` refuses nonlocal URLs and creates real OTP/Mailpit fixtures named
`csc-profile-test-*`. It checks concurrent first use, partial saves, completion,
protected fields, ownership, file limits/replacement/removal, suspension, logout,
and Data API isolation. It temporarily suspends only its synthetic application
profile and restores it in `finally`; it never edits managed Auth tables.
Synthetic accounts/profiles/mail remain for inspection, and sessions are signed
out. The SQL check verifies browser-role isolation.

For browser review, sign in, save a partial profile, complete it with multiple
majors, reload the nested URL, and upload/replace/remove both files. Check narrow
screens, retries, and logout while requests are pending.

Hosted rollout is separate: review/apply the migration to the intended project,
disable its generated Data API while retaining Auth, deploy Go and Gatsby, and
repeat the walkthrough. The hosted Auth test deployment in [AUTH.md](AUTH.md)
predates profiles. Do not copy local credentials or apply remote migrations
without explicit authorization.

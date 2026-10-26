# Member profiles

**My Account** at `/dashboard/account` lets each signed-in user edit only their
own profile. **Members** at `/dashboard/members` lists active, completed
profiles for other signed-in, completed accounts. Signed-in app screens share a top-right
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
year, and one major. Verified email is supplied by Auth. External usernames,
resume, picture, and career/community details are optional. Incomplete accounts can use My Account and
file uploads but cannot use dashboard, points, event, attendance, or staff
features. The same gate applies to all roles and is rechecked by Go on every
protected request. Removing a required field revokes access until it is restored.

| Field | Rule |
| --- | --- |
| First, last, preferred name | Trimmed text, up to 100 characters each; preferred name is optional for completion |
| Graduation year | One integer from 1900 through 2100, or blank while incomplete |
| Majors | Up to eight free-text entries of 120 characters each; duplicates ignoring case are rejected |
| GitHub, LeetCode, LinkedIn | Optional bare usernames, never URLs; a pasted profile URL is reduced to its handle in the browser |
| Profile picture | Optional JPEG, PNG, or WebP; at most 5 MiB, 4096 pixels per side and 16 megapixels |
| Resume | Optional PDF, at most 10 MiB |
| Current company, job title, location | Optional free text, up to 160 characters each |
| Bio | Optional, up to 2000 characters |
| Personal website | Optional full HTTPS URL, up to 500 characters |
| Contact email | Optional valid email, up to 254 characters; must differ from the current verified Pitt sign-in address |
| Coffee chats, mentorship, referrals, résumé reviews | Optional yes/no offers, defaulting to no |

An incomplete profile is filled in three questions, and each **Next**
saves, so leaving mid-flow keeps what was answered and returns to the first
unanswered question. After completion, the original profile or attendance link
resumes. Once complete, My Account becomes a single page where
names, year, majors, the three usernames, and optional career/community details save together with **Save
profile**. The last successful
save wins if multiple tabs edit the same profile. Failures preserve edits for
retry. Routine token refresh preserves the editor; logout, account changes, and
failed identity verification hide private state and cancel requests.
All members can save these details privately. **Share my profile details** is a
separate, explicit choice available after profile completion; new and existing
accounts start unshared. It exposes the photo, external handles, career details,
bio, website, help offers, and contact email to other completed, signed-in
members, including staff. The owner can stop sharing without deleting saved
information. Removing a required completion field or suspending the account
clears sharing in the same database update; completing or reinstating it requires
a new Share action. The Members directory never includes the sign-in email or
résumé. The contact email is displayed only on the member detail page and is not verified or
used to sign in.

Members whose saved graduation year is no later than the current New York year
can use **Mark me as alumni** in My Account. It self-assigns the existing alumni
role without extra permissions. The action is idempotent and audited; alumni-role
removal is not offered here. The alumni badge and filter require both the role
and eligible year on each read. Sharing is a separate choice for all members.

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
| `PUT /profile` | Replace editable profile fields; omitted or blank fields are cleared; role fields are rejected |
| `PUT /profile/alumni` | Self-assign alumni to the verified caller; empty body; repeat calls are safe |
| `PUT /profile/sharing` | Set `{ "shared": true/false }` for the verified, completed owner; repeat calls are safe |
| `GET /profile/avatar`, `GET /profile/resume` | Retrieve own file; missing files return 404 |
| `PUT /profile/avatar`, `PUT /profile/resume` | Validate and replace own file from a raw binary request body |
| `DELETE /profile/avatar`, `DELETE /profile/resume` | Remove own file; repeated removal succeeds |
| `GET /members?q=&company=&alumni=1&page=1` | Paginated active, completed directory; optional name, case-insensitive partial current-company, and alumni filters combine with AND |
| `GET /members/{id}` | Member profile with name, majors, year, optional handles/career details/help offers, alumni label, all-time points, and 30-day rank |
| `GET /members/{id}/avatar` | Authenticated avatar bytes for an eligible profile |

These member endpoints require the viewer's completed active account. Staff can
open an active incomplete profile by ID from User Management, but incomplete
accounts do not appear in the directory or member leaderboards. The response
never includes sign-in email, resume, or point claim links. Directory cards show company
and job title only when shared; the full profile shows other optional fields
only when shared. The avatar route also checks the owner's current sharing
choice, including for staff. Basic name, majors, graduation year, eligible
alumni label, and points remain visible regardless of sharing. Company search
ignores unshared companies so hidden data cannot affect results. Browser roles
have no direct database access.

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
protected fields, ownership, contact-email validation, sharing and unsharing,
hidden search and avatar access, alumni year eligibility, concurrent sharing and
profile writes, file limits/replacement/removal, suspension, logout, and Data API
isolation. It temporarily suspends only its synthetic application
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

# AlumniDB in the CRM

AlumniDB is a self-service publication of the existing CRM profile. Sign in at
`/login` with a Pitt email, open My Account, and use **Edit all fields / AlumniDB**
if still in guided setup. Fill in the shared fields and save, upload a photo,
then select **Publish my AlumniDB profile**. The same control unpublishes.
The directory is at `/dashboard/alumni`, with protected profile details and photos.

All directory information is required: first/last name, photo, graduation year,
location, bio, company/title (current or most recent), LinkedIn, valid non-Pitt
contact email, and at least one kind of help. Graduation year must be the current
New York calendar year or earlier. A resume, GitHub, LeetCode and majors are not
AlumniDB requirements; existing CRM completion remains separate. New fields may
stay empty for people who do not wish to publish. Contact email is checked for
syntax only; it never replaces Pitt authentication or becomes a recovery address.

Valid shared-field edits appear immediately. Removing required data, deleting the
photo, or setting a future graduation year saves the change but automatically
unpublishes in the same database transaction. Restoring eligibility never publishes
automatically. No automatic alumni role is assigned. Last-updated reflects actual
directory-information changes, including photo replacement, rather than private
CRM changes, login activity or publication toggles. Old profiles do not expire.

Readers must have an active authenticated CRM account. Directory responses project
only the agreed published fields; login email, resumes, roles and other private
fields are excluded. Photos are fetched with authorization into short-lived browser
object URLs, not copied into public Gatsby assets. Unpublished/suspended profiles
are excluded from list, detail, photo, search counts and filter options. Search,
filtering and 20-record pagination happen server-side; filters stay in the URL.
Returning from a profile reloads permitted records and restores browsing position.

## Local verification

Use the existing `mise run setup` / `mise run dev` workflow. The new schema is in
`supabase/migrations/20261025000000_alumni_directory.sql`; setup applies pending
local migrations without resetting data. Apply the migration separately to any
intended hosted environment before deploying this API. This work does not migrate
live alumni records or change production Auth, hosting, domains or databases.

Run `mise run check`, `mise run build`, and the existing local Auth/profile checks.
`mise run test:profiles` now includes AlumniDB publish/unpublish, eligibility,
authenticated photo, reader field projection and hidden-filter checks.
The opt-in Go test `TestAlumniPostgresLifecycle` additionally exercises real store
queries, publication retries, concurrent edits, private timestamp behavior,
unpublished photo denial, status enforcement, and multi-page filtering against an
isolated PostgreSQL database. It requires `ALUMNI_TEST_DATABASE_URL` pointing at a
loopback database named `pittcsc_alumni_test` with CRM migrations and synthetic Auth
fixtures; it refuses other targets and never resets a database. Without that
variable it is reported as skipped. Real Supabase Auth must be tested separately;
the standalone PostgreSQL fixture is not a substitute for the Auth checks.

## Source provenance and port scope

Selected presentation code comes from `pittcsc/PittCSC-Alumni-Database`, commit
`3ac2f46b49f1dc76c275a189689060c7e30d8b0d`:

- `frontend/src/components/alumni/AlumniCard.tsx` → `src/components/alumni/AlumniCard.tsx`.
- `frontend/src/components/alumni/AlumniFilters.tsx` → `src/components/alumni/AlumniFilters.tsx`.
- `frontend/src/components/ui/Card.tsx` → `src/components/alumni/ui/Card.tsx`.
- `frontend/src/pages/AlumniDetailPage.tsx` → the layout in `src/components/alumni/AlumniDetail.tsx`.
- Selected original Tailwind color/shadow/gradient tokens are added without
  replacing the public site's theme or fonts.

The layouts, card composition, availability badges and filter controls are
retained. Adaptations replace React Router with Gatsby, legacy identity payloads
with an allowlisted directory record, public image URLs with authenticated reads,
and Lucide icons with the CRM's already installed Font Awesome icons. The wrapper
uses existing CRM auth/request helpers. This avoids importing another router,
state manager, backend, authentication system or dependency stack.

The original React client filtered/paginated an already paginated response and
used inconsistent detail permissions. Those contracts are replaced by protected
Go queries on the shared profile, not preserved as behavior. Legacy API access,
public previews/photos, company/interview tools and connection requests are not
ported. Officer moderation remains deferred. No real alumni seed data is included.

## Verified during this port

Using the pinned Node 24.21.0 / Go 1.26.2 toolchain:

- `mise run check`: all 141 JavaScript tests (including the `/meet` HTTP tests),
  Go tests, vet and build passed. The final run had no JavaScript skips and
  included the isolated PostgreSQL lifecycle test.
- `mise run build`: production Gatsby build passed; existing Sass/Browserslist
  deprecation/staleness warnings remain.
- Go tests with `-race` and the isolated PostgreSQL lifecycle fixture passed.
- `mise run test:auth`: real local Supabase/Mailpit/Go OTP, refresh, independent
  sessions and immediate logout revocation checks passed.
- `mise run test:profiles`: real local shared-profile/file checks and the new
  AlumniDB publication/privacy cases passed.
- Browser walkthrough with a synthetic local account: Pitt sign-in, shared fields,
  photo upload, publish, directory filters/detail, filter restoration and unpublish.

No hosted environment, live alumni records, or production deployment was changed.

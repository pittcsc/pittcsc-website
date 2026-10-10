# Pitt CSC Web Application Architecture

## Direction

Extend the existing website into a club management application while preserving the public site's appearance and content. Add a separate dashboard for members and staff, backed by a Go API and Postgres.

CSC will manage its own accounts, member profiles, roles, events, and other club data.

This document records implementation and the agreed direction. Local email OTP,
Go identity/session verification, auth-aware navigation, and a minimal signed-in
landing page are implemented in #158. Private profile editing and files are
implemented in #159. Additive roles, operator staff provisioning, and the protected
staff dashboard implement the foundation of #160/#162; staff can search members and
change their roles. Staff event creation, editing, cancellation, audit history,
and Google Calendar delivery are implemented; see [EVENTS.md](EVENTS.md) for the
agreed scope refining #163/#164. Member event viewing remains deferred.
See [AUTH.md](AUTH.md), [PROFILES.md](PROFILES.md), and [STAFF.md](STAFF.md)
for the other implemented behavior.

## Technology and hosting

| Component | Choice | Responsibility |
| --- | --- | --- |
| Frontend | Existing React/Gatsby application on Netlify | Public website, authentication UI, and dashboard |
| Authentication | Supabase Auth in the CSC Supabase project | CSC accounts, sessions, and identity verification |
| Application backend | Go service on Google Cloud Run | Authorization, business logic, and integrations |
| Database | Supabase-hosted Postgres | CSC profiles, roles, events, and other club records |

Supabase provides both authentication and the Postgres database. The Go API owns club business logic and authorization; Supabase Auth manages credentials and sessions.

Keep the frontend and backend in this repository. Add the Go service under `backend/`, with its own build and deployment. Start with one Go service and one database, organizing backend code around features such as users, events, attendance, and integrations.

## Public website and dashboard

The public website remains accessible to everyone, including signed-in users. Signing in takes the user to `/dashboard`; it does not replace the public homepage.

- Signed out: the public navbar shows **Sign in / Create account**.
- Signed in: that button becomes **Dashboard**.
- The dashboard has its own layout, navigation, account menu, and logout action.
- **Dashboard** is the first link in its navbar. The home shows three upcoming
  or in-progress CRM events and a profile reminder when completion is pending.
- Only its navbar displays **Staff**, and only for active users with the staff role.
  The staff page has an API-verified access check, member search, and role editing.
- On My Account, a **Back to Website** link returns to the public site without
  signing out, and a logout button signs out. Other dashboard pages omit both.
- Logging out clears the local session and private UI state, then returns to `/`.

Initial route structure:

| Route | Purpose | Access |
| --- | --- | --- |
| `/` and existing public routes | Current website | Everyone |
| `/login` | Sign in or create a CSC account | Everyone |
| `/dashboard` | Member home with CRM events | Signed-in CSC members and staff |
| `/dashboard/account` | Own profile editor and files (implemented) | Signed-in account owner |
| `/dashboard/staff` | Staff tool cards (implemented) | Active staff |
| `/dashboard/staff/user-management` | Member search and role editing (implemented) | Active staff |
| `/dashboard/events` | Upcoming published events (planned) | Members and staff |
| `/dashboard/staff/events` | Create, edit, cancel, and sync events; audit history (implemented) | Active staff |
| `/dashboard/staff/members` | Member details, status management (planned) | Staff |

Use Gatsby client-only routes for the dashboard and load its data at runtime from the Go API. Configure hosting so direct visits and refreshes on nested dashboard routes work. Private data must not be included in generated public pages or Gatsby build-time data.

There is no initial frontend framework migration. Keep dashboard components separate from the existing public layout and load dashboard code only where needed.

## CSC accounts and roles

Use Supabase Auth with emailed six-digit codes, valid for 15 minutes, and a
60-second resend cooldown. New and returning users share the same flow and must
use an exact `@pitt.edu` login address. Private Auth hooks enforce the domain on
signup and token issuance. Personal profile contact emails are separate future
data and never become login identities. The SDK persists and refreshes sessions
without a configured lifetime/inactivity cutoff, and logout revokes the current
browser session only. Hosted Supabase/SMTP setup is a separate launch task.

First authenticated API use creates an empty CSC profile linked uniquely to the
verified Auth user ID (`sub`). Repeated/concurrent requests do not duplicate it.
The `/auth/session` endpoint provisions/checks the profile and returns verified
identity and current database roles. Partial saves are supported; completion
requires first and last name, graduation year, and one major, without gating
dashboard access. New profiles receive `member` atomically; existing profiles
were backfilled by the roles migration.

CSC manages its own application permissions:

- CSC roles are additive: `member`, `foundry`, `staff`, and `alumni`, stored authoritatively in Postgres with multiple assignments per user.
- New users default to `member`; users cannot self-assign elevated roles. Foundry/alumni alone do not confer staff permissions.
- Staff have member access and can search active members and grant or revoke `staff`, `foundry`, and `alumni`. `member` is permanent. All active staff can manage events; account status tools remain planned.
- A trusted operator bootstraps the first staff account with the audited command in [STAFF.md](STAFF.md); dashboard changes are audited with the authenticated staff actor.
- CSC account suspension is enforced through CSC profile status on API requests, including requests with an otherwise valid access token.

Authentication credentials remain managed by Supabase Auth. CSC role
assignments are separate from Supabase's built-in database access roles and from
user-editable Auth metadata.

## API and authorization

The normal request flow is:

1. React signs the user in through Supabase Auth.
2. React sends the Supabase access token as a bearer token with requests to the Go API over HTTPS.
3. Go verifies the token's signature, issuer, audience, and expiry using a JWT library. Configure asymmetric signing keys in Supabase and use the CSC project's published JWKS for verification, with caching and key rotation support.
4. Go checks the current Auth session, user, and profile status in Postgres on every protected request, so logout or suspension invalidates access immediately. The staff guard also requires the current database staff role; future staff routes must use it.
5. Go authorizes the operation, reads or writes Postgres, and returns the permitted data.

Client-side route guards control navigation and presentation. The Go API independently enforces authentication, roles, record access, and editable fields on every protected operation. A role supplied by the browser is never authoritative.

Use a JSON REST API. Implemented operations include the current profile, staff
member/role management, staff event management, and a restricted member event
list. Event save publishes immediately; there is no draft/publish workflow.
Members receive only display fields for active events. Staff-only delivery,
creator, and audit fields stay private.

All future CRM data access goes through Go. The browser communicates directly
with Supabase Auth for authentication only. Keep privileged credentials
server-side. Local Auth hooks live in a private, unexposed schema. Disable the
generated Data API before hosted rollout; local PostgREST is disabled and CRM
tables use an unexposed private schema. Auth remains available. Size the
database pool for database and Cloud Run limits.

Serve the Go API from a dedicated endpoint, such as `api.pittcsc.org`, with explicit frontend origin configuration. Existing Gatsby API routes can continue operating during the transition; avoid introducing routing rules that accidentally replace them.

## Initial data model

Manage the Postgres schema with versioned SQL migrations.

| Record | Initial purpose |
| --- | --- |
| `csc.profiles` | Implemented: internal ID, unique Auth user ID, profile fields, status, file references, and timestamps |
| `csc.profile_assets` | Implemented: private file bytes, ownership, type, and update time; unique per user/kind |
| `csc.roles`, `csc.user_roles` | Implemented: role catalog with display labels; additive assignments, unique per user/role pair |
| `csc.role_audit` | Implemented: transactional grant/revoke audit with target, role, action, staff actor or operator label, database actor, and time |
| `csc.events` | Implemented: stable ID, title, description, location, start/end times, fixed New York timezone, active/cancelled status, version, creator/timestamps, and calendar identity/delivery status |
| `csc.event_audit` | Implemented: event mutations and sync results with staff actor, snapshot, and time |

The application-owned `csc.profiles` table references Supabase's managed `auth.users` identities. Credentials remain in Supabase Auth. Private file access goes through Go; bounded files are stored transactionally in Postgres for this initial release. See [PROFILES.md](PROFILES.md) for limits and ownership enforcement.

Keep stable records across academic years. Represent dates and terms as data rather than creating a new set of tables each year.

`csc.attendance` relates an event to the verified Auth user, with a unique key
for one check-in per account per event. The Go API records it only after an
explicit authenticated POST. Staff can read the roster; members can read their
own status. See [EVENTS.md](EVENTS.md#qr-attendance). Registrations and RSVPs
remain separate future actions.

## Events and future integrations

Postgres is the authoritative source for CRM events. Staff changes appear in the
staff dashboard through API requests without rebuilding the website. Save and
publish are one action; calendar delivery is attempted after the database commit.
Edits update the existing Google entry; cancellation removes it while keeping the
CRM record and audit. Delivery failures require an explicit staff retry, with no
background checks or retries. The existing CSC calendar is fixed in the staff UI.
Server-only configuration supports a separate nonproduction calendar. See
[EVENTS.md](EVENTS.md) for concurrency, credentials, and recovery.

The existing public event integration imports Notion data during Gatsby builds. It can remain during the initial rollout. When public events move to the CRM, preserve the existing presentation and feed it published events from the new source. Define that transition explicitly so staff do not have to maintain competing event records.

QR attendance is implemented:

- Staff event details reuse the existing branded QR generation logic.
- Event QR codes point to stable CSC URLs. Any active account can check in once;
  cancellation closes check-in. There is no scheduled time cutoff.

Google Drive automation remains a later phase. It can begin with a stored folder
or document link. Automated folder creation and permission management belong in
the Go backend once the workflow is defined. Core event records stay in Postgres,
with external service IDs or links attached to them.

## Implementation sequence

The event flow delivers **staff saves an event and it appears on the member
dashboard**, plus the public CSC Google Calendar once server integration is
configured. The public Notion event cards remain independent.

1. Set up CSC Supabase Auth, provision CSC profiles, and implement access-token verification, the current-user API, logout, and role checks.
2. Add the dashboard layout, routes, and authentication-aware public navbar.
3. Implement staff event creation, editing, cancellation, Google Calendar sync, and member dashboard event viewing (implemented).
4. Add member search, account status management, and audited role changes.
5. Add QR attendance (implemented), then Drive integration and additional CRM features.

Before rollout, verify that CSC registration and sign-in work, invalid tokens are rejected, member requests cannot perform staff operations, role/status changes affect subsequent API requests, and nested dashboard URLs work on direct navigation. Use a non-production environment for development and testing, with deployment configuration and handoff documentation suitable for future club maintainers.

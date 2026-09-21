# Pitt CSC Web Application Architecture

## Direction

Extend the existing website into a club management application while preserving the public site's appearance and content. Add a separate dashboard for members and staff, backed by a Go API and Postgres.

CSC will manage its own accounts, member profiles, roles, events, and other club data.

This document records the agreed architecture and implementation direction. The dashboard and new backend described here are planned, not yet implemented.

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
- A **Visit website** link returns to the public site without signing out.
- Logging out clears the local session and private UI state, then returns to `/`.

Initial route structure:

| Route | Purpose | Access |
| --- | --- | --- |
| `/` and existing public routes | Current website | Everyone |
| `/login` | Sign in or create a CSC account | Everyone |
| `/dashboard` | Member home or staff overview | Signed-in CSC members and staff |
| `/dashboard/events` | Upcoming published events | Members and staff |
| `/dashboard/staff/events` | Create, edit, and publish events | Staff |
| `/dashboard/staff/members` | Search and manage members | Staff |

Use Gatsby client-only routes for the dashboard and load its data at runtime from the Go API. Configure hosting so direct visits and refreshes on nested dashboard routes work. Private data must not be included in generated public pages or Gatsby build-time data.

There is no initial frontend framework migration. Keep dashboard components separate from the existing public layout and load dashboard code only where needed.

## CSC accounts and roles

Use Supabase Auth in the dedicated CSC Supabase project. Members register and sign in through the CSC application using the Supabase client SDK, which also handles session refresh and sign-out.

On first authenticated use of CSC, the Go API creates a CSC profile linked to the verified Supabase Auth user ID (the access token's `sub` claim), defaulting its role to `member`. Enforce uniqueness on that user ID so repeated or concurrent requests cannot create duplicate profiles. Use the stable user ID as the identity link, not an email address.

CSC manages its own application permissions:

- CSC roles are `member` and `staff`, stored authoritatively in CSC's Postgres database.
- Staff have member access plus event and member management capabilities.
- Provision the first CSC staff account during setup. Subsequent role changes require authorized staff action and an audit record.
- CSC account suspension is enforced through CSC profile status on API requests, including requests with an otherwise valid access token.

The exact sign-in methods will be selected during implementation. Authentication credentials remain managed by Supabase Auth. CSC application roles are stored in the club profile and are separate from Supabase's built-in database access roles.

## API and authorization

The normal request flow is:

1. React signs the user in through Supabase Auth.
2. React sends the Supabase access token as a bearer token with requests to the Go API over HTTPS.
3. Go verifies the token's signature, issuer, audience, and expiry using a JWT library. Configure asymmetric signing keys in Supabase and use the CSC project's published JWKS for verification, with caching and key rotation support.
4. Go resolves the CSC profile by the verified user ID in the `sub` claim and checks its current status and role.
5. Go authorizes the operation, reads or writes Postgres, and returns the permitted data.

Client-side route guards control navigation and presentation. The Go API independently enforces authentication, roles, record access, and editable fields on every protected operation. A role supplied by the browser is never authoritative.

Start with a JSON REST API. Initial operations include retrieving the current profile, listing published events, creating and editing events, publishing events, and managing members. Members must not receive event drafts or staff-only member information.

All club profile, event, and other CRM data access goes through Go. The browser communicates directly with Supabase Auth for authentication only. Keep database credentials and privileged Supabase keys server-side and disable Supabase's generated Data API for this application; the Auth service remains available. Use a database connection pool sized for the database limits and Cloud Run instance configuration.

Serve the Go API from a dedicated endpoint, such as `api.pittcsc.org`, with explicit frontend origin configuration. Existing Gatsby API routes can continue operating during the transition; avoid introducing routing rules that accidentally replace them.

## Initial data model

Manage the Postgres schema with versioned SQL migrations.

| Record | Initial purpose |
| --- | --- |
| `users` | Internal ID, unique Supabase Auth user ID, member profile, CSC role, account status, and timestamps |
| `events` | Title, description, location, start/end times, timezone, draft/published/cancelled status, creator, and timestamps |
| `audit_log` | Actor, action, affected record, timestamp, and relevant change details for staff operations |

The application-owned `users` table holds club profiles and references Supabase's managed `auth.users` identities. Credentials remain in Supabase Auth, not in the club profile table.

Keep stable records across academic years. Represent dates and terms as data rather than creating a new set of tables each year.

When attendance is implemented, add an `attendance` table relating users to events, with a uniqueness constraint appropriate to one check-in per member per event. Add registrations or RSVPs separately if needed: registering and attending are distinct actions.

## Events and future integrations

Postgres becomes the authoritative source for CRM events. Staff changes appear in the dashboard through API requests without rebuilding the website.

The existing public event integration imports Notion data during Gatsby builds. It can remain during the initial rollout. When public events move to the CRM, preserve the existing presentation and feed it published events from the new source. Define that transition explicitly so staff do not have to maintain competing event records.

QR attendance and Google Drive automation are later phases:

- Reuse the existing branded QR generation UI where practical.
- Event QR codes should point to stable CSC URLs. The eventual check-in workflow will define token validation, eligibility, and duplicate prevention.
- Drive integration can begin with a stored folder or document link. Automated folder creation and permission management belong in the Go backend once the workflow is defined.
- Keep core event records in Postgres, with external service IDs or links attached to them.

## Implementation sequence

The first complete workflow is: **staff creates and publishes an event, and a member sees it in their dashboard**.

1. Set up CSC Supabase Auth, provision CSC profiles, and implement access-token verification, the current-user API, logout, and role checks.
2. Add the dashboard layout, routes, and authentication-aware public navbar.
3. Implement event creation, editing, publishing, and member event viewing.
4. Add member search, account status management, and audited role changes.
5. Expand into QR attendance, Drive integration, and additional CRM features.

Before rollout, verify that CSC registration and sign-in work, invalid tokens are rejected, member requests cannot perform staff operations, role/status changes affect subsequent API requests, and nested dashboard URLs work on direct navigation. Use a non-production environment for development and testing, with deployment configuration and handoff documentation suitable for future club maintainers.

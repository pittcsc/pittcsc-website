# Staff events and Google Calendar

Active staff manage events at `/dashboard/staff/events`, through the **Events**
card beside User Management. Any active staff member can create, edit, cancel,
and explicitly sync any event. Go checks the verified Auth session and current
database roles/account status for every request; mutations recheck active staff
after acquiring the event lock.

## Agreed first release

These decisions refine issues [#163](https://github.com/pittcsc/pittcsc-website/issues/163)
and [#164](https://github.com/pittcsc/pittcsc-website/issues/164):

- **Save publishes immediately.** There is no draft or separate publish step.
- Title (up to 200 characters), location (500), start, and end are required.
  Description is optional (5,000). The description is public calendar content,
  not a staff-only notes field.
- All times use `America/New_York`, including when the browser is elsewhere.
  Dates are supported from 2000 through 2100, and end must follow start.
  The form sends local wall times; Go converts them to UTC. Nonexistent and
  ambiguous times during DST transitions are rejected instead of silently shifted.
- The fixed destination is the existing public CSC calendar maintained through
  `pittcsc@gmail.com`: `f64u131to44gn3tn8g62ov2u1s@group.calendar.google.com`.
  There is no calendar picker or calendar embed in the staff tool.
- The CRM owns title, description, location, and times. Saves update the existing
  Google entry. Changes made directly in Google do not flow into the CRM and
  are overwritten by a subsequent save/sync.
- Cancellation removes the Google entry and retains the cancelled CRM record
  and history. Cancelled events are read-only and available in the Cancelled list.
- The member dashboard event list and a link back from Google to a member event
  page are deferred. The public Notion event cards and existing calendar embeds
  keep their current implementation. New CRM events appear only on the calendar.
- Recurring/all-day events, invitations, Drive/Slides, and importing existing
  Google events are outside this release. Attendance is described below.

## QR attendance

Every saved CRM event, including one created before attendance was added, has a
stable URL at `/attendance/<event-id>`. The staff event detail shows its branded
QR code and its clickable sign-in/check-in URL. It offers **Copy QR image**,
PNG/SVG downloads, and a transparent or white background. The URL uses the Go
API's configured `FRONTEND_ORIGIN`, so
hosted deployments must set that value to the public HTTPS website origin. The
API refuses to start on a nonlocal bind address with a localhost or private
frontend origin. Event edits
and Google Calendar failures do not change the URL. The QR contains only this
URL; it contains no user details or credentials.

A signed-out visitor goes directly to Pitt email OTP sign-in and returns to the
same attendance page. The page shows the event title and signed-in email. The
visitor must explicitly click **I'm Here!** to check in. Scanning, page loads,
and login completion never record attendance. Any active CSC account can check
in, including accounts with incomplete profiles and any additive role mix.
Check-in stays open after event creation, even after its scheduled end, until
staff cancel the event. A cancelled event closes check-in but retains its roster.
A static QR can be shared, so this workflow does not prove physical presence.

The Go API verifies the current session and account status. A database lock
coordinates check-in with cancellation and suspension, and the unique
`(event_id, auth_user_id)` key makes retries and concurrent submissions return
the original check-in time. Staff see the count and a paginated roster in event
details; ordinary members can read only their own check-in state. The roster
shows name when available, Pitt email, and check-in time. Corrections and
exports are follow-up work.

| Request | Purpose |
| --- | --- |
| `GET /attendance/{id}` | Authenticated event title/status and own check-in time; no write |
| `POST /attendance/{id}` | Explicit authenticated check-in for the verified user |
| `GET /staff/events/{id}/attendance?page=1` | Staff-only count and 25-person roster page |

The `20261009000000_attendance.sql` migration creates private `csc.attendance`
with RLS and no browser grants. It applies locally with
`mise exec -- npx supabase migration up --local`; never apply it to a hosted
database without authorization for that target.

## Delivery and recovery

The event and its mutation audit commit to Postgres **before** contacting Google.
Calendar success is a separate result. Saved records have `pending`, `synced`,
`failed`, or `disabled` delivery status; those are integration statuses, not extra
publishing states. The dashboard shows the Google event URL after successful sync.

There are no background retries, calendar watches, or automatic periodic checks.
Each save makes one explicit sync attempt. **Sync to Calendar** is available for
every active event and uses its latest saved data. If the Google entry was manually
deleted, this action recreates it. A failed cancellation prominently reports that
the Google entry may remain public and offers **Retry calendar removal**.

A timed-out browser or process can leave delivery pending. Staff reload the event
and sync again to confirm Google state. If Google is updated but saving the result
fails, the next sync reconciles the same calendar entry. Raw Google/database errors
and credentials are never returned to the browser.

## Storage, retries, and concurrency

The migration creates private `csc.events` and `csc.event_audit` tables, with RLS
enabled and no browser grants. Event identity and history survive cancellation.
Every mutation records the authenticated staff actor, time, action, and snapshot;
every completed sync attempt records its result. Staff can browse the history,
including older entries. Actor IDs and creator IDs survive account removal.

The create form generates an event UUID once and reuses it after failed requests.
`PUT` creation retries therefore refer to one CRM record. Optimistic versions
reject stale edits with 409 and a reload action. Repeating an identical save or
cancellation does not duplicate its mutation audit entry.

A Postgres session advisory lock per event serializes saves, syncs, and
cancellations across API instances. It spans short database transactions and the
bounded Google request; the connection is explicitly unlocked before returning to
the pool, or discarded if unlock cannot be confirmed. There is no open database
transaction during Google network calls. This prevents an older sync from
overwriting newer data or resurrecting a cancelled event.

Google event IDs are allocated before external insertion and reused after
timeouts. An insert conflict is reconciled with the existing entry. A deleted
Google ID can remain a tombstone; its replacement ID is committed before another
insert, so retries never allocate a second replacement for the same uncertain
attempt. Removal treats an already absent/deleted entry as success.

## API

The staff event routes below require active staff and return uncached private
responses. Member attendance routes are described above.

| Request | Purpose |
| --- | --- |
| `GET /staff/events?filter=upcoming&page=1` | List 25 events; filters: upcoming, past, cancelled, all |
| `GET /staff/events/{id}` | Saved event and delivery status |
| `PUT /staff/events/{id}` | Create or edit, then attempt calendar sync |
| `POST /staff/events/{id}/cancel` | Save cancellation, then attempt calendar removal |
| `POST /staff/events/{id}/sync` | Explicit delivery/removal of the latest saved record |
| `GET /staff/events/{id}/history?before=` | History, newest first, 25 entries; cursor is the last audit ID |

Save JSON has only `title`, `location`, `description`, `start`, `end`, and
`version`. Dates use `YYYY-MM-DDTHH:mm` in New York; use version 0 for creation and
the returned version for edits. Cancellation JSON contains `version`. Actor,
calendar IDs, timezone, and status cannot be supplied as editable fields. GETs
never create events, sync Google, or record attendance.

## Server configuration and calendar ownership

Calendar delivery defaults to `GOOGLE_CALENDAR_MODE=disabled`. The API can save
events without any Google credentials and reports that setup is needed. Ordinary
local onboarding does not connect to Google. Existing env files are preserved.

For an authorized hosted rollout:

1. Use a club-maintained Google Cloud project and dedicated service account.
   Enable the Google Calendar API for that project.
2. A maintainer of `pittcsc@gmail.com` shares the existing calendar with the
   service account email, granting **Make changes to events**. It does not need
   permission to manage sharing, read Gmail, or impersonate club members.
3. Configure service-account Application Default Credentials on the Go server.
   The adapter requests only `https://www.googleapis.com/auth/calendar.events`.
   Use the server's attached service identity when supported; otherwise mount a
   service-account JSON secret and point `GOOGLE_APPLICATION_CREDENTIALS` to its
   path. Personal user OAuth credential files are refused. Never place credentials
   under `GATSBY_*`, in browser code, in the repository, or in logs.
4. Set `GOOGLE_CALENDAR_MODE=google`. The fixed CSC calendar is the default.
   Staging must use a separate calendar and service identity, with server-only
   `GOOGLE_CALENDAR_ID` set to that nonproduction calendar. Do not point local
   fixture tests at a live Google connector.
5. Verify create/edit/remove with a deliberately created rollout test event, then
   manually sync any saved CRM events that need delivery. Enabling the connector
   does not automatically replay old events.

Club maintainers own the Google Cloud project, calendar sharing, hosting secret,
and service-account handoff. Prefer credentials without downloaded keys when the
hosting environment supports them. If using a key, rotate by issuing a replacement,
updating the hosted secret, restarting/redeploying the service, verifying a manual
sync, then revoking the old key. Remove obsolete calendar grants when replacing
the service identity. Live Google authorization and hosted deployment are separate
from local implementation and have not been performed by these tests.

Google references: [event creation](https://developers.google.com/workspace/calendar/api/guides/create-events),
[event IDs and scopes](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert),
[calendar sharing](https://developers.google.com/workspace/calendar/api/concepts/sharing),
and [service-account authorization](https://developers.google.com/identity/protocols/oauth2/service-account).

## Verification and local fixtures

Run `mise run check` and `mise run build`. Unit tests cover denied access across
role combinations, protected fields, validation/DST, Google payloads, outages,
lost responses, insertion conflicts, manual deletion, and idempotent removal.

With local Supabase and the updated Go API running in disabled mode:

```sh
mise run test:events
# If using an API on another local port:
TEST_API_URL=http://localhost:8081 mise run test:events
```

The script refuses nonlocal URLs and requires the running API to report disabled
calendar delivery before writing fixtures. It creates synthetic users through
Supabase Auth, verifies OTP through Mailpit, provisions two staff fixtures, and
checks the real API and database. It also runs the Go store integration tests with
the race detector and a simulated calendar, including outages, uncertain inserts,
manual retries/recreation, concurrent creates, and concurrent sync/cancellation.
These tests leave synthetic upcoming, past, and cancelled events plus audit
history for local inspection; they sign out their test sessions. Database tests
skip during ordinary `mise run check` and are exercised by `test:events`.

No database reset, hosted migration, Google invitation, or production calendar
write is part of the local test flow.

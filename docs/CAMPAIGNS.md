# Email studio

Officers use **Staff → Email studio** at `/dashboard/staff/email`. Existing active-staff and completed-profile rules apply; there is no extra sender permission or approval role.

## Contacts and subscriptions

Import a CSV with a header row and first name, last name, and email. Map columns and review invalid rows, duplicate addresses, merges, and conflicts before confirming. Files are limited to 2 MiB and 5,000 data rows. Optional columns are tags, major, and graduation year; use semicolons for multiple tags/majors. Missing optional fields remain empty. General newsletters do not require accounts or demographic information.

New contacts subscribe by default. Existing contacts retain unsubscribes, delivery blocks, and archive status. Imports merge tags and fill empty fields; an officer can explicitly choose to overwrite conflicting external-contact fields. Linked CRM profile fields remain authoritative. A stale preview fails rather than overwriting changes made after preview. Repeating the same committed import returns its original result. Export rejected rows to correct them separately.

All existing verified CRM profile holders are enrolled by the migration. Future profile provisioning enrolls the verified Pitt address and links a matching imported contact. Profile changes update account attributes without restoring subscriptions or altering contact tags. Suspending an account prevents delivery; deleting its CRM profile archives the contact before removing the link. Directory contact email is not repurposed as a campaign address.

Officers can create contacts, edit external-contact details, bulk-add/remove tags, and archive/unarchive. Delivery addresses are stable contact identities: add a different contact and archive the old one to replace an address. Ordinary edits never clear unsubscribes or delivery blocks.

My Account includes an announcements subscription toggle, including during incomplete profile setup. Accountless recipients use the link in a campaign. GET requests only display preferences; explicit POST actions unsubscribe, including mailbox-provider one-click POSTs. An external resubscription request sends a confirmation link valid for 30 minutes, limited to one request per contact per ten minutes. Visiting that link does not subscribe; pressing Confirm does. These verification-link lifetimes do not expire campaign history. Login OTP delivery is unchanged.

## Drafting and handoff

Campaign drafts belong to CSC. Any active officer can open and continue them. Changes autosave to the server after a short pause; Save now and the save indicator show progress. A saved draft survives page closure, device changes, and computer restarts. Changes still pending during an abrupt shutdown may not have reached the server.

The editor displays who last edited the campaign. Concurrent changes produce a conflict rather than a silent overwrite. Download unsaved changes before reloading/reconciling. Failed saves preserve the editor content and offer retry. Internal link navigation attempts to save first; the browser warns on unload with pending changes where supported. There is no simultaneous cursor-level collaboration.

Use headings, formatted text, images, buttons, dividers, up to three columns, and event blocks. Text supports bold, italic, and HTTPS Markdown links; raw HTML is escaped. `{{firstName}}` personalizes content, preheader, and subject, falling back to `there`. Event insertion copies the event details into editable content; later source-event changes do not update the email. The content selector loads upcoming CRM events; attendance filters can select past events as well. The event tool remains the source for managing those events.

Built-in newsletter and event templates use CSC branding. Officers can save reusable templates or audience rules; saving an existing name replaces that library item after UI confirmation. Existing campaign content does not change when a template is updated.

Uploaded JPEG/PNG/WebP images are validated and re-encoded, limited to 5 MiB, 4096 pixels per side and 16 megapixels. The immutable image library has public, unguessable URLs so email readers can load them. Do not upload private member documents. No image-delete operation invalidates old emails; uploaded image bytes and campaign history are retained. Externally hosted image URLs are supported, but continued availability of those remote images depends on their host.

## Audiences, tests, and sending

With no filters, a campaign reaches all eligible subscribed contacts. Saved audiences support all/any positive conditions on tags, current account roles, graduation year, majors, and attendance at an event. Exclusions always win. Missing data cannot satisfy a condition requiring it, but does not block general newsletters or other matching any-condition branches.

Preview in desktop or mobile widths. Test to up to five specified addresses; test messages are labeled and excluded from campaign analytics. Existing unsubscribe, archival, inactivity, and delivery blocks apply. Queued tests preserve the content/version selected when queued. The Delivery section shows recent test statuses separately from campaign analytics. Noncontact test recipients are not silently subscribed.

Send now or schedule a one-time campaign in `America/New_York`. Review the subject and current recipient estimate before confirming. Scheduling freezes content/rules; return a scheduled campaign to draft to edit. Audience rules are evaluated and recipients snapshotted when dispatch starts. Each delivery rechecks subscription and delivery eligibility. Removing the original author's staff role does not automatically cancel the campaign.

Cancel stops remaining pending delivery. Emails already submitted or in flight cannot be recalled. Submitted sends and later delivery events are distinct: a completed campaign has no dispatch work remaining, but late delivery/click events still update the report.

## Reports, exports, and recovery

Campaign reports show recipients, delivered, bounced, complaints, unsubscribes, and recorded clicks. Delivery means acceptance by the recipient's mail server, not inbox placement. Reports include total/unique recipients per clicked link and likely automated clicks when SES supplies that signal; no open tracker or individual browsing-history report is added. Test messages are excluded, but test bounces/complaints still create delivery blocks.

Contacts (with current filters), campaign summaries, recipient delivery results, and per-link totals download as CSV for officers to upload to their shared drive. Spreadsheet formula-like values are escaped. Exports are staff-only runtime responses. Contact filters do not automatically hide unsubscribed contacts; campaign eligibility is applied separately.

Campaign content, snapshots, received events, attempts, images, and import results live in Postgres without automatic expiration. Reporting aggregates deduplicate provider events and distinct affected recipients. Unsubscribe events are attributed to the linked campaign when available, otherwise the most recent submitted campaign for that contact. Later resubscription does not remove historical events.

A definitive provider throttle queues a delayed retry, capped at five attempts. Network/timeout failures or worker interruption after submission become **uncertain**, not automatic retries. Late SES events can reconcile uncertainty. Officers review uncertain/failed recipients in the report and either skip them or explicitly retry after a duplicate-risk warning. Complaint/hard-bounce delivery blocks persist independently of subscription. Clearing those blocks is an operator investigation, not an ordinary contact edit.

## Runtime and local verification

The Go API owns authorization and campaign state. All campaign tables use the private `csc` schema with RLS and no browser-role privileges. SES credentials remain server-side. SES publishes campaign-tagged events through the configured SNS topic to `POST /email/ses-events`; the API checks the topic, AWS certificate URL, and SNS signature before accepting events or confirming a subscription. It never follows a supplied subscription URL.

A separate Go job processes due work:

```sh
# From backend/, or use mise run email:worker from the repository root.
CAMPAIGN_MAIL_MODE=local mise exec -- go run ./cmd/campaign-worker
```

Local mode can send only to a loopback SMTP server (default Mailpit at `127.0.0.1:54325`). The Supabase config publishes that SMTP port; restart local Supabase after adopting this configuration change. Override `CAMPAIGN_LOCAL_SMTP_ADDR` for an isolated test stack. SES is not contacted in local/disabled modes. Local SMTP acceptance is recorded; real SES delivery/click analytics require SNS events and are not invented by local mode.

Run the API with the same campaign mode and `CAMPAIGN_PUBLIC_URL=http://localhost:8080`; frontend dev loads `.env.development`. Production Gatsby builds need their public configuration supplied through the build environment or `.env.production`; never put campaign secrets there.

```sh
mise run check
mise run build
# With local Supabase and Go running:
mise run test:email
```

`test:email` uses synthetic Auth/OTP fixtures, the audited staff provisioning command, real API calls and database tests with a fake provider. It refuses remote service/database addresses, leaves synthetic records for inspection, and signs out its fixture sessions. Optional `TEST_API_URL`, `TEST_MAIL_URL`, and `DATABASE_URL` target a separate loopback stack. Plain `go test` skips database integration without these fixtures. Existing `/meet` HTTP tests skip without the isolated Gatsby meeting-test server; they are a separate workflow.

See [SES setup](CAMPAIGNS-SES-SETUP.md) for live readiness, deployment, and domain configuration. Hosted changes and real campaign sends require their own authorization.

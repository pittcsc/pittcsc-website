# CSC email campaigns — design interview

Status: implemented on `email-system`; see [CAMPAIGNS.md](CAMPAIGNS.md) for delivered behavior, validation, and operational limits. Hosted SES/domain/scheduler setup and rollout remain separate.

## Agreed scope

- Build newsletters, event promotions, and targeted email campaigns using AWS SES as a substantial feature on the existing `email-system` branch, created from `master`.
- Maintain contacts independently of CRM accounts, initially with one delivery address per contact. Link an imported contact when a CRM account verifies a matching address.
- Enroll all existing CRM accounts at rollout and automatically enroll future CRM accounts using their Pitt sign-in address. There is no existing campaign system to migrate. Preserve unsubscribes across subsequent account creation and imports.
- Use one campaign subscription and global unsubscribe, with explicit recipient resubscription.
- Import CSV contacts, requiring first name, last name, and email. Preview column mappings, invalid rows, duplicates, and proposed changes before committing. Initial import size is approximately 400 contacts. Optional tags, major, and graduation year are accepted. Imports subscribe contacts by default without undoing an existing unsubscribe. Merge tags, fill empty fields, and present conflicting values for review rather than silently overwriting. Linked CRM profiles remain authoritative for account attributes.
- Target using tags, account role, graduation year, major, and attendance at a selected event, with all/any matching and exclusions. Imported tags never grant account permissions.
- Provide a visual block editor with headings, formatted text, images, buttons, dividers, columns, and event blocks; staff-managed reusable templates; test sends; desktop/mobile previews; and first-name personalization with a fallback. Insert CRM event details as an editable snapshot, not live content.
- Follow the existing hierarchy: active staff/officers can send campaigns. Do not introduce a separate sending permission or approval tier.
- Include send-now and scheduled one-time campaigns. Scheduled campaigns can be cancelled or returned to draft for editing. Do not introduce a special author-role-revocation cancellation workflow. Recurring campaigns and automatic reminders are outside the currently agreed scope.
- Save reusable audiences. Evaluate filters and freeze campaign recipients when sending begins; recheck unsubscribes and delivery blocks before each email. Exclusions always win.
- Use the same CSC sender email address as the existing code-based login. Transport configuration and sender verification still need investigation; using the same address does not decide how authentication mail is sent.
- Report campaign-level deliveries, bounces, complaints, unsubscribes, and link clicks; individual engagement histories are outside the initial analytics scope.
- Retain campaign content, history, analytics, and detailed events in the database without automatic expiration. Provide optional CSV exports that officers can save to their shared drive; automatic Drive integration is not requested.
- Allow accountless recipients to unsubscribe using campaign links and CRM members to toggle subscription in My Account. External-address resubscription requires email verification. Hard bounces and complaints block campaigns separately from subscription preferences.
- Resume confirmed unsent recipients after an interruption. Flag sends with uncertain provider acceptance for staff review rather than automatically retrying them. Cancellation stops remaining delivery.
- Schedule in `America/New_York` and display the timezone explicitly.
- Document SES sender-domain setup for completion when CSC has domain/account details; leave current login-mail delivery configuration unchanged.

## Existing system

- Gatsby provides private dashboard routes; Go owns CRM authorization and business logic; Supabase provides Auth and Postgres.
- Current active `staff` authorization is checked against database account status and roles on every protected request; see [STAFF.md](STAFF.md).
- Campaign state, imports, subscriptions, delivery, reporting, and shared drafts are implemented by this feature.


## Contact management and optional information

- First name, last name, and email are sufficient for imported contacts. A CRM account, major, graduation year, and attendance history are not required to receive general announcements.
- Store absent optional major/year values as null (or an absent optional relationship where the existing data model uses relationships); never invent values or require enrichment before sending.
- Allow staff to manually create contacts, edit details, change tags in bulk, and archive contacts. Archiving excludes future delivery while preserving campaign history.
- Ordinary contact edits, imports, and archiving/unarchiving must not override an unsubscribe or complaint block.
- CRM profile fields remain authoritative for linked contacts. Tags are contact labels, not grants of CRM roles.
- Missing information cannot satisfy an attribute condition that requires it. This does not exclude the contact from general newsletters or an audience matched through another applicable condition.

## Shared drafts and autosave

- Campaign drafts belong to CSC and are accessible to all active staff, rather than being private to their creator. Another officer can open a draft, review it, edit it, and take over preparation.
- Automatically save draft content and campaign settings to the server while editing. Saved drafts survive closing the browser, restarting a computer, or switching devices.
- Show saving, saved, unsaved, and save-failed states with the last successful save time. A server-confirmed save is durable; changes still pending when a device abruptly shuts down may not have reached the server.
- Preserve edits during recoverable network failures and retry saving. Warn before navigation when there are pending unsaved changes where the browser permits it.
- Use version checks to prevent one officer from silently overwriting another officer's changes. Present conflicts and let staff reload/reconcile while preserving their unsaved content. Shared access does not require live simultaneous collaborative editing.
- Record who last edited the draft and when. Draft saves never trigger campaign sending; explicit send/schedule actions remain separate.

## Content, assets, and tests

- Support uploaded images and supplied image URLs, with an uploaded-image library.
- Keep uploaded assets referenced by sent campaigns available independently of later draft or template changes. Email image assets require stable email-client-accessible URLs; private profile files must not become public through this feature.
- Permit up to five specified test recipients. Label test mail, exclude it from campaign analytics, and honor unsubscribe and delivery blocks for test recipients.
- Historical campaign versions preserve the content that was actually sent.

## Exports and history

- Download CSV exports directly; officers can upload them to their shared drive.
- Export filtered contacts with tags and subscription status, campaign summaries, recipient delivery results, and per-link aggregate click totals.
- Do not add individual browsing-history reports.
- Retain campaign content, recipient delivery records, assets required by sent campaigns, and received analytics events in the database without automatic expiration.

## Implementation design

The implementation follows the approved design and existing application boundaries.

- Extend the existing Gatsby staff tools and Go API. Protect contact, import, audience, campaign, asset-management, analytics, and export operations with the existing active-staff checks. Preserve existing completion gates and private-data boundaries.
- Keep campaign contacts, subscriptions, delivery blocks, tags, audiences, templates, assets, campaign versions, recipient snapshots, delivery attempts, and event history in private Supabase Postgres tables, added through migrations. Use application subscription state as the source of truth rather than maintaining an independently editable SES contact list.
- Use a durable Postgres delivery queue. A Go worker claims due work with transactionally protected leases; a deployment scheduler starts dispatch independently of open browser tabs or API requests. Recommended hosted arrangement is a scheduled Cloud Run Job, matching the existing backend hosting direction. Provide local worker execution and a fake mail transport for development; production dispatch remains disabled until configured.
- Send one recipient per SES operation, with configuration-set and campaign/attempt tags. Process SES events through a signature-verified SNS endpoint, deduplicating deliveries and handling out-of-order events. Keep AWS credentials server-side.
- Distinguish draft, scheduled, sending, completed, cancelled, and attention-required campaign states. Completed means dispatch is finished, not that every recipient mail server has delivered the email. Delivery events may continue updating reports afterward.
- Freeze the campaign content and audience rule version on scheduling; return to draft before edits. Evaluate those saved rules and freeze the recipient list at dispatch. Subscription, archive, and delivery-block checks still apply immediately before each attempt. Do not cancel an otherwise valid scheduled campaign solely because its creator's role later changes.
- Persist an attempt before provider submission. Retry only failures known not to have been accepted. Mark ambiguous submissions for review, allowing late provider events to reconcile them. Explicitly warn before staff authorize a resend of an uncertain attempt.
- Offer all eligible subscribed contacts as the default audience. For filtered audiences, apply positive all/any conditions then exclusions. Show a current estimate before sending; scheduled audience sizes can change before dispatch.
- Use case-insensitive, trimmed email matching without provider-specific transformations such as removing dots or plus suffixes. Deduplicate by email. Within-file conflicts must be resolved or skipped in preview; rejected rows must be downloadable. Recheck state at commit so preview cannot overwrite subsequent changes or subscription choices.
- Provide accountless subscription links with unguessable tokens and one-click unsubscribe support. Visiting a resubscription link must not itself verify ownership; use an explicit, email-verified confirmation flow. Verification mail is service mail, separate from campaigns. Keep login OTP delivery unchanged.
- Default personalization to first name, falling back to a neutral greeting when it is absent. Reuse CSC branding for initial newsletter and event templates. Escape personalization and validate editor content and URL schemes on the server.
- Default Reply-To to the configured existing CSC sender mailbox unless CSC supplies another monitored address. The actual sender/domain, AWS region, credentials, public URLs, and DNS records remain deployment configuration rather than invented values.
- Count delivered recipients separately from accepted send requests. Show total and unique recorded clicks per campaign/link, with automated-event labeling where available; do not add open tracking. Keep unsubscribe events separate from current subscription status so later resubscription does not rewrite history.
- Escape CSV cells that could be interpreted as spreadsheet formulas. Keep exports staff-only and generated at runtime.

## Delivery phases and acceptance checks

1. Contact/subscription migrations, existing-account backfill, future-account enrollment, manual management, CSV preview/commit, and accountless/member subscription controls.
2. Saved audiences, shared server-autosaved drafts with conflict handling, block editor, reusable templates, event snapshots, durable image library, previews, and test sends.
3. SES adapter, queue/worker, immediate and scheduled dispatch, cancellation, safe recovery, verified event ingestion, and delivery blocks.
4. Aggregate reports, durable history, CSV exports, configuration/readiness checks, and completed setup/runbook documentation.

Verify cross-officer draft handoff, draft recovery after reload/device change, autosave failures and concurrent-edit conflicts, staff-only access, optional contact fields, account linking and subscription preservation, CSV conflict handling, audience inclusion/exclusion, immutable sent content/assets, concurrent dispatch, cancellation, ambiguous sends, duplicate/out-of-order provider events, blocked test recipients, reporting counts, and export safety. Use synthetic contacts and a fake transport locally; SES simulator/hosted checks require configured infrastructure and separate hosted authorization. Follow repository-required checks for implementation; documentation-only changes require link/content review and whitespace checks.

See [GLOSSARY.md](../GLOSSARY.md) for agreed terminology.

## Sender setup

See [CAMPAIGNS-SES-SETUP.md](CAMPAIGNS-SES-SETUP.md) for the domain and SES preparation guide. The guide documents configuration that is still required before hosted live delivery.

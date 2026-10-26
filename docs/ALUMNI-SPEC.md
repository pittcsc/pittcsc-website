# AlumniDB → Pitt CSC CRM integration

Status: agreed and implemented locally on the integration branch. Updated October 25, 2026.

This spec replaces the earlier broader integration proposal. The scope is moving the useful AlumniDB directory/profile functionality into the CRM and extending the existing profile so owners can publish or unpublish. Source investigation remains in [alumni-investigation.md](ALUMNI.md). Implementation is on `codex/alumni-integration`; repository transfer, production deployment and live data migration remain outside scope.

## Agreed product behavior

### Identity and access

- Keep the CRM's existing regular `@pitt.edu` email-code sign-in for students and alumni. There is no separate alumni email type or second login system.
- Any active signed-in CRM user can browse. Directory access remains private to authenticated CRM users; “anyone can browse” does not make the database public.
- Publishing is focused on alumni and requires self-reported graduation **year ≤ the current calendar year**. Use year only, without graduation month or an officer-configured cutoff; each new graduating class becomes eligible automatically. The backend derives the current year using the CRM's America/New_York calendar, not a browser-supplied year. Becoming eligible does not publish a profile automatically.
- Do not add officer approval, invitations, identity vetting, personal-email login/recovery, or automatic `alumni` role assignment.
- Existing session verification, ownership checks, role rules, and account-status enforcement remain effective.
- People who lose Pitt email access recover their mailbox through Pitt. Their directory information does not expire merely because they stop logging in.

### One shared profile

Extend the existing CRM profile; do not create a second editable copy or a second onboarding system. Extra fields may remain null while a person uses ordinary CRM features. My Account contains an explicitly labeled **AlumniDB** section and the publication control. Shared-field changes immediately affect the published profile when it remains eligible.

The directory displays:

| Field | Publication requirement |
| --- | --- |
| Name | Filled out; reuse CRM name fields |
| Photo | Uploaded; reuse the existing profile photo |
| Graduation year | Filled out and eligible under the year rule |
| Location | Filled out |
| Bio | Filled out |
| Company and job title | Both filled out; may describe current or most recent position, labeled clearly |
| LinkedIn | Filled out and valid under the CRM's LinkedIn handling |
| Contact email | Filled out, valid email syntax, and outside the Pitt login domain |
| Offered help | At least one of referrals, mentorship, coffee chats, resume review |

All listed information is required for publication. Unchecked help options mean “not offered”; they are not missing answers. A small current/most-recent label describes the company/title without adding employment history.

The contact address may be personal or work email. Check its syntax and the non-Pitt requirement, but do not introduce verification codes or ownership checks for contact email in this release. It is never a login or recovery credential.

Directory readers get only these fields plus profile ID, publication-related display metadata, and **Profile last updated**. Resumes, login email, private handles not listed above, roles, and other account data stay private. Shared storage does not mean returning the entire CRM record. Serve directory photos through an authenticated read that checks publication; retain owner access through existing profile routes.

### Publication lifecycle

- Start unpublished. Creating/completing a CRM account never enrolls it in AlumniDB automatically.
- The same control switches between **Publish my AlumniDB profile** and **Unpublish my AlumniDB profile**.
- Publishing requires the current owner, active account, complete directory information, and eligible graduation year. The backend checks these regardless of UI state.
- Unpublishing immediately removes the profile from directory cards, details, search results, filters, and totals. It preserves the shared CRM information and account.
- Valid edits to a published profile appear immediately, without another review or publish step.
- Save an edit that makes a profile ineligible, automatically unpublish it in the same transaction, and explain what must be fixed. Do not block ordinary CRM edits to preserve a directory listing.
- Becoming eligible again does not republish automatically. Require the explicit Publish control again.
- Repeated publish/unpublish requests are safe and produce no duplicate directory entries. Publication is state on the shared profile, not insertion of another person record.
- **Profile last updated** reflects actual changes to directory-visible information, not login activity, unrelated private-field changes, or merely toggling publication. Do not expire old profiles for inactivity.

### Browsing

- Add **AlumniDB** to the signed-in dashboard navigation.
- Provide scrollable cards and profile details using the existing AlumniDB's presentation where compatible with the CRM.
- Search by name/company/role; filter by graduation year, location, and offered help.
- Load more records as needed using one server-side filtering/pagination contract. Preserve search, filters, and browsing position when returning from a detail page.
- Support direct profile links, refreshes, sign-in return, loading, empty results, errors/retry, and unavailable/unpublished profiles.
- Fetch private records at runtime. Do not put directory records or photos in Gatsby's public build data/static assets.

## Explicitly outside this release

- Officer dropdowns, profile removal tools, blacklists, ban/reinstatement UI, new moderation audit workflows, or a new staff curation workspace. The previously discussed moderation design is deferred.
- Separate officer removal-request tooling or an operator takedown workflow. The current request narrows launch to the owner's same publish/unpublish control; do not silently add administrative work to satisfy earlier proposals.
- Connection requests, messages, automated outreach, interview/company-process features, employment-history tools, analytics, and bulk export.
- A separate alumni account/profile system, personal-email authentication, contact-email verification, or an alumni approval process.
- Production hosting changes, repository ownership transfer, migration of live records, and retirement of a deployed legacy system as automatic consequences of porting code. Existing live data and deployments require a separately identified handoff if applicable.

## Existing work and implementation fit

The October 20 inspection found the website on clean `crm-expansion` at `723534e` and AlumniDB on clean `main` at `3ac2f46`. These are historical local snapshots, not a claim about current remote heads or deployed behavior. Before implementation, refresh the relevant source inspection and preserve unrelated changes.

The CRM already implements Gatsby dashboard routing, Supabase Pitt email OTP, Go token/live-session verification, private account profile/files, additive roles, staff tools, events, attendance and spending. Extend these foundations rather than copying AlumniDB's custom auth. Source evidence:

- [CRM profile and existing completion predicate](/Users/archzak/Desktop/pittcsc/pittcsc-website/backend/internal/profile/profile.go:21).
- [Private profile handlers](/Users/archzak/Desktop/pittcsc/pittcsc-website/backend/internal/server/profile.go:47).
- [Identity verification](/Users/archzak/Desktop/pittcsc/pittcsc-website/backend/internal/auth/auth.go:67) and [live session checks](/Users/archzak/Desktop/pittcsc/pittcsc-website/backend/internal/auth/sessions.go:15).
- [Dashboard dispatch](/Users/archzak/Desktop/pittcsc/pittcsc-website/src/pages/dashboard.js:12), [navigation](/Users/archzak/Desktop/pittcsc/pittcsc-website/src/components/auth/AuthFrame.js:10), and [existing account editor](/Users/archzak/Desktop/pittcsc/pittcsc-website/src/components/account/MyAccount.js:1).

AlumniDB already has React directory cards/details, search/filter UI, rich profile fields and self-service editing. Its inspected implementation also has a frontend-only Pitt restriction, public previews/photos, inconsistent list/detail access, and broken pagination/contracts; port selected functionality, not those behaviors. Full evidence and source paths are in [the investigation](ALUMNI.md).

## Implementation plan

1. **Start from CRM.** Create `codex/alumni-integration` from the then-current `crm-expansion` when implementation is authorized. Pin the AlumniDB source commit and record attribution/provenance for ported UI. Target the integration PR at `crm-expansion`; do not merge unrelated repository roots or carry over nested Git metadata, env files, generated bundles, or obsolete authentication/deployment code.
2. **Extend the shared model.** Add versioned Supabase migrations for nullable directory fields, offered-help values, employment labeling, publication state, and directory-information timestamp. Reuse existing names/year/LinkedIn/photo data. Keep schema private to Go database access. Do not require new fields for ordinary CRM profile saves or confuse existing CRM completion with directory eligibility.
3. **Implement owner operations.** Extend profile input/output validation and shared-profile updates. Add an explicit idempotent owner publication operation, such as `PUT /profile/alumni-publication` with a desired boolean. Save edits and automatic unpublication atomically; use current database eligibility, not browser-supplied roles/owner IDs. Keep publication out of generic self-editable role/account-status fields.
4. **Port directory reads.** Add protected `GET /alumni` and `GET /alumni/{id}` routes in the existing Go application, with explicit reader field projection and consistent publication/status checks. Search/filter/page in Postgres and return only published eligible profiles. Add a dedicated authorized directory-photo read or adapt existing image serving without making arbitrary account assets public. Use parameterized queries, bounded input/page sizes, and `Cache-Control: no-store`.
5. **Port the views.** Extend My Account with the agreed fields, completeness feedback and clearly labeled publish/unpublish control. Add `/dashboard/alumni` and `/dashboard/alumni/:id` dispatch plus dashboard navigation. Reuse selected AlumniDB display code and existing CRM request/session handling. Retain the public site's existing appearance and behavior.
6. **Verify and document.** Use synthetic fixtures to exercise the acceptance cases below. Update the website's profile/development docs. Run the required CRM checks/build and relevant local integration checks. Report skipped or failing checks accurately.
7. **Review and merge.** Review the port against this scope, the glossary, and ADRs. Merge into `crm-expansion` once implementation acceptance passes; production release remains separate. Do not make deferred moderation or legacy feature parity a merge requirement.

Suggested code locations follow existing conventions: extend `backend/internal/profile/`, add directory handlers/query implementation under `backend/internal/server/` and a focused alumni module if needed; extend `src/components/account/`, add `src/components/alumni/` and request helpers; add schema migrations and focused synthetic tests. Avoid introducing abstractions or another backend merely to preserve the old stack.

## Acceptance behavior

- An active Pitt-authenticated student can browse but cannot publish before meeting graduation/completeness rules. Anyone signed out, with a revoked/invalid session, or suspended under existing CRM rules is denied private directory access.
- A new CRM account remains unpublished. Missing directory fields do not prevent ordinary profile saves, CRM browsing, or other existing features.
- A complete eligible owner publishes through the explicitly labeled control, appears once, edits the shared data and sees valid changes reflected immediately, and unpublishes through the same control.
- Editing another person's profile or publication state is denied. Requests cannot publish by forging user IDs, role metadata or completion flags.
- Saving an invalidating edit succeeds for the CRM but atomically removes directory visibility. Fixing the data does not republish automatically. Concurrency cannot leave an ineligible profile published; retries do not duplicate records.
- Syntax-invalid/Pitt-domain contact addresses fail the agreed field rule; valid non-Pitt contact addresses need no verification flow. At least one help option is required; the other false values remain valid.
- Hidden/unpublished profiles are unavailable through details, photos, lists, search, filters, totals and any cached UI after refresh. Reader responses never include resumes, login addresses or other private account fields.
- Directory-visible data changes update its timestamp; logins, unrelated private edits, unchanged saves and publication toggles do not. Inactivity does not hide a published profile.
- Search and combined filters work across successive loaded pages; return navigation restores the browsing context. Deep links work through sign-in and refresh.
- No directory personal data enters Gatsby public HTML/page-data/static assets. Account switching/logout clears private UI state and prevents pending requests from repopulating the wrong session.
- No new moderation, messaging, interview, contact-verification or second-profile workflows are present in the port.
- Run `mise run check`, `mise run build`, focused Go/JS/database behavior checks, and real local CRM auth/profile/directory integration checks. Existing attendance/events/account behavior remains intact.

## Eligible graduation year

Agreed: `graduation_year <= current calendar year`. In 2026, graduation years 2026 and earlier qualify; 2027 does not. In 2027, that class qualifies without a configuration change. Completeness, active-account checks, and explicit publication still apply. A future-year profile remains unpublished until the owner explicitly publishes after becoming eligible. Test the calendar-year rollover with a controlled clock.

## Experience

**Student:** sign in to the CRM using Pitt email, open AlumniDB, search/filter scrollable cards and read published profiles/contact information. Being a CRM user alone does not list the student. A future graduate can fill out shared fields while remaining unpublished.

**Alumnus:** use the same Pitt sign-in and My Account profile. Complete the required information, explicitly publish when eligible, maintain it through normal shared-profile edits, and use the same control to unpublish. No separate alumni login or data-entry copy.

**Officer:** use the same browsing/profile behavior plus existing CRM staff tools. This release introduces no new moderation interface or alumni-curation responsibility.

## Decision records

- [Glossary](ALUMNI-GLOSSARY.md).
- [Explicit publication](docs/adr/0001-explicit-self-service-directory-publication.md).
- [One shared profile](docs/adr/0002-one-shared-profile.md).

Only planning documents were changed in this session. All raised product questions are resolved, and the user confirmed the resulting shared understanding. The grilling session is complete. See ALUMNI.md for the implementation and verification instructions.

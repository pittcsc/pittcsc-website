# /meet — QA pass

Adversarial testing of the whole feature: browser interaction against a running dev
server, independent hand-computation of every scheduling result, direct API calls with
payloads the UI can't produce, and a 75-test automated suite added along the way.

Severity: **P0** broken/data loss · **P1** major workflow · **P2** meaningful UX ·
**P3** polish.

---

## Bugs found and fixed

### P0-1 · Cell detail listed available people as "Busy"
**Repro:** open a meeting with mixed availability → Group tab → tap any heatmap cell.
**Expected:** the names under "Free" match the headcount printed in the cell.
**Actual:** the free and busy lists were swapped, contradicting the number in the very
cell that was clicked.
**Cause:** the polarity flip re-defined the encoding (`2` went from *busy* to
*available*), but `describeSlot` compared raw literals `2`/`1`/`0` written before the
flip, so it kept the old meaning. `score.js` used the named constants and was correct —
the two disagreed.
**Fix:** deleted the hand-rolled copy; extracted `partitionAt(group, start, k)` in
`score.js` as the single answer to "who can make this span", now used by both the
ranking and the cell detail.
**Test:** `scoring.test.mjs` — "partitionAt is the single source of truth", which also
asserts the partition agrees with the per-slot tally the heatmap prints.

### P0-2 · Concurrent responses silently lost answers
**Repro:** POST 12 responses to one meeting concurrently; re-read it.
**Expected:** 12 participants.
**Actual:** 7–9. Answers vanished with no error to anyone.
**Cause:** `mutateMeeting` did read → modify → write guarded only by an in-process
queue. Two people answering at the same moment routinely land in different processes
(dev) or different containers (Netlify), where that queue does nothing and the second
write clobbers the first.
**Fix:** compare-and-set at the adapter level, retried on conflict — Netlify Blobs via
its native `onlyIfMatch` etag, Upstash via an atomic Lua CAS, and the file store via an
exclusive `wx` lock file (with stale-lock reclaim) so the compare and the write happen
together. `mutateMeeting` retries up to six times and surfaces a 409 rather than
silently dropping anything.
**Test:** `store.test.mjs` — 12 writers across two independent module instances, all
land; `api.test.mjs` proves it end-to-end through the real HTTP API.

### P1-3 · The date picker could not be used with a keyboard
**Repro:** Tab to a day in the calendar, press Enter or Space.
**Expected:** the day is selected.
**Actual:** nothing. A keyboard-only user could not create a meeting at all.
**Cause:** day cells only handled `onPointerDown`. Enter/Space on a `<button>` produce a
`click`, which nothing listened for.
**Fix:** added `onClick` that acts only when `event.detail === 0` (the signature of a
keyboard-synthesised click), so pointer input still toggles exactly once and is not
double-handled. Added arrow-key travel across the grid, following the cursor when it
walks into an adjacent month.
**Verified in browser:** Enter toggles, Space toggles, a real pointer click still
changes the selection by exactly one.

### P2-4 · The meeting header advertised days that were never offered
**Repro:** create a meeting on Aug 29 and Sep 9 only.
**Expected:** a summary that shows two days.
**Actual:** "Aug 29 – Sep 9", implying twelve consecutive days.
**Cause:** `describeSpan` printed first–last and ignored gaps, duplicating
`summarizeDates`, which already handled the discontiguous case correctly.
**Fix:** deleted the duplicate; moved `summarizeDates` into `format.js` and used it in
both places.
**Test:** `format.test.mjs` asserts a discontiguous set never renders as a range.

### P2-5 · The same state had three different names on one screen
"Busy" in the heatmap detail, "Can't make it" in the best-times panel, "unavailable" in
the grid's screen-reader labels. Fixed with a single `STATE_LABEL` in `format.js`; a
test asserts the labels stay distinct and stable.

### P2-6 · A nonexistent clock time resolved the wrong way
`zonedToUtcMs` documented resolving spring-forward gaps *forward*, but resolved
backward — 2:30am on a US spring-forward date became 1:30am rather than 3:30am. Only
reachable if a meeting window spans 2–3am on that date, but the code and its
documentation disagreed. Fixed to resolve forward (matching calendar convention), with
a test that also asserts a later wall time is still a later instant.

### P2-7 · Every 15s poll rebuilt everything and re-sent the whole roster
The poll called `setMeeting` with a fresh object even when the payload was byte
identical, invalidating slot enumeration, timezone projection, ranking and every grid
cell — measured ~26ms of pure waste per poll at the size cap, plus the full participant
blob over the network (up to ~2.7MB over ten minutes for a 30-person meeting on a
phone). Fixed with a payload fingerprint that skips the update, and an `ETag` /
`If-None-Match` round trip so an unchanged poll is a 304 with no body.

### P2-8 · Every canonical URL pointed at a dead domain
**Repro:** `curl -I https://csclubatpitt.org` — no response. `curl -I https://pittcsc.org`
— 200, served by Netlify.
**Expected:** `siteUrl` names the domain the site is actually served from.
**Actual:** `gatsby-config.js` and `CNAME` both said `csclubatpitt.org`, which resolves
to nothing, and `seo.js` fell back to a stale Netlify preview URL. Since `seo.js` builds
`og:url` and the absolute `og:image` from `siteUrl`, every social card and canonical
link on the site pointed somewhere dead — not just on `/meet`.
**Fix:** `CNAME`, `gatsby-config.js` `siteUrl` and the `seo.js` default all now say
`https://pittcsc.org`.
**Note:** I originally filed this as a judgement call for a human. That was wrong —
I should have checked whether the domain resolved before assuming it was live.

### P3-9 · Assorted
- `chains.clear()` in the store dropped in-flight chains for *other* meetings,
  reopening the race the map exists to prevent. Now deletes only its own tail.
- The "+2 in September" jump link was a 20px-tall touch target; padded.
- Removed dead code the review surfaced: an unused `disabled` mode threaded through
  eight places in the grid, an unreachable `remove` branch in the respond API, an
  unused `scrollRef`, a `data-weekend` attribute no stylesheet referenced, a `busy`
  tally nothing read, and five exported helpers with no callers.

### Self-inflicted breakages caught during this pass
Three regressions I introduced while refactoring, all caught by testing rather than by
reading the code — worth recording because each produced a *blank page*, not an error:
an `import` placed below module code (ESLint `import/first` failed the whole bundle);
`buildGroup`'s signature changed at the call site but not the definition; and an import
pointed at `format.js` for a function still living in `MonthPicker.js`. An
import/export audit across the feature now runs as part of my checks.

---

## Verified working

**Creation** — name entered/empty (defaults to "Untitled meeting"), single date,
multiple dates, non-consecutive dates, click-again to deselect, drag across dates,
month navigation forward and back, past dates non-selectable, the previous-month button
disabling at the current month, crossing month and year boundaries, all four date
presets, Clear, all four time presets, the dual-handle range, duration presets, duration
clamped when it exceeds the window, creation, the generated link, and opening it.
Selection is communicated three ways at once: filled cells, a written summary in the
calendar header, and an explicit "+N in September" for anything off-screen.

**Participant flow** — name entry, empty name refused, drag to select, drag again to
deselect, selection across multiple days, presets, day/time header bulk selection,
partial answers, autosave, editing after submitting, reload, back/forward navigation,
reopening the same URL (recognised without retyping a name, selection restored, lands
on the right tab), the duplicate-name conflict path (claim vs. "different Sam", which
disambiguates to "Sam (2)"), and read-only peek without answering.

**Results** — checked against hand-computed fixtures, not read off the UI. A three
person meeting engineered so Wed 6–7pm works for all three, Thu for two, Fri for one
produced exactly `3/3`, `2/3 — Cy can't make it`, `1/3 — Ann, Cy can't make it`.
Also covered: an empty submission scoring 0 (never "free all week"), a pending join not
counting, a window requiring *every* slot in it, if-needed counting toward reach but not
the headline, ties breaking to the earlier day then earlier time, one-option-per-day
shortlists, no-overlap and everyone-available cases, one participant, and 30.

**Timezones** — EST/EDT and PST/PDT offsets, UTC, round trips through five zones, the
fall-back hour resolving to its first occurrence, the spring-forward gap, a meeting
spanning a DST change keeping real 30-minute gaps, the same instant labelled correctly
from New York / Los Angeles / Berlin, a Berlin meeting projecting onto the correct New
York days, a projection crossing local midnight adding a column and leaving inert holes
with no slot lost or duplicated, and changing the viewer's zone never moving the
underlying instant.

**Calendar import** — free time selected and events left unselected, a five-minute event
not consuming a half-hour slot, an empty calendar selecting everything, weekly `RRULE`
class schedules landing only on the right days, `CANCELLED` and `TRANSPARENT` ignored,
events outside the window dropped and crossing events clipped, all-day events,
overlapping and back-to-back events merged, folded lines, `DURATION`, UTC stamps,
manual edits surviving a re-import, and garbage input not throwing. The import status
message reports counts only — it never names an event.

**Abuse** — malformed and path-traversal meeting codes rejected at 400, unknown codes
404, method allowlist enforced, 5000-character names truncated, emoji/Unicode/HTML/
script-like input stored as inert text (React escapes at render; no `dangerouslySetInnerHTML`
anywhere in the feature), control characters stripped, a 10,000-slot payload truncated
to the meeting's real size, `source` allowlisted, malformed JSON bodies answered 4xx and
never 5xx, and 12 concurrent writers all landing.

**Visual consistency** — uses the site's own `Layout`, navbar, footer, Poppins,
`primary`/`secondary` colours, rounded-full buttons and rounded-2xl cards. `/meet` is
deliberately **not** in the navbar (`Header.js` contains no reference to it). All
in-feature branding says `pittcsc.org`.

**Accessibility** — all three availability states remain distinguishable in greyscale
(verified by screenshotting through a `grayscale(1)` filter): solid fill, dotted
texture, empty. The recommended window is a gold ring plus a rank badge, and group
density prints the actual headcount in the cell, so nothing depends on hue alone. Grid
has full keyboard support (arrows, Space, Shift-fill) with a roving tabindex; all form
controls are labelled; heading order is sane; live regions announce drag feedback and
bulk edits.

---

## Open issues

| # | Sev | Issue | Recommendation |
|---|-----|-------|----------------|
| 2 | P3 | ~2px horizontal overflow at ~485px viewport width | No element exceeds the viewport; consistent with scrollbar rounding. Not reproducible at 375px or 432px. |
| 3 | P3 | Site navbar has sub-24px touch targets (logo, Join) | Pre-existing, outside `/meet`. |
| 4 | P3 | Tailwind config still uses the v2 `purge` key and `darkMode: false` under v3 | Pre-existing build warnings, untouched by this branch. |
| 5 | P3 | Grid re-renders every cell on each newly-painted slot | Fine at realistic sizes (~336 cells). At the 45-day × 48-slot ceiling a drag may drop frames on a low-end phone; a memoised cell would fix it if anyone hits it. |

---

## Could not be tested

- **Google Calendar OAuth** — needs a real `GATSBY_GOOGLE_CLIENT_ID`; none is
  configured. The button is correctly hidden without one, and the `.ics` path (which
  shares all the interval→slot logic) is fully covered. Untested: the popup, a
  cancelled authorisation, and a denied grant.
- **Netlify Blobs on real Netlify** — exercised against a mock speaking the real edge
  protocol, including the strong-consistency downgrade, but never against the live
  service. `GET /api/meet/health` reports which store actually engaged; check it after
  the first deploy.
- **A real screen reader and a real touch device** — ARIA, labels and greyscale
  legibility were checked programmatically; VoiceOver/TalkBack and physical drag on
  glass were not.
- **Sustained multi-user load** — concurrency was tested to 12 simultaneous writers,
  not to a 30-person club all answering during one meeting.

---

## Automated tests added

`npm test` — 75 tests, no new dependencies (node's built-in runner).

| File | Covers |
|---|---|
| `scoring.test.mjs` (14) | ranking, counts, blockers, ties, shortlist diversity, if-needed, muting, empty and pending answers, 2 vs 30 people |
| `time.test.mjs` (13) | EST/EDT, PST/PDT, UTC, DST fold and gap, round trips, cross-zone projection, date-line handling, calendar arithmetic, labels |
| `model.test.mjs` (9) | slot encoding, window contiguity, create/respond validation, limits, name normalisation, code alphabet |
| `calendar.test.mjs` (11) | ICS parsing, recurrence, all-day, overlaps, clipping, manual-edit preservation, garbage input |
| `format.test.mjs` (7) | date summaries, state vocabulary, viewer-timezone descriptions, ICS generation, name lists |
| `store.test.mjs` (5) | round trip, abort, **concurrent writers across processes**, health honesty |
| `api.test.mjs` (16) | live HTTP contract: validation, identity conflicts, the pending ratchet, ETag revalidation, concurrency, abuse payloads. Skips automatically with no server running. |

---

## Assessment

**Ready for a club to use; not yet proven in production.**

The scheduling logic is the part I'd trust most — every result is now checked against
independently computed expectations rather than eyeballed, including the cases that
matter most (an empty answer scoring zero, a window requiring every slot, blockers
named correctly). The two P0s are exactly the kind that don't show up in a demo: the
inverted detail panel contradicted the number beside it, and concurrent answers
disappeared with no error. Both are fixed with regression tests.

What holds me back from "ship it and walk away" is the storage path. Netlify Blobs is
verified against a mock, not against Netlify. That's the one thing to confirm on the
first deploy — `curl https://<site>/api/meet/health` should report
`"store": "blobs", "durable": true`. If it reports `"file"`, meetings will not survive
and the Upstash fallback should be configured instead.

I'd also want one real person on a real phone before a club-wide announcement. Drag
painting is the heart of the product and I tested it with synthesised pointer events;
those are faithful to the code path but not to a thumb.

# /meet — a scheduler that respects your time

## The thesis

When2meet's flaw isn't features, it's **input volume**. It asks every participant to
paint ~200 cells starting from "unavailable", then dumps a heatmap and makes a human do
the interpretation.

Two things fix most of it, and one thing must not be touched:

1. **Selection always means available.** Drag adds the times you're free — the same
   polarity as the date picker on the create screen and as every other scheduling tool.
   An earlier build inverted this (everything pre-selected, paint your conflicts) to
   save gestures. It was wrong; see "The inversion we backed out of" below.
2. **Headers and presets are the bulk operations.** Tap a day header for the whole day,
   a time row for that half-hour across every day, or "Weekdays" for one tap. That is
   where the gesture count gets recovered — not by redefining what a filled cell means.
3. **Answer the question, don't render the data.** The output is a ranked list of
   *meeting windows of the requested length*, with the people blocking each one named —
   not a grid the organizer has to squint at.

Plus the biggest input reduction of all: **don't type it at all** — import from Google
Calendar or an .ics export and every slot your events leave open is selected for you.

## The inversion we backed out of

The first build had everything start selected and asked people to paint their conflicts.
The reasoning was gesture count, and on that narrow measure it won. It was still wrong:

- **It fails silently in the dangerous direction.** Misread "paint free" and you look
  *un*available — a conspicuous, self-correcting mistake someone notices. Misread "paint
  busy" and you look wide open, and the group books a time you can't make. An input
  model whose failure mode is invisible is disqualified regardless of efficiency.
- **A blank answer became a claim.** Every hour a person never considered read as a yes.
  Absence of input has to mean unknown, never consent.
- **The product contradicted itself.** The month picker used drag-to-select where blue
  meant *included*; the availability grid used the identical gesture to mean *excluded*,
  two screens apart in one flow.
- **A legend was carrying the load.** If misreading the interaction corrupts the whole
  group's results, explanatory text is not an adequate safeguard.

The efficiency argument was real, so it's answered directly: one-tap presets
(Anytime / Weekdays / Weekends / Evenings, offered only when they'd select something in
this meeting's window), header taps, and calendar import. The submit path also stays
closed until at least one slot is selected, so an empty answer can't quietly read as
"none of these work".

## Interaction model

- **Three cell states**, encoded so higher is better: `0` can't make it · `1` if needed ·
  `2` free. The default is 0, because an answer nobody gave must never read as a yes.
  "If needed" is what When2meet lacks and is why nothing ever schedules — it lets the
  ranker find a time that works when nothing is unanimous.
- **Drag to add, drag again to remove.** The first cell your pointer touches sets the
  mode, so there is no tool to select before you start. The same gesture selects dates
  on the create screen, with the same polarity.
- **Live feedback while dragging** ("Wed 5:00 – 6:30 PM", or "2 days · 4 half-hours"
  across columns) so the direction of the interaction is felt, not read off a legend.
- **One pointer path** for mouse, trackpad, touch and stylus, driven through
  `elementFromPoint`. Cells take `touch-action: none` so a finger drag paints; the time
  gutter keeps `pan-y` so the page still scrolls; a drag that reaches the edge of the
  screen auto-scrolls instead of stopping.
- **Keyboard**: arrows move, space toggles, shift fills a block, `m` switches the mark.
- **Autosave.** After the one-time name gate there is no submit button; edits persist
  ~650ms after you stop, and a closing tab flushes rather than dropping the last strokes.

## Visual language (no red/green)

Encoded by **fill + pattern + shape**, so it survives greyscale and every CVD type —
verified by screenshotting the running app through a `grayscale(1)` filter:

| state | encoding |
|---|---|
| Free | solid brand-blue fill — filled always means selected |
| If needed | mid-tone dotted texture (selected, but provisional) |
| Can't make it | empty white |
| Not yet answered | person-level: dashed avatar in the roster |
| Group density | one blue intensity ramp + the headcount printed in the cell |
| Best window | gold ring + rank badge (shape, not hue) |

The ramp is gamma-corrected (`ratio^1.5`), because the distinction that matters is
"almost everyone" vs "everyone", not the bottom of the range.

## Timezones

Slots are anchored to the meeting's home timezone and resolved to absolute instants;
the grid is then re-projected into the *viewer's* timezone — columns become
viewer-local dates, rows viewer-local times, and cells with no real slot render inert.
Same-tz collapses to the dense grid you'd draw by hand. Verified: a 9 AM–3 PM Berlin
meeting renders as 3:00–8:30 AM from New York, on the correct days.

## Privacy

Google import requests **`calendar.freebusy`** — the narrowest scope Google offers. That
grant returns opaque start/end pairs, so event titles, guests and locations never reach
the browser at all. Busy intervals become slot states in the browser; only one digit per
slot is ever sent to the server. The access token is revoked immediately after the call.

## Design

`/meet` uses the site's own `Layout` (navbar + footer), Poppins, `primary` / `secondary`
Pitt colours, rounded-full buttons and rounded-2xl cards. It is deliberately **not** in
the navbar — the link is the entry point. The stylesheet covers only what utilities
can't express: the grid, its cell states, the month picker and the range slider.

## Status

- [x] `src/lib/meet/` — time, model, score, calendar, format (pure, shared client+server)
- [x] `src/lib/meet/store.js` — pluggable persistence (file | Upstash)
- [x] `src/api/meet/{create,get,respond}.js`
- [x] `src/components/meet/*`
- [x] `src/pages/meet/index.js` + `src/pages/meet/[code].js` (matchPath `/meet/:code`)
- [x] `src/api/meet/health.js` — reports the live store without leaking credentials
- [x] Verified: create flow, paint (drag/day/row/keyboard/presets), drag-to-deselect,
      live drag readout, autosave, .ics import, cross-timezone projection, greyscale
      legibility of all three states, mobile at 390px, `gatsby build`
- [x] Verified storage: Upstash adapter exercised end-to-end against a mock speaking the
      real REST protocol — auth, GET/SET+EX, PING, 5 concurrent writers with no lost
      updates, and clear errors for bad token / unreachable host

## Edge cases → decisions

| case | decision |
|---|---|
| 2 vs 30+ people | ranker sorts by count; any person can be muted for a what-if |
| no Google Calendar | manual paint is primary; .ics needs no OAuth from anyone |
| partial availability | unmarked = can't make it; submit is blocked until something is picked |
| editing after submit | autosave, no submit step, identity in localStorage |
| overlapping cal events | intervals merged; a 5-min event won't eat a 30-min slot |
| empty submission | not possible by accident — the submit button stays disabled |
| different durations | windows slide by one slot; duration is a multiple of 30m |
| same link reopened | recognised instantly; "not you?" and "see results" escapes |
| identity w/o accounts | localStorage id; a name clash asks instead of guessing |
| DST | offset probed twice per instant; gap times resolve forward |
| shortlist quality | one option per day, so three options differ in a way people care about |

## Deployment note

Storage defaults to a local file store, which is correct for `gatsby develop` and for
self-hosting but **ephemeral on serverless** — it warns at boot when it detects that.
Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for durable storage; the
adapter interface in `src/lib/meet/store.js` is about twenty lines if another backend is
preferred. `GET /api/meet/health` reports which store is live, whether it is reachable,
and whether it is durable — check it after deploying, before sharing any link.

`.env.example` documents every variable. Google import is enabled by setting
`GATSBY_GOOGLE_CLIENT_ID`; without it the button is hidden and .ics upload carries the
flow.

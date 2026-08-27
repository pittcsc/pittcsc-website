# /meet — a scheduler that respects your time

## The thesis

When2meet's flaw isn't features, it's **input volume**. It asks every participant to
paint ~200 cells starting from "unavailable", then dumps a heatmap and makes a human do
the interpretation.

Three inversions fix most of it:

1. **Everything starts available.** You paint what's *blocked*, not what's free. In a
   window an organizer already narrowed, most people are mostly free, so this is far
   fewer strokes — and someone who opens the link and immediately hits Done has said
   something true rather than something useless.
2. **Headers are selectors.** Tap a day header → whole day busy. Tap a time row → that
   half-hour busy on every day. "I have class MWF 9–11" is one tap, not twelve drags.
3. **Answer the question, don't render the data.** The output is a ranked list of
   *meeting windows of the requested length*, with the people blocking each one named —
   not a grid the organizer has to squint at.

Plus the biggest input reduction of all: **don't type it at all** — import free/busy
from Google Calendar or an .ics export and the blocked slots pre-fill.

## Interaction model

- **Three cell states**: Available (default) · If needed · Busy. "If needed" is what
  When2meet lacks and is why nothing ever schedules — it lets the ranker find a time
  that works when nothing is unanimous.
- **Paint by inversion**: the first cell your pointer touches sets the mode. Touch an
  available cell → you're painting busy; touch a busy cell → you're erasing. No tool to
  select before you start. Same gesture selects dates on the create screen.
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
| Available | white, hairline border |
| If needed | dotted texture, mid tone |
| Busy | ink fill + diagonal hatch |
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
- [x] Verified: create flow, paint (drag/day/row/keyboard), autosave, .ics import,
      cross-timezone projection, greyscale legibility, mobile at 390px, `gatsby build`

## Edge cases → decisions

| case | decision |
|---|---|
| 2 vs 30+ people | ranker sorts by count; any person can be muted for a what-if |
| no Google Calendar | manual paint is primary; .ics needs no OAuth from anyone |
| partial availability | counted from the first mark; unmarked = available |
| editing after submit | autosave, no submit step, identity in localStorage |
| overlapping cal events | intervals are merged; a 5-min event won't eat a 30-min slot |
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
preferred. Google import is enabled by setting `GATSBY_GOOGLE_CLIENT_ID`; without it the
button is hidden and .ics upload carries the flow.

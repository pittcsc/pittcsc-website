# Dark mode — fresh implementation (supersedes #62)

Branch: `feat/dark-mode`. #62 closed 2026-09-21; it was 192 commits stale and its
one prerequisite (`darkMode: "media"`) is already on master. Credit @agrattan0820
for the idea and the `#0F2027` page colour in the PR.

## Decisions (confirm before executing)

1. **Media-driven, no toggle (v1).** Follows the OS setting via
   `prefers-color-scheme`. Zero UI, zero state, no hydration flash. A toggle is a
   follow-up: switch to `darkMode: "class"` + a pre-hydration script. Not now.
2. **Semantic tokens, not `dark:` sprinkles.** #62 added `dark:bg-x` next to every
   `bg-white`. That is brittle — every future component has to remember. Instead:
   CSS custom properties on `:root` that flip under the media query, registered in
   Tailwind as colours. Components say `bg-surface` / `text-ink` and never mention
   dark. `_meet.scss` already works this way with `--meet-*`; extend the pattern.
3. **Header logo stays.** Previewed `hero_image.png` on `#0F2027`: the grey editor
   window is its own light card, so the navy panther reads fine. Only the tail is
   weak. Not worth a second asset or #62's white-box hack.
4. **`text-primary` lifts, `bg-primary` doesn't.** Headings in Pitt navy (#243E8B)
   are unreadable on a dark page; filled navy buttons with white text are fine.
   Tailwind config already splits `colors.primary` from `textColor.primary`, so
   pointing only the latter at a token fixes all 22 headings with no component
   churn.

## Tokens

| token            | light     | dark      | used for                          |
|------------------|-----------|-----------|-----------------------------------|
| `surface`        | `#ffffff` | `#0F2027` | page                              |
| `surface-raised` | `#f3f4f6` | `#17262f` | cards (today `bg-gray-100`)       |
| `surface-sunken` | `#f9fafb` | `#0b181e` | inputs, gutters                   |
| `ink`            | `#111827` | `#e5e7eb` | body text                         |
| `ink-muted`      | `#6b7280` | `#9ca3af` | secondary text (today `gray-500`) |
| `ink-brand`      | `#243E8B` | `#8fa8ee` | `text-primary` headings           |
| `line`           | `#e5e7eb` | `#2a3b45` | borders                           |

Gold (`secondary-100`, `#ffb81c`) and the filled navy stay as they are in both.
Contrast targets: ink/surface ≥ 12:1, ink-muted/surface ≥ 4.5:1 (AA),
ink-brand/surface ≥ 4.5:1 — verified by script before shipping.

## Plan

- [x] 1. Tokens: `:root` vars + `@media (prefers-color-scheme: dark)` block in
      `global.scss`; `color-scheme: light dark` on `html` so form controls and
      scrollbars follow. Register in `tailwind.config.js`.
- [x] 2. Shell: `layout.js`, `Header.js`, `Footer.js`, `Modal.js` on tokens.
      Site is "dark with correct ink" everywhere after this step.
- [x] 3. Components: `TeamCard`, `ProjectCard`, `InitiativeTemplate`, `eventItem`
      — cards to `surface-raised`, borders to `line`.
- [x] 4. Pages: `index`, `about`, `join`, `initiatives/*`, `sponsors` (sponsor
      logos keep white cards — they're third-party marks), `qr` (checkerboard is
      already theme-neutral).
- [x] 5. `/meet`: redefine `--meet-*` under dark; replace the 52 literal colours in
      `_meet.scss` with vars where they mean surface/ink/line. Cell semantics
      unchanged: filled navy = free, dotted = if-needed, empty surface = can't.
      Hatch (#147) needs a dark-aware colour.
- [x] 6. Contrast script over every token pair; fix any that miss.
- [x] 7. Screenshot pass, every page, both schemes, via the pane's
      `colorScheme` emulation.
- [x] 8. PR. Body credits #62.

## Out of scope

- A user-facing toggle (see decision 1).
- A light logo variant.
- Illustrations on `index` (polka, arrows): checked per-page in step 7; fixed only
  if they actually break.

## Palette revision (after review)

The dark values were replaced with a brand-derived palette supplied on review. It
reached the same structural conclusion independently — navy cannot carry text on a
dark ground (about 2:1), so it demotes to a fill-only colour and a lighter tint takes
over for text, links and outlines — which is what `--ink-brand` vs `colors.primary`
already encoded. Only the numbers changed.

The ground moved from teal-tinted (#0f2027, inherited from #62) to navy-tinted
(#0f1320), and the whole neutral ramp now carries the brand's 220° hue instead of
Tailwind's neutral greys. Verified all four contrast claims in the supplied table:
8.78, 6.06, 8.79, 9.16 against the stated ~8.8, ~6, ~8.8, ~9.

Three tokens the table doesn't name were derived in the same family: `surface-sunken`
(a step below the page), `line-strong` (a step above the border), `ink-faint` (a step
below secondary text).

One place its rule "keep filled navy" could not be taken literally: a filled *grid
cell* in /meet has to read as filled against the card it sits on, and #26488c manages
1.85:1 there, with a white headcount printed on it besides. `--meet-primary` is the
same hue lifted to #496aab — 5.34:1 for the digits, 3.04:1 against the card. Filled
buttons everywhere else keep the unmodified navy.

Not adopted: the table's light-mode column lists #26488C / #F2A81D / #F2F2F2, but the
repo ships #243E8B / #FFB81C / #ffffff. Those are live-site brand values and changing
them is a separate decision, so light mode is untouched.

## Review

Landed on `feat/dark-mode`. What changed against the plan while doing it:

- **Two tokens the plan didn't have.** `surface-accent` (the decorative hero
  square: pale gold in light, deep olive in dark — light ink was crossing it) and a
  fixed `text-navy` for text on fixed gold bands (the sponsors stat tiles and the
  "Most Impact" badge), where the lifted `ink-brand` washed out to 1.3:1.
- **Pale-gold bands get fixed dark text** (`text-gray-900`) — the exact thing #62 was
  patching per-element with `text-black`, done once per band instead.
- **Form fields.** `@tailwindcss/forms` paints every input white in its base layer and
  beats `color-scheme`; one base rule puts them on `--surface`. Light stays white.
- **`/meet` fill lifted to `#4f6dd6`, not `#5b7be0`.** The heatmap prints white digits
  on the fill; `#5b7be0` gave 3.9:1, `#4f6dd6` gives 4.7:1 and still clears 3:1
  off the card. Card raised to `#1a2b35` so it lifts 1.15:1 off the page.
- **Dark `text-blue-600` → `ink-brand`** on initiatives and sponsors links (3.0:1 in
  dark otherwise). This nudges the light-mode link colour from Tailwind blue to Pitt
  navy — a brand alignment, and the only intentional light-mode change.

Verification: a contrast crawler over every route in both schemes (text < 3:1
against its effective background). Dark: 0 findings on all 13 routes after fixes.
Light: only pre-existing values (gray-400 hint text at 2.5:1, disabled past days in
the month picker) — unchanged from master, flagged but not touched. Scripted token
pairs all ≥ target in dark. Visual pass: home, about, sponsors, qr, both /meet
grids. 83/83 tests.

Header logo confirmed fine on dark without a second asset. 404 page had the Gatsby
starter's hard-coded `#232129`; dropped so it inherits ink.

Two things the crawler missed and only looking at the page caught:

- **Social icons on the pale-gold card** rendered at 1.85:1 — they are `text-primary`,
  which lifts, on a band that is fixed in both schemes. The crawler only inspected
  nodes with text content and an SVG icon has none. Ten of them across index and join
  now use the fixed `text-navy`, and the crawler covers `<svg>`.
- **Inputs with no `type` attribute** matched neither @tailwindcss/forms' base nor the
  override, so the meeting-name and join-name fields stayed white — with near-white
  text in them. `input:not([type])` added to the selector list; typed text now
  15.97:1.

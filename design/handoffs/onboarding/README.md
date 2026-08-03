# Handoff: New-user onboarding (first-run size capture)

## Overview

A visitor arrives from a Reddit thread, pastes one seller link, and the card opens. Today the size block on that card says nothing useful, and the visitor leaves. This feature closes that gap: **two taps on the first card produce a chart-scored size pick** — no tape measure, no keyboard, no account.

Scope of this handoff:

- The arrival screen change (a dismissible three-step strip under the paste bar).
- The two-step size ask inside the product card (usual size → preferred ease).
- The resulting size pick, with provenance.
- The skipped / no-chart / wrong-garment-class states.
- The "fit ladder" upgrade path reachable from any card.
- Phase two (specced, ship later): a reference-garment anchor ("name a tee you own") that yields a real cm number with zero typing.

Out of scope: sign-in, sync, the shelf grid itself, the card back, hauls, the order track, the chart-photo OCR read.

---

## About the design files

The files in `designs/` are **design references created in HTML** — prototypes that show intended look, copy and behaviour. They are **not production code to copy**. They use a local component runtime (`support.js`) and a bespoke templating layer that exists only in the design tool.

Your task is to **recreate these designs in the target codebase**, using its existing framework, component library and conventions. The Credenza app is a local-first React app (see `github.com/sportskoat/credenza`, branch `main`) — build there with its existing primitives (`Button`, `Chip`, `Field`, `SizeRecommendation`, `BuyButton`, `Toast`), not new ones. If a primitive named here does not exist in the codebase, extend the nearest one rather than inventing a parallel component.

The designs reference the design system at a path (`_ds/credenza-fashion-design-system-…/`) that does not exist in this bundle. The token CSS files you need are copied into `tokens/`. Opening the HTML files without the design tool will render unstyled or partially styled — read them as source, and use `designs/assets/handoff-*.png` for the visual reference.

## Fidelity

**High fidelity.** Colors, type, spacing, radii, touch targets and copy are final and lifted from the Credenza design system. Recreate them exactly, using the codebase's existing token variables (`--cz-*`) rather than hard-coded hex. Where a value below looks off-grid (13px padding, 42px Buy, 148px photo) that is intentional — Credenza does not sit on a 4/8px grid, and rounding those values is a defect.

Two colourways must both work: **Gallery** (`:root`, light) and **Blackout** (`[data-theme="dark"]`). The canvas shows turn 2 in Gallery and turn 1 in Blackout; every value below is a token, so both follow automatically.

---

## Screens / views

Ten frames. **A0–A5 ship now. B1–B4 are phase two** — specced so the two do not diverge later.

Frame images: `designs/assets/handoff-arrival.png` (A0), `handoff-2a.png` (A1–A5), `handoff-2b.png` (B1–B4).

### A0 · Arrival

**Purpose:** the visitor lands cold and understands what pasting a link buys them.

**Layout:** existing shelf screen, unchanged, plus one new element.
- Masthead: wordmark left (13px display, weight 800, letter-spacing 0.16em, uppercase), `Sign in` subtle button right. 1px bottom hairline.
- Paste field: height 52px, radius 14px, 1px hairline, `--cz-card-solid` fill, 16px placeholder `Paste a buy link…`, primary `Stash` button inset 6px from the right edge.
- **NEW — intro strip:** below the paste field. Radius 16px, 1px hairline, `--cz-card-solid`, padding 15px 16px, gap 12px.
  - Kicker row: `FROM REDDIT · HERE IS THE TRICK` (mono, 9.5px, weight 700, letter-spacing 0.12em, uppercase, `--cz-faint`) with a `×` dismiss at the right.
  - Three numbered rows, 10px gap. Numeral in a 22px circle, `--cz-accent-bg` fill, mono 10px/800. Label 13.5px/600 `--cz-ink`.
    1. `Paste one seller link.`
    2. `We read that seller's size chart.`
    3. `You get the size that fits you.`
  - Footer line 12.5px `--cz-faint`: `Two taps on the first card is all we ask for. No tape, no account.`
- Empty grid: 2-up, 10px gap, 4:5 dashed placeholders.
- Haul bar: 62px pill, `--cz-ink` fill, `--cz-bg` text, `Shelf` / 48px `+` / `Hauls`.

**Behaviour:** dismissal is permanent (`onboarding.introDismissed = true`, local). The strip never returns. **No size ask appears on this screen** — the ask belongs to the card.

### A1 · Ask 1 of 2 — usual size

**Purpose:** anchor the visitor to a row in this seller's chart.

**Layout:** product card, radius 16px, 1px hairline, `--cz-card-solid`, shadow `0 6px 16px rgba(23,24,26,.06)`.
- Photo flush to the card edge, height 148px, `object-fit: cover`.
- Text block, padding 13px, gap 10px: title 20px display/600/−0.03em · price row (mono 14px/700 `--cz-money`, left) with seller (11px/600 `--cz-faint`, right) · `Sizes on listing: S · M · L · XL` at 12px/600 `--cz-sub`.
- **Size block:** inset panel, radius 14px, 1px hairline, `--cz-inset-bg`, padding 13px, gap 11px.
  - Header row: `YOUR SIZE` (mono 9.5px/700, 0.12em, uppercase, `--cz-faint`) left · `STEP 1 OF 2` (same treatment, `--cz-warn-ink`) right.
  - Question: `What size do you usually buy?` — 19px display/600/−0.035em, line-height 1.25.
  - Body: `This seller's chart is posted. Your usual size tells us where you sit on it.` — 12.5px/1.5 `--cz-sub`.
  - Chip row, wrap, 7px gap. Each chip: min 54×44px, radius 999px, `--cz-card-solid` fill, 1px `--cz-hair`, 14px/700 `--cz-ink`.
  - Footer row: link `I have a tape · enter chest` (12.5px/650 `--cz-link`) left · subtle `Skip for now` right.
- **Buy is not rendered while an ask is open.** It returns with the pick (A3) and is present in the skipped state (A4).

**Chips come from the listing's own size run**, not a fixed S–XL list. Numeric listings render numeric chips. If the run has more than 6 entries, wrap to a second line; never scroll horizontally.

### A2 · Ask 2 of 2 — preferred ease

**Purpose:** turn the anchor into scoreable intent.

Same panel geometry as A1. Photo shrinks to 150px.
- Header row: `YOUR SIZE · USUAL M` left (the first answer stays visible) · `STEP 2 OF 2` right.
- Question: `How do you like a tee to sit?`
- Body: `Your usual M is 100cm on this chart. This tells us which way to move off it.` — the chart number is real and comes from the parsed chart; this is what makes tap two feel like progress.
- Three ease chips, equal width, 58px tall, 7px gap, two lines each:
  - `Close` / `+2CM` · `Regular` / `+6CM` · `Roomy` / `+12CM`
  - Label 13px/700; delta mono 10px/700 `--cz-faint` (0.7 opacity when selected).
  - Unselected: `--cz-card-solid` + 1px `--cz-hair` + `--cz-ink` text. Selected: `--cz-ink` fill, `--cz-ink` border, `--cz-bg` text.
- Full-width primary `Show my size` (min-height 44px), then a centred subtle `Skip for now`.

### A3 · The pick

**Purpose:** deliver the payoff and show its work.

Photo 126px. Size block border becomes **1px solid `--cz-ink`** to mark it resolved.
- Header: `YOUR SIZE` left · `CHART PICK · USUAL SIZE + FIT` (mono 9.5px/800, `--cz-money`) right.
- Body row: size at 34px display/600/−0.035em, line-height 1, beside one sentence of reasoning at 13.5px/1.5 `--cz-sub`.
  - Example: `The Large is 104cm here — 6cm over the 98cm this seller's M-wearers sit at, which is the regular fit you picked. The M's 100cm would sit close.`
- Three equal data tiles, 7px gap, radius 11px, 1px hairline, `--cz-card-solid`, padding 9px 10px. Each: mono 9px/700/0.1em uppercase label over mono 13px/700 value.
  - `ANCHOR / Usual M` · `GARMENT / 104cm` · `EASE / +6cm` (ease value in `--cz-money`).
- Hairline, then provenance line 12px/1.45 `--cz-faint`: `Started from a size you told us, not a measurement.` + link `Add your chest` `to remove the guess.`
- `BuyButton` below the panel, label `Buy`, agent `Superbuy`, height 42px.

### A4 · Skipped — the honest state

**Purpose:** never claim a pick the product cannot justify.

Photo returns to full 176px. Size block border becomes **1px dashed `--cz-hair-strong`**.
- Header: `YOUR SIZE` left · `NO PICK YET` (`--cz-faint`) right.
- Headline: `No size pick yet.` — 19px display/600.
- Body: `This seller's chart is read and ready. We just don't know anything about you yet — one tap is enough to start.`
- Full-width primary `Add my size`.
- Footer: `Signed out · your answers stay on this phone. We won't ask again this visit.`
- **Buy stays live.** Price, photos and the album all keep working. Skipping costs the visitor nothing but the pick.

Copy rule: name the *real* gap. Never "no size available" and never "no chart" when the chart parsed fine and the body data is what is missing.

### A5 · Upgrade path — the fit ladder

**Purpose:** collect the remaining data one field at a time, over weeks, never as a form.

Reached from any provenance link (`Add your chest`, `Add waist`, `Measure it properly`). **Settings is never the required path.**
- Top panel (radius 16px, hairline, `--cz-card-solid`): header `YOUR FIT · 2 OF 4` left, `TOPS ARE COVERED` right. Four-segment meter, 5px tall, 5px gap, radius 999px — filled segments `--cz-money`, empty `--cz-seg`. Then four rows, 13px/650:
  - `Usual size · M` → `SAVED` (mono 11px/700 `--cz-money`)
  - `How you like it · regular` → `SAVED`
  - `Chest · removes the guess` → `NEXT` (`--cz-faint`)
  - `Waist · for bottoms` → `LATER`
- Bottom panel (border 1px `--cz-ink`): headline `One number, one time.` · instruction `Lay a tee that fits you flat. Measure armpit to armpit, double it. That is chest.` · one `Field` labelled `Chest — pit to pit, doubled` · cm/in segmented pair (32px chips in a 999px `--cz-seg` track) with a `Show me how` link · full-width primary `Save and re-score my cards` · footnote `Updates every card on your shelf, not just this one. The full tape list still lives in Settings.`

**One field per visit.** Never show two.

### B1 · Phase two — name a tee you own

Same panel geometry as A1. Flag `NEEDS YOU` (`--cz-warn-ink`).
- Question `Name a tee that fits you.` · body `We know what these measure, so we can read this seller's chart against it. No tape.`
- Brand chip row (44px tall, padding 6px 14px, 13px/650): `Uniqlo` `Nike` `Zara` `Essentials` `Something else`.
- Hairline, then label `Then the size you wear in it` (12px/650 `--cz-faint`) and the size chip row (same as A1).
- Centred `Skip for now`.
- `Something else` falls through to A1 → A2. Nobody dead-ends.

### B2 · Confirm the number

**The only bottom sheet in the entire flow.** Card behind it dims to 0.35 opacity.
- Sheet: top corners radius 18px, `--cz-card-solid`, top hairline, shadow `0 -8px 30px rgba(23,24,26,.10)`, padding 16px 16px 20px, gap 12px. 38×4px grab handle, centred.
- Headline: `A Uniqlo L is 108cm across the chest.` — 21px display/600.
- Body: `That is the number we'll score this seller's chart with. Change it if your L runs different.`
- Number row: radius 12px, hairline, `--cz-inset-bg`, padding 12px 14px — value mono 22px/700 left, `CM · CHEST` mono 12px/700 `--cz-faint`, `Edit` link right.
- Buttons side by side, 44px: primary `Use this number` · subtle `Not now`.
- Footnote: `From published Uniqlo measurements, stored in the app. Nothing was sent anywhere.`

Reuse this exact surface for the chart-photo OCR read when it lands.

### B3 · Pick from a reference number

Identical to A3, with three deltas: flag reads `CHART PICK · CHEST 108CM`; first tile becomes `YOU / 108cm`; provenance reads `From the Uniqlo L you named, not a tape.` + link `Measure it properly` `to lock it in.` Photo 120px.

### B4 · Wrong garment class (bottoms)

A bottoms card with a tops-only profile.
- Flag `TOPS ONLY SO FAR`. Body: `Your chest is saved, but these are bottoms. Name a pair of jeans that fits and we can score this chart too.`
- Numeric waist chips `30 32 34 36` plus a wider `Type my waist` chip.
- Payoff line: `One tap. Then every pair of bottoms on your shelf gets scored.`
- Summary row under the card: `Tops · chest 108cm saved` with `SCORING` in `--cz-money`.

Each garment class asks its own single question, on the card where it matters, in the shape of A1.

---

## The sizing algorithm

```
resolveBody(profile, chartRow, garmentClass):
  if profile.chest        -> { value: profile.chest,             source: "measured"      }
  if profile.reference    -> { value: table[brand][size].chest,  source: "reference"     }
  if profile.usualSize    -> { value: chartRow(usualSize).chest - easeOf("regular"),
                                                                 source: "self-reported" }
  else                    -> null            // → A4 honest state

score(chart, body, ease):
  target = body + ease
  return argmin(row => abs(row.chest - target)) over chart.rows
```

Ease deltas (**estimates — validate against real chart data before ship**):

| Class | close | regular | roomy | Measure |
|---|---|---|---|---|
| Tops | +2cm | +6cm | +12cm | chest |
| Bottoms | +0cm | +2cm | +5cm | waist |

Rules:

- Ease is stored **once per garment class** and reused on every later card. The second card asks nothing.
- Anchor resolution runs against **this seller's chart**, not a global size table. "Usual M" means "the body this seller's M is cut for", which is why the pick can legitimately differ per seller.
- Confidence label never over-claims: `chart pick · usual size + fit` → `chart pick · chest 108cm` → `no chart · your usual size`.
- Ties (equal absolute error) resolve **up**, to the larger garment.
- Saving any anchor **re-scores every card on the shelf**, not just the open one. The button says so.
- Unit is a display concern only. Store centimetres; convert at the boundary. `in` values round to 0.5.

Test vectors (chart: S 96 / M 100 / L 104 / XL 112):

| Input | body | target | Pick |
|---|---|---|---|
| usual M, regular | 94 | 100 | M |
| usual M, roomy | 94 | 106 | L |
| chest 98, regular | 98 | 104 | L |
| chest 108, regular | 108 | 114 | XL |
| chest 108, close | 108 | 110 | XL (tie-up from 112 vs 104) |
| no chart, usual M | — | — | M, labelled `no chart · your usual size` |

---

## State machine

```
idle
 └─ paste ──> cardOpen
      ├─ chart? no  ──────────────> usualSizeEcho     (no ease ask)
      ├─ profile complete? yes ───> pick
      ├─ anchor missing ──────────> ask1 ──tap──> ask2 ──tap──> pick
      │                              └─skip─┐      └─skip─┐
      └─ wrong garment class ──────> askClass       ▼      ▼
                                                  skipped (session-sticky)
pick ──provenance tap──> ladder ──save──> pick (re-scored, all cards)
```

| State | Enter when | Exit |
|---|---|---|
| `ask1` | chart parsed, no anchor for this class, not skipped this session | chip tap → `ask2`; skip → `skipped` |
| `ask2` | anchor set, no ease for this class | chip + CTA → `pick`; skip → `skipped` |
| `pick` | anchor + ease (or measurement) + chart | provenance tap → `ladder` |
| `skipped` | either ask dismissed | new session, or `Add my size` |
| `usualSizeEcho` | no chart on the listing | anchor added later |
| `askClass` | card's garment class has no anchor | tap → `pick` |

`skipped` is **session-sticky**: one skip suppresses both asks on every card for the rest of the session. Write `skippedAt`; clear on new session. Do not re-prompt, do not show a toast asking again.

## State / data model

One local key, synced verbatim on sign-in (sign-in never gates any of this):

```json
{
  "fit": {
    "unit": "cm",
    "tops":    { "usualSize": "M", "ease": "regular", "chest": null,
                 "reference": { "brand": "Uniqlo", "size": "L" },
                 "source": "self-reported", "updatedAt": "2026-08-02T15:04:00Z" },
    "bottoms": { "usualSize": null, "ease": null, "waist": null,
                 "reference": null, "source": null, "updatedAt": null },
    "askedThisSession": ["tops.anchor", "tops.ease"],
    "skippedAt": null
  },
  "onboarding": { "introDismissed": false }
}
```

- `source` is one of `measured` | `reference` | `self-reported` and **drives the confidence label**. Never render a label that outruns this field.
- No network call is required for any state in A0–A5. B1–B3 read a **table shipped with the app** — no live lookup, no model call.
- On sign-in, merge local into remote; local wins on conflict for `fit` (the visitor just typed it).

## Interactions & behaviour

- **Motion:** one curve, `cubic-bezier(0.23, 1, 0.32, 1)`. Durations: 120 press, 140 micro, 250 open, 300 resize. Nothing bounces or overshoots.
- **Press:** `scale(0.96)` on chips and pills, `scale(0.98)` on full-width buttons and Buy.
- **Hover (fine pointers only):** `filter: brightness(0.98)` on pills, 6% accent tint on rows. Never a colour change. Buy fades in over the photo on hover on fine pointers only — on touch the first tap would fire hover and steal the open.
- **Focus:** `2px solid var(--cz-focus)` at 2px offset; inside a clipped card face use an inset `box-shadow` ring instead.
- **Disabled:** `opacity: 0.56`, `cursor: not-allowed`. `Show my size` is disabled until an ease chip is chosen.
- **Panel transitions:** A1→A2→A3 swap content inside the same panel at 250ms; do not remount the card or re-fetch the photo. The photo height change animates with the same duration.
- **Sheet (B2):** slides up 250ms; backdrop is ink at 50% with 6px blur, dropped entirely under `prefers-reduced-transparency`. Dismiss on backdrop tap = `Not now`.
- **Toast:** used only for a save that has an undo (`Saved M as your usual size.` / `Undo`), 4s, bottom inset 18px.
- **Reduced motion:** everything collapses to 0.01ms.
- **Loading:** while the chart parses, the size block shows a skeleton at the panel's resting height — never a spinner over the whole card, and never a layout jump when it resolves.
- **Error:** a chart that fails to parse routes to `usualSizeEcho`, not to an error state. Flat copy only: `Couldn't read that link.`

## Accessibility

- **44px minimum touch target on coarse pointers — non-negotiable.** Chips are 44px tall even where the visual pill looks smaller.
- Inputs are 16px under 767px so iOS does not zoom.
- Chip rows are radio groups: `role="radiogroup"` with an accessible group label from the question text; arrow keys move selection.
- The confidence flag and provenance line must be in the same accessible description as the size, so a screen reader never announces a bare `Large`.
- Ink ramp: `--cz-faint` is the lightest ink allowed on any readable text. Never lighter.
- The intro strip's `×` needs an accessible label (`Dismiss`).

## Telemetry

| Event | Properties |
|---|---|
| `onboarding_intro_shown` / `_dismissed` | — |
| `size_ask_shown` | `step: 1\|2`, `garmentClass`, `chartPresent` |
| `size_ask_answered` | `step`, `value`, `msSinceShown` |
| `size_ask_skipped` | `step`, `garmentClass` |
| `size_pick_shown` | `size`, `source`, `easeUsed`, `chartRows` |
| `size_provenance_tapped` | `from: pick\|ladder` |
| `fit_field_saved` | `field`, `source`, `cardsRescored` |
| `buy_tapped` | `hasPick`, `source` |

Primary metric: share of first-paste sessions that reach a size pick. Secondary: taps to first pick (target 2), skip rate at step 1 vs step 2, ladder completion within 7 days, and **Buy rate on cards with a pick vs without** — idea 1 (one tap, no ease) would win the first metric and lose this one. Watch them together.

## Design tokens

Use the CSS variables, not the literals. Full files in `tokens/`. Gallery / Blackout:

| Token | Gallery | Blackout |
|---|---|---|
| `--cz-bg` | `#F4F4F0` | `#000000` |
| `--cz-bg-elevated` | `#ffffff` | `#101012` |
| `--cz-card-solid` | `#ffffff` | `#202024` |
| `--cz-inset-bg` | `#FAFAF6` | `#26262b` |
| `--cz-footer-bg` | `#EFEFE9` | `#0c0c0e` |
| `--cz-seg` | `rgba(23,24,26,.06)` | `rgba(255,255,255,.07)` |
| `--cz-hair` | `#d2d2c9` | `rgba(255,255,255,.16)` |
| `--cz-hair-strong` | `rgba(23,24,26,.18)` | `rgba(255,255,255,.24)` |
| `--cz-ink` | `#17181a` | `#f5f5f7` |
| `--cz-sub` | `#4f545b` | `#b7bbc2` |
| `--cz-faint` | `#6b7078` | `#9ea3ab` |
| `--cz-placeholder` | `#8a9099` | `#8a9099` |
| `--cz-accent-bg` | `rgba(23,24,26,.08)` | `rgba(245,245,247,.12)` |
| `--cz-action-fill` / `-text` | `#17181a` / `#F4F4F0` | `#f5f5f7` / `#000000` |
| `--cz-money` | `#147a3a` | `#4ade80` |
| `--cz-money-bg` | `rgba(21,128,61,.09)` | `rgba(74,222,128,.12)` |
| `--cz-warn-ink` | `#8a6714` | `#e8bf63` |
| `--cz-link` | `#1d5fd0` | `#7fb2ff` |
| `--cz-focus` | `#17181a` | `#f5f5f7` |

**Type** — one family, two voices. `--cz-display` Clash Grotesk 600, tracked −0.03em (card titles) / −0.035em (headings). `--cz-sans` Clash Grotesk 500–800, tracked −0.01em. `--cz-mono` system mono, uppercase, tracked +0.08 to +0.14em, for prices, sizes, kickers and flags. App scale is fixed px: 17 card title / 14 body / 13 chrome / 12 label / 11 micro / 10 flag; this flow adds 34 (pick size), 21 (sheet headline), 19–20 (question / card title).

**Radii:** 10 field · 11 data tile · 12 number row · 14 inset panel & paste field · 16 card & strip · 18 sheet top corners · 999 every chip, pill and flag.

**Shadows:** card at rest `0 6px 16px rgba(23,24,26,.06)`; sheet `0 -8px 30px rgba(23,24,26,.10)`. Nothing else in this flow gets a shadow.

**Spacing in use (do not round):** card padding 13px · panel padding 13–14px · panel gap 10–11px · chip gap 7px · tile gap 7px · card gap 12px · screen inset 16px.

## Copy deck

Every string, verbatim. Sentence case. Periods on headings. No emoji, no exclamation marks, no "Oops". Middle dot `·` is the only separator.

| Slot | String |
|---|---|
| Intro kicker | `From Reddit · here is the trick` |
| Intro steps | `Paste one seller link.` / `We read that seller's size chart.` / `You get the size that fits you.` |
| Intro footer | `Two taps on the first card is all we ask for. No tape, no account.` |
| Ask 1 title | `What size do you usually buy?` |
| Ask 1 body | `This seller's chart is posted. Your usual size tells us where you sit on it.` |
| Ask 1 tape link | `I have a tape · enter chest` |
| Ask 2 title | `How do you like a tee to sit?` |
| Ask 2 body | `Your usual M is 100cm on this chart. This tells us which way to move off it.` |
| Ease chips | `Close +2CM` · `Regular +6CM` · `Roomy +12CM` |
| Pick flag | `Chart pick · usual size + fit` |
| Pick reasoning | `The Large is 104cm here — 6cm over the 98cm this seller's M-wearers sit at, which is the regular fit you picked. The M's 100cm would sit close.` |
| Provenance | `Started from a size you told us, not a measurement. Add your chest to remove the guess.` |
| Skipped | `No size pick yet.` / `This seller's chart is read and ready. We just don't know anything about you yet — one tap is enough to start.` |
| Privacy | `Signed out · your answers stay on this phone. We won't ask again this visit.` |
| Ladder rows | `Usual size · M` · `How you like it · regular` · `Chest · removes the guess` · `Waist · for bottoms` |
| Ladder headline | `One number, one time.` |
| Ladder instruction | `Lay a tee that fits you flat. Measure armpit to armpit, double it. That is chest.` |
| Ladder footnote | `Updates every card on your shelf, not just this one. The full tape list still lives in Settings.` |
| B1 title / body | `Name a tee that fits you.` / `We know what these measure, so we can read this seller's chart against it. No tape.` |
| B2 headline | `A Uniqlo L is 108cm across the chest.` |
| B2 body | `That is the number we'll score this seller's chart with. Change it if your L runs different.` |
| B2 footnote | `From published Uniqlo measurements, stored in the app. Nothing was sent anywhere.` |
| B4 body | `Your chest is saved, but these are bottoms. Name a pair of jeans that fits and we can score this chart too.` |
| Toast | `Saved M as your usual size.` / `Undo` |
| Buttons | `Show my size` · `Skip for now` · `Add my size` · `Save and re-score my cards` · `Use this number` · `Not now` · `Add my chest` · `Tap usual size` · `Type my waist` |
| Parse error | `Couldn't read that link.` |

## Assets

- `designs/assets/*.jpg` — product photography, from the Credenza design system (`assets/img/`). Placeholders for the mock; the real app uses scraped listing photos.
- `designs/assets/handoff-*.png` — frame captures, reference only.
- Fonts: Clash Grotesk Variable ships with the design system (`assets/fonts/`). Already in the app.
- Icons: Lucide, 12–17px, stroke 2–2.4. No icon font, no sprite sheet. The `+` in the stash button is sans 20px/500, not an icon. **No emoji anywhere.**

## Files in this bundle

```
README.md                                  ← this document, self-sufficient
designs/Onboarding Flow.dc.html            ← all 10 frames (turn 2 = ship, turn 1 = superseded)
designs/Onboarding Handoff.dc.html         ← the printable design memo
designs/support.js, doc-page.js            ← design-tool runtime, do not port
designs/assets/                            ← photography + frame captures
tokens/                                    ← colors, typography, spacing, motion, elevation, fonts
```

Turn 1 in `Onboarding Flow.dc.html` (ids `1a`, `1b`, Blackout) is an **earlier, superseded** exploration. Build turn 2 (ids `2a`, `2b`).

## Definition of done

- [ ] A visitor who pastes a link and taps twice sees a size, its reasoning and three data tiles — signed out, offline, on a cold profile.
- [ ] Taps to first pick is exactly 2. No keyboard is required anywhere in A0–A5.
- [ ] The second card of the session asks nothing.
- [ ] A skip at either step suppresses both asks for the session and leaves Buy, price and photos live.
- [ ] No chart → `no chart · your usual size`, never an error and never a silent guess.
- [ ] Every rendered size carries a confidence label and a provenance line derived from `fit.*.source`.
- [ ] Saving a chest re-scores every card on the shelf.
- [ ] All chips and buttons measure ≥44px on a coarse pointer.
- [ ] Gallery and Blackout both correct; no hard-coded hex anywhere in the diff.
- [ ] `prefers-reduced-motion` and `prefers-reduced-transparency` both honoured.
- [ ] Nothing in this flow makes a network request.

## Open questions for the team

1. Ease deltas (+2/+6/+12 tops, +0/+2/+5 bottoms) are a designer's estimate — validate against real parsed charts before ship.
2. Which brands ship in the B-phase reference table, and who owns keeping it current.
3. Stale profile (90+ days): confirm prompt, or silence?
4. Does the chart-photo OCR read reuse B2's confirmation sheet, or get its own surface?

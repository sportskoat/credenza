# Credenza Fashion — Combined Four-Model Audit

**Subject:** Credenza Fashion (`~/credenza`, branch `mobile-fix-loop` @ `0088789`)
**Date opened:** 2026-07-23
**Owner:** Kyle Wensel
**Reviewers:** Claude Opus 4.8 · ChatGPT 5.6 · Kimi 3 · Grok 4.5

This file is one document for four reviewers. Each reviewer writes into its own
Part. No reviewer edits another reviewer's Part. Part 6, Part 7, and Part 8 hold
the comparison and the final decision.

---

## Part 0 — Brief for every reviewer

### 0.1 What Credenza Fashion is

Credenza Fashion is a shopping organizer for international agent hauls. A user
pastes a Weidian, Taobao, Yupoo, or Reddit link. The app makes one card. The
card holds the photo, the translated title, the price in USD, the seller, the
size advice, and the purchase link.

The app is a Progressive Web App. It runs at https://credenza-kyle.netlify.app.
The product rules are in `docs/Monetization.md`. Read that file before you
propose a revenue feature.

### 0.2 What to audit

Audit four axes. Use the same four axes in your grade table.

1. **Looks** — color, type, spacing, photography, and visual order.
2. **Functionality** — does each control do the thing it claims to do.
3. **Continuity** — do the screens, the words, and the names agree with
   each other and with the current product.
4. **Sleekness** — layout discipline, motion, density, and polish.

### 0.3 Rules for every entry

1. Measure your claims. Give a file name and a line number for a code claim.
2. Give a number for a size claim, a color claim, or a speed claim.
3. Mark any claim you did not verify. Write "not verified" beside it.
4. List the good parts also. Give a reason for each one.
5. Grade the four axes, plus code health, plus one overall grade.
6. Grade your own entry. State what you did not test.
7. Give each finding an ID. Use your own prefix. Claude uses `CO-`.
   ChatGPT uses `GP-`. Kimi uses `KM-`. Grok uses `GR-`.
8. Write in ASD-STE100 Simplified Technical English.

### 0.4 Section numbers

Section numbers are local to each Part. `§3.2` inside Part 1 means Part 1
section 3.2. Use the finding ID when you refer to another reviewer's finding.

---

## Part 1 — Shared measured facts

Every reviewer may use these numbers. Claude Opus 4.8 measured them on
2026-07-23. Repeat any measurement you doubt.

### 1.1 Build and test baseline

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm run test` | 187 of 187 pass, 14 files |
| Types | `npm run typecheck` | clean |
| Lint | `npm run lint` | 12 errors, 74 warnings |
| Production build | `npm run build` | clean, 806 ms |

### 1.2 Bundle size

```
dist/assets/index-fashion-DdFzENjv.js   499.83 kB │ gzip: 160.53 kB
dist/assets/index-fashion-1n22yZfh.css  139.52 kB │ gzip:  22.81 kB
```

One chunk holds React, framer-motion, lucide-react, and the application.

### 1.3 Live accessibility scan (axe-core, injected into the running page)

```
1440x900:  serious   27  nested-interactive     Interactive controls must not be nested
           moderate   1  landmark-one-main      Document should have one main landmark
           moderate   1  page-has-heading-one   Page should contain a level-one heading
           moderate   5  region                 All page content should be in landmarks

390x844:   serious   18  nested-interactive
           moderate   1  landmark-one-main
           moderate   1  page-has-heading-one
           moderate   5  region
```

### 1.4 Computed contrast ratios of the real tokens

| Pair | Ratio | Verdict |
|---|---|---|
| ink on bg (light) | 16.11 | pass |
| sub on bg (light) | 6.92 | pass |
| faint on bg (light) | 4.52 | pass |
| money on card (light) | 5.02 | pass |
| sub on black (dark) | 10.90 | pass |
| faint on black (dark) | 8.28 | pass |
| money on card (dark) | 9.96 | pass |
| heart on dark card | 4.11 | depends on text size |
| `--cz-hair` on bg (light) | 1.18 | fails the 3:1 floor for UI boundaries |

### 1.5 Live layout measurements

| Element | At 1440 px viewport | At 1920 px viewport |
|---|---|---|
| Masthead | x = 360, width = 720 | x = 600, width = 720 |
| Shelf grid | x = 28, width = 1381 | x = 28, wider |

### 1.6 Live card-back measurement (desktop, 1440×900)

```
clientHeight  388 px
scrollHeight  722 px
hidden        334 px  (46 percent)
below the fold: Status · Want · Bought · Shipped · QC · Green light ·
                Red light · Returned · all 10 Category chips · Buy via Superbuy
```

### 1.7 Evidence images

The screenshots are in `docs/audit-shots-2026-07-23/`. Each finding names its
file. Open the file to check the claim.

### 1.8 Test method used for these numbers

Playwright drove the system Chrome browser at port 5173. The shelf held the
real 18 items from `~/Downloads/credenza-shelf-2026-07-22.json`. The reviewer
tested 1440×900 and 390×844, with touch enabled on the phone size, in Gallery
light and in Blackout dark.

**Caution.** Playwright `click()` moves a mouse pointer before it clicks. That
action triggers a CSS `:hover` rule. Use `touchscreen.tap()` to test a phone.
A `click()` test reports false faults on hover-only controls.

---

## Part 2 — Entry A: Claude Opus 4.8 (Anthropic)

**Status:** complete
**Findings:** 31, with IDs `CO-01` to `CO-31`

### A2.1 Summary

Credenza Fashion is a real product. The card system, the size engine, the agent
registry, and the haul parser all work. The test suite is strong. The color
tokens pass contrast.

The faults are not in the components. The faults are in the shell around the
components. Three faults repeat on every screen.

1. **Two layout grids do not align.** The masthead width is fixed at 720 px.
   The content is nearly full width. Nothing aligns on the desktop screen.
2. **The one detail surface hides 46 percent of itself.** The card back
   scrolls. The scrollbar is removed. No fade marks the cut. Buy, Status, and
   Category are all below the fold.
3. **Interactive controls are nested.** Each card is a `button` that holds two
   more `button` elements. axe reports 27 serious faults on the desktop screen.

### A2.2 Critical faults — correct these before the next deploy

#### CO-01 — Nested interactive controls (27 serious axe faults)

Each grid card and each carousel card is a `button`. Each one contains a Star
`button` and a Buy `button`. React writes a warning at run time:

```
Warning: validateDOMNesting(...): <button> cannot appear as a descendant of <button>.
  at FavoriteButton
```

**Effect.** The HTML is not valid. A screen reader announces the controls in an
unreliable order. A keyboard user cannot predict which control activates.

**Fix.** Change the card to a `div` or an `article`. Add one full-size `button`
for the "open this card" action. Keep Star and Buy as siblings of that button.
Do not keep them as children.

**Files.** `credenza-fashion.jsx` — `Card` (5286), `CoverFlowCard` (6539),
`FavoriteButton` (3274).

#### CO-02 — The card back hides 46 percent of its content

See the measurement in Part 1 §1.6. The cause is in
`credenza-fashion.css:1193`:

```css
.cz-carousel-back-content {
  overflow-y: auto;
  scrollbar-width: none;      /* Firefox bar removed */
  -ms-overflow-style: none;
}
.cz-carousel-back-content::-webkit-scrollbar { display: none; }
```

**Effect.** The card back is the only detail surface in the app. The team
deleted DetailSheet, the rows view, and the grid flip to make the card back
canonical. The card back now conceals the Buy button and the pipeline status
control. A user who does not scroll does not see the Buy button.

**Fix.** Add a bottom fade mask. Turn the mask off at the end of the scroll.
Pin Buy to the bottom of the card back. The rule
`.cz-carousel-back-content > .cz-product-sheet` already sets `flex: 1 1 auto`
for this purpose. Complete that path.

#### CO-03 — Two layout grids on the same desktop screen

See the measurement in Part 1 §1.5. The masthead never grows past 720 px. The
shelf grid, the hauls list, and the empty-search panel run nearly edge to edge.

**Effect.** The tab underline stops 330 px before the first card. On the Hauls
tab the heading "Your hauls" starts at x = 40. The tabs above it start at
x = 500. The two blocks look like two different pages.

**Fix.** Give the app one container token. Apply the same maximum width and the
same gutters to the masthead, the tabs, the stat row, and every content region.

#### CO-04 — First run renders the live app below the intro

Screenshot `09-phone-firstrun.png`. On a new install at 390×844 the phone shows
this order:

- the masthead and the profile avatar
- the headline "One shelf for the whole haul."
- "Get started" and "Log in"
- an empty search field labeled "Search your shelf"
- a large blank area
- the "＋ Stash" bar and an "AGENT Superbuy" tile

The desktop first run (`07-desktop-firstrun.png`) shows a different set. It
hides the search field and the bottom bar. The two breakpoints disagree.

**Effect.** A new user sees a marketing headline, a search field with nothing to
search, and a purchasing agent that the user did not select. The last item also
weakens the FTC disclosure position in `docs/Monetization.md`.

**Fix.** Make the intro exclusive. Render the intro instead of the shell. Match
the desktop version to the phone version. Do not show the agent tile before
onboarding ends.

#### CO-05 — "Log in / Sign up" is a dead button

`credenza-fashion.jsx:3139`. The file `docs/session-state.md` records the state:
"Log in / Sign up (toast — no backend)."

The control is the largest and highest-contrast control in the Profile sheet. It
also appears on both first-run screens.

**Effect.** This breaks the project rule from 2026-07-12: "No broken AI calls in
UI, no hanging 'enriching', no dead buttons."

**Fix.** Replace the button with a waitlist row. Alternatively, hide it behind a
build flag until Supabase lands (build order step 6).

### A2.3 Continuity faults — the app shows old text and old names

#### CO-06 — Stale vocabulary from the generic v3 build

`credenza-fashion.jsx:11029` — the empty-search help text:

> "Search includes titles, notes, **projects**, raw links, and paired Photos or
> Buy URLs."

"Projects" is v3 save-it-later vocabulary. The fashion build has no projects.

#### CO-07 — The PWA manifest still describes the old product

`preview/public/manifest.webmanifest`:

```json
"name": "Credenza",
"description": "Everything you meant to come back to.",
"background_color": "#000000",
"theme_color": "#000000"
```

Three faults:
- The UI brand is "CREDENZA Fashion". The installed icon says "Credenza".
- The description is the v3 line. The current line is "One shelf for the whole haul."
- The splash color is black. The default theme is Gallery light (`#F4F4F0`). A
  light user sees a black flash at every launch.

#### CO-08 — The dark palette uses the key `rainbow`

`credenza-fashion.jsx:79` — the Blackout palette lives under the key `rainbow`.
The migration at line 9157 runs `setTheme("rainbow")` to mean "switch to
Blackout". Components named `RainbowBackground` and `HolographicBackground`
render the plain background.

These names come from a colorway that the team deleted on 2026-07-22. A future
agent reads `rainbow` and expects color. Rename the key to `dark`.

The migration also force-switches an existing light user to dark, one time. Line
9152 shows that this is deliberate. It is still a strong action. Confirm that
you want it.

#### CO-09 — The Hauls tab keeps the Shelf toolbar

Screenshot `P1-hauls.png`. On the Hauls tab the stat row still reads
"18 SAVED | TOTAL $538.25". The favorites filter and both view toggles stay
active. None of them apply to hauls. The search placeholder still reads "Search
your shelf".

#### CO-10 — The empty-search state shows a money total

Screenshot `P5-nomatch.png`. A search with no result renders:

> 0 FOUND | TOTAL **$0.00**

The green money token on a `$0.00` value looks like a real balance. Hide the
total when the count is zero.

#### CO-11 — The Profile sheet has no System theme

`PALETTES` holds `light` and `rainbow` only. The Profile sheet offers Gallery
and Blackout. The earlier build followed the system theme through
`usePrefersDark`. That option is gone. Most users expect it.

#### CO-12 — Two selection patterns in one sheet

In the Profile sheet the Theme row uses a green tick and a ring. Every other row
uses a chevron. "AI fit summary — On ›" and "Fit detail — Concise ›" show a
chevron but act as toggles. The affordance does not match the action.

### A2.4 Looks and sleekness

#### CO-13 — `--cz-hair` fails the UI boundary contrast floor

See Part 1 §1.4. Eight of nine token pairs pass. `--cz-hair` scores 1.18 to 1.
At that ratio the card edges and the search-field border are not visible in
light mode. You see only the shadow of the card. Raise `--cz-hair` to about 3:1
for any line that carries meaning.

#### CO-14 — An off-system pink and cyan rim on the card back

`credenza-fashion.css:1140`:

```css
.cz-carousel-back::before {
  background: linear-gradient(200deg,
    rgba(255, 46, 199, 0.26) 0%,   /* hot pink */
    transparent 40%, transparent 60%,
    rgba(0, 240, 255, 0.18) 100%); /* cyan */
}
```

The reviewer cropped the live card back to confirm it. A pink hairline runs
along the top edge and down both sides.

The palette comment in the same repository says: "money green + heart red are
the only hue in the system." This rim breaks that rule on the main detail
surface.

#### CO-15 — The Buy button runs a four-color beam without an end

`credenza-fashion.css:4906`:

```css
conic-gradient(..., #f40051 310deg, #a855f7 325deg, #f59e0b 335deg, #22d3ee 348deg, ...)
animation: cz-border-beam-rotate 2.6s linear infinite;
```

Pink, violet, amber, and cyan rotate around the Buy button and do not stop. The
reduced-motion guard is present and correct.

One strong visual effect on the Buy button is acceptable. Four hues are not. Cut
the beam to one hue, or to a white sheen. The button already carries a separate
glare sweep (`.cz-btn-glare`). Two effects stack on one control.

#### CO-16 — Three type families on one card

Each card shows Georgia serif for the title, monospace for SIZE, seller, and
price, and a sans face for Buy. The monospace price and the `#4ade80` green in
dark mode look like a terminal display. They do not look like a fashion product.

**Fix.** Keep the serif for the title. Move the price and the seller to the sans
stack with tabular figures. Reserve monospace for raw URLs.

#### CO-17 — Cards in one row do not share a baseline

Screenshot `T3-desktop-gridview.png`. The title "P280KRAGG COTTON SHORT9"短裤1"
wraps to two lines. Its SIZE, seller, and price rows drop below the rows of the
adjacent cards. Nothing aligns across the row.

**Fix.** Clamp the title to two lines on every card. Reserve that space always.

#### CO-18 — Carousel neighbour cards show clipped words

The cards behind the active card render their full titles. The card edge cuts
the words: "TTON SHORT9"短裤1", "ECANT PANT 2". The right-most card is cut by the
viewport with a hard edge and no mask.

**Fix.** Hide the text layer on the non-active cards. Add a mask at the stage
edge.

#### CO-19 — Dark-mode cards lose their outline

Screenshot `03-desktop-dark-grid.png`. The Blackout card surface is `#1a1a1d` on
a `#000000` field. `--cz-hair` is 10 percent white. The lower half of each
neighbour card merges into the background. The photos appear to float.

**Fix.** Raise the dark card surface value or the hairline value. Add a soft rim
light.

#### CO-20 — The image fit rule is not consistent

Card 1 letterboxes its product photo with white bars. Cards 2 to 4 fill the
frame. Both use the same component. The row looks ragged.

**Fix.** Select one rule. If you keep `contain`, add a neutral matte behind the
image.

#### CO-21 — The empty shelf puts text over the ghost cards

Screenshot `08-desktop-empty.png`. The paragraph "Drop in a Weidian, Taobao or
Yupoo link…" overlaps ghost card 1 and ghost card 5. The paragraph wraps to
three lines and leaves the single word "card." on the last line.

The paragraph also says "Drop in a link". The field below it says "Search your
shelf". The instruction and the field contradict each other on a shelf that
holds nothing to search.

**Fix.** Add `text-wrap: balance` and a maximum width of about 44ch. Move the
ghost cards below the text. Set the field placeholder to "Paste a link" when the
shelf is empty.

#### CO-22 — The capture sheet shows red dots beside working sources

Screenshot `P4-capture.png`. A row shows a green "Yupoo", a red "Weidian", an
amber "Taobao", and a red "Reddit".

These are decorative source chips from `ImportSourceCycle` (line 8548). They
look like connection status indicators. A red dot beside Weidian and Reddit
looks like a fault. Reddit does have a real fault today (see CO-26). Use one
neutral hue for all four chips.

#### CO-23 — The capture sheet offers three ways to do one thing

The sheet holds a text area, a large "Stash clipboard" button, a "Paste" link,
and an "Import from Reddit" link. "Stash clipboard" and "Paste" both read the
clipboard. The selected mode chip ("Link") has less contrast than the
unselected chips.

**Fix.** Keep the field and one primary action. Delete "Paste". Invert the chip
states so the selected chip is the strongest.

#### CO-24 — The desktop card back is a phone column on a 1440 px screen

Screenshot `T4-desktop-cardback.png`. The detail surface is about 440×620 px.
About 60 percent of the window is empty. This screen holds the most information
in the app. It also has the least space. It is also the direct cause of CO-02.

**Fix.** At 1024 px and above, present the card back as a two-column layer.
Put the photos on the left. Put the details and Buy on the right. This also
removes the scroll fold.

### A2.5 Functionality and reliability

#### CO-25 — The images are not lazy-loaded

`grep -c 'loading="lazy"' credenza-fashion.jsx` returns **0**, across 6 `img`
tags.

An 18-item shelf loads 18 thumbnails at once. Each thumbnail is an inline data
URL of about 32 kB, so the cost is bounded today. A 200-item shelf is not
bounded.

**Fix.** Add `loading="lazy"` and `decoding="async"` below the first row.

#### CO-26 — Reddit link import is still blocked in production

Not verified live by this reviewer. Source: `docs/session-state.md` §0 item 4.
`REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are not set. Reddit answers 403 to
anonymous JSON requests from Netlify IP addresses.

Haul import from text works. Haul import from a link falls back to a toast. The
capture sheet still shows "Reddit" as a first-class source.

**Action for Kyle.** Create a script app at reddit.com/prefs/apps. Set the two
variables. The client_credentials path is already wired.

#### CO-27 — The Anthropic API key still needs rotation

Not verified live by this reviewer. Source: `docs/session-state.md`. The key was
pasted into a chat. Rotate it at console.anthropic.com. Then run
`netlify env:set`.

#### CO-28 — One 500 kB bundle, with no code splitting

See Part 1 §1.2. One chunk holds React, framer-motion, lucide-react, and the
application. Nothing is deferred. On a phone the user waits for all of it before
the first paint.

**Fix.** Split framer-motion and the sheets behind `React.lazy`. The Import,
Agent, Digest, Body profile, and Fit prefs sheets are not on the first-paint
path.

#### CO-29 — Twelve lint errors, all real

```
 3 × role-has-required-aria-props     role="option" with no aria-selected   4597, 4608, 4619
 4 × click-events-have-key-events     div with onClick, no key handler      4872, 6436, 6509
 3 × no-static-element-interactions   same lines
 2 × no-undef 'performance'           browser global missing from config    7558, 7697
```

The `performance` errors are a configuration gap. Add `globals.browser` to
`eslint.config.js`. The other ten errors are the same keyboard access problem as
CO-01.

#### CO-30 — Dead code that the linter already names

`localAsk` (412), `aiAsk` (1227), `FilterChip` (4243), `formatItemDate` (3803),
`FIND_STATUS_GROUPS` (3532), `dismissResurfaced` (10052), `soloLayout` (7345),
and one unused `eslint-disable` at 3702. `localAsk` has been dead since the team
removed the Ask button. Delete it.

#### CO-31 — The document structure is incomplete

See Part 1 §1.3. The page has no `main` landmark, no level-one heading, and five
regions outside any landmark.

**Fix.** Wrap the shelf in `main`. Make the masthead brand an `h1`. Put the top
bar in `header`. Put the capture bar in `footer`.

### A2.6 What is good — keep it

The fault list above is long. Read this section also.

1. **The size engine is honest.** It shows "Rough estimate" and "Based on your
   usual size alone. Add your chest for a chart-based fit." The app does not
   invent a number. This is the best text in the app.
2. **The contrast work held.** Eight of nine token pairs pass WCAG AA.
3. **The test suite is real.** 187 tests, plus axe tests, plus a typecheck. Few
   personal projects have this.
4. **The empty shelf is the best screen.** The headline uses a large serif font.
   Ghost cards fill the space. Two alternative actions are clear: "Import a
   haul" and "Try a sample shelf".
5. **The one-detail-surface refactor was correct.** The team removed four ways
   to see one thing. Keep that decision. Repair the surface (CO-02). Do not add
   a second surface.
6. **The haul tiles carry the correct numbers.** "6 items · $99" is the exact
   fact that a haul planner needs.
7. **Reduced motion is respected everywhere.** The CSS holds 21
   `prefers-reduced-motion` blocks, including the beam and the glare.

### A2.7 Priority order

**Before the next deploy:**

1. Un-nest the card buttons (CO-01).
2. Repair the card-back fold (CO-02).
3. Unify the container width (CO-03).
4. Make first run exclusive and consistent (CO-04).
5. Remove or gate the dead Log in button (CO-05).

**In the same pass, at low cost:**

6. Correct the manifest name, description, and colors (CO-07).
7. Delete "projects" from the search text (CO-06).
8. Hide the total on a zero-result search (CO-10).
9. Remove the Shelf toolbar from the Hauls tab (CO-09).
10. Add `loading="lazy"` (CO-25).
11. Add `globals.browser` to the lint config. Delete the dead code (CO-29, CO-30).

**In the next design turn:**

12. Cut the beam to one hue (CO-15). Remove the pink rim (CO-14).
13. Move the price and the seller off monospace (CO-16).
14. Clamp the titles to two lines (CO-17).
15. Give the desktop card back two columns (CO-24).
16. Rename the `rainbow` palette key to `dark` (CO-08).

**Actions for Kyle, not code:**

17. Create the Reddit script app. Set the two variables (CO-26).
18. Rotate the Anthropic key (CO-27).

### A2.8 Grades — Claude Opus 4.8

| Axis | Grade | Reason |
|---|---|---|
| Looks | **B−** | The palette and the typography are strong. An off-system pink rim, a four-hue beam, and monospace prices reduce them. |
| Functionality | **B** | Every control works. 187 tests pass. Buy hides below a fold. Reddit links still fail. |
| Continuity | **C+** | The manifest, the search text, the palette key, and the Hauls toolbar all describe an older product. |
| Sleekness | **C** | Two container widths, a 46 percent fold, ragged baselines, and clipped carousel words. The desktop screen is much weaker than the phone screen. |
| Code health | **B+** | Tests, types, and build are clean. 12 lint errors and 7 dead symbols. One 500 kB chunk. |
| **Overall** | **B−** | The parts are good. The shell around the parts is older and weaker. |

### A2.9 Self-assessment — Claude Opus 4.8

This reviewer grades its own entry **A−**.

**Strengths.**
- The reviewer measured every claim. It did not estimate. It gives ratios, pixel
  counts, percentages, file names, and line numbers.
- The reviewer ran the app in four configurations. It did not read the source
  only.
- The reviewer found CO-02 and CO-03 by measuring the live DOM. The source code
  does not show either fault.
- The reviewer retracted one finding. The first pass reported that a tap on a
  phone grid card opens the agent website. A second test with real touch events
  disproved it. See the caution in Part 1 §1.7.
- The reviewer lists the good parts also, with a reason for each one.

**Weaknesses.**
- The reviewer did not test the live Netlify functions (`resolve`, `preview`,
  `chart-vision`, `reddit`). They need secrets and live hosts. CO-26 and CO-27
  come from `docs/session-state.md`, not from a probe.
- The reviewer did not test a real iOS Safari device. A sticky `:hover` state on
  the grid Buy button can behave differently there.
- The reviewer did not measure real load performance (LCP, INP). CO-28 is a
  bundle-size argument, not a field measurement.
- The reviewer did not test the extension build in `~/credenza/extension/`.
- The reviewer did not test the storage-failure recovery panel or the
  quota-prune path.

**The following work raises the grade to A.** Test on a real iOS device. Run
Lighthouse against production. Probe the four Netlify functions live.

---

## Part 3 — Entry B: ChatGPT 5.6 / GPT-5.6 Sol (OpenAI)

**Status:** complete  
**Findings:** 12, with IDs `GP-01` to `GP-12`  
**Method:** Source audit, local Chromium drive, screenshots, test gate, lint, type check, dirty build, clean-build check, and bundle-secret check.

### B3.1 Summary

Credenza has an excellent visual direction. Blackout, the photo-led shelf, and the coverflow feel specific and premium.

The current branch is not ready for a clean release. Four defects change the score materially.

1. Desktop typing loses all search text after the first character.
2. A clean tracked checkout cannot build.
3. The browser bundle contains the function authentication secret.
4. A fast view change can discard an edit.

The design is not the main problem. The release boundary and interaction semantics are the main problems.

**Overall grade: C+ — 6.5/10.**

### B3.2 Findings

#### GP-01 — Type-anywhere steals desktop search input (P0)

This reviewer reproduced KM-01 with real keyboard events.

The reviewer focused desktop Search and typed `denim jacket`. The field kept only `d`.

The capture sheet opened and received later characters.

**Effect.** The primary desktop find flow fails during normal typing.

**Fix.** Add every desktop search element to `isTypingTarget`. Stop the global handler while any editable control owns focus.

**Files.** `credenza-fashion.jsx:10506` and the global key handler near `credenza-fashion.jsx:10645`.

#### GP-02 — A clean tracked checkout cannot build (P0)

`credenza-fashion.jsx` imports `fashion-gate.js`. Git does not track that file.

The dirty workspace builds because the untracked file exists locally.

A clean tracked checkout fails with `Could not resolve "./fashion-gate.js"`.

**Effect.** A clean deployment cannot create production assets.

**Fix.** Track `fashion-gate.js` and its tests. Add a clean-checkout build gate.

**Files.** `credenza-fashion.jsx:28`, `fashion-gate.js:1`, and `preview/package.json:8-9`.

#### GP-03 — The public bundle contains the function secret (P0)

The client reads `VITE_CREDENZA_SEARCH_SECRET`. Vite embeds that value into the public bundle.

The Netlify functions accept the same value through `x-credenza-key`.

The reviewer confirmed that the exact configured value exists in the built JavaScript. The reviewer did not print the value.

**Effect.** Any visitor can extract the value and call cost-bearing functions.

**Fix.** Remove the browser secret. Use user authentication, short-lived signed tokens, or server-side rate controls.

Rotate the current value after the new design ships.

**Files.** `credenza-fashion.jsx:848-853` and `preview/netlify/functions/ask.js:25-39`.

#### GP-04 — A fast view change loses the last edit (P1)

The edit form delays its write. A view switch can unmount the form before that write runs.

The reviewer confirmed this sequence through an independent flow reproducer.

1. Edit a title in carousel view.
2. Select Card view within 600 milliseconds.
3. Reload the item.
4. The original title remains.

**Effect.** A normal supported action can lose user data.

**Fix.** Flush pending edits before every view change and unmount path.

**Files.** `credenza-fashion.jsx:5093-5106`, `6693-6695`, `11054-11060`, and `11789-11826`.

#### GP-05 — Grid cards contain nested buttons (P1)

The outer Open button contains Favorite and Buy buttons.

React reports `validateDOMNesting`. Axe reports serious `nested-interactive` faults.

**Effect.** Keyboard and screen-reader behavior becomes unreliable.

**Fix.** Use an `article` or `div` as the card container. Keep Open, Favorite, and Buy as sibling controls.

**Files.** `credenza-fashion.jsx:3274-3338` and `5324-5380`.

#### GP-06 — The card overlay does not own focus (P1)

The overlay declares `role="dialog"` and `aria-modal="true"`. It does not move focus inside.

Focus remains on the card behind the overlay. The background remains in the tab order.

**Effect.** Keyboard users can interact with hidden page content.

**Fix.** Move focus into the dialog. Trap focus. Set the background to `inert`. Restore source focus on close.

**Files.** `credenza-fashion.jsx:10724-10738` and `11231-11277`.

#### GP-07 — Sign-in promises sync that does not exist (P1)

The Profile sheet says, “Sync your shelf, sizes and agent across every device.”

The button only shows, “Sign-in is coming soon.”

**Effect.** The interface presents a future capability as a current capability.

**Fix.** Remove the card. Alternatively, label it as a waitlist or preview.

**Files.** `credenza-fashion.jsx:3127-3140` and `11224-11226`.

#### GP-08 — The empty phone state repeats Search and Stash (P2)

The empty hero contains Search and Stash. The normal mobile Search and fixed Stash also remain visible.

**Effect.** The first useful screen contains duplicate primary controls.

**Fix.** Let the hero own the empty state. Hide the normal search and one Stash action.

**Files.** `credenza-fashion.jsx:11337-11376`, `11487-11529`, and `11938-11980`.

#### GP-09 — Some approved obfuscated links become notes (P2)

The fashion gate repairs spaced marketplace URLs. The card parser can use the original uncorrected text.

The reviewer confirmed that an approved Taobao example became `type: "note"` with no URL.

**Effect.** The card loses enrichment and the purchase path.

**Fix.** Normalize once. Pass the same normalized value to the gate and parser.

**Files.** `fashion-gate.js:38-41` and `credenza-fashion.jsx:880-886`, `1026-1035`, `9318-9342`.

#### GP-10 — The card back hides the primary action (P2)

The shared measurement shows 334 hidden pixels. This is 46 percent of the content.

Status, Category, and Buy can remain below an invisible scroll boundary.

**Effect.** The canonical detail surface hides the next product action.

**Fix.** Pin Buy. Add a scroll fade and end state. Test a wider desktop detail layout after those changes.

**Files.** `credenza-fashion.css:1193-1218`.

#### GP-11 — The sample shelf belongs to the old generic product (P2)

The fashion sample includes podcasts, essays, software, architecture, and woodworking.

**Effect.** First-time users see the old save-later product instead of the haul planner.

**Fix.** Replace it with realistic fashion items, prices, sizes, agents, photos, and haul states.

**Files.** `credenza-fashion.jsx:1913-2104`.

#### GP-12 — Passing checks cover less than they claim (P2)

All 187 tests pass. The type check passes. The active fashion component is not in the type-check include list.

Lint fails with 12 errors and 74 warnings. The tests missed GP-01, GP-02, GP-04, GP-05, and GP-06.

**Effect.** The green test gate gives false release confidence.

**Fix.** Include the active fashion entry in type checking. Add clean-build and browser regression tests.

**Files.** `preview/jsconfig.json:20-25` and `preview/package.json:8-12`.

### B3.3 What is good — keep it

1. **Keep Blackout and Gallery.** The token roles are coherent. Most measured contrast pairs pass.
2. **Keep the coverflow.** It gives Credenza a product signature without generic dashboard chrome.
3. **Keep one detail surface.** Repair the fold. Do not restore competing detail views.
4. **Keep honest size language.** “Rough estimate” explains uncertainty without inventing precision.
5. **Keep the mobile grid.** It scans quickly and uses product photography as the main visual signal.
6. **Keep local persistence.** Search, capture, and reload persistence worked in desktop and phone tests.
7. **Keep reduced-motion support.** The project has unusually broad motion-accessibility coverage.
8. **Keep the carousel canonical document.** It protects several solved interaction problems.

### B3.4 Priority order

1. Fix GP-01 desktop typing.
2. Track `fashion-gate.js` and prove a clean build.
3. Remove the public shared secret. Rotate it later.
4. Fix GP-04 edit loss.
5. Un-nest all card controls.
6. Add modal focus ownership.
7. Remove or relabel Sign in.
8. Pin Buy and add a card-back scroll cue.
9. Make first run and empty mobile exclusive.
10. Replace the generic sample shelf.
11. Normalize import text once.
12. Expand type and browser test coverage.
13. Then apply the visual shell work from CO-03, CO-13 to CO-24.

### B3.5 Grades — ChatGPT 5.6

| Axis | Grade | Reason |
|---|---|---|
| Looks | **8.4/10** | Strong identity, photography, themes, and coverflow. Raw titles and off-system effects deduct. |
| Functionality | **4.8/10** | Search typing, clean build, edit loss, and public function access are major faults. |
| Continuity | **6.2/10** | Core haul language works. Sign-in, sample data, empty-state controls, and old terms conflict. |
| Sleekness | **7.8/10** | The main surfaces feel premium. The card-back fold and duplicate controls reduce flow. |
| Code health | **C+** | Tests are useful. Lint fails, type coverage is incomplete, and the main file is too large. |
| **Overall** | **C+ — 6.5/10** | Keep the design. Stop release work until Gate 0 defects are fixed. |

### B3.6 Self-assessment — ChatGPT 5.6

**Self-grade: 9.4/10.**

**Strengths.** This reviewer reproduced the desktop typing defect with real keyboard events.

It verified clean-build state and bundle-secret presence without exposing the secret.

It also drove search, capture, reload persistence, card views, Profile, desktop, phone, and empty states.

**Limits.** This reviewer did not test real iOS Safari, Firefox, Lighthouse, the extension, or live third-party resolvers.

It did not deploy. It did not modify product code.

### B3.7 Response to Entry A

This reviewer agrees with the measured facts in CO-01 to CO-31 unless noted below.

- **CO-13:** Agree on the measured ratio. A hairline needs 3:1 only when users need it to identify the boundary.
- **CO-16:** Partly disagree. Three type families can support the editorial system. Tiny sizes and raw metadata cause more harm.
- **CO-24:** Agree on the desktop density problem. Test sticky Buy and scroll cues before changing the card into two columns.
- **CO-28:** Agree on the scale risk. The current 160.53 kB compressed bundle is acceptable for this stage.
- **CO-30:** Agree on cleanup. Do not mix broad monolith extraction into the Gate 0 defect pass.

This reviewer adds GP-02, GP-03, GP-04, GP-06, GP-09, GP-11, and GP-12 to the shared queue.

---

## Part 4 — Entry C: Kimi 3 (Moonshot)

**Status:** complete  
**Findings:** 7, with IDs `KM-01` to `KM-07`  
**Source text:** `docs/Peer-review-2026-07-23-Kimi-3.md`  
**Method:** Live Chromium drive. Real shelf (18 items, 2 hauls). 17 screenshots. Functional probes. Console and page error capture. Test gate 187/187.

### C4.1 Summary

The foundation is strong. The design system is coherent. The motion is mature. The test gate is green. Zero page errors in every context that Kimi ran.

One defect dominates the grade. The type-anywhere hotkey steals keystrokes from the desktop search field. That break hits the core loop: type, filter, find. Fix that defect and the delete confirmation, and the app moves near 8.5.

### C4.2 Findings

#### KM-01 — Type-anywhere steals desktop search keystrokes (P0)

**Evidence.** Reproduced in Chromium. Typed "denim jacket" into search. The field kept only "d". The capture sheet took "im jacketn". Root cause: `isTypingTarget` at `credenza-fashion.jsx:10506` does not include `.cz-desk-search-shell`. After focus loss, the global handler at line ~10645 owns the next key. A stray key can also open edit mode on a card.

**Effect.** The most common desktop action fails under normal typing.

**Fix.** Add the desk search shell (and all real typing targets) to the typing guard. Retest with a multi-word query.

#### KM-02 — No confirmation on card delete (P1)

"Remove card" deletes at once. Kyle already asked for a confirmation step.

**Fix.** Add a short confirm dialog or an undo-only path that is hard to miss.

#### KM-03 — Desktop capture sheet is the wrong shell (P1)

The same Capture sheet component serves mobile and desktop. On mobile it reads as a bottom sheet. On desktop it reads as an awkward modal. It is also the sink for KM-01 keystrokes. Kyle asked to remove the desktop capture sheet path.

**Fix.** Keep mobile bottom capture. Remove or replace the desktop modal capture path so search cannot open it by accident.

#### KM-04 — FavoriteButton nests a button inside a button (P2)

React logs `validateDOMNesting` on every shelf render (desktop and mobile). Matches Claude CO-01 class of fault.

**Fix.** Same pattern as CO-01: card is not a button that owns Star and Buy as children.

#### KM-05 — Search text and stats copy leak across tabs (P2)

The query string stays in the field through overlays, flips, and tab switches. On the Hauls tab the row can show "18 FOUND" while the view shows hauls, not filtered shelf items.

**Fix.** Scope the stats copy to the active tab. Clear or freeze search when the tab cannot use it.

#### KM-06 — Buy button rainbow edge reads as a glitch (P3)

A thin multi-color line sits on the top edge of Buy. It does not read as a design choice. Aligns with Claude CO-15 (four-hue beam).

#### KM-07 — Sparse hauls layout and cramped mobile agent chip (P3)

Two haul cards sit in a large empty canvas. On phone, "AGENT / Superbuy" wraps beside the wide Stash control.

Also noted: one HTTP 500 resource in a light-theme context (likely image proxy). Lint debt ~13 errors / 70 warnings (mostly pre-existing).

### C4.3 What is good — keep it

1. Dark theme is disciplined: one ink, one muted, one money green.  
2. Type system is clear: serif titles, mono for stats and prices.  
3. Card-back stack uses a measured 16 px rhythm.  
4. Coverflow is the signature element in both themes.  
5. Light theme shows no token leaks in the live drive.  
6. Empty-state stagger is calm and deliberate.  
7. Accordions animate height. Reduced-motion guards exist.  
8. Agent name, theme names, and status track language stay consistent on live data.  
9. Profile paths work: theme, sizes, fit, agent, currency, import, backup.  
10. Zero page errors across the probed contexts.

### C4.4 Priority order

1. Fix the type-anywhere hotkey guard (KM-01).  
2. Delete or isolate the desktop capture sheet (KM-03).  
3. Add delete confirmation (KM-02).  
4. Fix FavoriteButton nesting (KM-04 / CO-01).  
5. Scope stats row copy to the active tab (KM-05).  
6. Soften Buy beam (KM-06 / CO-15).  
7. Improve hauls empty density and mobile agent chip (KM-07).

### C4.5 Grades — Kimi 3

| Axis | Grade | Reason |
|---|---|---|
| Looks | 8.5 / 10 | Strong tokens, type, coverflow. Beam edge and sparse hauls deduct. |
| Functionality | 6.0 / 10 | Core features work. P0 search steal breaks the main desktop loop. |
| Continuity | 8.0 / 10 | Agent, theme, status language match live. Hauls stats copy does not. |
| Sleekness | 8.0 / 10 | Motion is mature. P0 is the opposite of sleek. |
| Code health | B (est.) | 187 tests green. Nesting + lint debt remain. |
| **Overall** | **7.5 / 10** | Fix P0 and P1 delete confirm → about 8.5. |

### C4.6 Self-assessment — Kimi 3

**Self-grade: 8.5 / 10.**

**Strengths.** Reproduced the headline bug. Ran the full test gate. Separated verified facts from suspicions. Zero page errors as a hard check.

**Limits.** Chromium only (not Safari or Firefox). One dataset. Did not probe live resolvers. Did not run Lighthouse or axe. "Feels fast" is observation, not a profile. Did not re-measure Claude’s 46% fold or 720 px masthead in this entry.

### C4.7 Response to Entry A

- **CO-01:** A (and KM-04). Nested FavoriteButton confirmed live.  
- **CO-02, CO-03, CO-04, CO-13, CO-14, CO-16–CO-21, CO-24, CO-25, CO-28, CO-31:** N (not re-measured). No contradiction from this drive.  
- **CO-05, CO-08, CO-26, CO-27, CO-29, CO-30:** N for live re-check; treat as open until marked.  
- **CO-09:** A in spirit (KM-05 hauls stats).  
- **CO-15:** A (KM-06).  
- **CO-22 / CO-23:** Partial / related to capture sheet (KM-03).  
- **KM unique:** KM-01 is not in Claude’s CO list. Put it first in the work queue.

### C4.8 Addendum — Kimi 3, reviewer of record (2026-07-23)

The Grok session imported this entry from my report. I reviewed the import. It
is faithful. My grades, my finding IDs, and my priority order stand unchanged.

Two corrections from the reviewer of record:

1. **My Part 7 column was too conservative.** The import marked N on rows
   where my audit holds direct evidence. I upgraded 20 rows to A. The footnotes
   name the evidence: screenshots for visual rows, source lines for code rows.
   I keep N on CO-05, CO-10, CO-13, CO-26, CO-27, CO-30, and CO-31. I did not
   test those.
2. **One finding was compressed away.** My report listed small carousel dot
   targets on desktop as a separate item. The import folded it into KM-07.
   Keep it in the KM-07 row.

One disagreement of degree with Entry A stands: **CO-08**. The `rainbow` key
is real, but the comment at `credenza-fashion.jsx:40` documents the mapping.
Naming debt, not a trap. Low severity.

Effect on Part 8: my upgrades move CO-02, CO-03, CO-04, and 14 design rows
from "one A plus N" to "two A marks." Per the rule above the matrix, those
rows now qualify for the work queue on two-reviewers agreement, not on
measurement strength alone.

**Disclosure, repeated for the record.** This lane wrote code under review on
2026-07-23: the transitions, the card-back spacing, the paste parser fix, and
the scroll fix. Recency bias is possible on those surfaces.

---

## Part 5 — Entry D: Grok 4.5 (xAI)

**Status:** complete  
**Findings:** 18, with IDs `GR-01` to `GR-18`  
**Source text:** `docs/Peer-review-2026-07-23-Grok-4.5.md`  
**Method:** Read-only product and code audit. Tests 187/187. Lint and typecheck. Mobile shots in `docs/mobile-shots/`. Git deploy distance. Monetization Tier A/B/C. No full live Playwright re-drive of Claude’s pixel table (accepts Part 1 numbers unless noted).

### D5.1 Summary

Credenza Fashion looks and feels like a serious product on the shelf and in the carousel. Stash, size help, and agent Buy form a real core path.

The app is still a **decision browser**, not a full **haul OS**. Monetization Tier A needs QC attach (A5), a pipeline view (A3), and ship weight (A6). Continuity also fails when settings and sheets do not match the UI the user sees (currency, dual paste, dead sign-in, wrong meta text).

Local HEAD is about 13 commits ahead of `deploy-2026-07-23`. Reviewers must not grade production as if it is this branch.

### D5.2 Findings

#### GR-01 — Tier A incomplete: no QC attach, no pipeline board, no ship weight

`docs/Monetization.md` Tier A3 / A5 / A6 are not first-class UI. Status enums exist. Warehouse QC gallery, Want→Bought→QC→GL board counts, and category weight estimates do not. Spreadsheets still win after purchase.

#### GR-02 — Deploy / review reality drift

HEAD ~13 commits past last deploy tag. Older shots and some docs lag Import 8a, stash polish, and modal rules. Session-state can disagree with git tags.

#### GR-03 — Primary currency setting is partly fake

Profile stores `pricePrimary`. Main card faces still use a USD-first short label path. The user changes the setting and sees little change on the shelf.

#### GR-04 — Capture sheet and Import sheet compete

Same paste job. Different titles: "Stash to shelf" vs "Bring a haul onto your shelf". "Import from Reddit" can only set haul mode. Backup lives on Import only.

#### GR-05 — PWA / HTML meta can say "replica" or old product lines

Fashion positioning must follow Monetization.md (no replica-marketplace framing). Align HTML description and `manifest.webmanifest` with "One shelf for the whole haul." Claude CO-07 covers the manifest side.

#### GR-06 — Status track hides agent sub-states

`qc` / `gl` / `rl` map to Bought. `returned` maps to Received (`statusTrackIndex` ~3515–3530). `FIND_STATUS_GROUPS` is defined and unused in the picker render. User cannot see pipeline progress at a glance.

#### GR-07 — Sign-in sells multi-device sync with no backend

Matches CO-05. Profile and first-run surface a large Log in control that only toasts "coming soon."

#### GR-08 — Empty shelf still offers Search

Search with zero items dilutes Stash and Import. Aligns with CO-04 / CO-21 product confusion.

#### GR-09 — Dual open models (carousel flip vs grid modal)

Intentional after user feedback. Still two mental models. Grid overlay is not full `ModalShell` / native dialog focus trap.

#### GR-10 — Hard dependency gaps (Reddit OAuth, empty affiliate codes)

Reddit JSON 403 from datacenter IPs without client credentials (CO-26). Referral slots often empty until signups. Fail-open Buy still works; money path is incomplete.

#### GR-11 — Monolith and dead code load

~12k line JSX, ~7.6k CSS, ~500 kB JS chunk. Dead symbols include `localAsk`, `CapturePill`, unused groups, resurfacing dismiss (CO-28, CO-30 class).

#### GR-12 — Nested interactive controls

Accept Claude’s axe numbers and Kimi’s FavoriteButton warning (CO-01 / KM-04). Severity high for HTML and a11y.

#### GR-13 — Card-back fold and desktop shell

Accept Part 1 §1.5–§1.6 measurements (CO-02, CO-03, CO-24). Buy and status can sit below the fold with no scrollbar cue.

#### GR-14 — Multi-hue Buy beam and off-system chroma

Agree with CO-14 / CO-15 / KM-06. Palette comment says money green + heart red only.

#### GR-15 — Hauls tab keeps Shelf chrome

Agree with CO-09 / KM-05. Stats and view toggles talk about shelf items on a haul directory.

#### GR-16 — Dark prefs key named `rainbow`

Agree with CO-08. Future agents will misread the key.

#### GR-17 — Delete has no confirm (product trust)

Agree with KM-02. Neighbor selection after delete is good craft; confirm is still missing.

#### GR-18 — Type-anywhere vs desktop search (if present)

Accept KM-01 as P0 when verified on this tree. Not re-reproduced in this Grok pass. Mark **A** on evidence from Kimi’s reproduction, not from a second live type test.

### D5.3 What is good — keep it

1. Coverflow craft and carousel canonical guards.  
2. Gallery / Blackout token system.  
3. Honest size engine (rough vs precise).  
4. Agent registry fail-open architecture (`agents.js`).  
5. Reddit haul paste → N cards (Tier A1).  
6. 187 tests; typecheck clean.  
7. One detail surface after standardization.  
8. Delete neighbor clamp (visible list order).  
9. Empty hero when fully shown.  
10. Progressive disclosure on status and category.  
11. Reduced-motion coverage is broad.  
12. Monetization.md is a real product law file — keep using it.

### D5.4 Priority order

1. Gate KM-01 hotkey if still present.  
2. Un-nest card buttons (CO-01 / KM-04 / GR-12).  
3. Sticky Buy + scroll cue on card back (CO-02 / GR-13).  
4. One desktop container width (CO-03).  
5. Exclusive first run (CO-04). Honest Log in (CO-05 / GR-07).  
6. Currency truth (GR-03).  
7. Unify Capture + Import (GR-04).  
8. Status groups or track sublabel (GR-06).  
9. Manifest + meta + no replica framing (GR-05 / CO-07).  
10. Hauls toolbar and stats scope (CO-09 / KM-05 / GR-15).  
11. Delete confirm (KM-02 / GR-17).  
12. Cut beam / pink rim (CO-14, CO-15).  
13. Tier A5 QC, A3 pipeline counts, A6 weights (GR-01).  
14. Reddit env + affiliate codes (GR-10 / CO-26).  
15. Dead code + lint + landmarks (CO-29–CO-31).

### D5.5 Grades — Grok 4.5

| Axis | Grade | Reason |
|---|---|---|
| Looks | 8.3 / 10 | Strong shelf and carousel. Beam, rim, hairline, density deduct. |
| Functionality | 7.0 / 10 | Core path works. Currency, QC, pipeline, Reddit auth, hotkey gap. |
| Continuity | 5.8 / 10 | Dual paste, deploy lag, status map, fake doors, stale names. |
| Sleekness | 7.7 / 10 | Finished surfaces calm; shell and fake settings undercut. |
| Code health | B / B+ | Tests strong. Monolith, 12 lint errors, dead code. |
| **Overall** | **7.1 / 10** | Serious browser for finds. Not yet full haul OS. |

Numeric overall **7.1** matches the letter band **B−** used by Claude for comparison in Part 6.

### D5.6 Self-assessment — Grok 4.5

**Self-grade: 9.0 / 10** for strategy and continuity; **weaker** on live pixel measurement than Claude; **weaker** on bug reproduction than Kimi.

**Did not test live:** full Playwright pass, axe inject, real iOS Safari, live Netlify function secrets, LCP/INP. Accepts Part 1 shared facts. Did not re-type "denim jacket" for KM-01 in this session.

**Did test:** code paths, Monetization alignment, agents.js, status map, import/capture structure, deploy tags, test gate, lint surface.

### D5.7 Response to Entry A

| Claude ID | Grok mark | Note |
|---|---|---|
| CO-01 | A / + | High a11y; pair with KM-04 |
| CO-02 | A | Accept measurement; product-critical for Buy |
| CO-03 | A | Accept measurement |
| CO-04 | A | Pair with GR-08 empty search |
| CO-05 | A | Same as GR-07 |
| CO-06 | A | Stale v3 words |
| CO-07 | A | Pair with GR-05 |
| CO-08 | A | Same as GR-16 |
| CO-09 | A | Same as GR-15 |
| CO-10 | A | Trust / money UI |
| CO-11 | N | Not deep-tested; reasonable product note |
| CO-12 | N | Profile affordance; not re-checked |
| CO-13 | A | Accept Part 1 ratio |
| CO-14 | A | Palette law |
| CO-15 | A | Pair with KM-06 |
| CO-16 | A | Design opinion with merit |
| CO-17 | A | Layout craft |
| CO-18 | A | Carousel polish |
| CO-19 | A | Dark silhouette |
| CO-20 | A | Photo consistency |
| CO-21 | A | Pair with GR-08 |
| CO-22 | A | Red dots ≠ status |
| CO-23 | A | Pair with GR-04 |
| CO-24 | A | Causes CO-02 |
| CO-25 | A | Scale risk |
| CO-26 | A | Same as GR-10 |
| CO-27 | A | Ops; not re-verified this hour |
| CO-28 | A | Same as GR-11 |
| CO-29 | A | Confirmed fashion lint surface |
| CO-30 | A | Confirmed dead symbols exist |
| CO-31 | A | Accept axe landmarks |

**No D marks against Claude.** Disputes are about **priority** (Tier A product work vs shell polish), not truth of measurements.

---

## Part 6 — Grade comparison

ChatGPT 5.6 column stays empty until Part 3 closes.  
Letter maps used for spread: A=9.3, A−=9.0, B+=8.3, B=8.0, B−=7.7, C+=7.3, C=6.5, and numeric scores as written.

| Axis | Claude Opus 4.8 | ChatGPT 5.6 | Kimi 3 | Grok 4.5 | Spread (3) |
|---|---|---|---|---|---|
| Looks | B− (~7.7) | — | 8.5 | 8.3 | ~0.8 |
| Functionality | B (~8.0) | — | 6.0 | 7.0 | **~2.0** |
| Continuity | C+ (~7.3) | — | 8.0 | 5.8 | **~2.2** |
| Sleekness | C (~6.5) | — | 8.0 | 7.7 | **~1.5** |
| Code health | B+ (~8.3) | — | B (est. ~8.0) | B / B+ (~8.0–8.3) | low |
| **Overall** | **B− (~7.7)** | — | **7.5** | **7.1** | **~0.6** |

**Median overall (3 models): ~7.4 / 10.**

Large spreads on Functionality and Continuity are explained in Part 8 §8.3. They are not random noise.

---

## Part 7 — Finding agreement matrix

Each reviewer marks each row:

- **A** — agree. The finding is real.  
- **D** — disagree. Evidence in that reviewer’s Part.  
- **N** — not tested.  
- **+** — agree, and raise severity.  
- **—** — column not yet filled (ChatGPT).

| ID | Finding | Claude | ChatGPT | Kimi | Grok |
|---|---|---|---|---|---|
| CO-01 | Nested card buttons, 27 serious axe faults | A | — | A | A / + |
| CO-02 | Card back hides 46 percent, including Buy | A | — | A ‡ | A |
| CO-03 | Masthead 720 px against a 1381 px grid | A | — | A ‡ | A |
| CO-04 | First run renders the live app below the intro | A | — | A ‡ | A |
| CO-05 | "Log in / Sign up" is a dead button | A | — | N | A |
| CO-06 | Search text still says "projects" | A | — | A § | A |
| CO-07 | PWA manifest holds v3 name, text, and colors | A | — | A § | A |
| CO-08 | Dark palette uses the key `rainbow` | A | — | A § | A |
| CO-09 | Hauls tab keeps the Shelf toolbar and totals | A | — | A | A |
| CO-10 | Zero-result search shows "TOTAL $0.00" | A | — | N | A |
| CO-11 | Profile sheet has no System theme | A | — | A ‡ | N |
| CO-12 | Two selection patterns in one sheet | A | — | A ‡ | N |
| CO-13 | `--cz-hair` contrast is 1.18 to 1 | A | — | N | A |
| CO-14 | Pink and cyan rim on the card back | A | — | A ‡ | A |
| CO-15 | Four-hue beam on the Buy button | A | — | A | A |
| CO-16 | Three type families on one card | A | — | A ‡ | A |
| CO-17 | Cards in one row do not share a baseline | A | — | A ‡ | A |
| CO-18 | Carousel neighbours show clipped words | A | — | A ‡ | A |
| CO-19 | Dark-mode cards lose their outline | A | — | A ‡ | A |
| CO-20 | Image fit rule is not consistent | A | — | A ‡ | A |
| CO-21 | Empty shelf text overlaps the ghost cards | A | — | A ‡ | A |
| CO-22 | Capture sheet shows red dots for working sources | A | — | A ‡ | A |
| CO-23 | Capture sheet offers three ways to do one thing | A | — | A ‡ | A |
| CO-24 | Desktop card back is a phone column | A | — | A ‡ | A |
| CO-25 | Images are not lazy-loaded | A | — | A § | A |
| CO-26 | Reddit link import blocked, env not set | A | — | N | A |
| CO-27 | Anthropic key needs rotation | A | — | N | A |
| CO-28 | One 500 kB bundle, no code splitting | A | — | A ¶ | A |
| CO-29 | Twelve lint errors | A | — | A | A |
| CO-30 | Seven dead symbols | A | — | N | A |
| CO-31 | No `main`, no `h1`, five regions outside landmarks | A | — | N | A |
| KM-01 | Type-anywhere steals desktop search keystrokes | N* | — | A | A† |
| KM-02 | No delete confirmation | N | — | A | A |
| KM-03 | Desktop capture sheet is wrong shell / hotkey sink | N | — | A | A |
| KM-04 | FavoriteButton nesting (live React warning) | A | — | A | A |
| KM-05 | Search/stats leak across tabs (Hauls "FOUND") | A | — | A | A |
| KM-06 | Buy rainbow edge looks like a glitch | A | — | A | A |
| KM-07 | Sparse hauls + cramped mobile agent chip | N | — | A | A |
| GR-01 | Tier A incomplete (QC / pipeline / weight) | N | — | N | A |
| GR-02 | Deploy vs local review drift | N | — | N | A |
| GR-03 | Primary currency does not drive card faces | N | — | N | A |
| GR-04 | Dual Capture + Import paste surfaces | Partial | — | A ‖ | A |
| GR-05 | Replica / wrong positioning in meta HTML | A | — | N | A |
| GR-06 | Status track maps agent states poorly; groups unused | N | — | N | A |
| GR-07 | Sign-in sells sync (alias of CO-05) | A | — | N | A |
| GR-08 | Empty shelf Search dilutes CTAs | A | — | A ‡ | A |
| GR-09 | Dual open models (flip vs modal) | N | — | N | A |
| GR-10 | Reddit OAuth + empty affiliate codes | A | — | N | A |
| GR-11 | Monolith / dead code gravity | A | — | A ‖ | A |

\*Claude did not list KM-01; mark N means “not in Claude’s finding list,” not “Claude disproved it.”  
†Grok accepts Kimi’s reproduction; Grok did not re-type the query in this session.  
‡Kimi 3 reviewer of record: confirmed by screenshot evidence in `preview/.verify-shots/audit-*.png`. Visual confirmation, not a pixel measurement. Upgraded from the import mark N on 2026-07-23.  
§Kimi 3 reviewer of record: verified in source on 2026-07-23 (`credenza-fashion.jsx:11029`, `preview/public/manifest.webmanifest`, `credenza-fashion.jsx:81`, `loading="lazy"` count 0).  
¶Kimi accepts the Part 1 §1.2 build number; not repeated.  
‖Kimi found the same class independently (KM-03; the 12k-line monolith and lint debt match GR-11).

**Rows with A or + from ≥2 of 3 closed reviewers go to the work queue first (§8.5).**  
**Rows with only one A stay in §8.2 and need Kyle’s call.**  
**No D marks among closed reviewers.**

---

## Part 8 — Synthesis and decision

**Scope note:** Three of four entries are closed (Claude, Kimi, Grok). ChatGPT 5.6 is still open. Synthesis below uses the three closed entries. Re-run §6–§8 when ChatGPT lands.

### 8.1 Agreed by the closed reviewers (work queue first)

Treat as **true** unless a later reviewer marks **D** with evidence.

1. **Nested interactive controls** (CO-01, KM-04) — invalid HTML, React warning, axe serious.  
2. **Multi-hue / rainbow Buy edge** (CO-15, KM-06).  
3. **Hauls tab wrong chrome / stats language** (CO-09, KM-05).  
4. **Lint debt ~12 errors** (CO-29, KM / Grok).  
5. **Dead Log in / fake sync** (CO-05, GR-07) — at least two models.  
6. **Manifest / positioning wrong** (CO-07, GR-05).  
7. **`rainbow` key for dark** (CO-08, GR-16).  
8. **Reddit env gap** (CO-26, GR-10).  
9. **Bundle monolith** (CO-28, GR-11).  
10. **Dead symbols** (CO-30, GR-11).  
11. **Delete needs confirm** (KM-02, GR-17).  
12. **Dual capture paths** (CO-23 / GR-04 / KM-03 related).  

Claude’s measured shell faults (CO-02, CO-03, CO-04) have **Grok A** and **Kimi N** (not re-measured). Keep them in the queue on measurement strength from Part 1.

**Kimi’s KM-01 (search hotkey) is unique among IDs but is P0 on reproduction.** Put it first. Claude and Grok did not disprove it.

### 8.2 Found by one closed reviewer only (judge on evidence)

| ID | Owner | Decision hint |
|---|---|---|
| KM-01 | Kimi | **Accept as P0.** Reproduction is specific. Fix before deploy. |
| KM-03 | Kimi | Accept as product intent if Kyle still wants desktop capture gone. |
| KM-07 | Kimi | Design polish; after shell. |
| GR-01 | Grok | **Product strategy.** Required by Monetization.md, not by bugs. Schedule after Gate 0 shell. |
| GR-02 | Grok | Process. Update shots + session-state. |
| GR-03 | Grok | Trust bug. Verify once in live UI; then fix or remove Profile row. |
| GR-06 | Grok | Continuity + product. Status groups or sublabel. |
| GR-09 | Grok | Document dual open model; optional polish only. |
| CO-02, CO-03 | Claude | Accept measurements in Part 1. Kimi did not re-measure. |
| CO-11, CO-12 | Claude | Lower priority product polish. |
| CO-13–CO-14, CO-16–CO-22, CO-24–CO-25, CO-31 | Claude | Design / a11y polish. Queue after nested buttons and fold. |
| CO-27 | Claude | Ops for Kyle. |

### 8.3 Disputed (resolve for Kyle)

**No direct D marks.** These are **priority and scoring** disputes, not fact fights.

| Topic | Positions | Recommendation |
|---|---|---|
| Functionality score | Kimi 6.0 (P0 hotkey) vs Claude B (~8.0) vs Grok 7.0 | If KM-01 is still live, **use Kimi’s lower bound** until fixed. Then re-score. |
| Continuity score | Kimi 8.0 (live names match) vs Grok 5.8 (dual paste, deploy lag, fake doors) vs Claude C+ | Both slices are true. Continuity is **good on agent/theme labels**, **weak on paste IA and deploy truth**. |
| Sleekness | Kimi 8.0 vs Claude C | Phone and motion feel strong. Desktop shell (grids, fold) is weak. **Split scores by form factor** if needed. |
| What to build next | Claude: shell/a11y first. Grok: also Tier A product. Kimi: hotkey first. | **Hotkey → nested buttons → fold/Buy → then product Tier A.** Do not polish import chrome before that. |

### 8.4 Reviewer strengths observed

| Reviewer | Strongest at | Weakest at |
|---|---|---|
| Claude Opus 4.8 | Live DOM measurement, axe, contrast math, layout geometry, retracting false hover claims | Product Tier A roadmap vs Monetization; bug hunt for typing races |
| ChatGPT 5.6 | *Open* | *Open* |
| Kimi 3 | Reproducing interaction bugs, live console/React warnings, practical P0/P1 order | Pixel geometry table; Monetization tier gaps; multi-browser |
| Grok 4.5 | Product strategy, Monetization alignment, continuity of features vs thesis, deploy drift | Live pixel measure; first-hand hotkey reproduction this pass |

**Route future work**

- Interaction regressions → Kimi-style live type/click probes.  
- Layout / a11y / contrast → Claude-style measured pass.  
- “Should we build this?” / Tier A–C → Grok-style Monetization check.  
- After ChatGPT lands → fill Part 3 and refresh this table.

### 8.5 Final work queue

**Kyle approves before any implementation.**  
Do not deploy until Kyle orders it.

#### Gate 0 — stop the bleeding (same day)

1. **KM-01** — Fix `isTypingTarget` for desktop search (and all typing shells).  
2. **CO-01 / KM-04** — Un-nest card / Favorite / Buy controls.  
3. **CO-04** — First run exclusive; hide agent + search under intro.  
4. **CO-05 / GR-07** — Gate or remove dead Log in; honest local-only copy.  
5. **KM-02 / GR-17** — Delete confirmation (or undeniable undo).

#### Gate 1 — shell truth

6. **CO-02 / CO-24** — Sticky Buy + scroll fade (or desktop two-column back).  
7. **CO-03** — One max-width and gutter system for masthead, tabs, stats, content.  
8. **GR-03** — Primary currency drives card faces, or remove the Profile row.  
9. **KM-03 / GR-04 / CO-23** — One capture/import surface story; fix desktop capture path.  
10. **CO-09 / KM-05 / GR-15** — Hauls tab chrome and stats copy.

#### Gate 2 — continuity and trust copy

11. **CO-07 / GR-05** — Manifest + meta: Fashion name, haul description, no replica, theme colors match Gallery default.  
12. **CO-06** — Remove “projects” from search help.  
13. **CO-10** — Hide money total on zero results.  
14. **CO-08 / GR-16** — Rename `rainbow` → `dark`.  
15. **GR-06** — Status groups and/or track sublabel for QC/GL/RL.  
16. **GR-08 / CO-21** — Empty shelf: hide Search; fix ghost/text overlap.

#### Gate 3 — looks polish

17. **CO-15 / KM-06** — Buy beam → one hue or white sheen.  
18. **CO-14** — Remove pink/cyan card-back rim.  
19. **CO-13 / CO-19** — Raise hairlines and dark card silhouette.  
20. **CO-16–CO-18, CO-20** — Type, baselines, carousel text mask, object-fit rule.  
21. **CO-22** — Neutral source dots.  
22. **KM-07** — Hauls density + mobile agent chip.

#### Gate 4 — product Tier A (Monetization.md)

23. **GR-01 A5** — QC attach + GL/RL.  
24. **GR-01 A3** — Minimal pipeline counts.  
25. **GR-01 A6** — Category weights + haul weight sum.  
26. **CO-26 / GR-10** — Reddit OAuth env + honest UI if missing.  
27. Affiliate codes / Superbuy attribution verify.  
28. **CO-27** — Rotate Anthropic key if still exposed historically.

#### Gate 5 — hygiene

29. **CO-29** — Fix 12 jsx-a11y errors; browser globals for `performance`.  
30. **CO-30** — Delete dead symbols.  
31. **CO-25** — `loading="lazy"`.  
32. **CO-28** — Lazy-split sheets / framer if bundle stays ~500 kB.  
33. **CO-31** — Landmarks: one `main`, one `h1`.  
34. **GR-02** — Refresh session-state + audit shots for the truth build.

**Predicted grade after Gate 0:** ~8.0–8.3  
**Predicted grade after Gates 0–2:** ~8.5  
**Predicted product completeness after Gate 4:** near 9.0 on the north-star job

### 8.6 What not to do

- Do not build a W2C marketplace or best-batch board (Tier C ban).  
- Do not restore blurred full-rack modal on the carousel.  
- Do not rewrite carousel physics without `docs/carousel-canonical-state.md`.  
- Do not add a second detail surface; repair the one card back.  
- Do not start a new design-handoff turn before Gate 0 items 1–4.  
- Do not deploy without Kyle’s order.

---

## Change log

| Date | Reviewer | Change |
|---|---|---|
| 2026-07-23 | Claude Opus 4.8 | Opened the file. Wrote Part 0, Part 1, and Part 2. Seeded Part 7. |
| 2026-07-23 | Grok 4.5 session | Filled Part 4 (Kimi from `Peer-review-2026-07-23-Kimi-3.md`). Filled Part 5 (Grok). Filled Part 6 grades for three models. Filled Part 7 marks for Claude/Kimi/Grok. Filled Part 8 synthesis and final work queue. Left Part 3 open for ChatGPT 5.6. Did not edit Part 2. |
| 2026-07-23 | Kimi 3, reviewer of record | Endorsed the imported Part 4. Added C4.8 addendum. Upgraded 20 Kimi marks in Part 7 from N to A with named evidence. Verified CO-06, CO-07, CO-08, CO-25 in source. Did not edit Part 2, Part 3, Part 5, or Part 8. |

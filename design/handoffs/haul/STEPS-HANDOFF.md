# Handoff: The haul page as five steps

**Status: this is the shipping direction.** Kyle approved it on 2026-08-03 from the mock in
`wireframes/Board as steps.html` (capture: `wireframes/board-as-steps.png`). It replaces the
four-column board as the haul working surface. Everything else in the flow — QC review, the
item drawer, hand-off, tracking, the index — carries over from `README.md` with the deltas
listed here.

**Supersedes `v2/`.** A parallel session produced a column-board mock at
`design/handoffs/haul/v2/` the same day, before Kyle chose steps. Its route, width,
header-removal, and volumetric decisions agree with this document; its column layout does
not. Where the two conflict, build this one. Do not build from `v2/`.

**Read `README.md` first.** It holds the vocabulary, the item state machine, the parcel
calculator, the generated messages, the design tokens, the copy rules, and the motion system.
This document does not repeat them. Where the two disagree, this document wins.

---

## Build status — audited against the repo on 2026-08-03

What exists today, what is still open. Checked against `credenza-fashion.jsx`,
`haul-fulfillment.js`, and `components/`. Update this section as items land.

### Already built (carry forward)

- The flow components exist: `HaulFlowBoard.jsx` (the column board), `HaulItemDrawer.jsx`,
  `HaulHandoff.jsx`, `HaulTracking.jsx`, `QcOverlay.jsx`. They came from the column-board
  prototype. The drawer, hand-off, and tracking surfaces carry over per the table below.
- The parcel calculator in `haul-fulfillment.js`: divisors, chargeable weight, the
  "paying for air" tip. Red-lit items are already excluded from the sums.
- The index CTA logic (`openHaulCta`, near line 8981): it opens the haul and jumps straight
  to the first unreviewed QC item. It works, but it is view state — see open item 1.
- `qcPhotos` with the HTTPS/data-URL gate and the 12-photo cap (`QC_PHOTOS_STORED`).
- `Button` variants primary / outline / subtle (added 2026-08-02).
- The parcel estimator is gone from `HaulBoard.jsx` (Kyle, 2026-08-02).
- **Item 1 — routes (landed 2026-08-03).** `/hauls`, `/hauls/<slug>` and `/parcels/<id>`
  are real URLs in `credenza-fashion.jsx`. Slugs are derived from the haul name
  (`haulSlugMap`, kebab-case, collision-suffixed). The one `popstate` listener peels
  overlays by open order (a stack — QC can sit over the drawer, so topmost closes first),
  then navigates. Boot effects restore a reload on any of the three URLs. Tab switches
  push addresses; a landed visit rewrites instead of leaving the app. `netlify.toml`
  rewrites all three prefixes to `/index.html`. Verified in a real browser: ten route
  checks plus the stacked drawer→QC peel, all green. Four source-shape tests updated to
  the new call shapes (`openHaulDrawer`, `openHandoff`); behaviour pinned is unchanged.
- **Item 2 — the steps page (landed 2026-08-03).** `components/HaulSteps.jsx` replaces
  `HaulFlowBoard.jsx` at the open-haul mount with the same props. Five collapsible
  sections beside the sticky 300px parcel rail (`components/HaulParcelRail.jsx`, the
  board's parcel panel restyled). Open by default: the steps that need the person
  (1, 3, 4-green). Collapsed by default: done steps and step 2. The 600ms hold before
  a completed step collapses is dropped under reduced motion. Step 1 caps at 8 rows,
  then a "Show all N" pill. The red row reads the reason sentence from
  `redReasonText`, never the raw key. The mount renders even on an empty haul — step 1
  carries the empty state, which is the only direction an empty haul has.
  `HaulFlowBoard.jsx` stays on disk as reference and keeps its own tests. Two
  source-shape tests re-pointed (`<HaulSteps` mount, archive-handler end marker).
  Verified in a real browser: 21 checks — five steps in order, current/done chips,
  collapse toggles, the 8-row cap, the loud QC pill, the red row, the sticky rail
  with maths and hand-off button, row click opens the drawer.
- **Item 3 — the 1400px exception (landed 2026-08-03).** The shell carries
  `cz-haul-wide` only while `openHaulName` is set; the rule
  (`.cz-app[data-fashion="true"] .cz-shell.cz-haul-wide`, credenza-fashion.css)
  lifts the cap to 1400px. The `.cz-shell` base rule is untouched, and the
  directory, shelf, and every other page stay at 1080px. The modifier needs the
  `data-fashion` specificity to outrank the CO-03 shell rule — a bare
  `.cz-shell.cz-haul-wide` loses and the cap stays 1080px (caught in the browser
  check). Verified in a real browser: shelf 1080px, directory 1080px, open haul
  1400px, cap restored on the way out.
- **Item 4 — legacy header removal (landed 2026-08-03).** The `cz-haul-stat`
  counts/weight/bulky block and the `HaulBoard` budget/parcel/archive strip are
  gone from the page, and with them the now-dead `haulPipeline` and
  `listTotalUsd` memos. New `components/HaulTitleMenu.jsx`: a ⋯ trigger on the
  title row (menu: Set a budget · Share · Archive). Share keeps its
  has-cards gate; the saved budget rides the menu row as quiet meta; the budget
  editor drops from the trigger reusing the old `cz-haul-board-*` field styles.
  The archive closure moved verbatim — close plus undo toast, unchanged.
  `HaulBoard.jsx` stays on disk as reference and keeps its own tests. Two
  app-level tests re-pointed (`canShare` gate, steps-stack as the haul-open
  signal). Verified in a real browser: 13 checks — the strip and counts are
  gone, the menu lists the three actions, a budget saves and reads back in the
  menu, Share opens the share surface, Archive closes the haul with the undo
  toast and Undo restores it. Note: vite dev hangs the surface swap when a
  visit LANDS on /hauls/<slug> (the exiting shelf surface never exits, dev
  only — production swaps correctly, checked live). Browser checks for this
  flow navigate in-app instead.
- **Item 5 — volumetric defaults (landed 2026-08-03).** `VOL_DEFAULTS` and
  `volumeFor(item)` live in `haul-fulfillment.js` beside the divisors.
  A stored `haulVolumeCm3` wins and reads as measured; otherwise the category
  default feeds the volumetric row with `estimated: true` — never zero
  (bag/other/uncategorised get the 2500 fallback). Hoodies classify as
  outerwear in the app's CATEGORIES, so the 5000 hoodie row fires on a title
  sniff inside outerwear; the no-box shoe row has no data source — the
  drawer's L×W×H field is how a de-boxed pair gets recorded. `toHaulItem`
  carries `vol` + `volEstimated`. The rail label reads
  `volumetric ÷ 6000 · est.` while any packed item is estimated. The drawer
  has three small L×W×H (cm) inputs that store the product; a half-typed size
  never overwrites a real one. Six pure tests beside the existing
  `haul-fulfillment` cases. Verified in a real browser: 7 checks — the
  volumetric row is alive on an estimated coat (1573 g, est. flag), the
  drawer says so, 40×30×20 stores 24,000 cm³ on the card, the rail maths
  picks up the measured size and keeps the flag for the still-estimated coat.
- **Item 6 — quiet top bar (landed 2026-08-03).** An open haul no longer renders
  the search field, the Shelf/Hauls/Inbox tab row, or the shelf-filter pills.
  The shelf-filter strips already carried `!openHaulName`; the same condition now
  gates the desktop search shell (the ＋ Stash button in the same bar stays),
  the legacy inline search row, the phone magnifier in the masthead, and the
  desktop `cz-view-tabs-row`. No new mechanism — the existing `openHaulName`
  conditionals were extended. The phone dock keeps its Shelf/Hauls buttons and
  the page keeps its "‹ All hauls" link, so the way out survives. The totals row
  stays and reads the haul ("N items | Haul $") — it carries count and money
  only, never weight, so the one weight story holds. Verified in a real
  browser: 17 checks — shelf and directory show the full bar; the open haul
  hides search, tabs, and pills, keeps the wordmark, Stash, and haul totals;
  Stash opens its sheet on the haul page; the bar returns on the way out.
- **Item 7 — `+ Parcel B` removed (landed 2026-08-03).** The `onAddParcel` prop
  and its button are gone from `HaulFlowBoard.jsx`. The new rail
  (`HaulParcelRail.jsx`) never had the control, and the app never passed the
  prop, so nothing user-facing changes — the live page already showed one box.
  Parcels stay an array in the data shape. The board's own test now pins the
  removal: no "+ Parcel B" renders even when a caller still passes the prop.
  The shared `cz-hb-foot` class stays — step ghost buttons and the board's
  column footer use it. Not deployed on its own: the file is not in the
  bundle, so there is nothing to ship.
- **Item 8 — QC full-viewport takeover (landed 2026-08-03).** The dialog now
  fills the viewport (`max-width`/`max-height: 100%`, no radius, no card edge);
  the 344px rail is unchanged, the photo pane takes the rest. Under 700px the
  rail folds under the photos. Photoless items get the dashed drop target with
  the handoff's copy — the em dash became its own sentence ("Paste or drop
  them here. Up to 12.") because Kyle banned em dashes in rendered copy
  (2026-08-02). Paste is bound at the window (a paste meant for a field stays
  with the field) and drop works anywhere on the stage; both feed a new
  `onAddPhotos(id, files)` prop that the app routes through `attachQcImage`,
  so the HTTPS/data-URL gate, the plan cap, and the compress stay in one
  place. Non-image files never reach the gate. Both verdict buttons and the
  G/R keys stay inert until a photo exists — the buttons sit at opacity .56,
  the house's disabled value. Entry paths: the steps page's "Review all QC"
  pill and the index CTA already open QC without a photo gate; the drawer's
  QC button still waits for photos (unchanged, not in this item's scope).
  Eight new tests in `qc-overlay.test.jsx` (drop target copy, disabled
  verdicts, .56 pin, paste, drop, field guard, app wiring, viewport CSS).
  Verified in a real browser: 15 checks — full-viewport dialog, 344px rail,
  dashed target and copy, disabled .56 verdicts, inert G, a dropped real PNG
  stored and shown, verdicts waking, G green-lighting, Escape closing.
- **Item 9 — QC deep link (landed 2026-08-03).** The index CTA now pushes the
  takeover onto a real address: `pushHaulOverlay` takes an optional URL and
  the CTA passes `/hauls/<slug>?qc=first`, so Escape and Back both reveal the
  plain haul address — the param cannot outlive the takeover. The boot effect
  resolves `?qc=first` to the first unreviewed warehouse item that HAS photos
  (a deep link never lands on the empty state; only the in-app paths do) and
  keeps the param in the address for resharing. Closing a takeover the visit
  landed on rewrites the address without the param (`closeQc` — same rule as
  closeHaul: a landed visit rewrites instead of walking back). One asymmetry,
  deliberate: the in-app CTA still picks the first pending item even when it
  is photoless, because item 8's drop target is the teach for that case.
  Three app-wiring tests. Verified in a real browser: 13 checks — CTA opens
  the takeover on the deep-link address at the photographed item, Escape and
  Back both close it and drop the param, a cold load of the URL opens the
  takeover on the right item, closing the booted takeover strips the param,
  and a photoless haul's link does not open QC.

### Open — not built yet

All nine items have landed (2026-08-03). The table stays empty until a new
audit finds follow-up work.

| # | Item | State in the repo today |
| --- | --- | --- |
| — | — | — |

### Suggested build order

1. Routes first (open item 1). Every other surface hangs off a real URL.
2. The steps page (items 2, 3, 6). Reuse the row anatomy from `HaulFlowBoard`.
3. The legacy header removal (item 4) — small, do it with the steps page.
4. Volumetric defaults (item 5) — pure data, `haul-fulfillment.js` only.
5. QC takeover + empty state (item 8), then the deep link (item 9).
6. Remove `+ Parcel B` (item 7) at any point. One line.

### File-by-file changes — exactly what to touch per open item

Line numbers were checked against `main` on 2026-08-03. Files drift — re-grep for the
named symbol before you edit, and trust the symbol over the number. After each item lands,
move it to "Already built" above and tick the matching checklist line at the bottom.

**Item 1 — routes.** One file: `credenza-fashion.jsx`.
- Write: a slug helper (kebab-case the haul name; derive, never store).
- Write: `pushState` calls where haul view state changes today — `openHaulCta`
  (~line 8981), the hauls-tab switch, `closeHaul`, and the hand-off submit
  (→ `/parcels/<id>`). Copy the `/settings` pattern at ~6369.
- Extend: the **one** `popstate` listener (~6546) to read `/hauls`, `/hauls/<slug>`,
  `/parcels/<id>` back into state. Do not add a second listener — the comment there
  explains the bug that caused.
- Extend: the initial-load path checks beside the `/settings` matcher (~6248) so a reload
  on `/hauls/<slug>` reopens that haul.
- Back must peel overlays before navigating: clear `haulDrawerId`, then `qcItemId`, then
  the hand-off sheet, then leave the page.

**Item 2 — the steps page.** New file `components/HaulSteps.jsx` + CSS.
- Mount point: `credenza-fashion.jsx` ~11817, where `<HaulFlowBoard … />` renders inside
  the `openHaulName ?` branch (~11729). Swap the component; keep the exact same props —
  `items`, `ship`, `tileFor`, `agentName`, `onOpenItem`, `onItemAction`. The stage→action
  dispatch in `onItemAction` (copy link / mark arrived / open QC / add to parcel) already
  does what the step pills need. Do not rebuild it.
- Extract the Parcel A panel out of `HaulFlowBoard.jsx` into the sticky rail (new
  `components/HaulParcelRail.jsx` or a section of `HaulSteps.jsx`).
- New CSS: `.cz-steps-*` rules in `credenza-fashion.css`, numbers from § The steps page.
- Leave `HaulFlowBoard.jsx` on disk as reference; delete its import (line 141) once the
  swap is verified.

**Item 3 — the 1400px exception.** `credenza-fashion.jsx` + CSS.
- The haul renders inside `.cz-shell` (injected rule, ~line 5008, `max-width: 1080px`).
  Do not touch `.cz-shell`. Add a class on the panel at ~10125
  (`id="view-panel-hauls"` branch) when `openHaulName` is set — e.g. `cz-haul-wide`,
  `max-width: 1400px; margin: 0 auto`.

**Item 4 — legacy header removal.** Two places.
- `credenza-fashion.jsx` ~11750–11776: delete the `cz-haul-stat` block — the
  `FIND_STATUS_LABELS` count spans, `weightLabel`, and `bulkyHint`. The steps page and the
  strip replace all three.
- `components/HaulBoard.jsx` (173 lines): remove its on-page budget/parcel/archive strip.
  Move **Set a budget** and **Archive** into a `⋯` `IconButton` menu on the title row.
  The archive behavior (close + undo toast) already lives in the `onArchive` prop at
  ~11785 — rewire it to the menu, do not rewrite it.

**Item 5 — volumetric defaults.** `haul-fulfillment.js`, the drawer, tests.
- `haul-fulfillment.js`: add the `VOL_DEFAULTS` table (§ Volumetric defaults) beside the
  divisors (~line 72) and a `volumeFor(item)` helper. In the item mapper (~line 152,
  `vol: num(card.haulVolumeCm3)`) fall back to the category default and carry an
  `estimated` flag. Never fall back to zero.
- Rail copy: `volumetric ÷ 6000 · est.` while any packed item's volume is estimated.
- `components/HaulItemDrawer.jsx`: add three small L×W×H (cm) inputs that write
  `haulVolumeCm3 = L × W × H`. A stored value clears `est.` and wins everywhere.
- Add pure tests beside the existing `haul-fulfillment` cases.

**Item 6 — quiet top bar on the haul page.** `credenza-fashion.jsx`.
- When `openHaulName` is truthy, do not render the search field or `SlidingTabsPill`
  (view tabs ~11457; shelf-filter pills ~11533 and ~11673). The masthead (~11006) and the
  Stash button stay. Conditionals keyed on `openHaulName` already exist right there
  (~11601, ~11729) — extend them, do not invent a new mechanism.

**Item 7 — remove `+ Parcel B`.** `components/HaulFlowBoard.jsx` ~381–385: delete the
`onAddParcel` block, and render no such control in the new rail. Keep parcels an array in
any new data shape.

**Item 8 — QC full-viewport takeover.** `components/QcOverlay.jsx` (333 lines).
- Size the `<dialog>` to the full viewport; keep the 344px decision rail; the photo pane
  takes the rest.
- Empty state when `photos == 0`: dashed drop target with the copy from § QC takeover
  deltas; wire paste and drag-drop through the existing `qcPhotos` HTTPS/data-URL gate
  and the 12-photo cap.
- Disable both verdict buttons at `opacity: .56` until at least one photo exists.

**Item 9 — QC deep link.** After item 1. `openHaulCta` (~8981) pushes
`/hauls/<slug>?qc=first` and opens the takeover. On load, `?qc=first` resolves to the
first unreviewed warehouse item (`photos > 0`), so the link survives a reload. Drop the
param from the URL when the takeover closes.

---

## Writing style for anything Kyle reads (MANDATORY — pass it down)

Kyle is not a programmer. Write every report, commit message, question, and plan in
ASD-STE100 Simplified Technical English:

1. Use short sentences. Maximum 20 words for an instruction, 25 for a description.
2. Give one instruction per sentence. Use the imperative for instructions.
3. Use the active voice. Use the present tense.
4. Use one word for one meaning. No idioms, no slang, no figurative speech.
5. Do not omit articles or verbs to save space.
6. Put a warning before the instruction it applies to.
7. Explain what a thing does, not what it is called. Name the effect Kyle sees.
8. Give Kyle a decision, not a diagnosis. Never ask him a technical question.

The full rule lives in `~/.claude/WRITING-STYLE.md`. If you spawn further agents, include
this block in their spec. UI copy is exempt from STE — it follows the house copy rules in
`README.md` (§ Copy) and every string in this document is final unless marked otherwise.

## Repo ground rules (from `/Users/kylewensel/credenza/CLAUDE.md` — they bind you)

- Never run `netlify deploy`. Only Kyle ships.
- Never touch `credenza-storage.js`, `agents.js`, the link resolver, or
  `components/CoverFlowCarousel.jsx`.
- Never add a marketplace surface. Credenza never takes money.
- Read `.claude/skills/credenza-design/` before you change any UI, CSS, or theme.
- Gates, run from `preview/`: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Run `git status --short` before every commit. Stage only your own files.
- Make one change at a time. Test after each one.

---

## Decision record — questions that were open, now closed

These were resolved by reading the shipped code and by Kyle's direction. Do not reopen them.

| # | Question | Decision | Basis |
| --- | --- | --- | --- |
| 1 | Real routing? | **Real URLs via the app's existing `pushState` pattern.** There is no router library and you must not add one. `credenza-fashion.jsx` already drives `/settings` and `/upgrade` through `window.history.pushState` plus **one shared `popstate` listener** (see the comment near line 6546 — two listeners on popstate caused a bug once; extend the existing one). Add `/hauls`, `/hauls/<slug>`, `/parcels/<id>` the same way. | Code |
| 2 | Layout model | **Vertical steps, not columns.** Kyle: "sectioned in steps to make it simpler." The five-step stack below is the design. The column board survives only as reference material. | Kyle |
| 3 | Page width | Steps column max **820px**, parcel rail **300px**, page container max **1400px** (`margin: 0 auto`). The rest of the app stays at the 1080px `.cz-shell`; this page is the sanctioned exception. | Kyle's 2380px monitor; the old page was ~40% void |
| 4 | Old haul header | **Delete it.** The counts line ("Not bought 3 · Bought 1"), the segmented progress bar, and its weight aggregate all go. They restate — and contradicted — the stage data. **Keep "Set a budget" and "Archive"**: move both into a `⋯` overflow menu on the title row. | One weight story, below |
| 5 | Volumetric = 0 | **Per-category defaults**, table below. A user-entered value always wins. Estimated values render with `est.` | `haulVolumeCm3` exists on the item model and is null for every item today |
| 6 | Masthead on the haul page | **Masthead stays (wordmark + Stash). Search and the Shelf/Hauls tabs go.** The Stash sheet is global (there is a focus-router comment about it near line 7379) so it must keep working here. Back is the `‹ All hauls` link, not browser-only. | Code + focused-workspace intent |
| 7 | Multi-parcel | **Not now.** The only trace in shipped code is one copy string. Model parcels as an array (`Haul → Parcel[]`) so nothing blocks it, but render no `+ Parcel B` control. | Code |
| 8 | QC photo source | **The user pastes or drops the agent's photos.** `qcPhotos` already exists with a data-URL/HTTPS gate and a 12-photo cap (`QC_PHOTOS_STORED`). The QC empty state must teach this — copy below. | Code |

---

## Routes

Three URLs, using the existing pushState mechanism:

| URL | Screen | Notes |
| --- | --- | --- |
| `/hauls` | Hauls index | The grid from `README.md` §1, unchanged. |
| `/hauls/<slug>` | **The steps page** — this document | Slug is the haul name, kebab-cased, collision-suffixed (`winter`, `winter-2`). One URL for the whole weeks-long middle of the haul. |
| `/parcels/<id>` | Tracking | `README.md` §10–11 unchanged. Created at hand-off; outlives the haul; a notification can link straight to it. |

Overlays are **not** routed — they layer over `/hauls/<slug>`:

- **Item drawer** — right drawer, 352px (`README.md` §8, unchanged).
- **QC review** — now a **full-viewport takeover**, not a 940px modal. Same internal anatomy
  and keyboard grammar (`←` `→` photos · `G` green · `R` red · `Esc` close), but the photo
  pane gets the whole screen minus the 344px decision rail. The user is judging stitching;
  give the photograph every pixel.
- **Hand-off** — centered sheet over the dimmed page (`README.md` §9). On
  **Mark submitted to agent** it routes to `/parcels/<id>`.

Back button: `popstate` peels overlays first (drawer/QC/hand-off close), then navigates.
This matches how the settings sheet already behaves — reuse that wiring.

Deep link that must survive: the index CTA **Review QC · N** navigates to `/hauls/<slug>`
**with the QC takeover already open** on the first unreviewed item. It is the highest-value
shortcut in the feature.

---

## The steps page

Capture: `wireframes/board-as-steps.png`. Numbers below are the spec; the mock used stand-in
fonts — ship with the real tokens (`--cz-display`, `--cz-sans`, `--cz-mono`) and glass
surfaces per `README.md` § Design tokens.

### Page frame

1. Masthead (wordmark + Stash only).
2. Kicker line — `Kicker` `9 items · haul`.
3. Title row — `‹ All hauls` link, `<h1>` haul name (display 30px/600/−0.035em), spacer,
   `⋯` `IconButton` (menu: Set a budget · Share · Archive).
4. Sub-line, 13px `--cz-sub`: **"Five steps, top to bottom. A step never locks — go back any time."**
5. Summary strip — identical component to `README.md` §2: Agent · Goods · Chargeable ·
   Ship est. · storage sentence. This is now the **only** place aggregate weight appears.
6. Two columns: `display: flex; gap: 20px; align-items: flex-start` — the steps stack
   (`flex: 1; max-width: 820px`) and the parcel rail (`flex: 0 0 300px; position: sticky; top: 20px`).

### The one weight story

Weight appears in exactly three places, each a different scope, each labelled:

| Place | Scope | Form |
| --- | --- | --- |
| Summary strip → **Chargeable** | Parcel A | `866 g` — the number the agent bills |
| Parcel rail maths | Parcel A, derivation | `actual + packaging` / `volumetric ÷ 6000` / `chargeable` / `billed at` |
| Item rows / drawer | One item | `512 g actual` or `est. 900 g` |

No other weight renders anywhere on the page. If the parcel is empty the strip cell reads
`—` with the label unchanged.

### The five steps

One `<section>` per step, stacked, `gap: 12px`. A step is a glass card: radius 14,
`--cz-card` at 82% + blur 16, hairline border, the standard card elevation.

| # | Title | Holds items in stage | Right-side status line |
| --- | --- | --- | --- |
| 1 | **Order it** | `toOrder` | `2 left to order` |
| 2 | **Wait for arrival** | `ordered` | `2 on the way · mark them when they land` |
| 3 | **Check the photos** | `warehouse` | `2 waiting on your green light` |
| 4 | **Pack the box** | `qcd` | `1 ready to pack · 1 can't ship` |
| 5 | **Hand it off** | — (it is an action, not a bucket) | `Opens when the box has something in it` / `Ready — 1 item in the box` |

Step titles are display 15px/600/−0.03em. Status lines are 12px `--cz-sub`; when the step
needs the user the status takes `--cz-ink`; when it is fully done it takes `--cz-money`.

**Step header anatomy** — `flex; gap: 12px; padding: 14px 16px; min-height: 54px`; the whole
header is a button (toggles the body):

- **Number chip** — 26×26, radius 8, mono 11px/700.
  - *Untouched*: transparent, `1.5px solid var(--cz-hair-strong)`, `--cz-sub` numeral.
  - *Current* (lowest-numbered step with work): filled `--cz-action-fill`, `--cz-action-text` numeral.
  - *Done* (stage empty because everything moved past it): `--cz-money-bg` fill, `--cz-money`
    border, a 13px Lucide `check` instead of the numeral.
- Title, then the status line pushed right (`margin-left: auto`).
- A 14px Lucide `chevron-down`, rotated 180° when open, 250ms standard curve.

**Section states** — all derived, never stored:

- **Open**: any step holding items that need the user (1, 3, 4 when it has green unpacked
  items). Body rendered.
- **Collapsed**: done steps and pure-waiting steps (2) collapse to their header. Click to
  open. A collapsed done step's status line is its receipt: `All 4 ordered · marked Jul 18`.
- **Resting** (step 5 with an empty box): card at `opacity: .62`, body swapped for one
  posture line, 11.5px `--cz-faint`, `padding: 10px 16px`, hairline top:
  *"Credenza writes the parcel instruction. You send it — Credenza never touches your agent."*
- The user's manual open/close override lives in component state (`openSteps`) and resets on
  navigation. **Never lock a step.** Every body stays reachable; going backwards is normal.

**Item rows** — `min-height: 52px; gap: 12px`, hairline-separated (no border on the last):

- 34×42 tile, radius 7 — real photo, else the platform gradient with the platform name.
- Title display 12.5px/600/−0.03em, one line, ellipsised.
- Meta line mono 9.5px/700/+0.04em: stage-appropriate facts —
  `NOT ORDERED · EST. 900 G · $112.00` / `SB-8827104 · ORDERED 4 D AGO · $88.00` /
  `512 G ACTUAL · 58 D LEFT · $41.20` / `GREEN · 268 G · $27.75` (in `--cz-money`) /
  `RED · STITCHING · CAN'T SHIP` (in `--cz-error-text`, row at `opacity: .62`).
- Action pill pushed right, `min-height: 30px`, radius 999. Default treatment is quiet
  (transparent + `--cz-hair-strong` border). **The QC pills are the loud exception** —
  filled `--cz-action-fill`, because Review QC is the page's real call to action whenever
  it exists. Never more than one loud pill style per row.
- Row click (not the pill) opens the item drawer. `stopPropagation` on the pill.

Per-step footers (dashed pill, `min-height: 34px`): step 1 **Copy all links for your agent**;
step 3 **Review all QC**. Hidden when the step is empty.

**Row actions by step** (behavior identical to the README's board pills):

| Step | Pill | Does |
| --- | --- | --- |
| 1 | Copy link | W2C to clipboard + toast |
| 2 | Mark arrived | → `warehouse`, sets `actual`, `storage = 90` |
| 3 | Review QC · N | Opens the QC takeover on that item |
| 4 (green) | Add to parcel | → `parcel` + toast; row moves to the rail |
| 4 (red) | Return message | Reopens QC at the red state |

**Empty haul** (nothing anywhere): steps 2–5 resting, step 1 open with a dashed empty box:
*"Nothing in this haul yet. Add items from any card's ··· menu."*

**Long steps**: a step body shows at most 8 rows, then a dashed
**Show all 14** pill that expands it. No inner scrollbars — the page scrolls.

### The parcel rail (right, sticky)

The board prototype's Parcel A panel (`README.md` §7), restyled to the rail, top to bottom:

1. **Contents + maths card** — header `PARCEL A` kicker over `--cz-ink` rule, count right.
   Packed items as compact rows (30×38 tile, name, mono weight, `IconButton ×` → back to
   `qcd`). Empty state, dashed box: *"Nothing in the box. Green-lit items in step 4 get an
   **Add to parcel** button."* Then the four maths rows, then the divisor chips (5000/6000 +
   "check yours").
2. **Lines card** — unchanged: user-owned rates, date stamp, editable inputs, selected line
   `--cz-ink` border + `--cz-accent-bg`.
3. **`BuyButton` — Review & hand off · N.** Empty box: label "Nothing in the box yet",
   refuses with a toast.
4. **Tips card** — `--cz-accent-bg`, the three conditional tips from
   `README.md` § The parcel calculator, verbatim.

The rail is the haul's scoreboard: it must stay in view while the user works the steps —
that is what "add to parcel" pays off visually. `position: sticky; top: 20px`.

### Volumetric defaults

`vol` (cm³) when the user has not entered one — the estimate that keeps the volumetric row
alive so the calculator can teach ("agents bill you for air"):

| Category | Default cm³ | | Category | Default cm³ |
| --- | --- | --- | --- | --- |
| Outerwear / puffer | 8000 | | Pants / denim | 3000 |
| Hoodie / knit | 5000 | | Shoes (boxed) | 9500 |
| Tee / shirt | 1500 | | Shoes (box removed) | 6000 |
| Accessory / hat / belt | 800 | | Fallback (unknown) | 2500 |

Category comes from the item's existing categorisation; fall back to the fallback, never to
zero. Estimated volumes render as `volumetric ÷ 6000 · est.` in the rail; a user-entered
L×W×H (drawer field, three small inputs) drops the `est.` and wins everywhere. Store on
`haulVolumeCm3`. Do not touch `weight-estimate.js` — it is weight, not volume; put the table
in `haul-fulfillment.js` beside the divisors.

### QC takeover deltas

Anatomy, keyboard, verdicts, reasons, and messages: `README.md` §3–5, unchanged. Two deltas:

- Full viewport, as above.
- **Empty state** (item at warehouse, `photos == 0`) — the takeover still opens, photo pane
  shows a dashed drop target: *"Your agent's QC photos live on their site. Paste or drop
  them here — up to 12."* Paste and drag-drop both accept; the existing `qcPhotos`
  HTTPS/data-URL gate validates. Until a photo exists the verdict buttons are disabled at
  `opacity: .56` — never let a user red-light what they have not seen.

### Motion

The system curve and durations (`README.md` § Interactions) cover everything. Specifics:

- Section open/close: body height + opacity, 250ms, standard curve. Chevron rotates in the
  same 250ms. No stagger, no spring.
- A row leaving one step for another (Mark arrived, Add to parcel): fade + 8px rise out
  (140ms), destination step's count and status line update in place. Do not animate a card
  flying across the page.
- Step number chip state change (outline → filled → check): 140ms crossfade.
- A step completing (its last item moving on) collapses after a **600ms hold** so the user
  sees the empty body before it folds. Under `prefers-reduced-motion` everything is 0.01ms
  and the hold is dropped.

### State

```ts
{
  // per README, plus:
  openSteps: Partial<Record<1|2|3|4|5, boolean>>,  // user override, session-only
}
```

Everything else stays a projection of `items` — step contents, counts, status lines, chip
states, the strip, the rail, the index card. **Store no step status.** Persistence rules and
the future `Haul → Parcel[]` shape: `README.md` § State.

---

## What to build against

- Primitives: `Button` (primary / outline / subtle — the two secondary variants were added
  2026-08-02; use them, do not restyle per call site), `BuyButton`, `IconButton`, `Chip`,
  `SegmentedControl`, `Kicker`, the masthead. All in the repo per `README.md` § About the
  design files.
- Tokens only — every colour, radius, and face is a `--cz-*` variable. The spacing values in
  this document are deliberate; do not round them to a grid.
- The mock (`wireframes/Board as steps.html`) is a **direction reference, not code**. Same
  for the board prototype. Do not ship their markup.

## Acceptance checklist

- [x] `/hauls`, `/hauls/<slug>`, `/parcels/<id>` are real URLs; back button peels overlays
      before navigating; reload lands on the same screen.
- [x] The haul page shows no search bar and no Shelf/Hauls tabs; Stash still opens.
- [x] The legacy haul header (counts, progress bar) is gone; budget and archive live in `⋯`.
- [x] Weight appears only in the strip, the rail maths, and item rows — and the three never
      disagree, because all are derived from `items`.
- [x] Volumetric is never 0 for a categorised item; `est.` clears when the user enters size.
- [x] Index CTA `Review QC · N` lands on the haul page with the takeover already open.
- [x] Every step opens and closes; no step ever locks; stage moves backwards via the drawer.
- [x] A haul with items in all five stages at once renders sanely — this is the normal case.
- [x] Red-lit items are excluded from every sum and cannot enter the box.
- [x] Keyboard: `G` `R` `←` `→` `Esc` in QC; visible focus rings everywhere; touch targets ≥ 44px.
- [x] Singular/plural correct everywhere (`1 item stays behind`).
- [x] Gates green from `preview/`: test, lint, typecheck, build.

## Files in this bundle

| File | What it is |
| --- | --- |
| `STEPS-HANDOFF.md` | This document — the shipping direction. |
| `wireframes/Board as steps.html` | The approved direction mock (stand-in fonts). |
| `wireframes/board-as-steps.png` | Capture of the mock Kyle approved. |
| `README.md` | Foundations: state machine, calculator, messages, tokens, copy, motion. |
| `Haul flow.dc.html` + `screens/` | The column-board prototype — now reference only, for the QC / drawer / hand-off / tracking / index surfaces, which carry over. |

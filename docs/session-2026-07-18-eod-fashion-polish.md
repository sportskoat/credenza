# End of Day — 2026-07-18 — Fashion UI Polish Batch

Second session doc for today (morning handoff:
`session-2026-07-18-card-back-handoff.md`). Everything below is implemented
and driven-verified in dark mode with Playwright (system Chrome, storage key
`credenza-fashion-items-v1`). **Still uncommitted — commit is Kyle's call.**
`docs/carousel-canonical-state.md` was updated to match the new approved
behavior; read it before touching carousel code.

## What shipped today

### Capture pill
- **Stash button glides again.** "Stash" ⇄ "Stash clipboard/tab" no longer
  teleports to center — the suffix wrapper animates `width` to 0 inside an
  `overflow: hidden` span so the collapsing space pushes "Stash" to the
  middle. Verified ≤2 px/frame over ~230 ms both directions.

### Shelf totals
- **Floating total row under the Shelf/Hauls tabs:** `N saved` count on the
  left (consistent placement across shelf/hauls — it no longer jumps up/down),
  then a pill with the transitions.dev **spinning reel counter** summing the
  displayed list's USD-normalized prices (`priceUsd` preferred, raw USD
  `price` fallback, CNY-only items excluded). Digits are per-column 0–9 reels
  with vertical `feGaussianBlur` streaks and a staggered settle.
- **The dollar amount is green** (`#4ade80`).
- **Organic recalculation:** favorites filter, search results, and open hauls
  each total only what's on screen (`Total Shelf Cost` ⇄ `Total Haul Cost`).
  Verified: $56.50 shelf / $11.50 starred / $45.00 search / $56.50 of $86.50
  haul.
- Known gap: typing "$120" in the stash box doesn't parse a price — totals
  only count structured prices (Weidian resolver or Edit → Price).

### Card back / edit
- **Favoriting never reorders** — shelf sort is newest-first by `createdAt`;
  the heart only marks the card.
- **Write-through autosave everywhere** — 700 ms debounce + flush on every
  exit path (back, click-away, flip, save-check). The Save/Done footer is
  gone. Grid-card back-note autosaves too (600 ms).
- **Tags field removed** from both edit forms (carousel + grid).
- **Heart like-button** replaces the star: transitions.dev spec, `#f40051`,
  pop on an HTML wrapper (never the SVG — Chromium 1× rasterization), 8-dot
  burst re-seeded per like. Sits **top-right, same slot as the edit control**.
- **Save-check on the edit screen** (late session): the detail header's
  checkmark, in the same top-right slot, permanently lit purple. Idle shows
  Check; hover reverse-morphs to Pen (the detail button's pen→check, flipped).
  Clicking saves and slides the sheet **back up** — the exact reverse of its
  entrance — while the back chevron still slides it down. Gotcha that cost a
  cycle: framer-motion freezes exit props at the last pre-removal render (and
  `AnimatePresence custom` loses to a child's own frozen `custom`), so the
  exit direction is committed with `flushSync` before `setEditing(false)`.
- **Edit ⇄ content swap** is a springed `AnimatePresence mode="wait"` pair:
  edit enters from above, content from below.

### Carousel
- **Wrap-around:** ArrowLeft/ArrowRight (and chevrons) wrap front ⇄ back via
  modulo on `activeIndex`.
- **Open haul is a clean view** — the view toolbar hides while a haul is open.

### Size info
- **Chinese is off the sizing charts:** `CarouselSizeInfo` drops any fact row
  or variant axis containing CJK (颜色 / 尺码 / 黑色…). English size runs
  still show via the Available row (`sizeRunLabel`), so nothing real is lost.

## What we learned (themes)

- **Everything today was verified dark-only.** The new chrome needs a light
  pass tomorrow: green reel (`#4ade80`), heart red (`#f40051`), save-check
  purple tint, burst particles, total-pill hairline.
- **`color-mix(in srgb, var(--cz-accent) N%, transparent)` is the right
  pattern** for interactive tints (save-check, menu hover) — it tracks the
  theme automatically. Hard-coded colors should be reserved for brand-fixed
  accents (heart red, money green).
- **Specificity trap (again):** a reusable component block must never set
  `position` — (0,2,0) silently overrides the (0,1,0) placement classes. Cost
  us the heart rendering top-left earlier today.
- **Motion:** exit-direction state must be committed (`flushSync`) before the
  unmounting render; `AnimatePresence custom` is not reliable when the exiting
  child carries its own `custom` prop.

## Where we want to go

- **Commit + deploy.** The whole fashion feature pack + this polish batch is
  uncommitted. Deploy stays a separate explicit step (netlify-cli).
- **Monetization track** (`docs/Monetization.md`): affiliate-first, Tier
  A/B/C, no W2C marketplace — feature work should keep pointing at that.
- **Price capture:** parse typed prices out of stash text so the total
  counter covers hand-entered items, not just resolver/Edit prices.

## Feedback for tomorrow

1. **Light-theme pass** on everything in the themes section — highest value,
  smallest effort.
2. **Lint debt:** `npm run lint` shows 1 error + 65 warnings; the error
   (`'performance' is not defined`, wheel handler) is pre-existing — fix the
   eslint browser-globals config rather than the code.
3. **Design-hook noise:** the transitions.dev bounce easing
   (`cubic-bezier(0.34, 1.96, 0.64, 1)`) keeps getting flagged. It's verbatim
   from Kyle's supplied spec — kept intentionally; consider an ignore-value
   entry so it stops re-flagging.
4. **Price-from-text parsing** if Kyle wants totals to cover typed entries.
5. When Kyle says commit: the tree contains the post-handoff feature pack
   *and* this batch — one commit or two (feature pack / polish), his pick.

# Credenza Fashion — To-Do

**Date:** 2026-07-23
**Source:** Combined four-model audit. See `docs/Peer-review-2026-07-23-synthesis.md`.
**Rule:** Do not commit until Kyle says so. Do not deploy until Kyle says so.

---

## Gate 0 — Fix the urgent defects first

- [x] **1. Fix the search hotkey defect.** DONE 2026-07-23. Guard now covers
  `.cz-desk-search-shell`; the type-anywhere block is gone; the root cause
  (carousel `stage.focus()` stealing the caret on list reorder) is fixed.
  Verified: "denim jacket" lands in full. No popup. No edit-mode theft.

- [x] **2. Remove the desktop capture sheet.** DONE 2026-07-23. The sheet
  renders on the phone only. The desktop ＋ Stash button runs the one-tap
  clipboard stash. Desktop ⌘V stashes directly. The mobile bottom sheet is
  unchanged. Verified on both viewports.

- [x] **3. Add a delete confirmation.** DONE 2026-07-23. The card-back Remove
  button and the Backspace/Delete key both stage a dialog. The dialog shows
  the card title and offers Keep / Delete. Verified: Keep keeps the card,
  Delete removes it.

- [x] **4. Repair the nested buttons.** DONE 2026-07-23. The grid card's open
  control is one button around the photo only. Star and Buy are siblings, not
  children. Zero buttons inside buttons. No validateDOMNesting warning. All
  187 tests pass. The carousel physics is untouched.

## Gate 1 — Repair the shell

- [x] **5.** DONE 2026-07-23. The Buy row is pinned to the bottom of the card
  back: `position: sticky; bottom: 0` plus `margin-top: auto` in the flex
  column. A gradient fade covers the scroll edge. JS scroll measurement adds
  `is-at-end` at the end of the scroll, and the fade drops there. Verified:
  Buy is visible without scrolling, gap 12px, fade toggles at both edges.
- [x] **6.** DONE 2026-07-23. One container width: 1080px centered. The
  fashion override `.cz-app[data-fashion="true"] .cz-shell` no longer beats
  the base shell rule on specificity. The `.cz-chrome` 720px cap is gone.
  Verified: masthead, tabs, stats row, and content all start at left 208 and
  end at right 1232 on a 1440px viewport. 187 tests pass.
- [x] **7.** DONE 2026-07-23. The stats row renders on the Hauls tab only
  inside an open haul. The directory shows its own head: "Your hauls / N
  hauls" plus per-haul item counts and totals. The shelf totals and the
  starred/view toggles no longer appear on that tab. Verified: directory has
  no stats row and no toggles; an open haul shows "N items | Haul $X".
  187 tests pass.
- [x] **8.** DONE 2026-07-23. First run shows the intro screen only. A
  `firstRunIntro` flag hides the avatar, the mobile search row, the tabs, and
  the bottom bar with the agent tile. Desktop and phone render the same intro:
  brand, headline, Get started. The agent tile never appears before onboarding
  ends. Verified on 1440px and 390px viewports. 187 tests pass (one test now
  clicks through the intro first).
- [x] **9.** DONE 2026-07-23. A `SYNC_ENABLED` flag gates both login buttons:
  the profile sheet's "Log in / Sign up" block and the intro's "Log in" quiet
  button. Both are hidden. Set `VITE_ENABLE_SYNC=true` when sync ships and
  they return. Verified: intro shows Get started only; the profile sheet opens
  on Theme. 187 tests pass.

## Gate 2 — Repair the text

- [x] **10.** Delete the word "projects" from the search help text.
  DONE 2026-07-24 (CO-06): the no-match help now reads "Search includes
  titles, notes, raw links, and paired Photos or Buy URLs."
- [x] **11.** Correct the install manifest. Use the name "Credenza Fashion".
  Use the haul description. Use the light theme colors.
  DONE 2026-07-24 (CO-07): manifest name/short_name "Credenza Fashion",
  description "One shelf for the whole haul.", background/theme #F4F4F0.
  index.html title, description, and apple-mobile-web-app-title match.
- [x] **12.** Hide the money total when a search finds zero items.
  DONE 2026-07-24 (CO-10): the separator and Total chip no longer render
  when a search returns zero. "0 found" stands alone.
- [x] **13.** Move the ghost cards below the text on the empty shelf. Change
  the search placeholder to "Paste a link" when the shelf is empty.
  DONE 2026-07-24 (CO-21): ghost strip renders in flow below the hero text;
  tagline gets text-wrap: balance (no orphan word). Empty-hero placeholder
  is "Paste a link"; the phone search field flips to it when the shelf is
  empty. A pasted link in either field stashes instead of filling the box.
  Probe: ghost top 475 vs text bottom 431; paste stored 1 card. 190 tests
  pass.

## Gate 3 — Polish the look

- [x] **14.** Reduce the Buy button beam to one color.
  DONE 2026-07-24 (CO-15/KM-06): beam, glow, action-btn rings, and both
  fallbacks now use one hue — var(--cz-money). Probe: no pink/violet/amber/
  cyan in the computed gradient.
- [x] **15.** Remove the pink and cyan edge from the card back.
  DONE 2026-07-24 (CO-14): the card-back rim is now the neutral --cz-hair
  hairline.
- [x] **16.** Make the thin borders darker. Make the dark cards easier to see.
  DONE 2026-07-24 (CO-19): light hairline #e2e2dc → #d2d2c9; dark hairline
  0.10 → 0.16; dark card surface #1a1a1d → #202024; stronger rim light on
  dark cards. Probe: tokens live, neighbor silhouettes read on black.
- [x] **17.** Limit card titles to two lines. Align the price rows across each
  row of cards.
  DONE 2026-07-24 (CO-17): titles clamp at two lines and always reserve two
  lines plus padding. Probe: all four row-1 titles 59px, all price rows at
  the same y.
- [x] **18.** Hide the cut-off words on the neighbor cards in the carousel.
  DONE 2026-07-24 (CO-18): the text layer is center-card only; the stage
  fades the outer 6% so side cards dissolve instead of clipping.
- [x] **19.** Use one neutral color for the four source dots.
  DONE 2026-07-24 (CO-22): per-platform dot colors deleted; one neutral
  --cz-faint dot for every source.
- [x] **20.** Fill the empty space on the Hauls tab. Widen the agent chip on
  the phone. Widen the carousel dot targets.
  DONE 2026-07-24 (KM-07): a dashed "Start a haul" ghost tile fills the
  hauls grid and points at the ⋯ menu. Agent chip floor 124px and name
  150px on phones. Dot hit boxes 16×12 → 24×24 (24×36 on phones).
  190 tests pass.

## Gate 4 — Clean the code, then build product

Do not start these items before Gates 0 to 2 are done.

- [x] **21.** Add lazy loading to the images. Fix the 12 lint errors. Delete
  the dead code. Add the page landmarks.
  DONE 2026-07-24 (CO-25/CO-29/CO-30/CO-31): all six img tags carry
  loading="lazy" + decoding="async". Lint is 0 errors (10 a11y fixes in JSX,
  globals.browser in the root eslint config). Deleted the seven named dead
  symbols in both JSX files (localAsk, aiAsk, FilterChip, formatItemDate,
  FIND_STATUS_GROUPS, dismissResurfaced, soloLayout) plus CapturePill,
  normalizedHostPath, MONO, the CapturePill-only ACTION_* constants, and the
  unused eslint-disable. Landmarks: masthead is header, brand is the one h1,
  shelf panels sit in main, the mobile capture bar is footer. The hero and
  intro titles are now p elements so the page keeps one h1. Probe:
  header/main/footer present, h1 count 1. 190 tests pass.
- [x] **22.** Split the JavaScript bundle. Load the sheets only when they open.
  DONE 2026-07-24 (CO-28): vendor chunk (react, framer-motion, lucide) splits
  from the app via manualChunks. The six sheets moved to `sheets/*.jsx` and
  load with React.lazy + Suspense on first open. Main chunk 502 kB → 210 kB
  (gzip 161 → 68 kB); vendor 277 kB (89 kB gzip) caches separately; sheet
  chunks are 1.4–6.2 kB each. The lint script now covers ../sheets. Probe:
  all six sheets open from their chunks on desktop and phone. 190 tests
  pass.
- [x] **23.** Build the Tier A features from `docs/Monetization.md`.
  DONE 2026-07-24 (GR-01): A6 weight estimator — CATEGORY_WEIGHT_GRAMS table,
  per-item weightGrams override in the edit form (placeholder shows the auto
  default), weight chip on the card back, "~" formatting, garbage input clears
  to the default. A3 pipeline board — the open-haul head shows per-status
  counts, "Ready to ship N" (bought + GL), and the rough haul weight; the
  haul money total now excludes returned items. A5 Warehouse QC — qcPhotos
  gallery on the card back (distinct from the product gallery, opens in the
  photo viewer), one-tap GL/RL with qcVerdictAt stamp and optional qcNote.
  migrateItem now round-trips weightGrams/qcPhotos/qcNote/qcVerdictAt.
  Same batch: the status-track connector no longer runs through the bubbles
  (9px inset at each end; Kyle's overlap report). Probe: board counts, $56
  returned-excluded total, ~3 kg, GL tap flips status + stamps + re-counts.
  8 new weight unit tests. 198 tests pass. Lint 0 errors. Build clean.
- [ ] **24.** Kyle: set the Reddit variables. Kyle: rotate the Anthropic key.

## Rules for every gate

- Run the full test gate after each session.
- Take screenshots to verify each fix.
- Do not commit until Kyle says so.
- Do not deploy until Kyle says so.

## Waiting

- ChatGPT 5.6 audit entry (Part 3 of the synthesis). Add its confirmed
  findings to this list when it lands.

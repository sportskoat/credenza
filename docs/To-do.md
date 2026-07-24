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

- [ ] **14.** Reduce the Buy button beam to one color.
- [ ] **15.** Remove the pink and cyan edge from the card back.
- [ ] **16.** Make the thin borders darker. Make the dark cards easier to see.
- [ ] **17.** Limit card titles to two lines. Align the price rows across each
  row of cards.
- [ ] **18.** Hide the cut-off words on the neighbor cards in the carousel.
- [ ] **19.** Use one neutral color for the four source dots.
- [ ] **20.** Fill the empty space on the Hauls tab. Widen the agent chip on
  the phone. Widen the carousel dot targets.

## Gate 4 — Clean the code, then build product

Do not start these items before Gates 0 to 2 are done.

- [ ] **21.** Add lazy loading to the images. Fix the 12 lint errors. Delete
  the dead code. Add the page landmarks.
- [ ] **22.** Split the JavaScript bundle. Load the sheets only when they open.
- [ ] **23.** Build the Tier A features from `docs/Monetization.md`.
- [ ] **24.** Kyle: set the Reddit variables. Kyle: rotate the Anthropic key.

## Rules for every gate

- Run the full test gate after each session.
- Take screenshots to verify each fix.
- Do not commit until Kyle says so.
- Do not deploy until Kyle says so.

## Waiting

- ChatGPT 5.6 audit entry (Part 3 of the synthesis). Add its confirmed
  findings to this list when it lands.

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

- [ ] **5.** Pin the Buy button to the bottom of the card back. Add a fade at
  the scroll edge.
- [ ] **6.** Give the app one container width. Use the same width for the
  masthead, the tabs, the stats row, and the content.
- [ ] **7.** Show haul text on the Hauls tab. Remove the shelf totals and the
  shelf toggles from that tab.
- [ ] **8.** Show the intro screen instead of the app shell on first run. Do
  not show both at the same time.
- [ ] **9.** Hide the "Log in / Sign up" button. Show it again when sync
  exists.

## Gate 2 — Repair the text

- [ ] **10.** Delete the word "projects" from the search help text.
- [ ] **11.** Correct the install manifest. Use the name "Credenza Fashion".
  Use the haul description. Use the light theme colors.
- [ ] **12.** Hide the money total when a search finds zero items.
- [ ] **13.** Move the ghost cards below the text on the empty shelf. Change
  the search placeholder to "Paste a link" when the shelf is empty.

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

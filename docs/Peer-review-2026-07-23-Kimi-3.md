# Credenza Fashion — Combined Audit for Peer Review

**Auditor:** Kimi 3. **Date:** 2026-07-23. **Build:** uncommitted worktree on branch `mobile-fix-loop`.
**Audience:** This text goes to four models for review: ChatGPT 5.6, Kimi 3, Grok 4.5, and Claude.
**Request to each reviewer:** Read the findings. Grade the findings. Name what this audit missed.

---

## Part 1 — Method

I ran the app in Chromium with the owner's real shelf data (18 items, 2 hauls). I took 17 screenshots across desktop dark, desktop light, mobile 390px, and the empty state. I ran functional probes for search, flip, delete, tabs, views, and profile. I captured all console errors and page errors. I ran the test gate: **187/187 tests pass, 14 files.** Zero page errors in every context.

## Part 2 — Findings in plain language

### The main problem

The app has one serious defect. The defect is in the search field.

When you type in the search field, the app sometimes loses focus. The app then sends your next letter to a global keyboard command. That command opens the "Stash to shelf" popup. The popup takes the rest of your word.

I tested this. I typed "denim jacket" into the search field. The search field kept only the letter "d". The popup took "im jacketn". This is the same bug the owner showed me in screenshots.

The cause is a missing line in the code. The guard that checks "is the user typing?" does not know about the desktop search field. The fix adds that field to the guard.

### The second problem

The delete button has no confirmation. You click "Remove card." The card is gone at once. The owner asked for a confirmation step. I agree. The app needs one.

### The third problem

The "Stash to shelf" popup is the same part on desktop and on mobile. On mobile it looks correct. It is a bottom sheet. On desktop it looks wrong. The owner already asked me to delete it. The popup is also the part that steals keystrokes. Deleting it removes two problems at once.

### The small problems

- A favorite button sits inside another button. This is not valid HTML. React prints an error on every render.
- Search text stays in the field when you change tabs. The Hauls tab then shows "18 FOUND." That text talks about shelf items, not hauls.
- The Buy button shows a thin rainbow line at the top. It looks like a glitch.
- One image failed to load in the light theme test.

### What works well

- All 187 tests pass. The app had zero crashes in every test I ran.
- The dark theme is clean. The colors follow strict rules.
- The spacing on the card back is even. I measured it.
- The animations are smooth. Dropdowns open with a height animation. The AI size line has a slow shine effect.
- The mobile layout works. The grid, the bottom bar, and the capture sheet all behave.
- The profile page is complete. Theme, sizes, fit, agent, currency, and backup all work.

## Part 3 — Scores and evidence

### Looks — 8.5/10

**Strengths:**

- The dark theme is disciplined. One ink color, one muted color, one green accent for money.
- The typography has a clear system. Serif display for titles. Mono for stats and prices.
- The spacing is consistent. The card-back stack uses a 16px rhythm. I verified this by measurement.
- The coverflow carousel is the signature element. The receding cards read well in both themes.
- The light theme holds up. No token leaks. No hard-coded dark values visible.
- The empty-state hero is elegant. The staggered line reveal adds polish without noise.

**Weaknesses:**

- The Buy button shows a thin rainbow line at its top edge. It reads as a rendering artifact, not a design choice.
- The hauls tab is sparse. Two small cards sit in a large empty canvas. The layout does not fill the space.
- The mobile agent chip is cramped. "AGENT / Superbuy" wraps awkwardly next to the wide Stash button.

### Functionality — 6/10

**Verified working:**

- Search filters the shelf. The stats row switches from SAVED to FOUND correctly.
- Card flip, edit mode, save, photos, status tracker, category select all render and operate.
- Profile sheet works: theme, sizes, fit preferences, agent, currency, import, backup.
- Hauls, carousel view, card view, starred filter, mobile bottom bar, mobile capture sheet.
- Paste import keeps prose as one note. Bulleted lists still split into cards. The fashion gate works.

**Defects found, ranked:**

1. **P0 — The type-anywhere hotkey steals keystrokes from the desktop search.** Reproduced in Chromium. The field kept "d". The popup took "im jacketn". Root cause: the `isTypingTarget` selector at `credenza-fashion.jsx:10506` does not include `.cz-desk-search-shell`. A focus loss mid-typing routes the next key to the global handler at line 10645. A stray key can also open edit mode on a card. This fires during the most common action in the app.
2. **P1 — No confirmation on card delete.** "Remove card" deletes immediately.
3. **P1 — The desktop capture sheet.** It is the vector for the P0 bug. The owner asked to delete it.
4. **P2 — Invalid HTML: a `<button>` inside a `<button>`.** React logs a `validateDOMNesting` error at `FavoriteButton` on every shelf render, desktop and mobile.
5. **P2 — Search text persists across contexts.** The query stayed in the field through overlays, flips, and tab switches. The hauls tab showed "18 FOUND" while displaying hauls, not items.
6. **P3 — One resource returned HTTP 500** in the light-theme context. Likely an image proxy miss.
7. **P3 — Lint debt:** 13 errors and 70 warnings. 12 errors and all 70 warnings pre-date this work.

### Continuity — 8/10

**Strengths:**

- The agent name is consistent. "Superbuy" matches on the card, the bottom bar, and the profile.
- The theme names are consistent. "Gallery" and "Blackout" appear in the profile and match the tokens.
- The stats row is truthful. Counts and totals matched the data in every state I checked.
- The status language is consistent. Want → Bought → Shipped → Received reads the same everywhere.
- The motion language is consistent. Accordions, panels, and modals share one easing and duration family.

**Weaknesses:**

- The stats row speaks about shelf items while the hauls tab is active. The context switches; the copy does not.
- The desktop capture sheet and the mobile capture sheet are the same component. It reads as a bottom sheet on mobile and as an awkward modal on desktop. One component serves two layouts unevenly.

### Sleekness — 8/10

**Strengths:**

- The accordion dropdowns on status and category animate height, not just opacity. This is the correct pattern.
- The shimmer on the AI size line signals "computed" without a spinner. It is subtle at 2 seconds per sweep.
- The hero stagger gives the empty state a deliberate entrance.
- Every animation has a `prefers-reduced-motion` guard.
- The app feels fast. No layout shift on load. No jank during carousel paging.

**Weaknesses:**

- The P0 hotkey bug is the opposite of sleek. A modal that steals text destroys trust in the interface.
- The carousel dots are small touch targets on desktop. The chevrons carry the load.

## Part 4 — Overall grade: 7.5/10

The foundation is strong. The design system is coherent. The motion is mature. The test gate is green. One defect dominates the score: the search hotkey bug. It breaks the core loop — type, filter, find. Fix the P0 and the P1 delete confirmation, and this app is an 8.5.

**Priority order for fixes:**

1. Fix the type-anywhere hotkey guard.
2. Delete the desktop capture sheet. Keep the mobile bottom sheet.
3. Add a delete confirmation dialog.
4. Fix the `FavoriteButton` nesting error.
5. Scope the stats row copy to the active tab.

## Part 5 — Self-grade of this audit: 8.5/10

**Strengths:** Every claim has evidence. I reproduced the headline bug instead of trusting the report. I ran the full gate. I separated verified facts from suspicions.

**Limits:** I audited in Chromium only, not Safari or Firefox. I used one dataset. I did not test the resolver against live sites — network access changes results. I did not measure performance with tooling; "feels fast" is observation, not a profile. Other models may catch visual defects I normalized after long exposure to this UI.

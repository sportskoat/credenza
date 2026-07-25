# Credenza Fashion — handoff to Kimi K3 (2026-07-25)

Read this file first. Then read, in this order:

1. `docs/carousel-canonical-state.md` — the frozen contract. Do not break it.
2. `docs/Monetization.md` — affiliate-first, Tier A/B/C, no W2C marketplace.
3. `docs/mobile-improvement-plan.md` — the audit that drives the mobile work.
4. `docs/grok-handoff.md` — the state before this session.

---

## 1. What the project is

Credenza Fashion is a save-it-later app for fashion hauls.
The user pastes a Weidian, Taobao, Yupoo, or Reddit link.
The app resolves the price, the photos, and the size chart onto a card.
Cards live on a "shelf". Hauls group cards under names.
Buy buttons wrap the links through affiliate agents.

Main UI: `credenza-fashion.jsx`, `credenza-fashion.css`, shared `credenza.css`.
Sheets: `sheets/*.jsx`, each lazy-loaded.
Vite app root: `preview/`. **The npm root is `preview/`, not the repo root.**
Production: https://credenza-kyle.netlify.app

---

## 2. State as of 2026-07-25

Branch: `mobile-shelf-handoff`. All work happens here.
Head: `8f55d20`.
There is **no git remote**. The branch is local only.

The mobile shelf handoff is **complete**. All 6 steps are done:

| Step | What | Commit |
| --- | --- | --- |
| 1 | Masthead collapse, tabs and totals merge | `23f4219` |
| 2 | Two-line shelf card | `be766c5` |
| 3 | Stash button, Settings sheet | `717012a` |
| 4 | Stash sheet rewrite, Undo toast | `7351bf1` |
| 5 | Mobile detail sheet, edit in place | `8f55d20` |
| 6 | Tokens, contrast, touch targets | `8f55d20` |

Verification at head:

- 372 tests pass across 27 files.
- 0 lint errors. 65 pre-existing warnings remain.
- Typecheck passes. Build passes.
- `preview/scripts/probe-step5.mjs` passes on WebKit iPhone 15 Pro, both themes.

**Nothing after `deploy-2026-07-24b` is live.** Steps 1 through 6 are all local.

---

## 3. What to do next

### 3.1 Blockers before any deploy

Do these first. Do not deploy until all three are clear.

1. **Remove the prototype photos.** The four files in the handoff `img/` folder
   (`item0-0.jpg` through `item3-0.jpg`) are fixtures. They are not licensed.
   Confirm no build output contains them. Run:
   `grep -rn "item0-0\|item1-0\|item2-0\|item3-0" preview/ credenza-fashion.jsx sheets/`
2. **Confirm every sheet module is in the release commit.**
   `docs/Market-Launch-Review.md:70` sets this rule. Check that each
   `lazy(() => import(...))` target in `credenza-fashion.jsx` exists on disk.
3. **Get Kyle's approval.** `docs/Execution-Plan.md:22` says Kyle approves each
   deployment. Never deploy without it.

### 3.2 The deploy procedure

Netlify, site id `d5dbe760-ea61-4603-be4a-0435e08e707a`.
Config: `preview/netlify.toml`. Build command `npm run build`. Publish `dist`.

1. Merge `mobile-shelf-handoff` into `main`.
2. Tag the release `deploy-2026-07-25`.
3. Build and deploy from `preview/`.
4. Test the live site on a real phone before you announce it.

### 3.3 Open work, in priority order

1. **Screenshot both themes on a phone.** Step 6's acceptance asks for it.
   `preview/scripts/probe-step5.mjs` already writes `/tmp/step5-*.png`.
   Widen it to cover the shelf, the Stash sheet, and the Settings sheet.
2. **Clear the 65 lint warnings.** They are all pre-existing. Most are unused
   variables. None are errors. Do this in one pass, not spread across features.
3. **Fix the audit items the mobile plan still lists as open.**
   `docs/mobile-improvement-plan.md` §1 names them. The heart red at 2.12:1 on
   the Gallery card and the `--cz-action-fill` gradient at 1.78:1 are the worst.
   Measure with the canvas method in `probe-step5.mjs`, not by eye.
4. **Split `credenza-fashion.jsx`.** It is about 12,900 lines. Every new sheet
   should leave it, not join it. Move by feature, one sheet per commit, with the
   test suite green between each.

---

## 4. Continuity rules — do not break these

### 4.1 The carousel is frozen

`docs/carousel-canonical-state.md` is a contract, not a suggestion. The desktop
carousel and its card back do not change. If a task seems to need a carousel
change, it does not. Find another way, or ask Kyle.

Two exceptions exist, both already used: the container clearance, and the
shared `StatusChips` component.

`StatusChips` now has three modes. `display` and `edit` belong to the frozen
carousel. `track` is the mobile detail sheet. **Add a mode; never edit one.**

### 4.2 Never put a color in JSX

Every color goes through a `.cz-*` class rule that reads a `--cz-*` token.
Zero hex values in JSX. This is the rule that keeps both themes working.

The palettes are a **JS object**, `PALETTES` in `credenza-fashion.jsx:73`.
They are not a CSS `:root` block. Keys: `light` is Gallery, `rainbow` is
Blackout. **A new token goes in both keys or it goes nowhere.**

Note the trap this creates: the palette is an inline style on `.cz-app`. Any
script that reads a token must read from that node, not from
`document.documentElement`. `probe-step5.mjs` shows the correct pattern.

### 4.3 One system per job

- **One toast.** Reuse `useNotification` and `.cz-toast`. Never build a second.
- **One debounce.** Reuse `useWriteThroughDraft` at 600ms, and the
  `editSavedFlash` pattern. Never write your own save timer.
- **One icon source.** Use `lucide-react`. Never hand-draw an SVG.
- **One mono stack.** `ui-monospace, SFMono-Regular, "SF Mono", Menlo,
  Consolas, monospace`.
- **One serif stack.** `Georgia, "Iowan Old Style", "Times New Roman", serif`.
  There is no `--cz-font-display` token. Do not invent one.

### 4.4 Presentation only

The mobile work changes no storage, no schema, and needs no migration. Keep it
that way. A layout task that seems to need a schema change is a task you have
misread.

---

## 5. The vibe — what this app is trying to be

Credenza is a **quiet catalogue**, not a dashboard. The reference points are a
gallery wall and a printed lookbook. Two words govern it: **editorial** and
**calm**.

What that means in practice:

- **The photo is the subject.** Chrome serves the photo. Chrome never competes
  with it. When a control must sit on an image, it goes translucent with a
  blur, never opaque.
- **Serif for names, mono for facts.** Georgia carries item titles and the
  recommended size, because those read like a caption in a catalogue. The mono
  stack carries labels, codes, and prices, because those read like a spec
  sheet. This split is the whole typographic system. Keep it.
- **Uppercase mono labels are small and tracked.** 10px, weight 700, about
  0.06em to 0.1em of tracking. They are a texture, not a headline.
- **Money green is a signal, not a decoration.** `--cz-money` marks a
  recommendation or a saving. If everything is green, nothing is.
- **Hairlines, not boxes.** Prefer a 1px `--cz-hair` rule over a filled panel.
  Weight comes from type and space, not from fill.
- **Motion is brief and physical.** 160ms to 260ms, on an ease-out curve. A
  sheet rises from the bottom edge. Nothing bounces. Nothing spins.
  **Every animation needs a `prefers-reduced-motion` kill switch.**

What to avoid: gradients under text, drop shadows used as decoration, more than
one accent color in a view, filled buttons that are not the primary action, and
any icon that repeats a word already on screen.

---

## 6. Mobile UI rules — hard floors

These are measured, not estimated. `probe-step5.mjs` enforces them.

| Rule | Value | Why |
| --- | --- | --- |
| Touch target | ≥44px | The finger, not the cursor |
| Input type size | ≥16px | Below this iOS zooms the page on focus |
| Any type size | ≥10px | Below this it is decoration, not text |
| Text contrast | ≥4.5:1 | WCAG AA |
| Icon contrast | ≥3:1 | WCAG AA non-text |

Two techniques from this session, both worth reusing:

1. **A visual under 44px can still pass.** Give the button a centered `::after`
   at 44×44 and it keeps its look while the finger gets the full target. The
   photo buttons in `DetailSheet.jsx` do this.
2. **Measure contrast on a canvas, not with a regex.** Two traps break the
   naive read. WebKit returns `oklch()` unconverted, so a digit match reads the
   L, C, and H channels as if they were R, G, and B. And `--cz-money-bg` carries
   alpha, so it must composite over its real backdrop first. Paint the backdrop,
   paint the color over it, read the pixel. `probe-step5.mjs` has the code.

---

## 7. The interaction model on a phone

This is the part most likely to get broken by a well-meaning change.

**A phone has no edit mode.** The detail sheet has no Save button and no Edit
button. Every value is its own tap target. A tap opens an inline editor in
place. The write goes through the 600ms debounce. A "Saved" chip is the only
confirmation.

Three consequences follow, and each one is load-bearing:

1. **The draft starts `null`.** `useWriteThroughDraft` skips its effect while
   the draft is null. That is what stops the sheet from writing when it opens.
   If you initialise the draft eagerly, every open becomes a save.
2. **Status bypasses the debounce.** A status tap commits immediately, and also
   mirrors into any open draft. Without the mirror, a pending 600ms write
   restores the old status a moment later.
3. **The open item is derived, not stored.** The sheet holds an id and looks the
   item up from `items` on every render. A delete, an Undo expiry, or a filter
   change then unmounts the sheet instead of rendering stale data. Never store
   the item object itself.

Desktop keeps the carousel. `useIsPhone()` at `matchMedia("(max-width: 767px)")`
gates every mobile-only branch. When you add a phone path, check the desktop
path still exists.

---

## 8. Working notes

- **The npm root is `preview/`.** Run `cd /Users/kylewensel/credenza/preview`
  first. Bash cwd does not persist between calls in this harness.
- Scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run dev`.
- Run all four before every commit. The suite is fast, about 13 seconds.
- jsdom measures nothing. A size, a color, or a layout claim needs a Playwright
  probe. There are 75 of them in `preview/scripts/`.
- The test harness exposes `window.__setMediaMatches(query, matches)` in
  `preview/test/setup.js`. Use it to fake the phone viewport.
- Dismiss the first-run intro in a test by clicking "Get started".
- Commit messages follow ASD-STE100 Simplified Technical English. So does every
  line of text Kyle reads. The full rule is in `~/.claude/CLAUDE.md`.

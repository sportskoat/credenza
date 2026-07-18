# Session Handoff — 2026-07-18 — Carousel Rebuild + Card Back Rework

Written for the next agent picking up Credenza Fashion (`~/credenza`,
branch `credenza-fashion-yupoo-carousel`). Everything below is committed and
verified; the working tree is clean. **Read
`docs/carousel-canonical-state.md` before touching any carousel code** — it
is the approved-state contract and this file only summarizes the session.

> **Later 2026-07-18 addendum:** Kyle intentionally superseded this handoff's
> “Photos button removed” rule. Every Yupoo album now routes to an external
> **More Photos** action, while the fan remains the separate in-app gallery.
> The card back also gained layered outside-click/Escape navigation, a structured
> header/scroll body/sticky edit footer, labeled Search/Theme/Edit morph controls,
> and persisted icon-only favorite stars. The current contract is documented in
> `docs/carousel-canonical-state.md`; the commit table and session notes below are
> retained as historical context.
>
> **Session recovery (same day, later):** The follow-up implementation of those
> addendum features landed in the working tree, but the multi-agent `/code-review`
> pass died mid-flight on `gpt-5.6-sol` **429 cool-downs** (Codex provider).
> Nothing was “half-coded” — the feature work and tests were already present;
> only the adversarial review + final commit were incomplete. Recovery verified
> the suite, removed leftover `console.log` noise in tests, and stopped the
> carousel container’s Escape handler from double-handling Escape (gallery +
> layered dismiss already own it). **Still uncommitted until Kyle says commit.**

## Where things stand

Branch: `credenza-fashion-yupoo-carousel`  
Last commit: `32b8613` (handoff doc only).  
**Uncommitted (post-handoff feature pack):** `credenza-fashion.jsx`,
`credenza-fashion.css`, `credenza.css`, `docs/carousel-canonical-state.md`,
`docs/session-2026-07-18-card-back-handoff.md`, `preview/test/fashion-app.test.jsx`.  
Also untracked (separate strategy work): `docs/Monetization.md`.

Branch history (newest first):

| Commit | What it did |
|---|---|
| `32b8613` | This handoff doc (card-back rework summary) |
| `08065b0` | Card back rework: flat right-spread photo previews, explicit-only cover swap, scrollable back/edit, Photos button removed, Batch tile removed |
| `c4aa584` | Wrote `docs/carousel-canonical-state.md` (the DO-NOT-REGRESS contract) |
| `08f48c2` | Rebuilt carousel as declarative CoverFlow; fixed idle-oscillation loop and invisible-card bug. **Kyle approved this visual state: "these look beautiful"** |
| `ff5be73` | (pre-session) Netlify functions under dev, Ask auth fix |

### Uncommitted feature pack (what “finish it” means)

Already implemented in the dirty tree — treat as one logical commit when Kyle asks:

1. **More Photos** — `linkButtons()` forces Yupoo → external “More Photos” / “More Photos 2…”, Buy stable-first.
2. **Layered dismiss** — `CoverFlowCard.dismissTopLayer()` via `useImperativeHandle`: bubble → discard edit → unflip. Outside `pointerdown` + capture-phase Escape.
3. **Edit chrome** — fixed header, scroll body, sticky Save/Cancel footer; back chevron is one-layer.
4. **MorphButton** — labeled Search / Theme / Edit morph controls.
5. **FavoriteButton** — persisted `favorite: boolean` (strict migrate; string `"true"` is not truthy), icon-only star, stopPropagation so it never centers/drags/flips.
6. **Tests** — fashion-app suite covers More Photos order, outside-click layers, Escape priority, batch save/discard, search morph, theme morph, favorites migrate/persist. **63 tests green.**

Files that matter: `credenza-fashion.jsx` (~7k lines, the whole app),
`credenza-fashion.css`, `preview/` (Vite workspace: tests, lint, build).
Dev server: `cd preview && npm run dev` → `http://localhost:5173` (port strict).

## Part 1 — Carousel rebuild (commit `08f48c2`, approved)

The old scroll-based carousel was replaced with a declarative CoverFlow
modeled on Amicro's `CardCoverFlow`
(github.com/Subhan-code/Amicro--Micro-transitions-), which Kyle supplied as
the reference. Full architecture, transform math, interaction table, and the
two historical bugs (idle oscillation guarded by `lastEmittedSelectRef`;
invisible card guarded by the sized `preserve-3d` wrapper) are in
`docs/carousel-canonical-state.md`. Don't re-derive them from here.

## Part 2 — Card back rework (commit `08065b0`, this session's second half)

Kyle reviewed the back of the card and requested five changes, all landed:

### 1. Photo previews spread flat to the right (no more arc fan)
`CardCornerFan` (credenza-fashion.jsx, ~line 3381) used to rotate photos
into a 90° arc on hover — Kyle called it "weird" and asked for his reference
layout instead: cover photo stays put on the left, previews slide out to its
right in a **flat row**. Implementation:
- Collapsed: previews stack behind the cover (`x = i * 2`, tiny `1.5°` per-card
  tilt so the stack reads as a stack).
- Hover: `x = i * 70`, rotation 0, cover scales to 1.04. Spring 240/22,
  `prefers-reduced-motion` collapses to `duration: 0`.
- Shows cover + 3 previews (`slice(0, 4)`) — 4 × 64px at 70px steps fits the
  ~284px back face. `+N` chip sits to the right of the stack and fades out on
  hover so it doesn't collide with the spread.
- CSS: `.cz-corner-fan` is now `width: 100%` (hover area covers the spread);
  `.cz-corner-fan-card` has fixed `64×86` size instead of `inset: 0`.

### 2. Cover image can only be changed explicitly
Previously each fan photo had its own click handler calling
`onSetPrimaryImage` — hovering + clicking silently replaced the card's cover.
Kyle: "it's very easy to change them around... when it should not be that
easy." Now:
- Clicking anywhere in the fan opens `PhotoCoverFlow` (full-screen gallery).
- The gallery's **"Use as cover"** button is the *only* path that sets the
  primary image. `onSetPrimaryImage` was removed from `CardCornerFan` and
  from `CoverFlowCard`'s props entirely; it still flows to `PhotoCoverFlow`.
- The old grid-view `Card` component (line ~2366) still has its own thumbnail
  click-to-set-cover path — untouched, Kyle only complained about the carousel.

### 3. Photos button removed, Buy moved up
The back-face actions had a redundant Photos button (the fan *is* the photos
affordance). Removed. `linkButtons(item)` output is now sorted Buy-first so
the Buy button sits directly under the photo previews. Resulting action
order: **Buy, Sizes, Seller, Edit, Remove** (+ Agent/other link buttons when
present).

### 4. Batch tile removed
- The Batch meta tile on the card back: removed.
- Batch in the front card's subtitle line: removed (subtitle is now
  `seller · size`).
- Batch is only visible/editable via the **Batch field in the edit form**
  (which already existed, line ~3700). The data field is untouched — nothing
  was migrated or deleted, it just isn't displayed on the card faces.

### 5. Scrolling fixed on card back and edit form
Root cause: the carousel's wheel handler (`CoverFlowCarousel`, ~line 4040)
calls `preventDefault()` on **every** wheel event over the carousel — that's
how one-gesture-one-card works — which blocked scrolling any flipped-card
content. Fix, first line of the handler:

```js
if (event.target.closest?.(".cz-carousel-back-content, .cz-carousel-edit")) return;
```

Plus `.cz-carousel-edit` needed `flex: 1; min-height: 0` (and bottom padding)
to be height-constrained enough to scroll at all. Verified: wheeling over the
back content scrolls it without paging the carousel or unflipping; same for
the edit form.

### Test adjustment
`preview/test/fashion-app.test.jsx` — "opens album photos in-app and requires
an explicit cover action" clicked the removed Photos button; it now clicks the
fan (accessible name **"Open photo gallery"**). The test's actual assertion —
cover changes only via "Use as cover" — is exactly the new behavior, so it
needed no other changes.

## Verification (all green at `08065b0`)

1. `cd ~/credenza/preview && npm test` → 56/56; `npm run lint` → 0 errors
   (61 pre-existing warnings, incl. one unused-directive in `credenza-v3.jsx`
   that is *not* from this session); `npm run typecheck`, `npm run build` → clean.
2. Real-browser drive (playwright-core + system Chrome, headless — no
   playwright browsers are installed; recipe in `.claude/skills/verify/SKILL.md`):
   seed localStorage key **`credenza-fashion-items-v1`** (NOT the generic
   `credenza-items-v3`) via `page.addInitScript`. Session scripts were at
   `/tmp/credenza-carousel-verify.mjs` (carousel contract) and
   `/tmp/credenza-back-verify.mjs` (card back: action order, no Batch tile,
   fan collapsed/hover x-positions, fan-click-doesn't-change-cover,
   use-as-cover-does, back + edit wheel scroll). /tmp may be cleared —
   recreate from the canonical doc's recipe if gone.

## Known loose ends (not blockers)

- Git identity is auto-generated (`kylewensel@Kyles-MacBook-Pro.local`);
  Kyle may want `git config --global user.email` set properly someday.
- Branch `credenza-fashion-yupoo-carousel` hasn't been merged/deployed
  anywhere; no remote is configured for this repo.
- From the project brief (`docs/fashion-app-brief.md`): Reddit ingestion flow
  still unbuilt.
- Dev server may still be running on :5173 from this session.

## Kyle's taste notes (so you don't re-learn them the hard way)

- AI enhances, never enables; no clutter (from the project memory).
- He gives visual references (screenshots / pasted components) — match them
  closely rather than reinterpreting.
- Destructive-ish actions (like changing a card's cover photo) must be
  explicit, never a side effect of browsing.
- When he approves a state, lock it down in writing — that's why
  `carousel-canonical-state.md` exists. Update it whenever approved behavior
  changes (this session added the wheel bail-out and fan rules to it).

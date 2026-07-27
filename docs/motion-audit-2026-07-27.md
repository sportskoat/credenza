# Motion audit — 2026-07-27

Source: full read-only inventory of `credenza-fashion.css`, `credenza.css`,
`components/*.jsx`, `credenza-fashion.jsx`, and the landing page.
Status: findings + ranked plan. No fix in this doc is approved yet — Kyle picks.

## The headline numbers

- ~24 distinct durations are in use. Three of them (140 / 150 / 160 ms) do one
  job across 81 declarations.
- Two near-identical ease-out curves split the app: `cubic-bezier(0.23,1,0.32,1)`
  (the `--ease-out` token, 124 uses) vs `cubic-bezier(0.22,1,0.36,1)`
  (29 uses, hardcoded or re-tokenized per component). They are visually
  indistinguishable.
- 57 declarations use bare `ease` — the untokenized browser default.
- Of 149 `transition:` declarations, only ~20 use a duration token.
- The exported `EASE` constant (`credenza-fashion.jsx:3138`) is the stated
  motion language and has exactly one consumer (`DigestDeck.jsx:107`).

## Ranked fixes

### M1 — One easing curve (mechanical, low risk)
Keep `--ease-out` = `cubic-bezier(0.23,1,0.32,1)` as the only ease-out.
Replace all 29 uses of `0.22,1,0.36,1` and the 3 longhand copies in
`credenza.css` (L89, L265, L307 — define the token there instead).
EXCLUDE the protected zones listed below.

### M2 — A duration scale, tokenized in one place (the LB-69 move)
Mirror the type-token pattern: define the scale once in `credenza.css` `:root`,
then add a guard test (`motion-tokens.test.js`) that fails on new hardcoded
durations. Proposed scale, mapped from what the code already means:
- `--dur-press: 120ms` (transform-only presses)
- `--dur-micro: 140ms` (hover / color micro-states; absorbs 140+150+160)
- `--dur-open: 250ms` (dropdown / modal / panel / page)
- `--dur-resize: 300ms` (exists as `--resize-dur`; keep name or alias)
- Entrances 400ms+ stay per-component but must cite a token.
Ambient loops (shimmer, 18s beams) are exempt — they are texture, not motion.

### M3 — The 10 outliers (one-line fixes each)
1. `credenza-fashion.jsx:7493` inline `background .25s` (no easing).
2. `.cz-flip-cue-icon` L5025 / `-label` L5036 — `0.15s ease`.
3. `.cz-carousel-overlay-close` L6630 — no easing at all.
4. `.cz-card-buy-hover` L6679 — `0.2s ease`.
5. `.cz-detail-dot` L9121 — `160ms ease-out` keyword (timing only; the
   coverflow dot's `transform: scaleX` property is contract).
6. `.cz-photo-coverflow-controls button` L9239 — `150ms ease`.
7. `.cz-import-source-swap` L7618 — only discrete `ease-in-out` in the app.
8. `cz-detail-fade` at L9578 / L10153 / L10241 — triplicated and not
   reduced-motion gated.
9. Two accordion timings: `.cz-detail-notes-box` L10720 (200ms) vs
   `.t-acc-panel` L4096 (250ms) on the same property.
10. `t-acc-*` L4096–4117 hardcode the literal curve inside the tokenized
    primitive layer.
(`t-like-pop`'s overshoot curve contradicts the "no bounce" language but the
heart is a Kyle-approved spec item — leave it unless Kyle says otherwise.)

### M4 — Reduced motion: adopt the landing page's universal reset
The landing has the `* { animation-duration: 0.01ms … }` reset; the app
gates only 9 named classes plus per-component blocks. Adopt the universal
reset in the app, then verify the carousel (its springs are JS-gated by
`usePrefersReducedMotion`, so they are unaffected) and the view-transition
backstop (already zeroed at `credenza-fashion.css:144-151`).

### M5 — Silent surfaces (the "more whole" work; needs taste sign-off)
These render inert beside animated siblings. Give each the entrance its
siblings already use — existing tokens only, no new physics:
- `SizeRecommendation.jsx` — no change animation when the verdict updates.
- `InfoBubble.jsx` — static, while the CSS bubble system fully animates.
- `HaulBoard.jsx` — static, while both fans spring.
- `WarehouseQcSection.jsx`, `SizeChartTable.jsx` — static tables in
  animated panels.
- `DesktopDetailPanel.jsx` — no entrance below the morph path.
- Card internals (`CardCover`, `CardFrontInfo`, `CardMetaLinks`) — inert
  while `Card.jsx` fades in around them.

## Protected — do not touch (docs/carousel-canonical-state.md)

- `CoverFlowCarousel.jsx:1136-1142` springs (260/28, 520/28), offset math,
  `rotateY ±38°`; card opacity stays `1`; no `backdrop-filter` on cards.
- `.cz-coverflow-dot::after` — animates `transform: scaleX`, never `width`;
  its reduced-motion no-transition is contract.
- `HAUL_SURFACE_TRANSITION` (`credenza-fashion.jsx:7031`) — two prior
  rewrites failed; the doc pins it.
- `runPhotoMorph` + `cz-morph-photo` — the one compliant shared-element
  transition; asserted by `preview/test/photo-morph.test.jsx`.
- `CardCornerFan.jsx:86` — flat 70px steps, no rotation (Kyle rejected arcs).
- `t-like-pop` / `t-like-burst` — approved spec; curve change needs sign-off.

## Execution shape

M1–M3 are one mechanical lane task (spec cites the protected list verbatim).
M4 is a second small task with a Playwright reduced-motion check.
M5 is a separate, Kyle-gated batch — it changes how the app feels, not just
its consistency. Guard test in M2 is what makes the fix permanent.

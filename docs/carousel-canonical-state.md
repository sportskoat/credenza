# Carousel — Canonical Working State (DO NOT REGRESS)

**Approved by Kyle: 2026-07-18.** The carousel as of commit `08f48c2` on
`credenza-fashion-yupoo-carousel` looks and behaves exactly right. If the
carousel ever "freaks out," cards go invisible, or interactions feel wrong,
diff against `08f48c2` and re-read this file before rewriting anything.

---

## Architecture (the part that must not change)

`CoverFlowCarousel` in `credenza-fashion.jsx` is a **declarative CoverFlow**:

- **One source of truth: `activeIndex`.** No scroll positions, no
  `scrollLeft`, no snap points, no measurement of transformed geometry.
  Every card's position is pure math from its offset to `activeIndex`:
  - `x = offset * (cardWidth * 0.62)`
  - `rotateY = 0` for center, `+38°` past, `-38°` upcoming
  - `z = -min(|offset| * 80, 240)`, `scale = 1 - min(|offset| * 0.08, 0.22)`
  - `opacity = max(0.52, 1 - |offset| * 0.16)` — floor keeps side cards
    readable, never melted together
  - z-order via `carouselLayerZ` (deterministic ties, no paint flicker)
- Cards animate with framer-motion springs (`stiffness 260, damping 28`);
  `prefers-reduced-motion` collapses all springs to `duration: 0`.
- Pattern source: Amicro's `CardCoverFlow`
  (github.com/Subhan-code/Amicro--Micro-transitions-), adapted to Credenza.

## The two historical bugs and their guards

1. **Idle oscillation ("back and forth freakout").** Two effects sync
   selection: `activeIndex → onSelect(id)` and `selectedId → setActiveIndex`.
   Without a guard they echo each other forever. The fix is
   `lastEmittedSelectRef`: when the carousel emits a selection it records the
   id, and the incoming `selectedId` effect ignores that echo. External
   selection (global arrow keys, grid view) still centers the carousel.
   **Never remove this ref or "simplify" the two effects into naive mirrors.**

2. **Invisible card.** `CoverFlowCard`'s outer wrapper must have
   `width/height: 100%` **and** `transformStyle: preserve-3d`. The card sits
   inside a 3D-transformed parent; a bare `<div>` wrapper collapses to zero
   size and the flip faces (`backface-visibility: hidden`) vanish.
   `.cz-carousel-card` in `credenza-fashion.css` owns the actual dimensions
   (`min(72vw, 320px) × 460px`) and `preserve-3d`; `.cz-carousel-track` owns
   `perspective: 1400px`.

## Interaction contract (all verified working — keep all of these)

| Input | Behavior |
|---|---|
| Click side card | Centers it, does **not** flip |
| Click settled center card | Flips to back face |
| Second click / Escape | Unflips; Escape also closes the photo gallery |
| ArrowLeft / ArrowRight | Global (no focus needed), one card per press |
| Trackpad wheel (either axis) | Accumulates deltas, steps exactly **one** card per gesture (110 ms quiet window, ±40 threshold) |
| Mouse/pen drag | Pans; release past 25% width or velocity 500 advances; small movements (≤4 px, ≤50 v) still count as clicks |
| Drag then release over card | Flip suppressed via `container.dataset.dragging` |
| Chevron / dot controls | Frosted pill below carousel; chevrons step, dots jump; active dot stretches with pink→cyan gradient |
| Reduced motion | No 3D springs, no dot transition |

Control-bar dots animate with `transform: scaleX`, **not** `width` —
compositor-only, keeps the impeccable design hook green.

## Companion pieces

- `CardCornerFan` — Amicro-style hover fan on the card back for gallery
  images; click opens `PhotoCoverFlow` (full-screen gallery, same offset math).
- Deps: `framer-motion` (v12), `lucide-react` (chevrons) in `preview/package.json`.

## How to verify after any carousel change

1. `cd ~/credenza/preview && npm test && npm run lint && npm run typecheck && npm run build`
2. Drive it headless (recipe in `.claude/skills/verify/SKILL.md`; storage key
   is **`credenza-fashion-items-v1`**, not the v3 generic key). The critical
   check: watch `[data-foreground="true"]` for 4 s of idle **before and after**
   interacting — zero changes is the only passing result.
3. A ready-made drive script pattern lives in git history of this session:
   seed 5 items, then test visibility → idle → keys → wheel → dots → flip →
   idle again.

## Red flags that mean someone is about to re-break it

- Reintroducing `scrollLeft` / scroll-snap / `getBoundingClientRect` for
  card positioning.
- "Cleaning up" the selection-sync effects or removing `lastEmittedSelectRef`.
- Replacing the `CoverFlowCard` wrapper div's sizing/`preserve-3d` styles.
- Animating dot `width` instead of `scaleX`.
- Making wheel step multiple cards per gesture.

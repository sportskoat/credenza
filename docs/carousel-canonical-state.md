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
  - **card opacity stays `1` always** — never animate opacity on carousel
    cards (that made the center card see-through mid-spring so neighbors
    flashed through). Side dimming is `--cz-card-side` + solid
    `--cz-card-solid` faces, not alpha.
  - z-order via `carouselLayerZ` (deterministic ties, no paint flicker);
    `zIndex` is set as a style snap, not a springed motion value
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
| Click outside the active card | Moves back exactly one layer: close info bubble → commit edit draft (write-through) and return to details → unflip to the front |
| Escape | Uses the same one-layer priority; the photo gallery owns Escape while open |
| Click inside back/edit content | Does not dismiss the current layer unless an explicit control is used |
| ArrowLeft / ArrowRight | Global (no focus needed), one card per press mid-shelf. **Wrap around** (front ↔ back of rack) is two-step: first press/swipe rubber-bands with a short edge nudge, second within ~900 ms commits the wrap. Same for chevrons / wheel / pan at the ends. |
| Trackpad wheel (either axis) | Accumulates deltas; steps **one** card as soon as |acc| crosses ~36, then **locks ~280 ms** so the gesture tail cannot multi-page while springs settle. Partial gestures that never cross the threshold clear after 140 ms quiet. |
| Wheel over flipped card's content (`.cz-carousel-back-content` / `.cz-carousel-edit`) | Scrolls that content — the carousel wheel handler bails out for those targets, never `preventDefault`s there |
| Mouse/pen drag | Pans; release past 25% width or velocity 500 advances; small movements (≤4 px, ≤50 v) still count as clicks |
| Drag then release over card | Flip suppressed via `container.dataset.dragging` |
| Chevron / dot controls | Frosted pill below carousel; chevrons step, dots jump; active dot stretches with pink→cyan gradient |
| Reduced motion | No 3D springs, no dot transition |

Control-bar dots animate with `transform: scaleX`, **not** `width` —
compositor-only, keeps the impeccable design hook green.

## Companion pieces

- `CardCornerFan` — photo previews on the card back (updated 2026-07-18):
  cover photo at the left with the rest stacked behind it; hover slides them
  out **to the right in a flat row** (70 px steps, no rotation — Kyle
  explicitly rejected the arc/rotate fan). Any click opens `PhotoCoverFlow`
  (full-screen gallery, same offset math). **Clicking a fan photo must never
  change the item's cover image** — the gallery's "Use as cover" button is the
  only path that sets the primary image.
- The fan and **More Photos** are intentionally separate photo affordances:
  the fan opens the in-app gallery, while every Yupoo album URL is normalized
  to an external **More Photos** action. Buy remains first and dominant. Neither
  path changes the cover without the gallery's explicit **Use as cover** action.
- Card faces have **no Batch tile** — Batch lives only in the edit form, and
  the edit form has **no Tags field** (removed 2026-07-18).
- The card back uses a fixed header and one scrollable body — **no Save/Cancel
  footer** (removed 2026-07-18). Edits persist via **write-through autosave**
  (700 ms debounce + flush on every exit path), so click-away/Escape/back
  never lose text. The 40px Lucide back control exits Edit to details before
  it unflips the card, sliding the sheet **down**; the header's purple
  **save-check** (same slot as the edit morph, idle Check / hover reverse-morph
  to Pen) saves and slides the sheet back **up** — the reverse of its entrance.
  Exit direction is committed with `flushSync` before unmount so
  `AnimatePresence` captures it (exit props freeze at the last pre-removal
  render).
- Each carousel/card front has an icon-only persisted **heart like-button**
  (transitions.dev spec, `#f40051`, pop + 8-particle burst, top-right in the
  same position as the card edit control). The heart is a sibling control and
  must never center, drag, or flip a card. Favoriting **never reorders** the
  shelf — sort stays newest-first by `createdAt`.
- The SIZE INFO bubble is **English-only**: fact rows and variant axes
  containing CJK (颜色 / 尺码 / …) are filtered out of `CarouselSizeInfo`.
- Search, Theme, and Edit use the shared labeled morph-button vocabulary from
  the supplied references, with keyboard-focus and reduced-motion equivalents.
- Deps: `framer-motion` (v12), `lucide-react` in `preview/package.json`.
- Shelf chrome (outside the carousel, 2026-07-18): a floating total row sits
  under the Shelf/Hauls tabs — `N saved/found/items` count on the left, a
  pill with a green (`#4ade80`) transitions.dev-style **reel counter** summing
  USD-normalized prices of the *currently displayed list* (shelf, favorites
  filter, search results, or open haul). Open hauls hide the view toolbar.

## How to verify after any carousel change

1. `cd ~/credenza/preview && npm test && npm run lint && npm run typecheck && npm run build`
2. Drive it headless (recipe in `.claude/skills/verify/SKILL.md`; storage key
   is **`credenza-fashion-items-v1`**, not the v3 generic key). The critical
   check: watch `[data-foreground="true"]` for 4 s of idle **before and after**
   interacting — zero changes is the only passing result.
3. A ready-made drive script pattern lives in git history of this session:
   seed 5 items, then test visibility → idle → keys → wheel → dots → flip →
   click-away/edit layers → More Photos → favorite/Search/Theme → idle again.

## Red flags that mean someone is about to re-break it

- Reintroducing `scrollLeft` / scroll-snap / `getBoundingClientRect` for
  card positioning.
- "Cleaning up" the selection-sync effects or removing `lastEmittedSelectRef`.
- Replacing the `CoverFlowCard` wrapper div's sizing/`preserve-3d` styles.
- Animating dot `width` instead of `scaleX`.
- Making wheel step multiple cards per gesture.
- Putting translucent glass (`backdrop-filter` / alpha card backgrounds) or
  animated `opacity` back on CoverFlow cards — that reintroduces the
  “side card flashes through the center” ghosting.

## Haul open/close transition (2026-07-19)

Opening/closing a haul from the directory grid into this carousel now uses a
plain declarative `AnimatePresence mode="wait"` crossfade (opacity + a 0.98→1
scale, ~180ms, `ease: [0.22, 1, 0.36, 1]`) between the hauls directory
(`haulDirectorySurface`) and the shelf/open-haul surface (`shelfSurface`),
both defined once in `credenza-fashion.jsx` and swapped by `key`. `mode="wait"`
was chosen over a true overlapping crossfade specifically so the directory
grid and the open-haul `CoverFlowCarousel` are never both mounted, visible,
and interactive at once — the old implementation cloned DOM nodes via
`getBoundingClientRect()`, flew them through a `createPortal` overlay to
hand-computed landing coordinates, and handed off to the real carousel via a
double-`requestAnimationFrame` + polling-retry loop. Two separate attempts to
fix that portal-morph system (by a different engineer, then by a different AI
tool) both left it visibly glitchy — marketing text and haul images
co-rendering on top of each other — which is exactly the DOM-measurement
anti-pattern this doc already warns against for the carousel itself. If this
transition is ever rewritten, do not reintroduce clone elements, `getBoundingClientRect`,
or a portal for it.

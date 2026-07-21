# Credenza Fashion — Mobile Improvement Plan

**Date:** 2026-07-22
**Inputs:** live drive of the dev build at 393×852 (Chromium) with Kyle's real 18-item
shelf; fresh WebKit/iPhone-15-Pro screenshots (`docs/mobile-shots/`, regenerated
against local dev this session); full color-token inventory + WCAG computation
(subagent report); full interactive-element census (subagent report); docs:
`Monetization.md`, `carousel-canonical-state.md`, `session-state.md`,
`settings-toggles.md`, `fashion-app-brief.md`, `V3-SPEC.md`.
**Builds on:** the 2026-07-21 six-fix mobile pass (grid columns, bottom sheets,
16px inputs, coarse-pointer fan/carousel/rAF fixes) — those all verified present;
this plan is the "fix more later" round.
**Scope note from Kyle (2026-07-22):** desktop changes are in scope too, and a
**new colorway is on the table** (see §8).

---

## 0. Verdict in three sentences

Capture and carousel browsing are genuinely good on the phone (1-tap clipboard
stash, 2-tap Buy from carousel, swipe physics with correct `pan-y`). The review
layer is where mobile breaks: the grid detail view renders crushed and clipped
inside a half-width column with the affiliate Buy button buried under photo
thumbnails, and the card-back notes are **unreachable by touch entirely** in the
view mode phones default to. Chrome priorities are inverted — a marketing hero
owns the first viewport while the pinned thumb-zone bar is spent on Theme.

---

## 1. Section findings (condensed, all claims cited)

### A. Color (full inventory in session transcript)

- **"Light" is not light.** `light` = Horizon: navy `#003973` bg, cream `#E5E5BE`
  ink (jsx:37-48). Both themes are dark-appearing; the app has no bright theme.
- **Contrast failures, both themes:** `--cz-faint`/`--cz-placeholder` = 2.92:1
  (Horizon) / 3.88:1 (Moonwalker) on card — below 4.5:1 text minimum, Horizon
  below even the 3:1 icon floor. Dozens of call sites (jsx:2468, 2904, 3921,
  4491, 6796, 7090, 8821, 9085, 9423, 9640; css:3199, 3473).
- Heart red `#f40051` on Horizon card = **2.12:1** (css:2268) — near-invisible.
- Rainbow action-button gradient bottoms at **1.78:1** under its black label at
  the `#1e3a52` stop (jsx:90-91) — CTA text can drown at one corner.
- Live no-op: `colorScheme: mode === "light" ? "dark" : "dark"` (jsx:9227).
- Dead-wrong fallback: `var(--cz-error-text, #ff7ae8)` (css:3344, 3535) matches
  neither theme's real error color.
- **Strong hygiene otherwise:** 62 `color-mix(var(--cz-*)…)` usages all follow
  the approved pattern; zero rogue colors in JSX; true `#000000` OLED base with
  moon layers kept off text surfaces; money-green `#4ade80` passes both themes.
- **V3-SPEC is formally retired as a design reference by this plan** — zero
  walnut/mustard remains; the spec predates the entire `--cz-*` theme system.
  (Replacement: write `docs/fashion-design-system.md` when the colorway lands.)

### B. Layout & one-handed use

- **Hero tax:** logo row + "Organize the haul." + 2-line tagline consume ~45% of
  the first viewport on *every* open (jsx:9296 region; shots 01/03). Zero cards
  above the fold on an 18-item shelf. A daily tool greets its owner like a
  landing page.
- **Inverted chrome:** the top-of-scroll (non-sticky) holds capture + search —
  the highest-frequency actions — while the **fixed bottom bar** (jsx:9700-9750)
  spends permanent thumb-zone slots on Theme / Agent / Import (low-frequency).
- **Carousel clipped:** on phone the carousel card renders under the fixed
  bottom bar (shot 03) — interactive card surface extends beneath Theme/Agent/
  Import taps.
- **Card header redundancy:** host/seller identity appears 3× per card (mono
  slug in header, seller link, "Saved from …" line — shot 02); mono URL slugs
  wrap up to 3 lines above every image at 2-col widths.

### C. Buttons & interaction (full census table in session transcript)

- The `pointer:coarse` 44px bump (credenza.css:410-424) exists but its selector
  allowlist **misses**: `.cz-favorite-button` (38×38, css:2236),
  `.cz-starred-filter` (32×32, css:2360), `.cz-coverflow-arrow` (~24×24,
  css:2414), `.cz-coverflow-dot` (16×12, css:2446), `.cz-morph-button`
  (36-40px, css:1874/1893), `.cz-photo-coverflow-close` (css:2618).
- `cz-tab` gets height-bumped but keeps 0 horizontal padding (css:2732) — "Hauls"
  is a text-width target.
- Dot row clips overflow past 220px with no scroll (css:2436-2442) — extra dots
  exist but are unreachable.
- Unlabeled buttons: grid card tap surfaces expose no aria-label (live drive,
  read_page showed anonymous `button` refs) — a11y debt.
- No remaining hover-gated functionality without touch fallback — the 07-21
  pass held. Carousel gesture contract needs **no internal changes** for touch.

### D. Flows (tap-counted on the live build)

| Flow | Count | Judgment |
|---|---|---|
| Capture (clipboard ready) | **1 tap** | Excellent — preserve exactly |
| Capture (typed/pasted) | 3 touches | Fine |
| Read an item's notes — carousel | 1 tap (flip) | Good |
| Read notes — grid/rows (mobile default) | **impossible by touch** (flip = F/Space only, jsx:3810-3814 + 8689) | **Broken** |
| Buy — carousel, agent set | 2 taps | Excellent for the money path |
| Buy — grid | tap → scroll crushed column → find pill below 8 thumbnails (jsx:4258 region) | **Broken-adjacent** |
| Change status — grid | 3 taps behind Edit | Weak (A3 will own this) |
| Change status — carousel | **impossible** — edit form has no findStatus control (jsx:5441-5488 vs 4372-4390) | **Broken** |
| Buy — no agent configured | Defaults to Superbuy silently (agents.js:107) | No dead-end ✓, but see Open Q6 |

- **Grid expansion is the worst surface:** expanded card renders inside its
  half-width grid column, overflows leftward clipping its own title/seller text
  (live drive screenshots), photos render as a 3-col thumb grid, Buy pill and
  destructive Remove sit at equal visual weight.
- **Agent sheet bleed-through:** the bottom sheet surface is translucent enough
  that the page's capture pill glows through option rows — Sugargoo read as
  "disabled" purely from underlying content (shot 05). Fashion-brief's own
  overlay guidance (frosted scrim / opaque surface) not applied here.

### E. What works — preserve list (reject any plan that touches these)

1. **Carousel contract** — frozen per `carousel-canonical-state.md`; its touch
   physics (`pan-y`, pan thresholds, tap-to-center vs tap-to-flip) are correct.
   Nothing in this plan modifies carousel internals.
2. **1-tap clipboard capture** and the capture pill morph.
3. **2-tap carousel Buy** — the affiliate money path at its best.
4. **Bottom-sheet modals** (≤767px) and 16px inputs from the 07-21 pass.
5. **Serif editorial titles** on cards — the identity carrier post-walnut.
6. **Brand accents:** heart `#f40051`, money green `#4ade80`, purple save-check
   (fix contrast contexts, never the colors' roles).
7. **Hearts/likes** — placement, burst, never-reorder rule.
8. **Time buckets** ("This week"), haul cost reel, FTC disclosure copy.
9. **OLED true-black base** + moons-off-text discipline.
10. **Token/`color-mix` discipline** — the colorway swap depends on it.
11. **Silent Superbuy default** (no dead-end first Buy) — pending Open Q6.

### F. Ranked problems

| # | Severity | Problem | Anchor |
|---|---|---|---|
| 1 | Breaks flow | Card-back notes unreachable by touch in mobile-default view | jsx:3810-3814, 8689 |
| 2 | Breaks flow | Grid detail = crushed half-width column, clipped text, buried Buy | jsx:3897-4738, 4258 |
| 3 | Breaks flow | No status control in carousel edit | jsx:5441-5488 |
| 4 | Breaks flow (a11y/legibility) | faint/placeholder contrast fails both themes | color report §2 |
| 5 | Annoys | Hero consumes first viewport every open | jsx:9296 region |
| 6 | Annoys | 44px coarse allowlist misses heart/star/chevrons/dots/morphs/photo-close | credenza.css:410-424 |
| 7 | Annoys | Bottom bar spends thumb slots on Theme; capture is top-anchored & scrolls away | jsx:9700-9750 |
| 8 | Annoys | Agent sheet translucency bleed-through | ModalShell surface, jsx:6660 region |
| 9 | Annoys | Carousel clipped by fixed bottom bar on phone | shot 03; carousel container padding |
| 10 | Annoys | Heart red invisible on Horizon; action-gradient dark stop | css:2268; jsx:90-91 |
| 11 | Polish | Host shown 3×/card; mono slug wraps 3 lines; "Read" label is v3 vocabulary on fashion items | card header region jsx:3897+ |
| 12 | Polish | Dot overflow clip; tab width; import file text-button; error-text fallback; colorScheme no-op; unlabeled card buttons; price-pill edge truncation | cited above |

---

## 2. The plan

### 2.1 Quick wins (each ≤ ~20 lines, independently shippable)

| QW | Change | Where |
|---|---|---|
| QW1 | Append `.cz-favorite-button, .cz-starred-filter, .cz-coverflow-arrow, .cz-coverflow-dot, .cz-morph-button, .cz-photo-coverflow-close` to the `pointer:coarse` min-size rule (use padding/hit-area growth for dots — visual size unchanged, `::after` hit-extender acceptable) | credenza.css:410-424 |
| QW2 | `cz-tab` coarse override: add `padding-inline: 14px` | credenza-fashion.css:2732 |
| QW3 | Raise `--cz-faint`/`--cz-placeholder`: Horizon → cream at ~0.68 alpha; Moonwalker → `#7f8fa0`-class value. Target ≥4.5:1 on `--cz-card-solid` | jsx:39-106 palette block |
| QW4 | `--cz-sub` headroom to ≥5.0:1 on Horizon | same |
| QW5 | Heart on Horizon: add theme-scoped `--like-halo` (thin outline/halo) or per-theme `--like-color`; keep `#f40051` on Moonwalker | css:2268 + palette |
| QW6 | Flatten `--cz-action-fill` under text on Moonwalker (or clamp gradient's dark stop ≥ `#2e5474`) so label contrast ≥4.5:1 across the full face | jsx:90-91 |
| QW7 | Fix `colorScheme` ternary (both branches "dark" → intentional single value + comment, or real branch) | jsx:9227 |
| QW8 | Fix `var(--cz-error-text, #ff7ae8)` fallbacks to match real theme values | css:3344, 3535 |
| QW9 | Agent/Import/Digest sheet surface → opaque `var(--cz-card-solid)` (+ optional backdrop blur on the scrim, not the sheet) | ModalShell styles |
| QW10 | Carousel phone clearance: on ≤767px add `padding-bottom: calc(bar-height + env(safe-area-inset-bottom))` to the shelf/carousel surface so cards never sit under the fixed bar | fashion.css carousel section (container-level, freeze-safe) |
| QW11 | Dot row: `overflow-x:auto` + `scrollbar-width:none` (or cap rendered dots at N with swipe as overflow path — Open Q4) | css:2436-2442 |
| QW12 | aria-labels on grid card toggle buttons (`aria-label={item.title}`) | jsx:3897-3910 |

### 2.2 Component-by-component changes

**C1. Grid detail → mobile detail sheet (fixes F#1 + F#2 together).**
Before: tapping a grid card expands it in-place inside its half-width column
(clipped text, thumb-grid photos, Buy + Remove pills mid-column, notes
unreachable). After, on ≤767px only: tapping a card opens the existing
bottom-sheet surface (reuse ModalShell pattern from the 07-21 pass) containing,
in order: cover image (full-width), title/seller/price row, **notes textarea
inline** (write-through autosave, same 600ms debounce the grid back already
uses — this *replaces* the unreachable flip in grid view), size/variant row,
photo strip (horizontal scroll, not 3-col thumbs), status row (see C3), and a
**pinned footer** with Buy-via-{agent} full-width primary + More Photos
secondary. Remove moves behind the sheet's ⋯ menu with an undo toast. Desktop
(≥768px) keeps in-place expansion (it has room; optionally clamp expanded card
to `grid-column: 1 / -1` later — separate decision). Grid *front* card is
unchanged. Carousel is untouched.

**C2. Hero collapse for returning users (F#5).**
Before: full hero every open. After: when `items.length > 0`, render only the
logo row with the tagline as small text (one line, muted); full hero remains
the empty-state onboarding. ~15-line conditional at jsx:9296 region — arguably
QW13, listed here because it changes first-paint identity (see Open Q2).

**C3. Status without Edit (F#3, aligned with A3 pipeline being next).**
Minimal now: port the findStatus chip radiogroup (jsx:4372-4390) into
`CoverFlowCard`'s edit fields (additive — freeze-safe, it's form content, not
carousel math) AND into the C1 detail sheet as a horizontal one-tap chip row
(not behind Edit). When A3's pipeline board ships, both inherit the same
component. Build the chip row as a shared `StatusChips` component once.

**C4. Bottom bar rebalance (F#7).**
Before: `• Local | Theme | Agent: Superbuy | Import`. After:
`Stash (primary pill) | Agent | Import | ⋯` where: Stash scrolls to top and
focuses capture (or opens capture as its own mini-sheet — implementer's
choice, spec: ≤1 tap to a focused input from anywhere); Theme moves into the
⋯/settings sheet per `settings-toggles.md` ("move Theme into Settings so the
capture bar stays about capture" — same logic for the bottom bar); the
unlabeled Local dot gets a label inside ⋯ too. Agent keeps its slot (money
path). Import keeps its slot until A3 lands, then reassess.

**C5. Card front header cleanup (F#11).**
Before: `[favicon] Read [mono host slug ·wraps 3 lines·] · date` + seller link
+ "Saved from host." After: `[platform mark] [Yupoo|Weidian|Reddit|category]
· date` on one line (label from platform/category, not v3's "Read"); seller
link stays (it's the identity line); drop "Saved from …" on ≤767px entirely
(it duplicates the seller link's host). Price pill: `right: 8px` inset so it
never clips at the card edge.

### 2.3 Interaction model statement (for the implementer)

- **Notes on touch:** grid/rows never flip on mobile — notes live inline in the
  C1 sheet. The 3D flip remains a carousel-only gesture on touch (tap centered
  card), and a keyboard shortcut (F/Space) everywhere. No long-press flips, no
  new gestures.
- **Buy placement rule:** on any detail surface, Buy is the pinned, full-width,
  bottom-most action (thumb zone), styled with `--cz-action-fill`; nothing
  destructive within 44px of it; affiliate params attach at open time only
  (unchanged A2 contract).
- **Destructive actions:** never a bare pill beside primary actions on mobile —
  behind ⋯ + undo toast (v3-generic already has the undo pattern; port it).
- **Carousel:** swipe/tap contract untouched; chevrons/dots become comfortably
  tappable via QW1 but remain secondary to swipe.

### 2.4 What NOT to change

The preserve list in §1E, verbatim, plus: no view-mode removal (grid default on
phone stays), no new gesture vocabulary, no carousel internals, no capture-flow
changes beyond relocating its entry point, and nothing that touches the
Monetization guardrails (no W2C surfaces, affiliate handoff semantics
unchanged, disclosure copy stays).

### 2.5 Sequenced implementation steps (each independently shippable + verifiable)

| Step | Contents | Est. | Verify |
|---|---|---|---|
| S1 | QW1, QW2, QW11, QW12 (CSS/aria batch — no logic) | ½ day | tap-target sweep in WebKit harness; axe pass |
| S2 | QW3-QW8 (token/contrast batch) | ½ day | contrast table recomputed ≥ thresholds; both themes screenshotted |
| S3 | QW9, QW10 (sheet opacity + carousel clearance) | ½ day | shots 03/05 re-taken, no bleed/clip |
| S4 | C2 hero collapse | ½ day | first-paint shot shows cards above fold |
| S5 | **C1 detail sheet** (the big one) + C5 header cleanup | 2-3 days | flows (b)(d) re-tap-counted: notes ≤2 taps, Buy ≤2 taps from grid |
| S6 | C3 StatusChips (carousel edit + detail sheet) | 1 day | status change ≤2 taps in every view |
| S7 | C4 bottom bar rebalance | 1 day | capture reachable ≤1 tap from any scroll depth |
| S8 | **Colorway** (§8): mockups → Kyle picks → PALETTES swap + S2 acceptance re-run on the new tokens, desktop + mobile | mockups now; swap ½ day after pick | full theme screenshot set, contrast table clean |

S1-S3 can ship this week without design decisions. S5 is the only multi-day
item and is isolated from the carousel. Steps map cleanly onto implementer
lanes; each cites its anchors above. Run
`npm test && npm run lint && npm run typecheck && npm run build` +
`node scripts/mobile-shots.mjs http://localhost:5173` per step.

---

## 3. Open questions for Kyle (answer before the flagged steps)

1. **Colorway (gates S8):** replace both themes, or keep Moonwalker and replace
   Horizon? And direction — I'll bring 3-4 visual mockups (true-black
   streetwear / cream-paper editorial / warm charcoal / current-plus-fixes) so
   you pick by eye, pre-checked against the contrast table.
2. **Hero (gates S4):** OK to reserve the full "Organize the haul." hero for
   the empty shelf only? It's the app's best marketing moment but pays a 45%
   viewport tax on every daily open.
3. **Card type labels (S5):** replace v3's "Read" with platform/category
   ("Yupoo", "Weidian", "Shorts"…)? Which vocabulary do you want on cards?
4. **Dots (S1):** scrollable overflow or cap at ~8 with swipe as the overflow
   path?
5. **Remove (S5):** ⋯-menu + undo toast acceptable, or do you want a confirm
   dialog instead?
6. **Silent Superbuy default (no code change proposed):** currently first Buy
   opens Superbuy without the user ever choosing. Monetization doc §3.1 allows
   a soft default with visible "change anytime," but the *sheet* is where that
   disclosure lives and a first-time buyer may never open it. Want a one-time
   inline "Opens in Superbuy — change?" hint on first Buy? (FTC-cleanliness
   call, your risk posture.)

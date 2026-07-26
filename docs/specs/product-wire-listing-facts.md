# Product wire checklist — listing-facts.js

**Status:** Ready when product UI is free. Do not land mid-gallery.  
**Date:** 2026-07-25  
**Pure module:** `listing-facts.js` (committed, 35 tests green)  
**Spec:** `docs/specs/richer-item-facts.md`  
**Style:** ASD-STE100

---

## Goal

Customer pastes a FashionReps haul. Each card keeps a human name, a photo, a price, a color run, a size run, and a size chart when the listing has one.

---

## Slice A — Title (highest customer pain) — LANDED 2026-07-25

**Bug:** Direct Weidian resolve overwrites a Reddit label with a SKU.

**Landed in** `credenza-fashion.jsx`:

1. Import `preferCardTitle`, pure `shouldReplaceFashionTitle`, colorway + weight helpers.
2. Local `shouldReplaceFashionTitle` re-exports pure policy.
3. Direct resolve path passes `preserveTitle: !shouldReplaceFashionTitle(...)`.
4. Merge uses `preferCardTitle` so human labels beat SKUs.
5. Also fills empty `colorway` from variants and `weightGrams` from note text.

### Acceptance (still probe live after deploy)

1. Paste: `Fourth3Ex Punk Wiener Longsleeve\nhttps://weidian.com/item.html?itemID=7777810977`
2. After enrich, title is still the Reddit label (not `L29735-H64`).
3. Bare link with only SKU may become Claude English title when Claude returns one.
4. Manual rename is not replaced by a SKU.

---

## Slice B — Colorway + size run cells

**Bug:** API has Size/Color variants; SIZE · FIT and COLORWAY stay `—`.

### Steps

1. Import `pickColorwayFromVariants`, `pickSizeRunFromVariants`.
2. After resolve sets `variants`, if `colorway` is empty, set:
   ```js
   colorway: pickColorwayFromVariants(variants) || x.colorway
   ```
3. For size display when `size` is empty:
   - Do **not** invent a chosen size.
   - Option (product choice): put size run in `sizeNotes` one-liner, or show run in the SIZE cell as `S–XL` until the user picks.
4. `migrateItem` already has `colorway` and `size`. No whitelist change if you only fill those.

### Acceptance

1. Weidian item with Color + Size axes shows a colorway string and a size run.
2. User-picked size still wins over the run.

---

## Slice C — Weidian size chart photos — LANDED 2026-07-25

**Bug:** Chart is a photo; chart-vision rejected non-Yupoo hosts.

**Landed:**

1. `chart-vision.js` allowlist: Yupoo + geilicdn + alicdn (SSRF tests expanded).
2. `SizeRecommendation.jsx` silent hunt uses resolved gallery CDN URLs when there is no Yupoo album.
3. Pure `isAllowedChartImageHost` defaults to Weidian-on.

### Acceptance (probe live after deploy)

1. Open a Weidian card with a size-chart photo in the gallery and a body profile.
2. `sizeNotes` gains labeled chart lines; recommendSize can pick a letter.
3. Yupoo path still green.

---

## Slice D — Taobao resolve (separate)

See `docs/specs/empty-taobao-cards.md`. Do not mix with Slice A unless time is free.

---

## Gate

1. Pure tests: `npx vitest run preview/test/listing-facts.test.js`
2. Full suite + lint + typecheck + build from `preview/`
3. Deploy only from `preview/` with `npx netlify deploy --prod --dir=dist`
4. Session-state note
5. Live probe: haul paste with mixed Weidian + Taobao

---

## Out of scope

1. Full HTML scrape of 购前说明
2. W2C marketplace
3. Fighting K3 dirty `reddit-haul.js`

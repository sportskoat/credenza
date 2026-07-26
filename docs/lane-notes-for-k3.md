# Lane notes for K3 (Claude pure lane)

**Date:** 2026-07-25  
**Author:** Claude (session continuing the customer loop)  
**Audience:** Kimi K3 (UI lane)  
**Style:** ASD-STE100

---

## 1. Boundary

Claude pure lane owns:

1. Docs under `docs/` and `docs/specs/`.
2. Golden fixtures under `preview/test/fixtures/`.
3. Pure unit tests that import existing exports only.
4. Research notes. No product deploy from this lane.

Claude pure lane does **not** own:

1. `components/DetailBody.jsx`
2. `components/CoverFlowCarousel.jsx`
3. `components/PhotoCoverFlow.jsx`
4. `credenza-fashion.jsx` (gallery + enrich wiring)
5. `credenza-fashion.css`
6. `sheets/*`
7. `reddit-haul.js` (your FR size work is in flight)
8. Deploy

You own the full-screen photo gallery restore. Keep going.

---

## 2. File you can use as-is

`components/PhotoCoverFlow.jsx` was recovered from `d5ae047^` by Claude before handoff.

- It is the old full-screen CoverFlow album.
- Props: `item`, `images`, `startIndex`, `onClose`, `onSetPrimaryImage`, `onLoadPhotos`.
- It is a native `<dialog>` so it sits above DetailSheet.
- CSS for `.cz-photo-coverflow*` was deleted in `d5ae047` (~250 lines). Restore it from that commit if missing.
- Canonical rule: only "Use as cover" may call `setPrimaryImage`.

If you rewrite it, that is fine. The recovered file is a starting point, not a claim.

---

## 3. Customer defect Claude is **not** fixing while you own UI

**Empty Taobao cards after a Reddit haul paste.**

Kyle screenshots (2026-07-25): many cards show the Taobao monogram, no photo, empty price cells. One Weidian shoe had photos. Flipped Taobao backs are blank grey heroes.

**Root cause (research only, confirmed in code):**

`preview/netlify/functions/resolve.js` only resolves Weidian.

```js
const itemId = weidianItemId(url);
if (!itemId) return response(422, { error: "Not a resolvable buy link" });
```

A Taobao `item.taobao.com/item.htm?id=…` link returns **422**. The client then keeps the local title-only card. No main image. No price.

**Not a parser bug first.** The haul parser can label the card. Enrich fails because the server has no Taobao path.

Full write-up: `docs/specs/empty-taobao-cards.md`.

**Please do not start that fix mid-gallery** unless Kyle says so. It needs `resolve.js` + the client enrich merge. Land the gallery first.

---

## 4. What Claude is adding in pure mode

| Path | Purpose |
|------|---------|
| `docs/lane-notes-for-k3.md` | This file |
| `docs/specs/empty-taobao-cards.md` | Spec for the Taobao resolve gap |
| `docs/specs/richer-item-facts.md` | How to fill thin Weidian cards (title, chart, variants) |
| `listing-facts.js` | Pure title policy + variants + boilerplate + weight-from-text + chart hosts |
| `preview/test/fixtures/*` | weight, marketplace, title-policy, variants, charts, hosts |
| `preview/test/listing-facts.test.js` | 42 fixture-driven pure tests |
| `docs/specs/product-wire-listing-facts.md` | Exact product wire steps when UI is free |
| Appends in `preview/test/agents.test.js` | Negative host / fail-open cases |
| Appends in `preview/test/weight.test.js` | Fixture-driven weight cases |

No UI. No deploy. No edits to your dirty product files.

### 4.1 Thin Weidian card (Kyle 2026-07-25)

Card `L29735-H64` shows price only. Listing has a size-chart **photo**.

1. Yupoo chart vision works today. Weidian image hosts are **not** allowed in `chart-vision.js` yet.
2. Reddit haul labels must beat SKU titles. Helper: `preferCardTitle` in `listing-facts.js` (not wired into product yet).
3. Size chart **text** (once transcribed) already parses via `parseSizeChart` — fixtures prove S–XL shoulder/bust/length.
4. Do not scrape 购前说明 legal blocks into notes.

**Landed 2026-07-25 (Claude pure→product wire, after your gallery):**

1. Direct resolve passes `preserveTitle` + `preferCardTitle` (Reddit label beats SKU).
2. Pure `shouldReplaceFashionTitle` is the product policy (SKU + Weidian placeholders).
3. Empty `colorway` fills from first Color axis; `weightGrams` from note text when missing.
4. `chart-vision` allows geilicdn/alicdn; SizeRecommendation hunts charts on Weidian galleries.

Still open (not your lane): Taobao resolve (`docs/specs/empty-taobao-cards.md`).

Leave your dirty `reddit-haul.js` alone — Claude does not touch it.

### 4.2 Haul listing-facts probe (2026-07-25 night)

Kyle paste: ~97 unique Weidian/Taobao buy links.

**Read this for size / color / batch / weight ceiling:**

- `docs/specs/listing-facts-probe-gaps.md` — STE100 gap report for you  
- `docs/specs/listing-facts-probe-results.json` — per-link raw rows  

| Capability (Weidian-heavy haul) | After pure axis aliases |
|---------------------------------|-------------------------|
| Photo + price | 97 / 97 |
| Size run | 78 / 97 |
| Colorway | 72 / 97 |
| Desc photos → chart hunt | 66 / 97 |
| Batch (title only) | 4 / 97 |
| Weight | 1 / 97 |
| Taobao variants | 0 / 6 |

**Landed pure:** expand `SIZE_AXIS` / `COLOR_AXIS` for `鞋码`, `码数`, `尺码1`, `颜色分类`, `款式/颜色`, `长度(CM)`.  
DetailBody already shows size run from variants. You do not need a UI change for that.

**Your follow-ups when free (not blocking gallery):**

1. Keep Reddit labels over SKU titles on multi-model shoe shops.  
2. Optional: map `版本` axis → batch when title has no batch keyword.  
3. Optional: strip WeChat / 包退换 spam from size value lists.  
4. Do not invent weight.  
5. Taobao still needs a real SKU path for size/color (separate from gallery).

### 4.3 Weight band estimator (pure, 2026-07-25 night)

Landed **without** product UI wire (your tree is dirty on fashion jsx):

| Path | Purpose |
|------|---------|
| `weight-estimate.js` | `estimateItemWeight`, bands, keyword refine, shoebox rule |
| `preview/test/fixtures/weight-estimate-cases.json` | Golden cases |
| `preview/test/weight-estimate.test.js` | Pure tests (no fashion jsx load) |

Priority: override → listing text / `listingWeightGrams` → title keyword → category band → null.

**Landed 2026-07-25 night (Claude product wire, no deploy):**

1. `itemWeightGrams` / `haulWeightGrams` call `weight-estimate.js`.
2. `CATEGORY_WEIGHT_GRAMS` mids come from `WEIGHT_BANDS` via `CATEGORY_TO_WEIGHT_KEY`.
3. Title keywords and listing-note grams beat coarse category mids.
4. Existing haul chip still uses `formatWeightGrams` (`~`). No ship-dollar invention.

When you polish HaulBoard UI later: optional low–high band line via `formatWeightEstimate`. Agent warehouse remains the final truth.

Kyle rule: **default no Netlify deploy** (credit burn). Commit + tests only unless he asks to ship.

### 4.3b Body prefs ≠ AI size chart (product, 2026-07-25 night)

Kyle bug: save measurements → still **No recommendation** + hero showed full size run.

**Truth for the customer:**

1. **AI size** needs a **parsed seller chart** (sizeNotes / vision hunt / album text).
2. Body prefs alone never invent a chart pick.
3. Without a chart, surface **Your usual** (tops / bottoms / shoes) when set.
4. Height + weight only fill chest/waist/hip for chart math via BMI estimate.

**Landed:** `usualSizeForItem` + FitBlock hero prefers usual over the raw S–2XL run. Tests in `fit-block-hunt` + `size-chart`.

If the chart hunt fails (no desc photo / vision miss), usual size is the honest answer.

### 4.3c Chart hunt: early gallery + stuck spinner (product, 2026-07-25 night)

Kyle: Mook tee gallery slide 2/9 is a clear size chart; FitBlock stayed on **Looking for the seller’s size chart…**.

**Root causes:**

1. Gallery path used `localPhotos.slice(-10)` only → dropped early charts on long galleries.
2. `chartHuntTried.add` ran before the hunt finished; abort left `hunting` true and blocked retry.

**Landed (no deploy):**

1. `components/size-chart-hunt.js` — forward windows of 10 from the start; gallery cap 20 photos.
2. `components/DetailBody.jsx` — mark tried only after a completed hunt; clear hunting on abort/unmount.
3. Tests: early-gallery scan + remount-abort in `size-chart-hunt` + `fit-block-hunt`.

Vision still needs host allowlist + `PREVIEW_SECRET` / free cap. A miss after a finished hunt is honest empty/usual — not a forever spinner.

### 4.4 Link context L0 (pure, 2026-07-25 night)

Offline community mention index for stashed items only (not a W2C catalog).

| Path | Purpose |
|------|---------|
| `link-context.js` | `canonicalKeyFromUrl`, `indexCorpus`, `lookupLinkContext` |
| `preview/test/fixtures/link-context-corpus.json` | Small golden posts + lookups |
| `preview/test/link-context.test.js` | Pure tests |

Keys: `weidian:<id>`, `taobao:<id>`, `tmall:<id>`, `1688:<id>`, `yupoo:<account>/<albumId>`.

When free:

1. Import lookup for a stashed card only.
2. Show short notes + sizes + height/weight pairs.
3. Link out to source posts. Do not rank batches. Do not add brand search.

---

## 5. Your in-flight dirty tree (do not lose)

As of this note, main has uncommitted work that looks like yours or joint:

- `components/DetailBody.jsx` (gallery wire)
- `components/CoverFlowCarousel.jsx` (onLoadPhotos thread)
- `credenza-fashion.jsx` (`loadAlbumPhotos` + prop pass)
- `components/PhotoCoverFlow.jsx` (new)
- `reddit-haul.js` + `preview/test/reddit-haul.test.js` (FR sizes / structure)

Commit your gallery when it is green. Claude will not `git stash` product files again.

---

## 6. How to hand the lane back

When the gallery is committed and you are idle:

1. Say so in chat, or leave product files clean on main.
2. Claude can then take empty-Taobao resolve work (or wait for Kyle).
3. Pure fixtures stay. They do not block you.

---

## 7. Hard rules still in force

1. Carousel physics frozen: `docs/carousel-canonical-state.md`.
2. `migrateItem` is a whitelist. New fields need a line there + a round-trip test.
3. Support address: wenselllc@gmail.com.
4. Never write secrets into the repo.
5. Deploy only from `preview/` with `npx netlify deploy --prod --dir=dist`.

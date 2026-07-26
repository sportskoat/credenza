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
| `listing-facts.js` | Pure title policy + variant display + boilerplate filter |
| `preview/test/fixtures/*` | weight, marketplace, title-policy, variants, charts |
| `preview/test/listing-facts.test.js` | Fixture-driven pure tests |
| Appends in `preview/test/agents.test.js` | Negative host / fail-open cases |
| Appends in `preview/test/weight.test.js` | Fixture-driven weight cases |

No UI. No deploy. No edits to your dirty product files.

### 4.1 Thin Weidian card (Kyle 2026-07-25)

Card `L29735-H64` shows price only. Listing has a size-chart **photo**.

1. Yupoo chart vision works today. Weidian image hosts are **not** allowed in `chart-vision.js` yet.
2. Reddit haul labels must beat SKU titles. Helper: `preferCardTitle` in `listing-facts.js` (not wired into product yet).
3. Size chart **text** (once transcribed) already parses via `parseSizeChart` — fixtures prove S–XL shoulder/bust/length.
4. Do not scrape 购前说明 legal blocks into notes.

When the product lane is free, wire:

1. `preferCardTitle` into resolve merge (keep haul label over SKU).
2. `pickColorwayFromVariants` / `pickSizeRunFromVariants` into SIZE · FIT / COLORWAY empty states.
3. Extend chart-vision host allowlist for Weidian CDNs **with** SSRF tests.

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

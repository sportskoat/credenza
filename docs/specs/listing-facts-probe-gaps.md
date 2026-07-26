# Spec — Haul listing-facts probe (size / color / batch / weight)

**Status:** Live probe complete. Pure axis aliases landed.  
**Date:** 2026-07-25 (probe run 2026-07-26 UTC)  
**Audience:** Kimi K3 + Claude pure lane  
**Style:** ASD-STE100 for prose Kyle reads.  
**Raw data:** `docs/specs/listing-facts-probe-results.json`  
**Method:** Same Weidian + Taobao extract as production `resolve.js`  
(`itemTitle`, fen prices, `attrList`, desc via `{ vItemId }`).  
No Claude vision in this probe. `chartHuntPossible` = desc photos exist for FitBlock hunt.

---

## 1. Short answers for Kyle

| Question | Answer |
|----------|--------|
| Can we parse **sizing** from real haul Weidian links? | **Yes for most apparel and many shoes.** 78 / 97 after axis aliases. |
| Can we parse **color**? | **Yes for most apparel.** 72 / 97 after axis aliases (`colorway` filled). |
| Can we parse **batch**? | **Weak.** Title regex only. 4 / 97 (GX, LJR). |
| Can we parse **weight**? | **Almost never from the SKU API.** 1 / 97 (title `230g`). |
| Can FitBlock **hunt charts**? | **Often.** 66 / 97 Weidian items had desc photos (`getDetailDesc` + `vItemId`). |
| Taobao? | Photo + weak price from world.taobao HTML. **No size, color, desc photos, batch, or weight.** |
| Yupoo-only / text-only rows in the paste? | Not in this 97-link buy-URL set. They need Yupoo album resolve + Reddit labels. |

**How far can we take this today (Weidian, after resolve):**

1. Photo, price, stock — strong.  
2. Size run + colorway from `attrList` — strong for apparel with standard axes.  
3. Desc photos for chart vision — strong when the seller posts them.  
4. Batch — title keywords only.  
5. Weight — title / notes text only; API almost empty.  
6. Taobao — thin monogram fix is live; variants still missing.

---

## 2. Probe totals (97 unique buy links from Kyle’s haul paste)

Post-alias totals (after `SIZE_AXIS` / `COLOR_AXIS` expand in `listing-facts.js`):

| Capability | Count | Rate |
|------------|------:|-----:|
| Resolve ok | 97 | 100% |
| Photo | 97 | 100% |
| Price (CNY) | 97 | 100% |
| Size axis | 78 | 80% |
| Colorway filled | 72 | 74% |
| Desc images (chart hunt possible) | 66 | 68% |
| Batch hint in title | 4 | 4% |
| Weight | 1 | 1% |
| SKU-like title | 22 | 23% |
| Weidian | 91 | — |
| Taobao | 6 | — |
| Full set: size + color + price + desc | 50 | 52% |

Pre-alias size was 72; colorway-equivalent was ~69.  
Alias recoveries: `鞋码`, `码数`, `尺码1`, `颜色分类`, `款式/颜色`, `长度(CM)`.  
First bad probe used wrong field names. This file uses the **production** mapping.

---

## 3. What works today (do not rebuild)

### 3.1 Weidian SKU API (`getItemSkuInfo`)

| Field | Source | Customer use |
|-------|--------|--------------|
| Title | `itemTitle` | Card title (often Chinese or SKU) |
| Price | `itemDiscountLowPrice` / 100 (fen) | Price cell |
| Photo | `itemMainPic` + attr imgs | Hero / gallery |
| Variants | `attrList` → `attrTitle` / `attrValue` | Size run, colorway |
| Stock | `itemStock` | Optional |

### 3.2 Weidian desc photos (`getDetailDesc`)

- Param must be `{ vItemId: itemId }` (not `itemId`).  
- Type-2 URLs → `descImages` → FitBlock chart hunt + Product Details.  
- 66 / 97 items returned ≥1 desc photo in this haul.

### 3.3 Pure helpers (`listing-facts.js`)

- `pickSizeRunFromVariants` / `pickSizeValuesFromVariants`  
- `pickColorwayFromVariants`  
- `extractWeightGramsFromText`  
- Title policy (`preferCardTitle`, `isSkuLikeTitle`)  
- Chart host allowlist

### 3.4 Taobao / Tmall (`world.taobao` HTML)

- Title + main image from og tags (works).  
- Price sometimes appears as ¥ in HTML (probe saw ¥50 placeholders often).  
- **No `attrList`.** No size/color. No desc images in this path.

### 3.5 1688

- Landed in resolve via detail page og + JSON-LD.  
- Not in this haul sample.

---

## 4. Gaps for K3 (reference next time)

### Gap A — Seller axis titles (pure; Claude landing)

Old matchers only:

- Size: `size|尺码|尺寸|사이즈|サイズ`  
- Color: `color|colour|颜色|顏色|カラー|색상`

**Missed real titles in this haul:**

| Axis title | Role | Example labels |
|------------|------|----------------|
| `鞋码` | shoe size | Dior b30, Dior b22 |
| `码数` | size count | Prada cups, Gallery Dept T-shirt |
| `尺码1` | size + typo | Birkenstock |
| `颜色分类` | color category | RHUDE shorts |
| `款式/颜色` | style/color | Prada cups, Golden goose |
| `长度(CM)` | belt length | LV belt |

**Do not** map bare `款式`, `版本`, `型号`, `序号` as size or color. Those mix models and batch.

**Fix:** expand `SIZE_AXIS` / `COLOR_AXIS` in `listing-facts.js` + fixtures.  
DetailBody already uses pure size-run helpers. Enrich already uses `pickColorwayFromVariants`.

### Gap B — Taobao has no variants (medium; resolve)

All 6 Taobao IDs in the paste: photo yes, price weak, **size/color/desc no**.

Needs a real Taobao SKU/detail source (or mobile H5 JSON), not og-only HTML.  
Client already treats Taobao as resolvable. Server still thin.

### Gap C — Weight (hard)

| Source | Status |
|--------|--------|
| Weidian `multiItemWeight` | Almost never useful in this haul |
| Title / notes grams | Works when text has `230g` style |
| Size-chart vision | Not weight |
| Seller “shipping weight” in desc text | Not scraped |

**Customer path:** Reddit/haul notes + manual edit. Do not invent grams.

### Gap D — Batch (weak)

Title regex hits: `GX`, `LJR`, and similar.  
Real batch often lives in:

1. A `版本` axis (value only, not mapped to batch field today).  
2. Multi-item “Link1 / Link2” catalogs.  
3. Seller album notes / Yupoo.

**K3 option:** map `版本` axis first value → batch when title has no batch keyword.  
Do not invent.

### Gap E — SKU titles (product + Claude title)

22 / 97 titles look like `SK01-03011` or bare codes.  
Reddit haul labels must win (`preferCardTitle` / `shouldReplaceFashionTitle`).  
Claude enrich title rewrite still needed when the paste has no human label.

### Gap F — Chart vision cost / coverage

- 66 items had type-2 desc photos in the first probe → FitBlock can hunt.
- **Fixed 2026-07-26:** resolve also reads **type 13** albums (`itemDetailImgAlbum.albumImgList[].thumbnail`).
  Live re-check on the 25 empty Weidian rows: **21 recovered** (≈87 / 91 Weidian now have desc photos).
  Still empty (no type-2/13, Yupoo text only): Travis Scott Low Dunks GX, CDG AF1 GX, Nike P-6000 Anthracite, ASICS Gel-Kayano 14.
- Vision is on-demand, not free.
- Probe did **not** call vision; it only flags hunt possible.
- 6 Taobao rows still have no desc photos (separate anti-bot gap).

### Gap F0 — (superseded note) type-13 was the 1/3 miss

First probe said 31 / 97 had no desc images. Root cause was **not** missing charts on the seller side for most cases. Resolve only accepted `desc_content` **type 2**. Multi-model shoe shops put photos in **type 13**. Landed in `resolve.js` `descImageUrls`.


### Gap G — Accessories with no size axis (expected empty)

Belts/necklaces/hats/socks/cases often have no clothing size.  
Empty SIZE · FIT is correct unless length/fit axes exist (Gap A covers belt length).

### Gap H — Yupoo-only / text-only haul rows

Not in the 97 buy-URL probe.  
Customer still pastes Yupoo albums and “no link” lines.  
K3: keep Reddit label; resolve Yupoo gallery; do not force Weidian fields.

---

## 5. Per-gap label lists (pre-alias probe)

### 5.1 No size axis after aliases (19)

Chrome Hearts belt, Chrome Hearts Necklace, Chrome Hearts Pants Chain, Hell Star Hat, Rimowa Case, Hermès belt, Oakley Glass, Nike sock, Armani sock, Nike zoom, Nike Kobe, Air force One, Stussy shorts/jorts TB, chrome tee TB, Supreme MM6 boxlogo zip TB, black jeans TB, supreme x cdg longsleeve TB, travis scott x ap tee TB, Supreme Socks 4-Pack.

**Recovered by aliases:** LV belt, Dior b30/b22, Prada cups, Birkenstock, Gallery Dept T-shirt.  
**Remain empty:** pure accessories + all 6 Taobao + multi-model shoe catalogs with only model axes (`NK`, `DIR`).

### 5.2 No colorway after aliases (25)

Multi-model shoes with `款式` only, some apparel without a color axis, accessories, all 6 Taobao, socks/cases.  
**Recovered:** RHUDE (`颜色分类`), Prada / Golden goose (`款式/颜色`).

### 5.3 Weight (96 missing)

Only ESSENTIALS T-shirt title carried grams in this set.

### 5.4 Batch (93 missing)

Hits: Jordan 4 black cat (GX), Prada cups (LJR), Travis Scott Low Dunks GX, CDG AF1 GX.

---

## 6. Work split

| Work | Owner | Notes |
|------|-------|-------|
| Axis alias expand in `listing-facts.js` | Claude pure | Landed with this probe write-up |
| Keep Reddit labels over SKU resolve titles | Already pure + product | Verify on SKU-heavy shops |
| FitBlock chart hunt on `descImages` | Product / K3 UI | Live path; do not break |
| Taobao real SKU/variants | Resolve (either lane with care) | Spec: `empty-taobao-cards.md` still open for price reliability + variants |
| Batch from `版本` axis | Pure optional | Small helper; wire on enrich merge |
| Weight from notes only | Keep | No fake grams |
| Vision batch OCR of desc charts | On demand | Cost-aware; not this probe |
| Dirty `reddit-haul.js` | **K3 only** | Claude does not touch |

---

## 7. Sample strong Weidian card (ESS set)

- Title: 新复线短裤ESSENTI运动短裤套装  
- Price: ¥168–175  
- Size run: S–XL  
- Colorway: many FG* color names  
- Desc images: 19 → chart hunt possible  
- Gaps: weight, batch  

That is the customer ceiling for a good Weidian apparel link **without** vision.

---

## 8. Sample weak Taobao card

- Photo yes  
- Title truncated Chinese og  
- Price often ¥50 noise  
- No size, color, desc, weight, batch  

Customer still needs a human Reddit name and manual size notes until Taobao variants land.

---

## 9. Extra quality notes (size values)

1. Some size axes include seller spam values (WeChat ids, “包退换”). Filter those before display if needed.  
2. Some shoe size values pack many sizes into one option string. Size run becomes ugly. Prefer first/last clean tokens later.  
3. Gallery Dept `码数` values include contact spam — pure filter candidate.

---

## 10. Definition of done for this probe

1. [x] 50+ real haul buy links probed with production extractors.  
2. [x] Totals for size / color / batch / weight / chart-hunt / photo / price.  
3. [x] Gap doc for Kimi at this path.  
4. [x] Raw JSON at `listing-facts-probe-results.json`.  
5. [x] Pure axis aliases for known miss titles + fixtures (46 tests green).  
6. [x] Re-score totals after alias land.  
7. [ ] Optional: batch-from-版本 pure helper.  
8. [ ] Optional: strip spam tokens from size values.  
9. [ ] Optional: Taobao SKU path (separate spec).

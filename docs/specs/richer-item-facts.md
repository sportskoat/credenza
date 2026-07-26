# Spec — Get more facts onto every card

**Status:** Research + plan. Pure layer.  
**Date:** 2026-07-25  
**Kyle case:** Weidian `itemID=7777810977` → card title `L29735-H64`, price only. No color, size chart, weight, or human product name. Listing page has a size table photo (S/M/L/XL × shoulder/bust/length) and long legal boilerplate.  
**Related:** `docs/specs/empty-taobao-cards.md`, `docs/lane-notes-for-k3.md`, `docs/pure-layer-exhaustiveness-plan.md`  
**Style:** ASD-STE100 for prose Kyle reads.

---

## 1. Short answers

| Question | Answer |
|----------|--------|
| Can we read Weidian + Yupoo size chart **tables**? | **Yes for Yupoo photos today** (`chart-vision`). **Not for Weidian photos yet** (host allowlist is Yupoo-only). |
| Can we use the big legal block ("购前说明")? | **No value.** That is store policy boilerplate. Drop it. |
| Why is the card only price + SKU? | Resolve got price + SKU title. Claude title rewrite did not produce a human name (or was not applied). Size chart lives in a **photo**, not in the SKU API text. Color/size variants may exist in the API but do not fill the SIZE · FIT / COLORWAY cells by themselves. |
| Should the shirt name come from Reddit comments? | **Yes when the haul paste or post has a label.** That path exists. Resolve must **not** replace a good Reddit label with a bare SKU. |
| How hard is "more info per parse"? | Layered. Some wins are **small pure fixes**. Charts from photos are **medium** (vision). Taobao is a **separate** gap. Full page HTML scrape is **hard and fragile**. |

---

## 2. What the customer sees vs what the listing has

### 2.1 Card (Kyle screenshot)

- Title: `L29735-H64` (seller SKU)
- Price: `$36.69` (from ¥249 — resolve worked for Weidian price)
- SIZE · FIT: `—`
- COLORWAY: `—`
- WEIGHT: empty
- BATCH / HAUL: empty

### 2.2 Listing page (same item)

| On the page | Useful? | Today |
|-------------|---------|-------|
| ¥249 price | Yes | Resolve fills price |
| Main product photo(s) | Yes | Resolve can fill image |
| SKU / model `L29735-H64` | Weak as **title** | Becomes the card title |
| Size chart **image** (S/M/L/XL, shoulder, bust, length) | **Yes — gold** | Not transcribed for Weidian |
| Variant axes (size / color / model) in API `attrList` | Yes | Map to `variants`; cells stay empty unless user picks |
| Seller name / shop | Medium | Often missing on card |
| "购前说明" legal / tax / return boilerplate | **No** | Must not pollute title or notes |
| "Size chart 1-3cm error is allowed" footer | Context only | Optional one-line note, not a chart |

---

## 3. What Credenza already has (do not rebuild)

### 3.1 Weidian resolve (`preview/netlify/functions/resolve.js`)

Calls Weidian SKU API (not the empty HTML shell).

Returns today:

- `title` (often Chinese or bare SKU)
- `priceCny` / `priceUsd`
- `mainImage` / `images`
- `variantGroups` from `attrList`
- Claude tool: English `titleEn`, `summary`, `category`, `sizeNotes`, translated variants

**Does not return today:**

- Parsed size chart rows from chart **photos**
- Weight grams from listing
- Explicit `colorway` / chosen `size` fields (only variant lists)

### 3.2 Yupoo chart vision (`preview/netlify/functions/chart-vision.js`)

- Fetches **Yupoo image hosts only** (`photo.yupoo.com` / `pic.yupoo.com`)
- Claude vision → line text like `M 胸围112 衣长70`
- Client puts that text in `sizeNotes`
- `parseSizeChart` already reads that format for recommendations

### 3.3 Size chart parser (pure, in fashion jsx)

`parseSizeChart` already understands:

- Labeled: `M: 胸围112 衣长70 肩宽48`
- Table-ish: header + rows with size tokens

Your photo table maps cleanly **once transcribed**:

```
S  shoulder 61  bust 124  length 63
M  63  130  64
L  65  136  65
XL 67  142  66
```

Or labeled Chinese lines the parser already accepts.

### 3.4 Reddit haul parser

- Item `label` → card title hint
- `note`, `category`, `posterSize`, `sizeNotes`, `weightGrams` when the **post text** says them
- `sourceTitle` = post title
- Does **not** open the Weidian page

### 3.5 Client merge (`resolveBuyDetails`)

```text
title ← resolvedTitle unless preserveTitle
price ← resolve (unless priceManual)
variants ← variantGroups
sizeNotes ← resolve sizeNotes
image / gallery ← resolve images
```

SIZE · FIT cell on the card is **chosen size / recommendation**, not "has a size run". A full chart can live in `sizeNotes` and still show `—` until the user has a body profile + chart parse + rec, or picks a size.

---

## 4. Why THIS card is thin (root causes)

1. **Seller title is a SKU.** Weidian `itemTitle` = `L29735-H64`. Claude is told: if bare SKU, describe from variants. That rewrite either failed, returned the SKU again, or the Anthropic path did not run (no key / cap / error → untranslated facts only).

2. **Reddit label is overwritten on direct Weidian resolve (confirmed in code).**  
   - Yupoo path sets `preserveTitle: !shouldReplaceFashionTitle(item.title, item.url)`.  
   - Direct resolve path (`resolveBuyDetails(item, { token, signal })`) **never** passes `preserveTitle`.  
   - Merge then does: `title: preserveTitle ? x.title : resolvedTitle || x.title`.  
   - Product `shouldReplaceFashionTitle` also does **not** treat bare SKUs or `Weidian item 123` placeholders as replaceable (returns `false` for both human labels **and** SKUs).  
   - Pure fix lives in `listing-facts.js` (`preferCardTitle` + improved `shouldReplaceFashionTitle`). Wire when product is free.

3. **Size chart is a photo.** SKU API does not include the table pixels. `chart-vision` host allowlist is Yupoo-only (`photo|pic.yupoo.com`). Weidian `itemMainPic` is usually `*.geilicdn.com` / `*.alicdn.com` — rejected today. Pure proposed check: `isAllowedChartImageHost(url, { includeWeidianProposed: true })`.

4. **Variants ≠ filled cells.** Even with Size S–XL and Color in `attrList`, COLORWAY and SIZE stay `—` until mapped into `colorway` / `size` or the UI shows the run from `variants`. Helpers: `pickColorwayFromVariants` / `pickSizeRunFromVariants`.

5. **Weight is not on the API extract.** Only category defaults (~250 g shirt) if category is set. SKU titles often yield `other` or weak category.

6. **Legal HTML is a trap.** Scraping the product details HTML will pull "购前说明" and return policy. Filter with `isListingBoilerplate`. Prefer API + chart photos + Reddit text.

---

## 5. Difficulty map (honest)

| Source | Fields | Difficulty | Stability |
|--------|--------|------------|-----------|
| Reddit haul line label | Human title, note, poster size | **Easy** (pure parser) | High if paste is haul-shaped |
| Weidian SKU API | Price, images, raw title, variants | **Done** | High |
| Claude on API facts | English title, category, sizeNotes prose | **Easy–medium** (prompt + tests) | Medium (model) |
| Prefer Reddit label over SKU | Title policy | **Easy** (merge rule) | High |
| Map first color variant → colorway | Colorway cell | **Easy** | High |
| Show size run from variants when no pick | Size cell UX | **Easy–medium** (UI) | High |
| Yupoo chart photo → sizeNotes | Full chart | **Done** (chart-vision) | Medium (vision) |
| **Weidian chart photo → sizeNotes** | Full chart | **Medium** | Medium — extend host allowlist + referer rules like Yupoo |
| Listing HTML scrape | Risk of boilerplate | **Hard** | Low — avoid as primary |
| Taobao resolve | Price + photos | **Medium–hard** | See empty-taobao spec |
| Weight from listing text/photo | weightGrams | **Medium** | Low coverage |
| Community prior comments on a bare link | Fit notes | **Hard** (corpus + later server) | Pure plan §6 |

---

## 6. Recommended work order (customer value first)

### P0 — Pure / small product rules (high value, low risk)

1. **Title policy (SKU must not beat a human label)**  
   - If `item.title` looks like a SKU (`/^[A-Z0-9][A-Z0-9._-]{3,}$/i` or mostly code) and Reddit/`sourceTitle`/prior label is human, keep human.  
   - If resolve returns SKU and Claude `titleEn` is also SKU-like, keep prior human title.  
   - Fixtures: SKU vs "Celine Shirt", SKU-only link, Chinese title + English rewrite.

2. **Claude bare-SKU prompt acceptance tests**  
   - Fixture facts: title `L29735-H64`, variants Size S–XL + Color Black.  
   - Expect `titleEn` contains a garment word, not only the SKU.  
   - Pure scoring of the tool schema; live call optional behind a flag.

3. **Variant → display fields (pure helpers)**  
   - `pickColorwayFromVariants(variantGroups) → string | ""`  
   - `pickSizeRunFromVariants(variantGroups) → string` e.g. `S–XL`  
   - Do not invent a chosen size. Only show the run for the SIZE cell when empty.

4. **Boilerplate filter (pure)**  
   - Drop paragraphs matching 购前说明 / 依法纳税 / 无理由退货 / "Pre-purchase instructions".  
   - Never write these into `summary` or `sizeNotes`.

### P1 — Weidian size chart photos (your Image #17)

Goal: same pipeline as Yupoo charts.

1. Detect chart-looking images in the resolve image list (optional cheap heuristic: filename, aspect, or "try first N detail images").
2. Extend `chart-vision` host allowlist carefully:
   - Today: Yupoo only (SSRF lockdown).
   - Add known Weidian / Ali CDN image hosts only after SSRF tests (private IP, weird IPv4, redirect tricks).
   - Referer rules must mirror what the CDN accepts (like Yupoo).
3. Reuse the same Claude tool → `sizeNotes` line format.
4. Client: after resolve, if `sizeNotes` has no parseable chart and images remain, call chart-vision (cost + rate limits apply).
5. Fixtures: synthetic chart image transcription strings (no need to ship licensed photos in git).

**Hard parts:** host allowlist safety, CDN hotlink headers, cost (vision tokens), and not sending the legal text image as a "chart".

### P2 — Reddit comment / post body richness

When paste is a full haul or QC post:

1. Label from the line above the link (already).
2. Size phrases → `posterSize` / `sizeNotes` (K3 is expanding this in `reddit-haul.js` — do not fight that file).
3. Do not open every product page just to name the card if Reddit already named it.

### P3 — Taobao / Tmall resolve

Separate track: `docs/specs/empty-taobao-cards.md`. Without this, haul pastes full of Taobao links stay monogram cards.

### P4 — Avoid as primary

1. Full HTML product-page scrape for "everything".
2. Treating return-policy text as product facts.
3. Fake precision weight without a signal.

---

## 7. Field-by-field target for a "good" card

| Field | Primary source | Fallback |
|-------|----------------|----------|
| Title | Reddit label → Claude English title → seller title (never SKU if better exists) | Host + item id |
| Price | Resolve API | Manual |
| Photos | Resolve / Yupoo album | Monogram |
| Colorway | Variant axis Color/颜色 / Reddit note | `—` |
| Size run | Chart in sizeNotes / Size variant axis | `—` |
| Chosen size | User pick / posterSize from Reddit | Recommendation when chart + body |
| Weight | Listing parse / Reddit / manual | Category default with `~` |
| Batch | Yupoo / Reddit | `—` |
| Fit notes | Chart footer + Reddit "size down" | Empty |

---

## 8. Pure fixtures to add next (no UI)

Under `preview/test/fixtures/`:

| File | Purpose |
|------|---------|
| `title-policy.json` | SKU vs human label; when resolve may replace |
| `variant-display.json` | Color/size axes → colorway + size run strings |
| `boilerplate-filter.json` | Chinese legal blocks → drop |
| `size-chart-tables.json` | Transcribed tables like Kyle's S–XL photo → `parseSizeChart` rows |

These score pure helpers before any server host-list change.

---

## 9. Effort estimate (engineering, not calendar)

| Slice | Effort | Blocks on |
|-------|--------|-----------|
| Title policy + fixtures | Small | None |
| Variant display helpers + tests | Small | None |
| Boilerplate filter | Small | None |
| Weidian chart-vision hosts + SSRF tests | Medium | Security review of hosts |
| Wire chart-vision after Weidian resolve | Medium | Above + cost caps |
| Taobao resolve | Medium–large | External API stability |
| Link-context community notes | Large | Corpus + product rules |

---

## 10. What to tell the customer (product copy, later)

Honest empty states beat fake data:

- SIZE · FIT empty + chart in notes: "Size chart on card — set My sizes for a rec"
- Title still SKU: "Seller code — rename anytime"
- Never paste legal boilerplate into the card body

---

## 11. Implementation gate (when a lane is free)

1. Land pure fixtures + helpers first (this lane can start **title-policy / variant / boilerplate / chart table fixtures** without touching K3 UI).
2. Product merge rules in `resolveBuyDetails` only when gallery/UI is quiet.
3. chart-vision host expansion only with guard tests green.
4. Full gate + deploy + session-state.
5. Probe: stash `https://weidian.com/item.html?itemID=7777810977` and a Reddit line with a human label; expect human title + price + image; chart text after P1.

---

## 12. Direct answers to Kyle

**"Would we be able to collect these types of charts from Weidian and Yupoo?"**  
Yupoo: yes, already. Weidian: yes in principle — the photo is enough for vision — but the server must be allowed to fetch Weidian image hosts, which it is not today.

**"There's also stuff on this page… how hard to extract more?"**  
API facts + Reddit text: not hard. Chart photos: medium. Whole page HTML including legal text: hard and mostly noise.

**"PRICE IS IT… shouldn't the shirt name come from Reddit comments?"**  
Yes when the paste has a name. Keep that name over the SKU. When the user only pastes the bare Weidian link, Reddit cannot help — then Claude must invent a short English description from variants/images, not leave `L29735-H64` as the only title.

**"NO WEIGHT NO COLOR NO SIZE NO FIT — HOW?"**  
- Color/size run: often already in API variants; map them to the cells.  
- Fit/chart: need photo transcription for Weidian.  
- Weight: rarely on the page; category default or Reddit "480g" style notes.  
- Title: policy + Claude, not more HTML scrape.

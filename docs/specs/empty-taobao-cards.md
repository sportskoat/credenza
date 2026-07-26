# Spec — Empty Taobao cards after Reddit haul paste

**Status:** Research only. Do not implement while K3 owns UI.  
**Date:** 2026-07-25  
**Reporter:** Kyle (screenshots of monogram Taobao cards + blank flipped backs)  
**Owner later:** Pure/server lane after gallery lands  
**Related:** `docs/lane-notes-for-k3.md`, `docs/pure-layer-exhaustiveness-plan.md` §3.3

---

## 1. Customer symptom

1. User pastes a FashionReps haul text with many W2C links.
2. Cards appear with correct-ish titles.
3. Many cards show the **Taobao monogram** tile instead of a product photo.
4. Price shows blank or missing on the front and on the flipped back.
5. At least one **Weidian** card in the same haul shows real photos (proof that enrich works for Weidian).

This is a launch defect. A haul paste is a core first-run path.

---

## 2. Confirmed root cause

File: `preview/netlify/functions/resolve.js`

The handler only extracts a Weidian item id:

```js
const itemId = weidianItemId(url);
if (!itemId) return response(422, { error: "Not a resolvable buy link" });
```

`weidianItemId` rejects every non-Weidian host.  
Taobao, Tmall, and 1688 URLs all return **422**.

Client effect (conceptual):

1. Haul parser creates a local card with title + canonical URL.
2. Enrich calls `/.netlify/functions/resolve` with that URL.
3. Server returns 422.
4. Client leaves the card as title-only. No `image`, no `priceCny` / `priceUsd`.
5. Cover falls back to the host monogram (correct empty-state design).
6. Flipped back has a grey hero because the photo list is empty.

Parser quality can still improve labels. It cannot invent marketplace photos.

---

## 3. What already works

| Platform | Resolve today | Notes |
|----------|---------------|-------|
| Weidian | Yes | `thor.weidian.com/detail/getItemSkuInfo/1.0` |
| Taobao | No | 422 |
| Tmall | No | 422 |
| 1688 | No | 422 |
| Yupoo | Separate path | `yupoo.js` + album relay, not `resolve.js` |

Agent wrap URLs already support Taobao for most agents (`agents.js` supports lists). Buy still works. The **card content** does not fill.

---

## 4. Goals for a later fix

1. A Taobao item URL returns structured facts the client already understands.
2. Same for Tmall and 1688 if a stable public source exists.
3. Fail open: if fetch fails, keep the local title card. Never block stash.
4. No secrets in the repo.
5. SSRF, rate limit, cost cap, and paid-gate stay identical to Weidian.
6. Pure tests use fixtures and mocks. CI never hits live Taobao.

---

## 5. Proposed response shape (match Weidian)

Keep the client merge path stable. Prefer the same JSON keys the Weidian path already returns:

```json
{
  "source": "taobao",
  "itemId": "856801351597",
  "url": "https://item.taobao.com/item.htm?id=856801351597",
  "title": "…",
  "originalTitle": "…",
  "summary": "",
  "category": "shirt",
  "sizeNotes": "",
  "priceCny": 180,
  "priceCnyHigh": null,
  "priceUsd": 25.2,
  "usdPerCny": 0.14,
  "stock": null,
  "mainImage": "https://…",
  "images": ["https://…"],
  "variantGroups": [],
  "translated": false
}
```

Client already maps these onto the card. Do not invent a second merge schema.

---

## 6. Implementation options (rank later)

### Option A — Public mobile H5 / open APIs (preferred if legal and stable)

1. Extract `id` from `item.taobao.com`, `m.tb.cn`, `detail.tmall.com`, `detail.1688.com`.
2. Fetch a documented or long-stable public endpoint with SSRF guards.
3. Parse title, price (fen or yuan — document which), main image.
4. Optional Claude enrich for English title (same degrade path as Weidian).

Risk: hosts change often. Needs live probe before `verified`.

### Option B — Client-side image fallback only (partial)

If server cannot fetch Taobao:

1. Keep 422 for resolve.
2. Still show something better than a monogram if the paste or page has an og:image (rare for haul text).

This does **not** fix price. Treat as a weak stopgap only.

### Option C — Honest empty state copy (UX only)

If resolve fails for a platform:

1. Keep monogram.
2. Show a one-line subtext: "Open Buy to see the listing" or "Price fills when resolve supports Taobao".

Does not replace Option A. Helps until A lands.

---

## 7. Pure work that can land first (no UI)

1. `taobaoItemId(url)` / `tmallItemId` / `ali1688ItemId` pure extractors with fixtures.
2. Negative tests: junk hosts, `javascript:`, oversized query strings.
3. Fixture JSON of real-shaped Taobao API payloads (sanitized) for parser unit tests.
4. Matrix table: platform × agent wrap already covered in `agents.test.js` expansions.

Extractors can live in a **new** file such as `marketplace-ids.js` later. Do not put them into `credenza-fashion.jsx` while it is dirty for gallery work.

---

## 8. Acceptance when the fix lands

1. Paste the Kyle haul (or `preview/scripts/corpus-fashionreps.json` Taobao items).
2. After enrich, Taobao cards show a real main image when the marketplace has one.
3. Price cell shows CNY or USD when the listing has a price.
4. Weidian path still green (no regression).
5. Offline stash still creates a card with no network.
6. Gate: full test suite + lint + typecheck + build.
7. Live probe against production after deploy.

---

## 9. Out of scope

1. Full variant matrix shopping UI.
2. Stock notifications.
3. Any W2C marketplace or batch leaderboard (banned by Monetization).
4. Storing raw listing HTML in logs.

---

## 10. Handoff checklist

- [ ] Gallery restore committed by K3
- [ ] Product files clean or K3 says free
- [ ] Choose Option A/B/C with Kyle if A needs a new external host
- [ ] Implement extractors + resolve branch + fixtures
- [ ] Gate + deploy + session-state

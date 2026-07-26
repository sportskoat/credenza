# Credenza Fashion — Pure Layer Exhaustiveness Plan

**Status:** Research only. This document does not change product code.  
**Date:** 2026-07-25  
**Audience:** Kyle, and any Grok lane that must not block Kimi K3.  
**Read first:** `docs/Monetization.md`, `docs/session-state.md`, `docs/carousel-canonical-state.md`.  
**Style:** ASD-STE100 Simplified Technical English for all prose Kyle reads.

---

## 0. Purpose of this document

This document records a full research plan for the pure technical layers of Credenza Fashion.

A pure layer is a function that:

1. Takes clear input.
2. Returns clear output.
3. Does not paint the screen.
4. Does not talk to the network unless a test mock provides that talk.
5. Is easy to score with fixed fixtures.

Grok is strong on pure layers. Claude and Fable stay strong on product design and UI risk. K3 owns the current mobile UI work. This plan keeps those roles apart.

This document answers six questions:

1. What is Credenza trying to do for the user?
2. What pure code exists today?
3. Why does the weight model feel wrong?
4. How can a bare product link show prior community comments without a banned marketplace?
5. What pure work can Grok do now without blocking K3?
6. What is the exact order of work, with revert paths?

---

## 1. Safe mode while K3 writes code

### 1.1 Rule

Do not fight K3. Do not edit the same files. Do not deploy. Prefer new files and new branches.

### 1.2 Files you must not touch while K3 is active

| Path | Reason |
|------|--------|
| `credenza-fashion.jsx` | Main app. Carousel contract. Sheet wiring. Storage paths. |
| `credenza-fashion.css` | Fashion theme and layout. |
| `credenza.css` | Shared chrome and tokens. |
| `sheets/*.jsx` | Mobile and desktop sheets. Capture, Detail, Settings, Profile. |
| `preview/src/*` | Account, auth, usage UI. |
| Netlify env and deploy | Kyle and the other lane own ship. |
| Carousel physics or DOM structure | Frozen contract in `docs/carousel-canonical-state.md`. |

### 1.3 Work that is safe now

1. Read code.
2. Write documents under `docs/`.
3. Expand golden fixtures under `preview/scripts/` and `preview/test/fixtures/`.
4. Add pure unit tests that import existing exports only.
5. Work on a new git branch that adds only test files and data files.
6. Harvest Reddit corpora offline with the existing Playwright harvester.
7. Design pure modules as proposed files (for example `.proposed.js` or files under `docs/specs/`) until K3 is idle.
8. Expand tests for `agents.js`, `reddit-haul.js`, entitlements, and `migrateItem` without changing their public APIs.
9. Land pure helpers in **new** modules (example: `listing-facts.js`) that product code can import later. Do not wire them into `credenza-fashion.jsx` while K3 owns UI.

### 1.5 Landed pure slice (2026-07-25) — richer item facts

Spec: `docs/specs/richer-item-facts.md`.

| Path | Role |
|------|------|
| `listing-facts.js` | `preferCardTitle`, SKU detect, variant colorway/size-run, boilerplate filter |
| `preview/test/fixtures/title-policy.json` | Reddit label vs SKU |
| `preview/test/fixtures/variant-display.json` | Size/color axes → display strings |
| `preview/test/fixtures/boilerplate-filter.json` | Legal block drop list |
| `preview/test/fixtures/size-chart-tables.json` | Kyle Weidian chart photo as text → `parseSizeChart` |
| `preview/test/listing-facts.test.js` | 18 green fixture tests |

Not wired into resolve merge or chart-vision hosts yet. That needs a quiet product lane.

### 1.5b Landed pure slice (2026-07-25 night) — weight bands + link context L0

| Path | Role |
|------|------|
| `weight-estimate.js` | `estimateItemWeight`, keyword refine, shoebox rule, `formatWeightEstimate` |
| `preview/test/fixtures/weight-estimate-cases.json` | Golden bands and priority cases |
| `preview/test/weight-estimate.test.js` | Pure tests (no fashion jsx) |
| `link-context.js` | `canonicalKeyFromUrl`, `indexCorpus`, `lookupLinkContext` |
| `preview/test/fixtures/link-context-corpus.json` | Small golden mention index |
| `preview/test/link-context.test.js` | L0 tests + frozen 22-post FashionReps score |

Product UI not wired (K3 dirty tree). No Netlify deploy from this slice.

### 1.4 Revert strategy

Use one branch per workstream.

Examples:

- `pure/weight-table`
- `pure/reddit-corpus-200`
- `pure/link-context-fixtures`
- `pure/agents-negative-tests`
- `pure/migrate-roundtrip`

Rules:

1. Do not force-push.
2. Do not deploy from these branches.
3. Drop a bad branch with `git branch -D <name>`.
4. Prefer new files over edits to shared modules until K3 is quiet.
5. If a pure module must land in the app later, land it behind a re-export with no UI change first.

### 1.5 How to know the other lane is busy

Check:

```sh
cd ~/credenza
git status -sb
```

If you see edits in `sheets/`, `credenza-fashion.jsx`, `credenza-fashion.css`, or live probe scripts that K3 owns, stay on fixtures and docs only.

---

## 2. What Credenza is trying to do

### 2.1 North-star job

From `docs/Monetization.md`:

> I found something on Reddit, Yupoo, or Weidian. Help me decide size, keep context, run QC, plan the parcel, and open it in my agent — without a spreadsheet.

### 2.2 Product truth in one line

Credenza is the decision layer in front of buying agents.

It is not a replica marketplace.  
It is not an agent replacement.  
It is not a customs advice tool.  
It is not a best-batch leaderboard.

### 2.3 The user problem in plain terms

A user finds clothing on Chinese marketplaces and haul communities. The listing pages are hard to read. Size charts use Chinese labels. Colors and stock change. Weight is unknown. Shipping cost is unknown until the agent weighs the parcel. Community notes sit in long Reddit posts. Spreadsheets hold the only full view.

Credenza must:

1. Capture a link or a haul paste in one step.
2. Turn messy text into clear cards.
3. Show price, photos, variants, and size notes when the data exists.
4. Help the user pick a size from a body profile and a chart.
5. Keep QC photos and GL or RL decisions on the card.
6. Estimate haul weight with honest ranges, not fake precision.
7. Open the correct agent with one Buy action and a referral code.
8. Keep all of this on a quiet, editorial shelf, not a busy dashboard.

### 2.4 Feature filter

If a feature does not reduce uncertainty before the agent click, or reduce chaos after QC, it is probably wrong work.

### 2.5 Money model (context only)

Primary money: agent affiliate on Buy handoffs.  
Secondary money: Pro for workflow power (sync, QC vault, higher AI limits, multi-profile).  
Never sell access to a private counterfeit catalog.

This pure-layer plan supports the free core and the pure engines under Pro. It does not invent Tier C products.

---

## 3. Current pure surface (code map)

These modules are pure or almost pure. They are the Grok home turf.

| Module | Role | Main tests |
|--------|------|------------|
| `reddit-haul.js` | Paste text → items, stats, labels, categories | `preview/test/reddit-haul.test.js` |
| `agents.js` | Agent registry, wrap URL, referral, marketplace id | `preview/test/agents.test.js` |
| `fashion-gate.js` | Detect fashion URLs vs noise | `preview/test/fashion-gate.test.js` |
| Weight helpers in `credenza-fashion.jsx` (near L222–294) | Category grams, haul sum, volumetric, chargeable | `preview/test/weight.test.js` |
| `parseSizeChart` / `recommendSize` in fashion jsx | Size decision from chart + body | `preview/test/size-chart.test.js` |
| `migrateItem` / `migrateHaul` | Whitelist persistence on reload | storage and hauls tests |
| `parseImport` | Raindrop, Pocket, bookmarks, Reddit haul import | fashion-app and haul-export tests |
| `credenza-haul-export.js` | Export formats | `preview/test/haul-export.test.js` |
| `preview/netlify/functions/lib/guard.js` | SSRF guards | `preview/test/guard.test.js` |
| `preview/netlify/functions/lib/limit.js` | Rate and cost ceilings | `preview/test/limit.test.js` |
| `preview/netlify/functions/lib/entitlements.js` | Plan state machine | `preview/test/entitlements.test.js` |
| Corpus | 22 FashionReps posts | `preview/scripts/corpus-fashionreps.json` |
| Harvester | Headless Chromium harvest for Reddit | `preview/scripts/harvest-fashionreps.mjs` |
| Corpus scorer | Run parser on corpus and print scores | `preview/scripts/corpus-fashionreps.mjs` |

### 3.1 Hard trap: migrateItem is a whitelist

`migrateItem` keeps only known fields. Any field that import or resolve writes must appear in the whitelist. If it is missing, the field dies on reload.

This trap has bitten the project more than once. Every pure plan that adds a field must add:

1. The write path.
2. The `migrateItem` (or `migrateHaul`) line.
3. A round-trip test.

### 3.2 Hard trap: carousel is frozen

Do not change carousel physics, echo-loop guards, or the card-back contract. Read `docs/carousel-canonical-state.md` before any UI work that seems to need carousel edits. Pure work does not need carousel edits.

### 3.3 Hard trap: offline-first is no longer absolute

Cloud resolve, chart-vision, and Ask exist. Local capture still works with no network. Pure parsers must still work with no network. Enrichment may enhance later. Enrichment must never block stash.

### 3.4 Approximate sizes today

| File | Scale |
|------|-------|
| `credenza-fashion.jsx` | ~13,000 lines |
| `reddit-haul.js` | ~540 lines |
| `agents.js` | ~419 lines |
| `preview/test/reddit-haul.test.js` | ~453 lines |
| `preview/test/agents.test.js` | ~328 lines |
| `preview/test/weight.test.js` | ~144 lines |
| `preview/test/size-chart.test.js` | ~403 lines |
| FashionReps corpus | 22 posts |

The giant JSX file is the wrong place for large pure expansions. Extract pure logic into new modules when K3 is idle.

---

## 4. Product flow in pure terms

This section describes the user path as a chain of pure transforms. UI is only the last display step.

### 4.1 Capture a single link

Input: one URL string.

Steps:

1. `fashionGateStatus(text)` or `isFashionUrl(url)` decides if the link is in scope.
2. Stash creates a local item with a primary URL and inferred link roles.
3. Marketplace host sets photos vs buy roles (Yupoo → photos, Weidian or Taobao → buy).
4. Optional network resolve fills title, price, image, variants, size notes.
5. `migrateItem` keeps the fields on reload.

Pure test targets:

- Gate true or false for many hosts.
- Role inference for multi-URL lines.
- Canonical key extraction for dupe and context later.

### 4.2 Capture a Reddit haul paste

Input: multi-line text, optional post title, optional `fromPost` flag.

Steps:

1. `parseRedditHaul(text, opts)` returns null or a haul object.
2. Haul object has poster stats, poster name, items with label, url, note, category.
3. Import path builds candidates and dedupes against the shelf.
4. Cards keep `sourceText` and `posterStats` when present.

Pure test targets:

- Name-above-link attribution.
- Colon format labels.
- French numbered articles.
- Obfuscated URLs with spaces.
- Agent invite links never become cards.
- Single-link QC posts with title provenance.

### 4.3 Size decision

Input: size chart text, body profile, category, optional fit preference.

Steps:

1. `parseSizeChart(text)` builds a structured chart.
2. `recommendSize(chart, profile, category, fitPref)` returns size + reason.
3. Missing data returns a clear empty state. It does not invent fabric stretch.

Pure test targets:

- CJK and English labeled tables.
- Positional tables.
- Ease rules for tops and bottoms.
- Fit looseness nudge.
- Shoes, hats, bags, socks skip path.

### 4.4 Weight and parcel

Input: items with category or override, optional parcel dims and packaging.

Steps:

1. `itemWeightGrams(item)` returns override or category default or null.
2. `haulWeightGrams(items)` sums and skips returned items.
3. `volumetricWeightGrams(dims)` uses l·w·h / 5 grams.
4. `chargeableWeightGrams(...)` takes max of packaged actual and volumetric.

Pure test targets:

- Every category default.
- Override wins.
- Returned exclusion.
- Packaging factors.
- Null paths.

This is the section that feels weak to the user today. Section 5 expands the fix.

### 4.5 Buy handoff

Input: preferred agent id, canonical marketplace URL, env referral codes.

Steps:

1. `buildAgentUrl(agentId, canonicalUrl)` wraps or fails open.
2. Referral attaches only at open time.
3. Canonical storage never stores the agent wrap as the only URL.
4. Outbound log stores privacy-safe fields only.

Pure test targets:

- Every agent template type.
- Retired agents.
- Bad hosts.
- Missing ids fail open.
- Referral matrix.

---

## 5. Honest diagnosis of the weight model

### 5.1 What exists today

```text
CATEGORY_WEIGHT_GRAMS = {
  shirt: 250,
  pants: 600,
  shorts: 350,
  shoes: 1100,
  outerwear: 900,
  accessory: 200,
  socks: 100,
  bag: 700,
  hat: 150,
  other: 300
}
```

Public helpers:

- `itemWeightGrams(item)`
- `formatWeightGrams(grams)` with a `~` prefix
- `haulWeightGrams(items)`
- `volumetricWeightGrams(dims)`
- `chargeableWeightGrams({ actualGrams, dims, packaging })`
- `PACKAGING_OPTIONS` for none / standard / reinforced

UI copy already says the agent weighs the final parcel. That honesty is correct. Keep it.

### 5.2 Why the model feels loose

1. **Ten buckets only.** A thin tee and a heavy fleece both use `shirt` → 250 g. A low sneaker and a boot both use `shoes` → 1100 g.
2. **Category guess is weak.** Title keywords map to the same coarse list. Wrong category gives wrong weight with no confidence flag.
3. **No title-level refinement.** Sample titles even include grams in text. The table does not parse them.
4. **No agent-reported weight path.** QC notes and warehouse messages often include real grams. The model never learns from them.
5. **No range.** A single number looks precise. Users need low, mid, and high bands.
6. **No shoe-box policy.** Shoes ship heavy with boxes. “No shoebox” is a packing preference, not a weight rule yet.
7. **Coupled to the giant JSX file.** Hard for Grok to expand without merge risk against K3.

### 5.3 Design goals for a better estimator

1. Stay pure and local first.
2. Prefer known facts over defaults.
3. Show a band and a reason.
4. Never invent live agent shipping dollars in v1.
5. Keep the agent as the final source of truth for chargeable weight.
6. Extract the module so tests do not load the whole app when possible.

### 5.4 Proposed pure API

```text
estimateItemWeight(item) → {
  grams,           // mid estimate used by haul sum
  lowGrams,        // low band
  highGrams,       // high band
  source,          // "override" | "listing" | "title" | "category" | "unknown"
  confidence,      // "high" | "mid" | "low"
  reason           // one short line for the UI
}
```

Priority order. First match wins for the mid value:

1. Manual `item.weightGrams` override.
2. Parsed listing weight from resolve or Yupoo text if present. Examples: `480g`, `0.48kg`, `约500克`.
3. Title and notes keyword table. Examples: hoodie, fleece, leather, denim, boot, slide.
4. Category default table (refined from the current table).
5. Unknown → null. Do not invent a number.

### 5.5 Proposed subcategory table

These middles are starting points. Always show `~`. Always keep bands.

| Key | Mid g | Low g | High g | Notes |
|-----|------:|------:|-------:|-------|
| tee | 200 | 150 | 280 | Light cotton tee |
| heavy_tee | 280 | 220 | 360 | Thick blank tee |
| hoodie | 650 | 450 | 900 | Fleece mid |
| heavy_hoodie | 850 | 650 | 1100 | Heavyweight fleece |
| crewneck | 450 | 350 | 600 | |
| shirt_woven | 250 | 180 | 350 | Button shirt |
| denim_jacket | 900 | 700 | 1200 | |
| puffer | 900 | 600 | 1400 | Wide band by fill |
| light_jacket | 500 | 350 | 700 | Windbreaker class |
| jeans | 700 | 550 | 900 | |
| sweatpants | 500 | 400 | 700 | |
| shorts | 300 | 200 | 450 | |
| low_sneaker | 900 | 700 | 1100 | Often boxed |
| boot | 1400 | 1100 | 1800 | Often boxed |
| slide | 350 | 250 | 500 | Light |
| cap | 120 | 80 | 180 | |
| belt | 200 | 120 | 300 | |
| backpack | 900 | 600 | 1400 | |
| crossbody | 400 | 250 | 600 | |
| socks_pair | 80 | 50 | 120 | |
| other | 300 | 150 | 600 | Last resort |

Map the old categories into this table for backward compatibility:

| Old category | Default key |
|--------------|-------------|
| shirt | tee |
| outerwear | light_jacket or hoodie by keyword |
| pants | jeans or sweatpants by keyword |
| shorts | shorts |
| shoes | low_sneaker |
| accessory | belt or other |
| socks | socks_pair |
| bag | backpack |
| hat | cap |
| other | other |

### 5.6 Shoe box rule

Parcel mode needs a pure packing flag.

Default for shoes:

- Assume boxed ship weight in the mid estimate.

If the haul or parcel sets `packNoShoebox: true`:

- Subtract a fixed box mass per shoe item. Start with 400 g as a research default.
- State the rule in the reason line.

Do not pretend this matches every agent warehouse. It is a planning aid only.

### 5.7 Listing and title parsers (pure)

Add pure helpers:

```text
parseWeightFromText(text) → { grams, raw } | null
refineWeightKeyFromText(text, category) → subcategory key
```

Examples the parser must pass:

| Text | Expected grams |
|------|----------------|
| `480g` | 480 |
| `480 g` | 480 |
| `0.48kg` | 480 |
| `0.48 kg` | 480 |
| `约500克` | 500 |
| `500克` | 500 |
| `1.2 kg` | 1200 |
| noise with no weight | null |

Reject absurd values. Example: 50_000 g for a tee is not a listing weight for this product class. Cap or ignore with a clear rule and a test.

### 5.8 What not to build for weight v1

1. Live multi-agent rate scraping.
2. Fake dollar ship totals from guessed $/g without a user-entered rate.
3. Cloth simulation or 3D mass.
4. Seller-specific secret tables that you cannot verify.

Optional later:

- User-entered `$ / g` or route preset for rough money math.
- Learn from warehouse actuals the user pastes into parcel weight.

### 5.9 Files to change later (when K3 is idle)

| Action | Path |
|--------|------|
| Extract | `weight-estimate.js` (new) from fashion jsx weight helpers |
| Re-export | thin wrappers in fashion jsx for one release |
| Tests | expand `preview/test/weight.test.js` plus `preview/test/fixtures/weight-cases.json` |
| Optional UI later | show band and reason on card and haul board |

### 5.10 Acceptance for weight pure layer

1. Every fixture case has a stable expected object.
2. Override always wins and marks `source: "override"` with high confidence.
3. Listing parse wins over title and category.
4. Unknown items return null mid and do not force a fake category weight in the new API.
5. Backward wrappers keep old call sites green during migration.
6. Haul sum still skips returned items.
7. Chargeable weight math stays identical unless a test documents a deliberate fix.

---

## 6. Link context — who used this link before?

### 6.1 The user ask

Even for a bare Weidian, Yupoo, or Taobao link, show prior community comments where that link appeared. Include size worn, height, weight, fit notes, GL or RL notes, and agent used when present.

This is one of the highest value pure problems in the product.

### 6.2 Hard product rule

This must not become a searchable W2C marketplace. See `docs/Monetization.md` Tier C.

Safe framing:

- Context attaches to items the user already stashed.
- No public browse by brand name.
- No best-batch ranking.
- No paid seller placement.
- Copy says notes from posts the user can open, not a catalog of fakes.

### 6.3 What the code already has for identity

In fashion code and `agents.js`:

- Weidian item id from query params.
- Yupoo account and album id from album paths.
- Taobao, Tmall, and 1688 numeric ids.
- `marketplaceOf(url)` and `extractMarketplaceItemId(url)`.

Dupe detection today is shelf-local. Same id already saved shows a dupe. There is no community mention index.

### 6.4 Three-layer approach

#### Layer L0 — Local corpus index (build first)

This layer is pure and offline.

Steps:

1. Harvest 200 or more posts from haul communities with `harvest-fashionreps.mjs` or expanded harvest scripts.
2. Start with FashionReps. Later add DesignerReps, Repsneakers, and QC-focused posts if the harvest path works.
3. Parse each post with `parseRedditHaul` plus extra mention extraction for single-link QC posts.
4. Build a fixture file of posts and extracted items.
5. Index by canonical key.
6. Lookup returns mentions for a URL.

Canonical key shapes:

```text
weidian:<itemId>
taobao:<itemId>
tmall:<itemId>
1688:<itemId>
yupoo:<account>/<albumId>
```

Proposed pure API:

```text
canonicalKeyFromUrl(url) → key | null
indexCorpus(posts) → Map or plain object of key → Mention[]
lookupLinkContext(url, index) → {
  mentions,
  count,
  sizesSeen,
  heightWeightPairs,
  notes
}
```

Mention object fields:

```text
{
  postId,
  postTitle,
  postUrl,
  subreddit,
  label,
  note,
  posterStats,
  category,
  observedAt   // harvest date if known
}
```

Score the pure function with fixtures only. Unit tests do not hit the network.

#### Layer L1 — Live Reddit lookup (after OAuth exists)

Blocked on Kyle:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`

These vars are still the top production gap for paste-by-URL on the live site. The client credentials path is wired. The env vars are missing.

When OAuth works:

1. Add a server function that clones guards from `reddit.js`, `guard.js`, `limit.js`, and paid auth patterns.
2. Search allowed subreddits for the item id or full URL.
3. Return OP text and comment snippets only.
4. Cache by canonical key with a short TTL.
5. Free tier: limited lookups per day.
6. Pro tier: higher cap.

Do not invent a new security model. Copy the known guards.

#### Layer L2 — User shelf and haul history

When the same canonical key appears in an older haul or older card:

1. Surface the user note.
2. Surface the size the user chose.
3. Surface QC verdict and note.
4. Surface GL or RL.

This merge is pure local data. No network.

### 6.5 Why L0 must come before L1

1. L0 builds the parser quality and the key quality without rate limits.
2. L0 gives golden fixtures that protect against later regressions.
3. L0 works offline and in unit tests.
4. L1 without L0 will ship fragile ranking and weak labels.
5. L0 does not need Reddit env vars.

### 6.6 Corpus harvest plan

Current:

- `preview/scripts/harvest-fashionreps.mjs`
- Target default 20
- Output `corpus-fashionreps.json` with 22 posts today

Needed:

1. Freeze the 22-post file as a golden regression set. Do not overwrite it.
2. Harvest into a new file, for example `corpus-haul-200.json`.
3. Run with `TARGET=200`.
4. Keep human pace delays so Reddit is less likely to block the session.
5. Store id, title, selftext, and if possible permalink and subreddit.
6. Optional second pass: harvest top-level comments that contain shoppable URLs.

Comment harvest note:

OP selftext is not enough for many modern posts. Comments often hold the real W2C links. A second corpus file for comments keeps the OP regression set stable.

### 6.7 Acceptance for link context

| Gate | Metric |
|------|--------|
| Corpus size | At least 200 posts, at least 1 community first, then 3 if possible |
| Key coverage | At least 90% of Weidian, Taobao, and Yupoo album links in corpus get a key |
| Lookup precision | Fixture keys return only matching mentions |
| Label quality | At least 80% of mentions keep a human label, not the raw URL |
| Safety | No global brand search UI in free product |
| Persistence | Any attached context fields appear in `migrateItem` |
| Privacy | Do not store raw user Reddit tokens in local item JSON |
| Fail mode | Missing context shows a quiet empty state, not an error wall |

### 6.8 Files later

| Kind | Path |
|------|------|
| New pure module | `link-context.js` |
| New data | `preview/scripts/link-context-corpus.json` |
| New harvest scripts | `preview/scripts/harvest-*.mjs` for more communities |
| Tests | `preview/test/link-context.test.js` |
| Server later | `preview/netlify/functions/link-context.js` cloned from known guards |
| UI later | card back panel for community notes, only after pure layer is green |

### 6.9 UX sketch (not for this pure phase)

On a stashed card:

```text
Community notes (3)
• 182 cm / 80 kg · size M · “midsole flaw, suede ok”
• size L · “TTS for me”
• Open source posts →
```

Rules:

1. Show only after the user stashed the item.
2. Prefer short notes.
3. Link out to the source post when URL is known.
4. Do not rank “best batch.”
5. Do not show brand leaderboards.

---

## 7. Reddit and haul parser — from 22 posts to 200

### 7.1 Current state

- Corpus: 22 posts in `corpus-fashionreps.json`.
- Prior session claim: 21 of 22 parse, 77 of 77 items labeled after the 2026-07-24 pass.
- Tests cover name-above-link, French numbered lists, obfuscated URLs, agent invite exclusion, Yupoo path join, and more.

### 7.2 Gaps that still hurt UX

1. Single-link posts with almost no text still need title and provenance.
2. Seller promo posts label cards with the seller name.
3. Comment threads are not harvested. Only OP selftext is stored.
4. Multi-community formats differ. Tables, colon lists, and “W2C:” lines all appear.
5. Link-only pastes from Discord or WhatsApp lose surrounding chatter unless the user pastes it.
6. Some agent short links need host recognition beyond the current matcher.
7. Parenthetical flair in titles, such as `(QC)`, can survive cleaning.

### 7.3 Exhaustive pure plan

1. Freeze the current 22-post corpus as golden.
2. Harvest toward 200 posts into a new JSON file.
3. Split corpora:
   - `corpus-fashionreps-22.json` or keep the current name as frozen.
   - `corpus-haul-200.json` for score reports.
4. Build expected-output fixtures for hard cases under `preview/test/fixtures/reddit-haul/`.
5. Keep the live unit tests that embed small pastes for speed.
6. Add a score script threshold report:
   - percent of posts that parse as haul
   - percent of items labeled
   - percent categorized
   - percent with marketplace primary URL
   - percent with agent-only primary URL
7. Optional comment harvest in a separate file.
8. Track failure classes in a markdown score log under `docs/` or `preview/scripts/reports/`.

### 7.4 Fixture file shape

```text
{
  "name": "gats-qc",
  "input": {
    "text": "...",
    "opts": { "title": "...", "fromPost": true }
  },
  "expect": {
    "itemCount": 1,
    "labels": ["Maison Margiela Gats"],
    "categories": ["shoes"],
    "mustIncludeUrlSubstrings": ["itemID=7785888265"],
    "mustNotIncludeUrlSubstrings": ["register", "invite"]
  }
}
```

### 7.5 Do not break these behaviors

1. `parseRedditHaul` returns null for bare single links without provenance. The generic stash path owns those.
2. Agent register and invite links must never become cards.
3. Name-above-link attribution must keep the right-item regression.
4. Stats lines must not leak into review snippets as item labels.
5. JSON and HTML pastes return null so other import paths own them.

### 7.6 Parser function inventory

Important symbols in `reddit-haul.js`:

| Symbol | Role |
|--------|------|
| `deobfuscateUrls` | Repair spaced and escaped URLs |
| `parseStats` / stats line helpers | Poster height, weight, size, agent |
| `cleanLabel` | Strip junk labels |
| `headerSplit` | Header vs review at boundaries |
| `pickPrimaryUrl` | Marketplace over agent when both exist |
| `extractItems` | Core line walk |
| `titleLabel` | Title-derived name for sparse posts |
| `parseRedditHaul` | Public entry |

Grok expands fixtures and edge cases first. Parser code changes need a failing fixture before the edit.

### 7.7 Suggested communities for later harvest

1. FashionReps (already started)
2. DesignerReps
3. Repsneakers
4. Agent-specific haul flairs if public and harvestable

Stay legal and technical. Use public pages. Keep rate human. Store only what tests need.

---

## 8. Agent registry completeness

### 8.1 Current strengths

`agents.js` is table-driven. Template types exist:

- `urlTemplate`
- `idPathTemplate`
- `idUrlTemplate`
- `idPlatformTemplate`

Retired agents stay in the table with `retired: true`. They fail open and hide from the picker. CSSBuy is the known retired example for USA purchasing limits.

Referral codes come from build env only. Per-user override path was removed on purpose.

### 8.2 Grok pure work

1. Negative host tests: random hosts, phishing lookalikes, `javascript:`, `data:` URLs.
2. Referral matrix table: every agent × null code / env code / retired.
3. Fail-open tests for every template type.
4. Platform map completeness for Weidian, Taobao, Tmall, and 1688 on each platform-token agent.
5. Signup URL tests for agents that pay on registration.
6. Outbound summary tests for privacy fields only.

### 8.3 Do not do these without Kyle

1. Change live wrap formats without a curl probe and a real click-through.
2. Delete retired agents.
3. Hardcode referral secrets into the repo.
4. Mark `verified: true` without a live open.

### 8.4 One-click buy completeness (product view)

Today:

1. Canonical URL is stored forever.
2. `buildAgentUrl` runs at open time.
3. Referral comes from env.
4. FTC disclosure is present.

Still weak for “set up the whole haul”:

1. Bulk checklist with per-item size.
2. Honest multi-open or export list agents understand.
3. Parcel estimate next to the checklist.
4. Preferred agent onboarding that does not brick first Buy.
5. Optional per-item agent override from Monetization A2.

Pure work for that is a checklist state machine plus export format tests. UI waits for a Claude or Fable spec.

---

## 9. Entitlements and billing pure layer

### 9.1 Current strengths

- `lib/entitlements.js` lifecycle
- Webhook idempotency
- Offline HMAC snapshots
- Free limit math
- Paid gate on server routes

### 9.2 Grok fills cases

Expand tests around:

1. Order of Stripe events. Checkout before subscription update.
2. Grace to free transition at day boundaries in UTC.
3. Double-click checkout.
4. Portal before first payment.
5. Snapshot tamper detection.
6. Usage counter reset at UTC midnight.
7. Bad Bearer never downgrades to shared key path.
8. Replay of the same event returns success with no double apply.

### 9.3 Gate

Fable or a human reviews any new state shape. Grok only expands tests and small pure helpers unless the state machine design is already approved.

### 9.4 Kyle blockers outside pure code

1. Stripe secrets on Netlify if real checkout is next.
2. Supabase URL and JWT secrets if account UI must work everywhere.
3. Real-card Part 7g gate.

---

## 10. Netlify function clones from known guards

### 10.1 Rule

When a new helper is needed, copy the known patterns. Do not invent a new security model.

Needed patterns live in:

- `preview.js` and `guard.js` for SSRF
- `limit.js` for rate and cost
- `paid-gate.js` and `auth.js` for auth
- `reddit.js` for Reddit-specific fetch flow
- outcome JSON logging with hashed key and no body content

### 10.2 Future function candidates

| Function idea | Clone from | Notes |
|---------------|------------|-------|
| Link context live lookup | `reddit.js` + guards | After OAuth |
| Parcel track deep link helper | simple redirect builder + auth if paid | Prefer external 17Track link first |
| Bulk resolve queue | `resolve.js` + limit | Careful cost ceiling |
| Weight from image text | only if chart-vision style already covers it | Do not duplicate |

### 10.3 Acceptance for any new function

1. SSRF tests pass on private IPs and odd IPv4 forms.
2. Rate limit returns 429 with Retry-After.
3. Paid path uses Bearer account caps when accounts are required.
4. Logs never store raw listing content.
5. Body size caps exist.
6. Unit tests use mocks, not live network, in CI.

---

## 11. migrateItem completeness audit

### 11.1 Why this matters

If import writes a field and migrate drops it, the user loses data on reload. That is a product-breaking silent bug.

### 11.2 Mechanical inventory method

1. List every field written by:
   - `parseImport` and Reddit haul path
   - resolve merge
   - QC paste
   - size chart and recommendSize
   - haul board parcel editor
   - any new link-context attachment
2. Diff against `migrateItem` whitelist.
3. Build a maximal item object with every field set.
4. Round-trip: `migrateItem(JSON.parse(JSON.stringify(item)))`.
5. Deep equal on every field that must survive.
6. Repeat for `migrateHaul`.

### 11.3 Known survivor fields already include

Examples:

- `posterStats`
- `posterUser`
- `sourceText`
- `weightGrams`
- `qcPhotos`
- `qcNote`
- `qcVerdictAt`
- `variants`
- `sizeNotes`
- `recommendedSize`
- links and images
- find status
- project or haul name fields as currently modeled

### 11.4 Rule for new pure features

Any new field ships with:

1. Write path.
2. Migrate line.
3. Round-trip test.
4. Erase-all awareness if it uses a new storage key.

---

## 12. Import paths and export paths

### 12.1 Import providers to fixture

1. Reddit haul paste
2. Raindrop CSV
3. Pocket HTML with `time_added`
4. Browser bookmark HTML with `ADD_DATE`
5. Generic CSV
6. Generic JSON backup

Preserve original saved dates, tags, and notes when the provider has them. Silent loss of provider fields has been a real past bug in the generic app. Fashion import must not repeat that class of loss for haul-critical fields.

### 12.2 Export

`credenza-haul-export.js` needs round-trip tests:

1. Export CSV.
2. Export JSON.
3. Re-parse raw haul text where that path exists.
4. Read-only share payload shape if present or planned.

Acceptance:

- No loss of canonical buy URL.
- No loss of size and weight override.
- No loss of QC verdict fields on JSON backup.

---

## 13. Size charts and stock or color clarity

### 13.1 Size charts

Existing pure path:

- `parseSizeChart`
- `recommendSize`
- body profile with unit conversion
- fit preferences looseness nudge

Exhaustive pure work:

1. More CJK axis labels.
2. More positional tables without headers.
3. Mixed unit rows.
4. “Runs small” and “runs large” hints.
5. Empty chart honest states.

### 13.2 Color and stock

Resolve already returns variants with value names and sometimes images. Pure gaps:

1. Normalize color synonyms for search.
2. Detect out-of-stock markers in text if present.
3. Keep variant images attached to the right value.
4. Never invent stock when the API is silent.

Stock truth is often incomplete on marketplace shells. The UI must say when stock is unknown.

### 13.3 Viewing chopped Chinese sites

The product win is not a full China browser. The product win is:

1. Translated or cleaned title.
2. Photo gallery that works around hotlink rules.
3. Size chart extraction.
4. Variant list.
5. Price in CNY and USD when known.
6. Pair photos (Yupoo) with buy link (Weidian or Taobao).

Pure tests should freeze sample resolve payloads and chart texts as fixtures so UI and network volatility do not hide parser bugs.

---

## 14. Mapping Kyle’s Tier list to this plan

| Kyle tier item | Plan section | Can start now while K3 works? |
|----------------|--------------|-------------------------------|
| 1 Golden fixture corpora | §5 weight fixtures, §7 Reddit fixtures, §12 import | Yes, data and tests only |
| 2 Agent registry completeness | §8 | Yes, tests first |
| 3 Entitlement pure tests | §9 | Yes |
| 4 Function clones from guards | §10 | Spec only until a real need ships |
| 5 migrateItem audit | §11 | Yes, read and tests |
| 6 Vitest bulk pure paths | all pure sections | Yes |
| 7 Tier B pure layers | §15 | Spec stubs only until Claude or Fable designs rules |
| 8 Extension MV3 | not pure product core | No for this lane |
| 9 Haul export and import | §12 | Yes on export module tests |
| 10 Cost and rate tables | §10 and limit tests | Yes |
| 11 Dead code and extract-under-map | Claude writes the map | Wait |
| 12 Legal page drafts | optional | Optional draft only |
| 13 Help and FAQ volume | optional | Optional draft only |
| 14 Launch matrix content | optional | Optional draft only |

---

## 15. Tier B pure layers (spec first)

These need a Claude or Fable design pass before Grok types production rules.

### 15.1 Seller memory

Store per seller or Weidian shop:

- notes
- batch names
- RL history count
- bait flag

Pure merge rules:

- What key identifies a seller?
- How do two notes merge?
- What is the cap on history?

### 15.2 Dupe detection

Keys:

- Weidian id
- Yupoo album
- Paired photos + buy links

Actions:

- warn
- merge
- link as same item across hauls

### 15.3 Parcel mode totals

Already partly present. Extend pure rules for:

- split parcels by weight ceiling
- packing prefs
- declare template fields as user text only, never customs advice

### 15.4 Bulk agent checklist state machine

States:

- selected
- size locked
- ready
- opened
- ordered
- skipped

Events:

- select
- set size
- open agent
- mark ordered
- reset

### 15.5 17Track field client

Freeze the deep-link contract first. Prefer open external tracker. Do not rebuild global package tracking.

---

## 16. Recommended sequence with no K3 collision

### Phase P0 — Research freeze

This document is P0.

Exit when Kyle accepts the framing and picks a next phase.

### Phase P1 — Fixtures only

Branch: `pure/fixtures-only`

Work:

1. Freeze current 22-post corpus as golden.
2. Harvest toward 200 posts into a new JSON file.
3. Add expected-output fixtures for the known hard Reddit cases.
4. Expand `weight.test.js` with a data table for every current category and garbage inputs. Do not change API yet if K3 risk is high.
5. Add agents negative-host and referral matrix tests.
6. Write maximal `migrateItem` round-trip test.
7. Add haul export round-trip cases if missing.

Exit:

- Test count up.
- Product code untouched or only test imports of existing exports.
- Main stays green.
- Easy branch delete if needed.

### Phase P2 — Pure modules on a branch

Branch: `pure/weight-and-link-context`

Work:

1. Extract or propose `weight-estimate.js` with banded estimates and text parsers.
2. Implement `link-context.js` and corpus index over the 200-post set.
3. Wire nothing into UI until pure tests pass.
4. Optional: re-export weight helpers from fashion jsx with identical behavior.

Exit:

- Pure APIs green.
- App behavior identical if any re-export landed.

### Phase P3 — Thin product wiring

Owner: Claude or Fable with human review. Do this when K3 is idle or after merge planning.

Work:

1. Card back community notes from L0 corpus only.
2. Weight chip shows mid and band and one-line reason.
3. Haul board packing toggle for no-shoebox.
4. Only then consider L1 Reddit live lookup after OAuth exists.

### Phase P4 — Bulk agent checklist and one-click setup

Tier B1. Spec first. Pure state machine second. UI third.

---

## 17. What “perfect” means for this pure path

Credenza feels correct when all of these are true:

1. A bare Weidian link becomes a clear card with title, photo, and variants when resolve works, and a usable local card when resolve fails.
2. That card can show prior human notes from a local corpus or the user history without becoming a marketplace.
3. Weight is a band with a reason, not a lonely fake gram.
4. Size is chart plus body profile. Fabric behavior is never invented.
5. Buy opens the right agent with referral every time, or fails open to the canonical link.
6. A haul shows product total, chargeable weight, and QC path without a spreadsheet.
7. Pure parsers and estimators have hundreds of fixed cases so Grok can harden them without redesigning the product.
8. Reload never drops haul-critical fields.
9. Server helpers use the same guards every time.
10. The UI stays quiet and editorial while the pure engines get stricter.

---

## 18. What not to build

| Idea | Reason |
|------|--------|
| Live multi-agent rate scraping | Fragile. Agents own that UX. Near Tier C arms race. |
| Global W2C search of brands | Tier C ban. Lawsuit and trust risk. |
| Customs tips or declare-low advice | Legal landmine. Not the product job. |
| Freehand rewrite of carousel or the 13k JSX | High merge risk. Wrong owner while K3 works. |
| New security model for functions | Clone existing guards. |
| Fake precise ship money | Dishonest without real agent weigh or user rate. |
| Paid best-batch leaderboard | Community trust poison and business risk. |
| In-app checkout that replaces agents | Wrong battlefield. |

---

## 19. File checklist for future pure PRs

### 19.1 Safe additions

```text
preview/scripts/corpus-haul-200.json
preview/scripts/link-context-corpus.json
preview/scripts/harvest-*.mjs
preview/test/fixtures/reddit-haul/*.json
preview/test/fixtures/weight-cases.json
preview/test/fixtures/import/*.json
preview/test/link-context.test.js
preview/test/weight.test.js
preview/test/agents.test.js
preview/test/migrate-roundtrip.test.js
preview/test/haul-export.test.js
docs/specs/weight-estimate.md
docs/specs/link-context.md
docs/pure-layer-exhaustiveness-plan.md
```

### 19.2 Later pure modules

```text
weight-estimate.js
link-context.js
```

Prefer new files at repo root next to `reddit-haul.js` and `agents.js`, or under a small `lib/` if a map is agreed.

### 19.3 Only when wiring UI or server

```text
credenza-fashion.jsx
sheets/DetailSheet.jsx
preview/netlify/functions/link-context.js
migrateItem fields
erase-all keys if new storage appears
```

---

## 20. Test strategy that Grok can run hard

### 20.1 Unit tests first

Use Vitest. Keep cases table-driven.

Pattern:

```text
const CASES = [ { name, input, expected }, ... ]
for (const c of CASES) {
  it(c.name, () => expect(fn(c.input)).toEqual(c.expected))
}
```

### 20.2 Corpus score second

Run harvest corpora through parsers. Print counts. Fail CI only on golden frozen sets. Use the large 200 set as a score report first, then promote stable cases into golden fixtures.

### 20.3 Playwright probes last for pure claims

Pure functions do not need Playwright. Use Playwright only when a pure change is wired into UI and K3 is not mid-edit on the same surface.

### 20.4 Gate commands

From `preview/`:

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Run all four before any pure PR merge into main when product files changed. For fixture-only branches, `npm test` is the minimum.

---

## 21. Operational constraints and environment facts

1. npm root is `preview/`, not the repo root for app scripts.
2. Production domain is live as Credenza Fashion. Deploy only with Kyle approval.
3. Repo may have no remote or limited remote history depending on session state. Local branches still protect work.
4. Reddit anonymous JSON is blocked from many datacenter IPs. Harvester uses browser session. Production reader needs OAuth env.
5. Yupoo photo CDN needs correct referer. That is already fixed in chart-vision. Do not regress it.
6. ASD-STE100 applies to commit messages and user-facing copy.
7. Money green is a signal token, not decoration.
8. Never put raw hex colors in JSX. Use tokens.

---

## 22. Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Edit same files as K3 | Merge pain, lost UI work | Fixtures and new files only |
| Link context looks like W2C search | Strategy and legal risk | L0 on stashed items only, no brand browse |
| Weight bands still feel wrong | User distrust | Show reason and agent disclaimer |
| 200-post harvest blocked | Delayed corpus | Keep 22 golden, retry harvest, manual paste fixtures |
| migrateItem miss | Silent data loss | Maximal round-trip test mandatory |
| New function SSRF hole | Security incident | Clone guard tests, no new model |
| Scope creep into Tier C | Wasted work and risk | Feature filter in §2.4 |
| Over-precise ship $ | User anger when agent bill differs | No fake $ without user rate |

---

## 23. Immediate ask of Kyle

Pick one:

1. **Research only.** Keep this document. No code until K3 is done.
2. **P1 fixtures branch.** Harvest and golden tests only. No app wiring.
3. **P1 plus weight design data.** Add `docs/specs/weight-estimate.md` and fixture JSON. Still no UI wiring.

Recommendation: **option 2**.

Why:

1. It hardens the product where silent failure is worst.
2. It does not block K3.
3. It gives Grok a clean pure surface for Reddit context and weight truth.
4. It is easy to revert.

Still on Kyle for live truth:

1. Reddit OAuth app env vars.
2. Stripe secrets if Part 7g real-card is next.
3. Deploy approval for any branch that is not pure data.

---

## 24. Detailed P1 task list

Use this as a checklist when option 2 starts.

### 24.1 Branch setup

1. Create branch `pure/fixtures-only` from a known green main commit.
2. Do not deploy.
3. Do not edit sheets or fashion CSS.

### 24.2 Reddit golden freeze

1. Copy or pin current `corpus-fashionreps.json` behavior in tests.
2. Ensure the 8 known corpus regression tests still pass.
3. Add a note in `preview/scripts/` that the 22-post file is frozen.

### 24.3 Harvest 200

1. Run harvester with target 200 into a new file.
2. If harvest fails, save partial results. Do not overwrite golden.
3. Run corpus scorer. Save report text under `preview/scripts/reports/` if useful.
4. Promote only stable hard cases into unit fixtures.

### 24.4 Weight fixture expansion without API change

1. Table-test all current `CATEGORY_WEIGHT_GRAMS` keys.
2. Table-test garbage overrides.
3. Table-test returned exclusion.
4. Table-test volumetric and packaging edges already covered and add missing null paths.
5. Add commented future cases for listing parse so P2 can enable them.

### 24.5 Agents expansion

1. Negative hosts.
2. Every agent appears once in a matrix test for wrap shape.
3. Retired fail-open.
4. Referral null vs present.
5. Platform map missing-id fail-open.

### 24.6 migrateItem maximal object

1. Construct item with every known field.
2. Round-trip through migrate.
3. Fail if any must-keep field disappears.
4. Same for haul record.

### 24.7 Exit report

Write a short note in the PR or branch README:

1. Tests added.
2. Files added.
3. Product files touched: none.
4. Known corpus score numbers.

---

## 25. Detailed P2 task list

Start only when P1 is green and pure modules will not collide, or keep modules unimported.

### 25.1 weight-estimate.js

1. Move or reimplement category table.
2. Add subcategory table.
3. Add `parseWeightFromText`.
4. Add `estimateItemWeight`.
5. Keep old function names as wrappers.
6. Full fixture file.

### 25.2 link-context.js

1. `canonicalKeyFromUrl`
2. `indexCorpus`
3. `lookupLinkContext`
4. Corpus JSON from harvest
5. Precision tests
6. No UI import yet

### 25.3 Optional app re-export

1. Fashion jsx re-exports old weight helpers from new module.
2. No visual change.
3. Full test gate.

---

## 26. Detailed P3 wiring notes (future)

### 26.1 Community notes panel

1. On card back or detail sheet only.
2. Call pure lookup with local index first.
3. Empty state is quiet.
4. No brand search box.

### 26.2 Weight band display

1. Replace lone gram chip with mid and optional band.
2. Keep `~`.
3. Show reason on expand or secondary line.
4. Keep agent disclaimer on haul board.

### 26.3 No-shoebox toggle

1. Haul or parcel setting.
2. Pure estimate reacts.
3. Copy states that the agent still measures the final parcel.

---

## 27. Worked example: bare Weidian link

User pastes:

```text
https://weidian.com/item.html?itemID=7785888265
```

Desired system behavior:

1. Gate accepts as fashion buy URL.
2. Card is created with canonical buy link.
3. Resolve fills title, price, images, variants if network works.
4. Canonical key becomes `weidian:7785888265`.
5. Link context L0 finds prior mentions in the local corpus if any.
6. Card shows community notes when mentions exist.
7. Category guess may say shoes.
8. Weight estimate uses shoe band, not a fake exact ship dollar.
9. Size block waits for chart or usual size. It does not invent.
10. Buy opens preferred agent with wrap and referral.
11. Reload keeps all fields through `migrateItem`.

Pure coverage for this path:

- gate test
- key test
- context lookup test
- weight band test
- agent wrap test
- migrate round-trip test

UI and network resolve stay outside the pure gate except for fixture payloads.

---

## 28. Worked example: Reddit haul paste

User pastes a long haul with stats and many links.

Desired system behavior:

1. Parser returns one item per shoppable product link.
2. Labels come from names above links or colon headers, not from the next item.
3. Poster height and weight land on haul or item stats.
4. Review notes stay with the correct item.
5. Invite links are ignored.
6. Cards enter a named haul when the flow says so.
7. Source text is preserved for re-parse.
8. Weight defaults appear after category guess.
9. User can override weight and size later.
10. Haul board sums money and weight without returned items.

Pure coverage:

- full paste fixtures
- attribution fixtures
- stats fixtures
- invite exclusion
- migrate of sourceText and posterStats

---

## 29. Worked example: parcel planning

User has 8 GL items and 1 returned item.

Desired system behavior:

1. Returned item is out of ship weight.
2. Item weights use override or estimate bands.
3. User enters box dims.
4. Chargeable weight is max of packaged actual and volumetric.
5. Copy says estimate only.
6. Checklist can open agent links for the GL set.
7. No customs evasion text appears anywhere.

Pure coverage:

- returned exclusion
- packaging factors
- volumetric math
- checklist state later in Tier B

---

## 30. Grok operating rules for this plan

1. Spec first when state is new.
2. Fixture first when parser behavior is new.
3. One pure module per PR when possible.
4. No carousel edits.
5. No deploy.
6. No Tier C features.
7. No new security model.
8. No silent migrate misses.
9. Prefer short STE100 commit messages.
10. Report scores with numbers, not vibes.

---

## 31. Claude and Fable operating rules for this plan

1. Own UI wiring and product language.
2. Own any new state machine shape.
3. Review extract maps before large JSX splits.
4. Keep Monetization tiers.
5. Keep editorial quiet UI.
6. Ask Kyle before strategy changes.

---

## 32. Success metrics

### 32.1 Engineering metrics

1. Golden Reddit fixtures: at least the current hard set plus new stable cases from the 200 harvest.
2. Weight fixtures: at least one case per subcategory and every parse form.
3. Agent negative tests: nonzero and growing host matrix.
4. migrate round-trip: maximal object passes.
5. Link context precision: fixture suite passes at 100% on labeled keys.

### 32.2 Product metrics later

1. Buy click rate after stash.
2. Share of cards with size decision.
3. Share of hauls with parcel weight filled.
4. Share of cards with community notes shown when corpus has hits.
5. Support burden from wrong weight expectations. Should fall after bands and reasons ship.

---

## 33. Open questions for Kyle

1. Start P1 fixtures now, or wait until K3 finishes the current UI batch?
2. Is a local-only community notes panel acceptable for v1 of link context?
3. Which communities beyond FashionReps should harvest include first?
4. For weight, is a band on the card enough, or do you also want a simple user `$ / g` field soon?
5. Should bulk checklist come before or after live Reddit OAuth?
6. Any seller memory fields that matter more than notes and RL count?

---

## 34. Summary

Credenza must make chopped Chinese listings and haul chaos understandable, then hand the user to an agent with confidence.

The pure layers that make that trust real are:

1. Parsers for hauls and imports.
2. Size chart math.
3. Weight estimation with honest bands.
4. Agent URL correctness.
5. Link context without a marketplace.
6. migrate and entitlement safety.
7. Server guards copied, not reinvented.

While K3 owns UI, this lane stays on research, fixtures, and pure tests. The first execution step is a fixtures-only branch. The first product breakthrough after that is banded weight plus local link context on stashed items.

This document is the full research plan for that path. It is safe to keep, edit, or delete without product impact. No product code was changed to create it.

---

## 35. Appendix A — Current weight helper behavior (reference)

Public behavior to preserve during extraction:

1. Manual positive finite `weightGrams` wins and rounds.
2. Non-positive or non-numeric override falls back to category.
3. Unknown category returns null.
4. Format under 1000 g as `~NNN g`.
5. Format at or above 1000 g as `~N.N kg` with one decimal from deci-kg rounding.
6. Haul sum skips `findStatus === "returned"`.
7. Volumetric divisor is 5000 cm³/kg, implemented as `(l*w*h)/5` grams.
8. Packaging factors: none 1.0, standard 1.1, reinforced 1.2.
9. Chargeable weight is the max of packaged actual and volumetric when either side exists.

---

## 36. Appendix B — Current agent template types (reference)

1. **urlTemplate** — encode full canonical URL into `{url}`.
2. **idPathTemplate** — marketplace numeric id in path.
3. **idUrlTemplate** — id and url together, Fansbuy style.
4. **idPlatformTemplate** — id plus platform token or code, Mulebuy or CNFans or Hoobuy family.

Fail open always beats a wrong guess.

---

## 37. Appendix C — Suggested fixture names for Reddit

```text
gats-qc-single-link.json
15kg-gtbuy-colon-names.json
french-hipobuy-numbered-articles.json
name-above-link-attribution.json
obfuscated-spaces-weidian.json
agent-invite-excluded.json
yupoo-root-plus-album-join.json
tb-cn-shortlink.json
mycnbox-agent-primary.json
stats-not-in-labels.json
markdown-table-w2c.json
single-link-with-title-provenance.json
seller-promo-label-noise.json
```

Each file holds input text, options, and expected constraints. Keep expected constraints tight where the product promise is tight. Keep them loose where community text is noisy, but never loose on invite exclusion or right-item attribution.

---

## 38. Appendix D — Suggested weight fixture groups

```text
override-wins.json
category-defaults.json
garbage-override-fallback.json
returned-excluded-from-haul.json
volumetric-basic.json
packaging-factors.json
parse-grams-from-text.json
parse-kg-from-text.json
parse-cjk-grams.json
title-hoodie-refinement.json
title-boot-vs-slide.json
no-shoebox-delta.json
unknown-null.json
```

---

## 39. Appendix E — Canonical key examples

| URL shape | Key |
|-----------|-----|
| `weidian.com/item.html?itemID=123` | `weidian:123` |
| `weidian.com/item.html?itemId=123` | `weidian:123` |
| `item.taobao.com/item.htm?id=456` | `taobao:456` |
| `detail.tmall.com/item.htm?id=789` | `tmall:789` |
| `yupoo.com/.../albums/555` with seller account | `yupoo:seller/555` |
| agent wrap of weidian | key from unwrapped marketplace id if recoverable, else null |
| random blog URL | null |

---

## 40. Appendix F — STE100 notes for future copy

When pure results reach the UI, use short clear lines.

Good:

- Estimate only. Your agent weighs the final parcel.
- Community notes from posts you can open.
- Weight unknown. Add grams or pick a category.
- Size needs a chart or your usual size.

Bad:

- AI magic fit certainty.
- Best 1:1 batch guaranteed.
- Beat customs with this declare value.

---

## 41. Closing

This plan is exhaustive on purpose. The product only becomes trustworthy when the pure engines are strict and the UI stays calm.

Start with fixtures. Extract weight next. Build local link context next. Wire UI after the pure tests are green. Keep K3 unblocked. Keep Tier C closed. Keep the agent as the final warehouse truth.

End of plan.


---

## 42. Appendix G — Full pure function inventory (expanded)

This appendix lists pure or near-pure functions that deserve fixture coverage. Line numbers drift. Search by name.

### From `reddit-haul.js`

| Function | Input | Output | Fixture priority |
|----------|-------|--------|------------------|
| `deobfuscateUrls` | messy text | text with repaired URLs | high |
| `parseStats` | stats block | height, weight, size, agent | high |
| `cleanLabel` | raw label | cleaned label | high |
| `headerSplit` | line + boundary flag | header vs review parts | high |
| `pickPrimaryUrl` | url list | marketplace preferred URL | high |
| `extractItems` | body text | item list | high |
| `titleLabel` | post title | fallback name | medium |
| `parseRedditHaul` | text + opts | haul or null | critical |
| `guessCategory` | label | category key | medium |

### From `agents.js`

| Function | Input | Output | Fixture priority |
|----------|-------|--------|------------------|
| `getAgent` | id | agent row or null | medium |
| `listAgents` | none | non-retired agents | medium |
| `marketplaceOf` | url | marketplace key | high |
| `agentOf` | url | agent host match | high |
| `extractMarketplaceItemId` | url | marketplace + id | high |
| `resolveReferralCode` | agent | code or empty | high |
| `buildSignupUrl` | agent id | signup URL or null | medium |
| `buildAgentUrl` | agent id + canonical | wrap result | critical |
| `hashItemId` | id | privacy hash | low |
| `summarizeOutbound` | clicks | summary | low |

### From fashion weight helpers

| Function | Input | Output | Fixture priority |
|----------|-------|--------|------------------|
| `itemWeightGrams` | item | grams or null | critical |
| `formatWeightGrams` | grams | display string | high |
| `haulWeightGrams` | items | sum or null | critical |
| `volumetricWeightGrams` | dims | grams or null | high |
| `chargeableWeightGrams` | actual, dims, packaging | grams or null | critical |
| `migrateHaul` | raw haul | clean haul or null | high |

### From size path

| Function | Input | Output | Fixture priority |
|----------|-------|--------|------------------|
| `parseSizeChart` | chart text | structured chart | critical |
| `recommendSize` | chart, profile, category, fitPref | size + reason | critical |
| measure unit converters | value + unit prefs | storage or display value | high |

### From gate and import

| Function | Input | Output | Fixture priority |
|----------|-------|--------|------------------|
| `isFashionUrl` | url | boolean | high |
| `fashionGateStatus` | text | status object | high |
| `parseImport` | text + opts | candidates + provider | critical |
| `migrateItem` | raw item | clean item | critical |

### Proposed new pure modules

| Function | Module | Purpose |
|----------|--------|---------|
| `parseWeightFromText` | weight-estimate | listing and title grams |
| `refineWeightKeyFromText` | weight-estimate | subcategory from keywords |
| `estimateItemWeight` | weight-estimate | banded estimate object |
| `canonicalKeyFromUrl` | link-context | stable item key |
| `indexCorpus` | link-context | key to mentions map |
| `lookupLinkContext` | link-context | mentions for a URL |

---

## 43. Appendix H — Example failing cases to hunt in the 200 corpus

Use these as search themes when you score the 200-post harvest. Promote any stable failure into a golden fixture.

1. Name on the line above the link, with a blank line between name and URL.
2. Name on the line above the link, with no blank line.
3. `Name: review text` then URL on the next line.
4. Markdown table with a W2C column.
5. Markdown link whose anchor is only "W2C" or "link".
6. Agent register URL mixed into a real haul.
7. Yupoo root URL plus a detached `/albums/123` path on the next line.
8. `tb.cn` short links.
9. Weidian URLs with Reddit `\_` escapes and spaces.
10. French or other non-English numbered article lists.
11. Poster stats in imperial units only.
12. Poster stats mixed into the first item label by mistake.
13. Single QC image post with one Weidian link and a long review above it.
14. Seller lookbook post where every card would take the seller name if unfiltered.
15. Multi-agent comparison line that is not an item.
16. Price-only lines with no URL.
17. Discord-style bare links with angle brackets.
18. WhatsApp-obfuscated dots in hostnames if present.
19. Album + buy pair on one line.
20. Same Weidian id repeated twice in one post.

For each theme, record:

- post id
- whether parse returned a haul
- item count
- label quality score (human pass or fail)
- category quality score
- notes for a future fixture

---

## 44. Appendix I — Link context ranking rules (local only)

When more than one mention exists for a key, sort for display as follows:

1. Mentions with poster height and weight first.
2. Mentions with an explicit size next.
3. Mentions with a non-empty note next.
4. Newer harvest or post id as a weak final tie break if dates exist.

Do not score “batch quality.” Do not score “1:1.” Those rankings create a marketplace shape.

Display cap for free UI later:

- show top 3 notes
- offer open source posts for the rest

Pro can raise the cap. That is a product decision, not a pure decision.

---

## 45. Appendix J — Weight reason line catalog

The pure estimator should return one of a fixed reason set so UI copy stays consistent.

Examples:

- `Manual weight.`
- `Listing text says N g.`
- `Title looks like a hoodie. Mid estimate.`
- `Category default for shoes. Includes box assumption.`
- `Category default for shoes. No-shoebox packing applied.`
- `Weight unknown.`

Never return:

- `AI determined this is exactly 847 g.`
- `Shipping will cost $23.41.`

---

## 46. Appendix K — Security clone checklist for a future link-context function

Before any live Reddit lookup function merges:

1. Auth matches paid-gate or shared-key policy already used by `reddit.js`.
2. SSRF guard rejects private and special-use IPs on every hop.
3. Redirects are checked, not followed blindly.
4. Response byte cap exists.
5. Rate limit per IP and per account exists.
6. Daily cost ceiling is considered if the path uses paid LLM work. Prefer no LLM on pure id search.
7. Logs store route, status, latency, hashed key. Logs do not store selftext.
8. Allowed host list is Reddit only.
9. Subreddit allow list is explicit.
10. Unit tests cover the above with mocks.

---

## 47. Appendix L — migrateItem field worksheet

Use this worksheet when adding a field.

```text
Field name:
Written by (function or UI path):
Type and validation:
Default when missing:
Included in migrateItem? (yes/no)
Included in erase-all key sweep if new key? (yes/no/n/a)
Round-trip test name:
UI surfaces that show it:
Pro or free?
Risk if dropped on reload:
```

Required for:

- any community notes cache on the item
- any weight band cache if stored
- any packing flags on haul parcel
- any checklist state if persisted

---

## 48. Appendix M — Definition of done for P1

P1 is done when all of the following are true:

1. Branch name is `pure/fixtures-only` or equivalent.
2. Golden 22-post corpus still passes.
3. A second corpus file exists with a larger harvest or a clear blocked report.
4. At least 10 new table-driven pure tests landed across weight, agents, or migrate.
5. `npm test` is green in `preview/`.
6. No edits to `sheets/*` or carousel CSS.
7. No deploy occurred.
8. A short branch report lists numbers, not adjectives.

---

## 49. Appendix N — Definition of done for P2

P2 is done when:

1. `weight-estimate.js` or proposed module has banded estimates and text parse fixtures.
2. `link-context.js` or proposed module indexes the local corpus and returns precise mentions.
3. Old weight call sites still pass through wrappers if extraction landed.
4. UI still looks and behaves the same if any re-export landed.
5. Full test gate is green.
6. No Tier C UI shipped.

---

## 50. Final reminder

The user experience becomes excellent when the pure engines are strict and the interface stays calm.

Keep those concerns separate:

- Grok hardens pure engines with fixtures.
- Claude and K3 shape the quiet interface.
- Kyle approves deploy and sets production secrets.

This plan exists so those roles do not collide.


---

## 51. Appendix O — User journey scripts for pure scoring

These scripts are not UI tests. They are pure input sequences you can turn into fixtures.

### Journey 1 — Bare link to Buy

1. Input URL only.
2. Gate accepts fashion host.
3. Item created with canonical buy URL.
4. Canonical key extracted.
5. Context lookup returns zero or more mentions.
6. Category guess or resolve category sets weight band.
7. Agent wrap succeeds for preferred agent.
8. migrateItem keeps every field after reload simulation.

Score:

- key not null for Weidian and Taobao sample set
- wrap not equal to empty
- migrate loses zero must-keep fields

### Journey 2 — Full haul paste

1. Input multi-item post body with stats.
2. parseRedditHaul returns haul.
3. Each item has label quality pass or explicit known hard-fail tag.
4. Poster stats parsed once.
5. Invite links absent from items.
6. Haul weight sum ignores returned later.

Score:

- labeled item ratio
- categorized item ratio
- zero invite cards

### Journey 3 — Size then weight

1. Input chart text and body profile.
2. recommendSize returns size or honest empty.
3. estimateItemWeight returns band with reason.
4. User override weight becomes high confidence.

Score:

- no invented size without chart or usual
- override always wins

### Journey 4 — Parcel chargeable weight

1. Input GL items with categories.
2. Input dims and packaging.
3. chargeableWeightGrams returns max path.
4. Disclaimer string remains separate from pure math.

Score:

- math fixtures exact
- returned items excluded before chargeable input is built

---

## 52. Appendix P — Data contracts for proposed pure modules

### weight-estimate.js contract

```text
parseWeightFromText(text: string) -> { grams: number, raw: string } | null
refineWeightKeyFromText(text: string, category: string) -> string
estimateItemWeight(item: object) -> {
  grams: number | null,
  lowGrams: number | null,
  highGrams: number | null,
  source: "override" | "listing" | "title" | "category" | "unknown",
  confidence: "high" | "mid" | "low",
  reason: string
}
```

Invariants:

1. If source is override, confidence is high.
2. If grams is null, low and high are null.
3. If grams is not null, low <= grams <= high.
4. reason is non-empty always.

### link-context.js contract

```text
canonicalKeyFromUrl(url: string) -> string | null
indexCorpus(posts: array) -> object
lookupLinkContext(url: string, index: object) -> {
  key: string | null,
  mentions: array,
  count: number,
  sizesSeen: array,
  heightWeightPairs: array
}
```

Invariants:

1. count equals mentions length.
2. lookup of unknown key returns count 0 and empty arrays.
3. index building is deterministic for the same posts array.
4. no mention contains an agent register URL as the item url.

---

## 53. Appendix Q — STE100 commit message patterns for pure PRs

Use short imperative lines.

Good:

- Add Reddit haul fixtures for name-above-link cases.
- Expand agent negative host tests.
- Add migrateItem maximal round-trip test.
- Extract weight estimate module with wrappers.

Bad:

- Supercharge the weight AI vibes.
- Refactor everything in fashion jsx.
- Temporary hack for shipping dollars.

---

## 54. Appendix R — Coordination protocol with K3

1. Before any product file edit, run `git status -sb` in `~/credenza`.
2. If K3 paths are dirty, stay on fixtures.
3. If you need a shared pure module name, write a proposed file first.
4. Tell Kyle which branch is pure-only.
5. Do not rebase K3 branches.
6. Do not deploy.
7. After K3 merges, rebase pure branch onto main and run the full gate.

---

## 55. Appendix S — Minimum fixture counts by area

These are targets, not vanity metrics.

| Area | Minimum fixtures before UI wiring |
|------|-------------------------------------|
| Reddit hard cases | 12 named fixtures |
| Frozen corpus posts | 22 |
| Extended harvest | 200 attempted |
| Weight table cases | 40 |
| Weight text parse cases | 20 |
| Agent wrap cases | 1 per agent template type |
| Agent negative hosts | 15 |
| migrate maximal fields | 1 full object + 5 edge objects |
| link context keys | 30 known keys from corpus |
| import providers | 1 happy path each |

---

## 56. Closing statement

Credenza wins when a messy link becomes a clear decision surface, then a clean agent handoff.

The pure layers make that decision surface trustworthy. This document is the map for building those layers without blocking the UI lane and without crossing into banned marketplace behavior.

Keep the plan. Run P1 when ready. Expand pure modules only after fixtures prove the behavior.


---

## 57. Appendix T — Agent-by-agent pure test matrix

For each agent row in `agents.js`, maintain a row in the test matrix.

| Agent id | Template type | Supports | Retired | Referral param | Signup template | Must-pass wrap fixture | Must-pass fail-open fixture |
|----------|---------------|----------|---------|----------------|-----------------|------------------------|-----------------------------|
| superbuy | urlTemplate | weidian, taobao, tmall, 1688 | no | partnercode | yes | weidian item | yupoo album |
| sugargoo | urlTemplate | weidian, taobao, tmall, 1688 | no | inviteCode | no or yes | weidian item | random host |
| cssbuy | idPathTemplate | taobao, tmall, 1688 | yes | promotionCode | no | n/a retired | any URL fails open |
| kakobuy | urlTemplate | weidian, taobao, tmall, 1688 | no | ref | no | weidian item | missing url |
| fansbuy | idUrlTemplate | weidian | no | null signup base64 | yes | weidian item | taobao fails open |
| mulebuy | idPlatformTemplate | platform map | no | null until known | no | weidian + taobao | id-less url |
| joyagoo | idPlatformTemplate | platform map | no | null until known | no | weidian + taobao | wrong wrap family |
| cnfans | idPlatformTemplate | platform map | no | none by design | no | uppercase platform | no commission env |
| hoobuy | idPlatformTemplate | numeric codes | no | null until known | no | codes 1/2/3 | unknown market |
| oopbuy | idPlatformTemplate | numeric codes | no | null until known | no | codes 1/2/3 | unknown market |
| allchinabuy | url family | market set | no | null until known | no | wrap shape | bad input |

Update this table when agents change. Tests should import `AGENTS` and generate cases from the table instead of hardcoding forever when practical.

---

## 58. Appendix U — Category keyword conflict rules

Category guess and weight refine can conflict. Define precedence.

1. Explicit user category on the item always wins for weight category base.
2. Size chart axes can confirm tops vs bottoms but do not force shoes.
3. Title keywords beat weak generic category only when confidence is high.
4. Multi-keyword titles use the more specific garment class. Example: "denim jacket" is outerwear or denim_jacket, not pants.
5. Shoe keywords beat apparel if both appear and the primary product is footwear.
6. Accessory keywords lose to apparel when the title is clearly a hoodie or tee with a free gift belt.

Write fixtures for each conflict class. Do not solve conflicts only in UI.

---

## 59. Appendix V — Storage keys related to pure layers

Known fashion keys that pure features may touch or must not corrupt:

- `credenza-fashion-items-v1`
- `credenza-fashion-hauls-v1`
- `credenza-prefs-v1`
- `credenza-fashion-outbound-v1`
- `credenza-fashion-errors-v1`
- `credenza-fashion-activation-v1`
- `credenza-fashion-entitlement-v1`
- session and usage keys for accounts

Rules:

1. New pure client indexes may use a new key only if erase-all knows it.
2. Corpus files are not storage keys. They live in the repo under `preview/scripts/`.
3. Do not write harvested Reddit full dumps into localStorage.
4. If community notes are cached per item, prefer fields on the item that migrateItem keeps, or a dedicated key with a cap and erase support.

---

## 60. Appendix W — Error and empty states for pure results

Pure functions return data. UI maps data to states. Define the pure empty forms so UI does not invent meaning.

| Situation | Pure result | UI meaning later |
|-----------|-------------|------------------|
| No weight source | grams null, source unknown | Ask for category or manual grams |
| No size chart and no usual | recommend empty | Show need chart or usual |
| No link context | count 0 | Hide panel or quiet empty |
| Agent retired | fail open canonical | Open original listing |
| Parse haul null | null | Use generic stash path |
| Import all dupes | zero fresh | Tell user nothing new |

Pure code must not throw for normal empty cases. Throw only on programmer errors inside tests if needed. Production pure paths prefer null or empty objects.

---

## 61. Appendix X — Performance budgets for pure work

These are local CPU budgets for interactive feel. They are not server SLAs.

| Operation | Budget on mid phone class target |
|-----------|-----------------------------------|
| parseRedditHaul on 50 KB paste | under 50 ms typical |
| estimateItemWeight per item | under 1 ms |
| haulWeightGrams for 200 items | under 5 ms |
| indexCorpus for 200 posts | under 200 ms once at load or worker |
| lookupLinkContext | under 1 ms with prebuilt index |
| migrateItem | under 1 ms per item |

If a pure step exceeds the budget, move corpus index build to idle time or a worker. Do not block stash.

---

## 62. Appendix Y — Open research spikes (optional)

These are optional spikes. They are not required for P1.

1. Can warehouse QC text from agent screenshots yield grams with existing chart-vision patterns?
2. Can comment harvest be done in the same Chromium session without extra ban risk?
3. Which agents expose public rehearsal-package weight in a stable way without scraping rates?
4. Is there a safe public source for average garment weights that is license-clean?
5. How often do FashionReps posts use tables vs free text in 2026 samples?

Document spike results under `docs/` or vault `99-Archive` if negative.

---

## 63. Appendix Z — Glossary

| Term | Meaning |
|------|---------|
| Pure layer | Deterministic function with fixtures and no required UI |
| Golden fixture | Frozen input and expected output that must not regress |
| Canonical key | Stable id for a marketplace item or Yupoo album |
| Fail open | Return the original safe URL when wrap is impossible |
| Chargeable weight | Max of packaged actual weight and volumetric weight |
| GL / RL | Green light / red light QC decision |
| Tier C | Banned product directions in Monetization |
| L0 context | Local corpus link notes only |
| L1 context | Live Reddit lookup after OAuth |
| L2 context | User own shelf and haul history |
| STE100 | ASD-STE100 Simplified Technical English |
| K3 | Kimi K3 UI lane in the other session |

---

## 64. Document control

| Field | Value |
|-------|-------|
| Title | Credenza Fashion — Pure Layer Exhaustiveness Plan |
| Status | Research only |
| Created | 2026-07-25 |
| Primary path | `~/credenza/docs/pure-layer-exhaustiveness-plan.md` |
| Vault path | `~/Documents/Credenza-Vault/60-Pure-Layers/pure-layer-exhaustiveness-plan.md` |
| Product code changed for this doc | none |
| Next action default | P1 fixtures branch after Kyle approval |

If this document and a newer session-state disagree on what is live, trust `session-state.md` for deployment truth and trust this document for pure-layer intent.

# Free to Pro — the build checklist

Source: `~/Downloads/Credenza - Shelves & Pricing.html` (Kyle, 2026-07-26).
The mock is the target. This file records what the app already does, what is
missing, and what each missing row costs to build.

Written 2026-07-26. Verified against the code, not against the docs.

---

## 1. Two conflicts — both settled 2026-07-26

### Conflict A — the price — SETTLED

**Decided: $4.99 a month, $39.99 a year.** Kyle created both Stripe Prices
on 2026-07-26. Both hold 0 active subscriptions. The monthly Price is the
default.

The yearly is $39.99, not the mock's $36, so the mock's "$3 a month" note
is false. Every surface says "Save 33%" and "$3.33 a month" instead —
$4.99 × 12 = $59.88, and $59.88 − $39.99 = $19.89, a third off.

One `PRICING` export in `credenza-fashion.jsx` is now the single source.
`sheets/ProfileSheet.jsx` reads it, and `preview/test/pricing.test.js`
fails if the static page drifts from it.

Still Kyle's: put the two Price IDs in `STRIPE_PRICE_MONTHLY` and
`STRIPE_PRICE_YEARLY` on Netlify, both contexts.

The original analysis follows, for the record.

### Conflict A — the price (as written)

| Place | Monthly | Yearly |
|---|---|---|
| The mock | **$4.99** | **$36** |
| The live app (`sheets/ProfileSheet.jsx:171,178`) | $5 | $39 |
| Stripe (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`) | matches the live app | matches the live app |

The mock's yearly note says "Works out at $3 a month". $36 / 12 = $3.00. That
is correct arithmetic and a better story than $39.

**To change the price you must make new Stripe Prices.** Stripe Prices are
immutable. The steps are: create two new Prices, put the new IDs in
`STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_YEARLY` on Netlify, then change the
two strings in `ProfileSheet.jsx`. Existing subscribers keep the old price
unless you migrate them.

**Recommendation: take the mock's $4.99 / $36.** Nobody has subscribed yet,
so the migration cost is zero today. It will not be zero later.

### Conflict B — the navigation — SETTLED

**Decided: keep the live nav and add Pricing.** The order is now
Open app · About · How it works · Guides · Pricing · FAQ · Privacy ·
Terms · llms.txt, on all 13 public pages. No `/sizing/` page was built;
the guides cover sizing.

The original analysis follows, for the record.

### Conflict B — the navigation (as written)

The mock's nav is "How it works · Sizing · Pricing".
The live nav is "How · Guides · FAQ".
There is no `/sizing/` page and no `/pricing/` page in `preview/public/`.

Pricing needs a public page before you can sell. Sizing is optional; the
guides already cover it.

---

## 2. What the free plan gives today

`preview/netlify/functions/lib/entitlements.js:29-43` is the only real
limit table. It matches the mock exactly:

| Limit | Free | Pro |
|---|---|---|
| `askPerDay` | 5 | 200 |
| `chartVisionPerDay` | 2 | 100 |
| `resolvePerDay` | 20 | 1000 |
| `qcPhotosPerItem` | 4 | 12 |
| `haulsMax` | 2 | 100 |

The server enforces the three daily caps in `lib/paid-gate.js`. That gate is
real: a free user at the cap gets 429.

---

## 3. The 15 rows, scored

Verdict key: **BUILT** works today · **PARTIAL** exists but the Pro half is
missing · **MISSING** no code at all.

| # | Row | Verdict | Where |
|---|---|---|---|
| 1 | Cards on your shelf — unlimited both | **BUILT** | No cap exists. The mock says unlimited for both, so nothing to do. |
| 2 | Buy in your agent — uncapped both | **BUILT** | `agents.js:440` |
| 3 | Reddit haul paste — yes both | **BUILT** | `reddit-haul.js:839` |
| 4 | Hauls at once — 2 / 100 | **BUILT** 2026-07-26 | `blockNewHaul` + the `saveEdit` guard in `credenza-fashion.jsx`. A name already on the shelf always passes, so a move between hauls is never refused. |
| 5 | AI size-chart reads — 2 / 100 a day | **BUILT** | Server-enforced. `chart-vision.js` |
| 6 | Link resolves — 20 / 1,000 a day | **BUILT** | Server-enforced. `resolve.js` |
| 7 | Ask — 5 / 200 a day | **BUILT** | Server-enforced. `ask.js` |
| 8 | QC photos per item — 4 / 12 | **BUILT** 2026-07-26 | `attachQcImage` in `credenza-fashion.jsx` checks `planLimit(plan, "qcPhotosPerItem")` before the compress. |
| 9 | Body profiles — 1 / several with fit history | **PARTIAL** | One profile object only. `credenza-fashion.jsx:4043`. No array, no history. |
| 10 | Devices — this one local / all synced | **MISSING** | The shelf is `localStorage` only. `credenza-storage.js` |
| 11 | Shared shelf — public link / unlisted, custom URL, expiry | **MISSING** | No share code at all. No router. |
| 12 | Parcel planner — weight / box, volumetric, chargeable | **BUILT** | All three already compute. `credenza-fashion.jsx:319-333`. Free users get the Pro version. |
| 13 | Restock and price watch — 3 items / every item | **MISSING** | Needs a scheduler. Nothing exists. |
| 14 | Export to CSV or agent list — no / yes | **PARTIAL** | JSON export works (`credenza-fashion.jsx:4761`). No CSV writer. |
| 15 | Seller memory — 5 sellers / every seller | **MISSING** | `item.seller` is a plain string per card. No seller store. |

Also in the mock, not in the table:

| Row | Verdict | Note |
|---|---|---|
| 5 share toggles (prices, notes, quality, sellers, parcel) | **MISSING** | Depends on row 11. |
| 4 Pro share toggles (unlisted, custom URL, 30-day expiry, hide footer) | **MISSING** | Depends on row 11. |

**Score: 8 BUILT · 3 PARTIAL · 4 MISSING.** (Rows 4 and 8 closed 2026-07-26.)

---

## 4. Do these first — cheap, and they close a real hole

Every item here is under half a day. Together they make the free plan honest.

### 4.1 Enforce `qcPhotosPerItem` — DONE 2026-07-26

**Correction.** This section named `components/WarehouseQcSection.jsx:19`.
That component is orphaned — nothing imports it and nothing mounts it, so
capping it would have enforced nothing. The live write path is
`attachQcImage` in `credenza-fashion.jsx`, reached from `onAttachQcPhoto`
in `components/DetailBody.jsx`.

The cap now comes from `planLimit(accountPlan, "qcPhotosPerItem")` in
`preview/src/usage.js`. The check runs before the image compress, so a
user at the cap never waits on a read we would throw away.

The store keeps a separate `QC_PHOTOS_STORED = 12`. Two numbers on
purpose: slicing the stored array down to the free cap would delete a
downgraded customer's existing photos.

### 4.2 Enforce `haulsMax` — DONE 2026-07-26

**Correction.** This section named `updateHaul` at
`credenza-fashion.jsx:4228`. A haul is not a record — `haulNames` is a
`useMemo` over the distinct non-empty `item.project` strings, so creating
a haul means writing a project name no card carries yet.

`blockNewHaul(name)` now guards that. `saveEdit` calls it and, on
refusal, drops only the `project` key so a rename in the same save still
lands. A name already on the shelf always passes, so a user over the cap
can still move cards between existing hauls.

Pre-existing hauls above the cap are kept. Creation only is capped.

### 4.3 Ship the CSV export (2 hours)

`credenza-haul-export.js` already builds the row objects and is not wired to
any button. Add a CSV writer and one Pro-gated row in the Import sheet, next
to the JSON export at `sheets/ImportSheet.jsx:247`.

### 4.4 Publish `/pricing/` — DONE 2026-07-26

`preview/public/pricing/index.html`, built from the
`preview/public/how/index.html` template. The compare table lists only the
BUILT rows above; rows 10, 11, 13 and 15 are omitted, because we do not
sell a feature before it ships.

Pricing is in the nav and the footer on all 13 public pages, in
`sitemap.xml`, in `llms.txt` and in `llms-full.txt`. The CTA targets
`/?profile=1`, never Stripe — a checkout started from a static page has no
account to grant Pro to.

`preview/test/pricing.test.js` pins the price against the `PRICING` export
and the caps against `PLAN_LIMITS`.

---

## 5. Do these next — one day each

### 5.1 Multiple body profiles with fit history (1 day)

`bodyProfile` is one object. Make it an array with an active index, and
migrate the existing object into slot 0. Free gets one slot; Pro gets many.
"Fit history" means recording what a finished item actually fit like, keyed
to the profile.

The migration is the risk. Write the migration test first.

### 5.2 Restock and price watch (1 day, plus running cost)

This needs a scheduled Netlify function that re-resolves watched items and
writes the result to the entitlement store. Free watches 3 items; Pro
watches every item.

Warning: this is the only Pro row with a recurring server cost. Every
watched item is a resolve call per cycle, forever. Price it before you
build it.

---

## 6. Do these last — they are the hard ones

### 6.1 The shared shelf, `/s/:id` (2 to 3 days)

This is the biggest row in the mock and it has no foundation. Facts:

- The app has **no router**. `preview/src/main-fashion.jsx` mounts one
  component. There are no paths.
- The shelf lives in `localStorage`. A public link needs the shelf on a
  server.

**Recommendation: do not add a client router.** Build `/s/:id` as a
server-rendered Netlify function that reads a published snapshot from
Supabase and returns plain HTML. That approach also gives you the Open
Graph preview a shared link needs, which a client-rendered route cannot.

The work splits into four parts:

1. A publish action that writes a snapshot row (shelf JSON + toggles).
2. The 5 free share toggles: prices, notes, quality scores, seller names
   and links, parcel estimate.
3. The `/s/:id` function that renders the snapshot as HTML.
4. The 4 Pro toggles: unlisted, custom URL, 30-day expiry, hide footer.

Parts 1 to 3 are the free tier. Part 4 is the paywall.

### 6.2 Cross-device sync (3 or more days)

Do not start this until the shared shelf ships. A publish snapshot is a
one-way write. Sync is two-way, which means conflict resolution, and that
is a different and much larger problem.

The shared shelf teaches you the schema. Reuse it.

---

## 7. Suggested order

1. ~~Decide the price (Conflict A).~~ DONE 2026-07-26.
2. Section 4 — the four cheap fixes. 4.1, 4.2 and 4.4 DONE 2026-07-26.
   4.3, the CSV export, is still open.
3. Section 6.1 parts 1 to 3 — publish and the public page.
4. Section 6.1 part 4 — the Pro share toggles. **The first true Pro row.**
5. Section 5.1 — body profiles.
6. Section 5.2 — watch, if the running cost is acceptable.
7. Section 6.2 — sync. Last.

After step 4 the paywall has something to sell that the free plan does not
already give away. Today it does not.

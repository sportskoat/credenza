# Credenza Fashion — Pre-Launch Plan

**Date:** 2026-07-26
**Purpose:** This is the master task list for the public launch. A planner
session wrote it from a full code audit. Executor agents: pick one task,
do it completely, and report against its acceptance criteria.
**Source audits:** `docs/free-to-pro-checklist.md`,
`docs/Peer-review-2026-07-23-synthesis.md`, `docs/session-state.md`.

---

## Rules for every executor agent

1. Read `docs/session-state.md` before you start. Update it before you stop.
2. Do not commit until Kyle says so. Do not deploy until Kyle says so.
3. Run the full gate after your change: `cd preview && npm run test`,
   `npm run lint`, `npm run typecheck`, `npm run build`. All must pass.
4. **WARNING:** Build with `preview/.env` populated. A build without it
   ships a signed-out app. A new git worktree does NOT get `preview/.env`
   — copy it in first. If the file is lost, run `netlify env:list` and
   restore the five `VITE_` keys. See `preview/.env.example`.
5. Take screenshots to verify each visible change.
6. Do only the task you picked. Flag adjacent problems; do not fix them.
7. When a task says "Kyle decides", stop and ask. Do not guess.

---

## Status board

| ID | Task | Priority | Est. | Depends on | Status |
|---|---|---|---|---|---|
| LB-1 | Enforce the free QC photo cap | P0 | 30 min | — | OPEN |
| LB-2 | Enforce the free hauls cap | P0 | 1 h | — | OPEN |
| LB-3 | Decide the price; make new Stripe Prices | P0 | 1 h + Kyle | — | OPEN (Kyle) |
| LB-4 | Build the public /pricing/ page | P0 | 0.5 day | LB-3 | OPEN |
| LB-5 | Run one checkout end-to-end (Part 7g) | P0 | 2 h | LB-3 | OPEN |
| LB-6 | Add the build preflight env check | P0 | 1 h | — | OPEN |
| LB-7 | Cloud sync for the shelf (Supabase) | P0 | 3–4 days | — | OPEN |
| LB-8 | Shared shelf `/s/:id` with OG preview | P1 | 2–3 days | LB-7 | OPEN |
| LB-9 | Ship the "Install share shortcut" page | P1 | 0.5 day | — | OPEN |
| LB-10 | Ship the CSV export (Pro row) | P1 | 2 h | — | OPEN |
| LB-11 | Cut the framer-motion payload | P2 | 0.5 day | — | OPEN |
| LB-12 | Purge dead CSS | P2 | 0.5 day | — | OPEN |
| LB-13 | Archive the legacy root files | P2 | 30 min | — | OPEN |

Update the Status column in place: OPEN → IN PROGRESS (agent, date) →
DONE (date, commit).

---

## Decisions Kyle must make first

### D-1. The price (blocks LB-3, LB-4, LB-5)

| Place | Monthly | Yearly |
|---|---|---|
| The pricing mock | $4.99 | $36 |
| Live app + Stripe | $5 | $39 |

Recommendation: take **$4.99 / $36**. The yearly works out to $3 a month —
a better story. Stripe Prices are immutable. Nobody has subscribed yet, so
the change is free today and costly later.

### D-2. The public nav (blocks LB-4)

The mock nav is "How it works · Sizing · Pricing". The live nav is
"How · Guides · FAQ". Minimum change: add Pricing to the live nav. A
`/sizing/` page is optional; the guides already cover sizing.

### D-3. What the pricing page may promise

Rule: **list only built features.** Restock watch (row 13) and seller
memory (row 15) have zero code. Do not put them on the pricing page.
If Kyle wants them listed, mark them "coming soon" — but the
recommendation is to omit them.

---

## P0 — Launch blockers

### LB-1. Enforce the free QC photo cap

**Why.** A free user gets the Pro cap by accident. This is the only row
where free receives a paid feature silently.

**Files.**
- `components/WarehouseQcSection.jsx:19` — `const QC_PHOTO_CAP = 12;`
  is hard-coded for everyone.
- `preview/netlify/functions/lib/entitlements.js:34` — free is
  `qcPhotosPerItem: 4`; Pro (line 41) is 12.
- The entitlement snapshot reaches the client via
  `preview/src/account.js` (`loadCachedEntitlement` → `payload.lim`).

**Steps.**
1. Add a `photoCap` prop to `WarehouseQcSection`. Default it to 4.
2. Pass the cap from the plan snapshot at the call site in
   `credenza-fashion.jsx`. Signed-out and free users get 4. Pro gets 12.
3. At the cap, show the existing upgrade prompt pattern, not a dead button.
4. Never delete photos a user already has over the cap. Cap additions only.

**Acceptance.**
- Free (or signed-out) user: the add-photo control locks at 4 and shows
  an upgrade nudge.
- Pro snapshot in the cache: the cap is 12.
- An item that already has 6 photos keeps all 6.
- Full gate green.

### LB-2. Enforce the free hauls cap

**Why.** `haulsMax: 2` is declared in the entitlement table and never read.
Free users can make unlimited hauls.

**Files.**
- `credenza-fashion.jsx:4261` — `updateHaul` appends a new haul when the
  name is not in the list. No cap check exists.
- `preview/netlify/functions/lib/entitlements.js:35` — free `haulsMax: 2`.

**Steps.**
1. Read `haulsMax` from the plan snapshot (same path as LB-1).
2. Cap haul **creation** only. At the cap, show the upgrade prompt
   instead of creating the haul.
3. **WARNING:** A user who already has more than two hauls keeps them
   all. Never delete or lock an existing haul.

**Acceptance.**
- Free user with 2 hauls: "Start a haul" shows the upgrade prompt.
- Free user with 4 pre-existing hauls: all 4 still open and edit.
- Pro: cap is 100.
- Full gate green.

### LB-3. Decide the price; make new Stripe Prices (Kyle + agent)

**Why.** The mock and Stripe disagree (see D-1). Checkout and the pricing
page both need the final numbers.

**Steps.**
1. Kyle picks the price (D-1).
2. If the price changes: create two new Stripe Prices (test mode first,
   then live). Do not edit the old Prices — they are immutable.
3. Put the new Price IDs in `STRIPE_PRICE_MONTHLY` and
   `STRIPE_PRICE_YEARLY` on Netlify (both contexts).
4. Update the two button strings in `sheets/ProfileSheet.jsx:171` and
   `:178` ("$5 / month", the yearly line).
5. See `docs/Part-7-setup.md` for the existing Stripe wiring.

**Acceptance.**
- Stripe test-mode Prices exist with the final amounts.
- Netlify env holds the new IDs.
- The Profile sheet shows the final price strings.

### LB-4. Build the public /pricing/ page

**Why.** You cannot sell without a pricing page. There is none in
`preview/public/`.

**Files.**
- New: `preview/public/pricing/index.html`.
- Pattern: copy the structure and styles of the existing static pages
  (`preview/public/how/index.html`, `preview/public/faq/index.html`).
- Reference table: `docs/free-to-pro-checklist.md` section 3 — the 15
  rows and their verdicts.
- Mock: `~/Downloads/Credenza - Shelves & Pricing.html`.

**Steps.**
1. Build the free/Pro comparison from the mock, minus every MISSING row
   (see D-3). Built and PARTIAL-but-fixed rows only.
2. Use the final price from LB-3. Include the "$3 a month" yearly note
   if D-1 lands on $36.
3. Add Pricing to the nav on all public pages (see D-2).
4. Add the page to `sitemap.xml`. Match the head/meta pattern of the
   other public pages (canonical, OG, description).
5. The upgrade CTA opens the app's Profile sheet (same target the app's
   own upgrade buttons use). Do not link Stripe directly from a static
   page.

**Acceptance.**
- `/pricing/` renders correctly on 390px and 1280px.
- Every listed feature exists in the shipped app.
- The page is in the sitemap and the nav.
- Lighthouse on the page: no console errors, images sized.

### LB-5. Run one checkout end-to-end (Part 7g)

**Why.** No purchase has ever completed through the full stack. An
untested payment path is not a payment path.

**Files.** `preview/netlify/functions/checkout.js`, `stripe-webhook.js`,
`entitlement.js`, `portal.js`. Setup notes: `docs/Part-7-setup.md`.
Test cards: use the Stripe test-cards skill or 4242 4242 4242 4242.

**Steps.**
1. Deploy the current build to a Netlify preview (not production) with
   test-mode Stripe keys. Kyle approves the deploy first.
2. Sign in with a real test account (magic link or Google).
3. Buy monthly with the test card. Confirm the webhook fires and the
   entitlement record flips to Pro.
4. Reload the app. Confirm the plan badge, the 200/day Ask cap, the
   12-photo QC cap, and the 100-haul cap are live in the client.
5. Open the Stripe portal from the Profile sheet. Cancel. Confirm the
   record returns to free after the webhook.
6. Record every step and result in `docs/Part-7-setup.md` under a
   "7g test log" heading.

**Acceptance.**
- One full loop: checkout → webhook → Pro snapshot → portal cancel →
  free snapshot. Each step has evidence (screenshot or log line).

### LB-6. Add the build preflight env check

**Why.** Production already shipped once with `AUTH_ENABLED = false`
because `preview/.env` was missing. The build must fail loudly instead.

**Files.** `preview/package.json` (build script), new
`preview/scripts/preflight-env.js` (the `scripts/` dir exists),
`preview/.env.example` (the key list).

**Steps.**
1. Write a Node script that loads `preview/.env` and checks every
   `VITE_` key named in `.env.example` is present and non-empty.
2. On failure: print the missing keys and exit 1.
3. Wire it: `"build": "node scripts/preflight-env.js && vite build"`.
4. Also check the deploy-time keys the functions need are documented in
   `.env.example` (do not check their values — they live on Netlify).

**Acceptance.**
- `npm run build` with `.env` renamed away fails with a clear message.
- `npm run build` with `.env` present succeeds.
- Full gate green.

### LB-7. Cloud sync for the shelf (Supabase) — THE BIG ONE

**Why.** The shelf is `localStorage` only (`credenza-storage.js`). A Pro
subscriber who clears the browser or switches devices loses everything.
"All devices, synced" is a headline Pro row. This is the largest gap
between what the app charges for and what it does. It also unblocks the
shared shelf (LB-8).

**Files.**
- `credenza-storage.js` — the current storage layer (197 lines; already
  an abstraction, which helps).
- `preview/src/auth.js` — session + access token (plain REST, no SDK).
  Keep that pattern: use PostgREST over fetch, no Supabase JS SDK.
- `preview/src/account.js` — plan snapshot (Pro check).
- `preview/netlify/functions/lib/auth.js` — server-side token check,
  if a function-mediated write path is chosen.

**Design (planner's recommendation — confirm with Kyle before starting).**
1. One table `shelves`: `user_id uuid primary key references auth.users,
   data jsonb, updated_at timestamptz`. Row-level security: owner only.
2. Whole-document sync, not per-item rows. The shelf is one JSON blob
   today; keep it one blob. Per-item sync is a post-launch upgrade.
3. Client flow: on sign-in, pull; newest `updated_at` wins; merge is
   last-write-wins per item `id` when both sides changed. Push on change,
   debounced (~2 s), and on `visibilitychange`.
4. `localStorage` stays the source of truth offline. Sync is a mirror.
   Signed-out users lose nothing and sync nothing.
5. Decide with Kyle: sync for all signed-in users, or Pro only. The mock
   says synced devices are Pro. Recommendation: pull/restore free,
   multi-device continuous sync Pro — restore-on-sign-in is the safety
   story and should never be paywalled.

**Steps.**
1. Write the migration SQL (table + RLS). Kyle runs it in Supabase.
2. Add `pushShelf` / `pullShelf` to a new `preview/src/sync.js` using
   the session's access token against PostgREST.
3. Wire into the storage layer behind a flag; hydrate order:
   local first, then reconcile with remote.
4. Handle: token expiry mid-push (refresh, retry once), 0-byte or
   invalid remote data (keep local, do not clobber), and the erase
   sweep ("Erase my data" must delete the remote row too — extend
   `delete-account.js`).
5. Tests: merge logic unit tests; a mocked-fetch round-trip test.

**Acceptance.**
- Sign in on device A, stash 3 items, sign in on device B: the 3 items
  appear.
- Edit the same item offline on both; the later edit wins; nothing
  duplicates.
- Erase my data removes the remote row.
- Signed-out use is unchanged.
- Full gate green.

---

## P1 — The growth loop

### LB-8. Shared shelf `/s/:id` with OG preview (after LB-7)

**Why.** Every haul shared on Reddit or Discord with a real preview card
is free acquisition. This is the viral loop. The decision is recorded in
`docs/session-state.md`: **server-rendered Netlify function, not a client
router** — the only way a shared link gets an Open Graph image.

**Design.**
1. A `shares` table: `id` (short code), `user_id`, `data jsonb` (a
   frozen snapshot of the selected haul), `created_at`, `expires_at
   nullable`, `unlisted bool`.
2. A Netlify function serves `GET /s/:id`: server-rendered HTML — haul
   name, item grid (photos, titles, prices per the share toggles), OG
   meta tags, and a "Made with Credenza" footer linking home.
3. In-app: a Share action on an open haul creates the share and copies
   the link. Free: public link with the standard footer. Pro: unlisted
   toggle, expiry, hide-footer (per the mock's Pro toggles).
4. Share toggles (prices, notes, quality, sellers, parcel) control what
   the snapshot includes. Default: photos + titles only.
5. Redirect rule in `netlify.toml`: `/s/*` → the function.

**Acceptance.**
- A share link pasted into Discord/Slack shows a preview card with image
  and title.
- Toggled-off fields are absent from the served HTML, not hidden by CSS.
- An expired or deleted share returns 404 with a branded page.
- Full gate green.

### LB-9. Ship the "Install share shortcut" page

**Why.** Phone capture is the core loop and it is still clumsy. This is
item 26 in `docs/To-do.md`. The backend already handles
`/?stash=` + shared URL.

**Steps.**
1. Write the steps up as a page under `preview/public/how/` (a
   sub-page, e.g. `/how/stash-from-your-phone/`), matching the guide
   page pattern. The steps live on Kyle's Obsidian "My Checklist" and in
   `docs/To-do.md` item 25.
2. Include: create the Shortcut (`/?stash=` + shared URL → Open URLs),
   turn on Show in Share Sheet, pin it, optional Add to Home Screen.
3. Screenshots or simple illustrations for each step.
4. Link it from the FAQ and from the phone capture bar's empty state.
5. Add to sitemap.

**Acceptance.**
- The page renders on 390px. The Shortcut built from the page works on
  a real iPhone (Kyle verifies the device step).

### LB-10. Ship the CSV export (Pro row)

**Why.** Row 14 of the pricing table. Half-built already:
`credenza-haul-export.js` exports `exportItemRecord`/`exportHaulBundle`
and is wired to JSON download only (`downloadHaulJson`).

**Steps.**
1. Add a CSV writer over the same row objects. Columns: title, seller,
   price, currency, size, status, weight, canonical buy URL, photos URL,
   notes. Quote and escape correctly (commas, quotes, newlines).
2. Add a Pro-gated "Export CSV" row in the Import sheet next to the
   JSON export. Free users see the row with the upgrade nudge.
3. Unit tests for the escaping and a golden-file row.

**Acceptance.**
- The CSV opens clean in Numbers/Excel/Google Sheets with correct
  columns and no broken rows from embedded commas.
- Free-gated; Pro downloads.
- Full gate green.

---

## P2 — Speed and code health (post-launch acceptable, pre-launch nice)

### LB-11. Cut the framer-motion payload

The vendor chunk is 277 KB raw and framer-motion dominates it. Switch to
`LazyMotion` + the `m` component with `domAnimation` features. Expected
cut: ~25–30 KB gzip from first load. Touch every `motion.` usage in
`credenza-fashion.jsx`, `components/`, and `sheets/`. Verify every
animation still runs (carousel physics, sheet transitions, the settings
modal stack). Full gate + manual motion pass on desktop and phone.

### LB-12. Purge dead CSS

`credenza-fashion.css` is 10,489 lines / 181 KB built. Known dead zones:
the retired card-flip styles (flip stays dormant by design — keep the
machinery, remove only selectors with no remaining markup), the deleted
`.cz-onboard*` block's leftovers, and legacy shell rules. Method: grep
each top-level selector against the JSX; remove unmatched; screenshot
diff the app at 390 / 768 / 1024 / 1280 before and after.

### LB-13. Archive the legacy root files

Move `credenza-v2.jsx`, `credenza-v3.jsx`, `credenza-v3-walnut.jsx`,
`credenza-v2/v3` CSS, and `V3-SPEC.md` into `docs/legacy/` (or a
`legacy/` dir). They are dead build targets (see `preview/vite.config.js`
comment). Update the lint script paths in `preview/package.json`.
Confirm nothing imports them: `grep -rn "credenza-v3" preview/src
components sheets`.

---

## Explicitly deferred (do NOT build before launch)

- **Restock and price watch** (row 13) — needs a scheduler; zero code.
- **Seller memory** (row 15) — needs a seller store; zero code.
- **Multiple body profiles with fit history** (row 9) — one profile
  object today; fine for launch.
- **Splitting `credenza-fashion.jsx`** (7,978 lines) — velocity work,
  not user-facing. After launch.
- Anything in `docs/Monetization.md` Tier B/C.

Do not list deferred features on the pricing page (D-3).

---

## The launch gate

Launch when every box is checked:

- [ ] LB-1 through LB-7 DONE.
- [ ] LB-3/D-1 price decision recorded here.
- [ ] One full paid loop verified in test mode (LB-5 log exists).
- [ ] Pricing page lists only shipped features.
- [ ] A fresh build from a clean checkout passes the preflight and shows
      sign-in (the LB-6 regression can never recur silently).
- [ ] Kyle approves one production deploy batch containing all of it.

LB-8, LB-9, LB-10 are strongly recommended before any public
announcement post — the share link is the announcement's engine — but
they do not block flipping the site live.

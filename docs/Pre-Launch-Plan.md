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
2. **Commit and push every checkpoint. Never leave a worktree dirty.**
   This rule replaced "do not commit until Kyle says so" on 2026-07-26,
   after that rule stranded 4,244 uncommitted lines in one worktree and
   11 unpushed commits across three others. Committing is not shipping.
   Pushing is not shipping. Only `netlify deploy --prod` ships.
   - Commit when the gate in rule 3 passes. Do not wait for approval.
   - `git push` immediately after every commit. A commit that lives on
     one laptop is not saved. GitHub is the only durable record.
   - Before your turn ends, run `git status`. If it is not clean, make a
     `WIP:` commit and push that. A messy checkpoint beats a lost one.
   - If you work in a worktree, push its branch with `-u origin <branch>`
     on the first push. Never let a worktree branch stay local-only.
   - Deploys still need Kyle. See rule 8.
3. Run the full gate after your change: `cd preview && npm run test`,
   `npm run lint`, `npm run typecheck`, `npm run build`. All must pass.
4. **WARNING:** Build with `preview/.env` populated. A build without it
   ships a signed-out app. A new git worktree does NOT get `preview/.env`
   — copy it in first. If the file is lost, run `netlify env:list` and
   restore the five `VITE_` keys. See `preview/.env.example`.
5. Take screenshots to verify each visible change.
6. Do only the task you picked. Flag adjacent problems; do not fix them.
7. When a task says "Kyle decides", stop and ask. Do not guess.
8. **Only Kyle ships. Never run `netlify deploy` on your own.**
   Corrected 2026-07-26 after measuring the account. The original rule
   said deploys were a scarce budget. That premise is wrong: the team
   plan reports `"has_builds": false`, so builds run on this Mac and
   spend zero build minutes. Deploy frequency is free. Credits go to
   bandwidth, function invocations and AI usage — see rule 8a.
   - The reason for the rule is coherence, not cost. One deploy must
     carry all the work, so nothing half-lands.
   - Do not run `netlify deploy` for any reason, preview or production.
   - Do not add a task whose acceptance needs its own deploy.
   - Land work on `main` and let it queue. Kyle deploys a batch.
   - Verify your change with tests, the local `vite` dev server and
     screenshots. Local proof replaces a deploy, except for the
     Netlify functions, which cannot run locally without a deploy.
   - When a task can only be proved live, say so and stop. Write what
     the deploy must verify into `docs/session-state.md` so the next
     batch checks it. Do not deploy to find out.
8a. **The real meter is per customer, not per deploy.** Every function
   invocation and every byte out costs credits, forever, for every
   customer. The image relay was the worst offender: Yupoo refuses
   hotlinks, so each album photo crossed a function at full size.
   Fixed in `d2f1180` — the relay answers GET with a durable CDN cache,
   and relays 6 photos, not 20. Before you add a function call to a
   hot path, work out its cost per customer per session.

---

## Status board

| ID | Task | Priority | Est. | Depends on | Status |
|---|---|---|---|---|---|
| LB-1 | Enforce the free QC photo cap | P0 | 30 min | — | DONE 2026-07-26 |
| LB-2 | Enforce the free hauls cap | P0 | 1 h | — | DONE 2026-07-26 |
| LB-3 | Decide the price; make new Stripe Prices | P0 | 1 h + Kyle | — | DONE 2026-07-26 |
| LB-4 | Build the public /pricing/ page | P0 | 0.5 day | LB-3 | DONE 2026-07-26 |
| LB-5 | Run one checkout end-to-end (Part 7g) | P0 | 2 h | LB-3 | OPEN |
| LB-6 | Add the build preflight env check | P0 | 1 h | — | DONE 2026-07-26 |
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

### D-1. The price — DECIDED 2026-07-26

**$4.99 a month. $39.99 a year.** Kyle made both Prices in Stripe on
2026-07-26 and showed them to the session. Monthly is the default Price.
Both have zero active subscriptions.

The yearly is $39.99, not the mock's $36, so the "works out at $3 a month"
line is wrong and must not ship. The true line is **$3.33 a month**, and
the saving against monthly is **$19.89 a year** (33%). Use the saving, not
the monthly-equivalent: a third off is the stronger number.

Superseded rows, kept so nobody re-opens the question:

| Place | Monthly | Yearly |
|---|---|---|
| The pricing mock | $4.99 | $36 |
| The old live strings | $5 | $39 |
| **Decided** | **$4.99** | **$39.99** |

### D-2. The public nav — DECIDED 2026-07-26

Add **Pricing** to the nav on every public page. Do not build `/sizing/`;
the guides already cover sizing, and a thin page competes with them for
the same query.

Nav order, on all pages: Open app · About · How it works · Guides ·
Pricing · FAQ · Privacy · Terms · llms.txt.

### D-3. What the pricing page may promise

Rule: **list only built features.** Restock watch (row 13) and seller
memory (row 15) have zero code. Do not put them on the pricing page.
If Kyle wants them listed, mark them "coming soon" — but the
recommendation is to omit them.

---

## P0 — Launch blockers

### LB-1. Enforce the free QC photo cap — DONE 2026-07-26

**Why.** A free user got the Pro cap by accident. This was the only row
where free received a paid feature silently.

**CORRECTION to the original plan.** The plan said to add a `photoCap`
prop to `components/WarehouseQcSection.jsx`. That component is orphaned.
Nothing imports it and nothing mounts it — commit `3f29fae` dropped it,
and its `.cz-qc*` CSS is still live only because nobody removed it.
Capping it would have enforced nothing.

The live QC write path is `attachQcImage` in `credenza-fashion.jsx`,
reached from `onAttachQcPhoto` → the `cz-detail-qc-prompt` block in
`components/DetailBody.jsx`. Only `sheets/DetailSheet.jsx` passes that
prop, so QC photos are phone-sheet-only today.

**What shipped.**
- `preview/src/usage.js` — new `FREE_LIMITS`, `PRO_LIMITS`, `planLimit()`.
  `planLimit` returns the FREE cap when the plan is null. That is the
  opposite of `overFreeLimit` and is deliberate: a daily counter is
  re-checked by the server on every call, but a QC photo never reaches a
  server, so the client is the only place the cap can hold.
- `credenza-fashion.jsx` — new `QC_PHOTOS_STORED = 12` export. The
  guard uses the PLAN cap; the store uses `QC_PHOTOS_STORED`. Two
  numbers on purpose: slicing the stored array to the plan cap would
  delete a downgraded customer's existing photos.
- `attachQcImage` checks the cap BEFORE the image compress, so a user at
  the cap never waits on a read whose result we would throw away.
- The `migrateItem` normalizer reads the same constant, so a stored
  photo can never save and then vanish on the next reload.
- The nudge routes to the Profile sheet via `setProfileOpen(true)`.

**Test.** `preview/test/plan-limits.test.js`, 10 tests. It reads both
`usage.js` and `entitlements.js` and fails if the two copies drift, with
a guard-the-guard case so a reshaped `PLAN_LIMITS` cannot make the
comparisons pass vacuously.

**Acceptance — met.** Free and signed-out cap at 4. A Pro snapshot caps
at 12. An item already holding 6 photos keeps all 6. Full gate green.

### LB-2. Enforce the free hauls cap — DONE 2026-07-26

**Why.** `haulsMax: 2` was declared in the entitlement table and never
read. Free users could make unlimited hauls.

**What a haul actually is.** Not a record. `haulNames` in
`credenza-fashion.jsx` is a `useMemo` deriving the sorted set of distinct
non-empty `item.project` strings. So creating a haul means writing a
project name no card carries yet, and that is the only thing the cap
refuses.

**What shipped.**
- `blockNewHaul(name)` in `credenza-fashion.jsx`. A name already on the
  shelf always passes — that is a MOVE between hauls, not a new one, and
  a user over the cap must still be able to sort.
- `saveEdit` calls it. On refusal it drops only the `project` key and
  keeps the rest of the patch, so a user renaming a card and picking a
  third haul in one save still gets the rename.
- The cap comes from `planLimit(accountPlan, "haulsMax")`, the same path
  as LB-1.

**Acceptance — met.** A free user with 2 hauls gets the upgrade prompt
instead of a third. A free user with 4 pre-existing hauls keeps all 4 and
can still move cards between them. Pro caps at 100. Full gate green.

### LB-3. Wire the decided price — DONE 2026-07-26

**Why.** The mock and Stripe disagreed (see D-1). Checkout and the
pricing page both needed the final numbers.

**Decided.** $4.99 a month, $39.99 a year. Kyle created both Stripe
Prices on 2026-07-26, each with 0 active subscriptions. The monthly Price
is the default.

The mock's "$3 a month" note was true of a $36 yearly and is false of
this one. The page says "Save 33%" and "$3.33 a month" instead —
$4.99 × 12 = $59.88, and $59.88 − $39.99 = $19.89, a third off.

**What shipped.**
- `credenza-fashion.jsx` — new `PRICING` export. Every surface reads it.
- `sheets/ProfileSheet.jsx` — both buttons read `PRICING`, plus a new
  `.cz-profile-upgrade-note` line naming the saving.
- `credenza-fashion.css` — `.cz-profile-upgrade-note`, using the
  existing `--cz-money` token.

**Still Kyle's.** Put the two Price IDs in `STRIPE_PRICE_MONTHLY` and
`STRIPE_PRICE_YEARLY` on Netlify, both contexts. See LB-5.

### LB-4. Build the public /pricing/ page — DONE 2026-07-26

**Why.** You cannot sell without a pricing page.

**What shipped.**
- `preview/public/pricing/index.html`, built from the
  `preview/public/how/index.html` template — same head and meta pattern,
  same inline style tokens, same brand SVG.
- Two plan cards, then a 9-row comparison table. Every row is a BUILT row
  from `docs/free-to-pro-checklist.md`. Rows 10, 11, 13 and 15 are
  omitted under D-3: we do not sell a feature before it ships.
- Product and FAQPage JSON-LD, so the AI answers can quote the price.
- The CTA targets `/?profile=1`. `credenza-fashion.jsx` reads
  `params.get("profile")` on mount and calls `setProfileOpen(true)`. No
  Stripe URL appears on the static page — a checkout started there would
  have no account to grant Pro to.
- Pricing added to the nav and the footer on all 13 public pages, in the
  D-2 order. `/pricing/` added to `sitemap.xml`, `llms.txt` and
  `llms-full.txt`.
- The FAQ page said "No paid plan is announced". That is now false, so
  both the visible copy and the FAQPage JSON-LD were corrected, and a
  "What does Credenza cost?" question was added.

**Test.** `preview/test/pricing.test.js`, 14 tests. It compares the page
against the `PRICING` export, refuses any pre-2026-07-26 price string
anywhere under `preview/public/`, pins the CTA target, checks the page is
in the sitemap and in every page's nav, refuses any unbuilt feature name,
and checks each table cell against `PLAN_LIMITS` in `entitlements.js`.

**Acceptance — met**, except the 390px / 1280px render check and the
Lighthouse pass, which need the deploy (LB-5).

### LB-5. Run one checkout end-to-end (Part 7g)

**Why.** No purchase has ever completed through the full stack. An
untested payment path is not a payment path.

**Files.** `preview/netlify/functions/checkout.js`, `stripe-webhook.js`,
`entitlement.js`, `portal.js`. Setup notes: `docs/Part-7-setup.md`.
Test cards: use the Stripe test-cards skill or 4242 4242 4242 4242.

**Steps.**
1. Wait for Kyle's batch deploy. Do not deploy for this task (rule 8).
   The batch must carry test-mode Stripe keys. Stripe checkout, the
   webhook and the portal are Netlify functions, so this is the one
   task that cannot be proved locally. Do every other task first, then
   run this against the batch that ships them.
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

### LB-6. Add the build preflight env check — DONE 2026-07-26

**Why.** Production already shipped once with `AUTH_ENABLED = false`
because `preview/.env` was missing. Vite inlines that value at build
time, so the bundle simply had no sign-in in it. Nothing threw. Nothing
logged. A silent wrong build is worse than a loud failed one.

**What shipped.**
- `preview/scripts/preflight-env.js`. It reads the key list from
  `.env.example` rather than hard-coding one, so adding a key to that
  file is what makes the build start checking it. A key is required
  unless the line above it reads `# optional`.
- It checks the same union Vite would: `process.env` first, then `.env`,
  `.env.<mode>`, `.env.local`, `.env.<mode>.local`, later files winning.
  So it passes exactly when the build would find the value. That matters
  on Netlify, where the values are in the environment and no `.env`
  exists.
- On failure it names each empty key, explains that a missing
  `VITE_SUPABASE_` key compiles `AUTH_ENABLED` to false, and prints the
  `netlify env:get` line for each one. Then exit 1.
- `.env.example` was rewritten. It now lists all 23 keys the source
  reads, splits them into required and optional, and names the nine
  server-only secrets that must never gain a `VITE_` prefix.
- `package.json`: `"build"` and `"build:fashion"` are now
  `node scripts/preflight-env.js && vite build`. A new `"preflight"`
  script runs the check alone.

**Test.** `preview/test/preflight-env.test.js`, 10 tests. It runs the
real script as a child process with a controlled environment, because
the exit code is the contract. It also checks `.env.example` carries no
filled-in value (that file is committed) and names no server secret as a
`VITE_` key.

**Acceptance — met.** With `.env` renamed away the build stops and
prints the three missing keys. With `.env` present the build runs and the
bundle carries the Supabase URL. Full gate green.

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
      This is the ONLY deploy the whole launch spends (rule 8). Every
      task lands on `main` and waits for it.

LB-8, LB-9, LB-10 are strongly recommended before any public
announcement post — the share link is the announcement's engine — but
they do not block flipping the site live.

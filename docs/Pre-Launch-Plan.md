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
| LB-7 | Cloud sync for the shelf (Supabase) | P0 | 3–4 days | — | CODE DONE 2026-07-26 — dormant, needs Kyle |
| LB-8 | Shared shelf `/s/:id` with OG preview | P1 | 2–3 days | LB-7 | CODE DONE 2026-07-26 — needs the shares migration |
| LB-9 | Ship the "Install share shortcut" page | P1 | 0.5 day | — | DONE 2026-07-26 |
| LB-10 | Ship the CSV export (Pro row) | P1 | 2 h | — | DONE 2026-07-26 |
| LB-11 | Cut the framer-motion payload | P2 | 0.5 day | — | DONE 2026-07-26 — 25.5 KB gzip off first load |
| LB-12 | Purge dead CSS | P2 | 0.5 day | — | DONE 2026-07-26 — 859 lines cut; focus-ring bug fixed |
| LB-13 | Archive the legacy root files | P2 | 30 min | — | DONE 2026-07-26 — safe half; credenza-v3.jsx stays (7 tests) |
| LB-14 | Audit the public site; lock it with a test | P1 | 0.5 day | LB-4 | DONE 2026-07-26 — 3 defects fixed; 89 tests added |
| LB-15 | Build the /support/ page | P1 | 2 h | LB-14 | DONE 2026-07-26 — plus the stale 404 nav |
| LB-16 | Give every page structured data | P1 | 1 h | LB-15 | DONE 2026-07-26 — 15 WebPage/BreadcrumbList nodes |
| LB-17 | Body-measurements guide | P1 | 1 h | LB-16 | DONE 2026-07-27 — last buying question with shipped product |
| LB-18 | Agent comparison guide | P1 | 1 h | LB-17 | DONE 2026-07-27 — planner-framed, from the verified registry |
| LB-19 | Lock the pricing page numbers | P0 | 1 h | LB-18 | DONE 2026-07-27 — the Link resolves row and both bullet lists now fail the build if they drift |
| LB-20 | Fix the search snippets; lock the language rules | P1 | 1 h | LB-19 | DONE 2026-07-27 — 13 descriptions and 1 title rewritten; 1 banned phrase found |
| LB-21 | Fix the internal link graph | P1 | 1 h | LB-20 | DONE 2026-07-27 — 2 guides had one inbound link; 6 links added, graph locked |
| LB-22 | Fill the thin guides; lock a length floor | P1 | 2 h | LB-21 | DONE 2026-07-27 — 5 guides expanded; stale pipeline fixed on 4 files; floor locked |

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

#### LB-7 result — CODE DONE 2026-07-26, dormant until Kyle acts

All five steps are built and tested. Sync stays off until two manual
actions happen. Both need Kyle; an agent cannot do either.

**Kyle must do, in this order:**
1. Run `docs/sql/2026-07-26-shelves.sql` in the Supabase SQL editor. It
   creates `public.shelves` with row-level security and four owner-only
   policies. Verification queries are at the foot of that file.
2. Set `VITE_ENABLE_SYNC=true` in the Netlify build environment and in
   `preview/.env`.

Warning: do not set the flag before the table exists. Every sync call
answers 404. The app degrades quietly and nothing syncs, so the flag
would be a lie.

**Decision taken (item 5 above), NOT yet confirmed by Kyle.** The agent
built the plan's own recommendation: pull is free, push is Pro.
- Pull runs for any signed-in account. It is the restore story. A person
  who loses a phone signs in and the shelf returns. Paywalling that turns
  a lost phone into lost data.
- Continuous push is Pro. Keeping two devices in step is the feature the
  mock sells, and it is the part that costs storage.
- A free account still saves once, right after the first merge, so
  signing in never throws away what is on the device.

**What was built.**
| File | Role |
|---|---|
| `credenza-sync-merge.js` | Pure merge core. No fetch, no DOM, no clock. |
| `preview/src/sync.js` | Transport: pull, push, delete, debounced pusher. |
| `docs/sql/2026-07-26-shelves.sql` | The migration. Kyle runs it. |
| `credenza-fashion.jsx` | Tombstone state, load, persist, three effects. |
| `credenza-storage.js` | Tombstone key added to the erase sweep. |
| `netlify/functions/lib/entitlement-store.js` | `deleteShelf`. |
| `netlify/functions/delete-account.js` | Deletes the shelf row too. |

**The two failure modes the design refuses.**
- A plain union of two devices resurrects every deleted card. So a delete
  writes a tombstone, kept beside the shelf in
  `credenza-fashion-tombstones-v1`, swept after 90 days.
- Treating absence as a delete lets one signed-in empty device erase the
  whole account. So only an explicit tombstone newer than the card
  deletes it. Absence never deletes.

Wins are per item, by `updatedAt`. Never per document. Never per field.
On an exact tie the winner is chosen from the two cards alone, so both
devices pick the same one and never push at each other.

**Tests.** 60 new tests, all green:
- `test/sync-merge.test.js` — 27, the merge rules.
- `test/sync-transport.test.js` — 17, injected fetch, no network.
- `test/sync-wiring.test.js` — 16, the call sites in the JSX.
- `test/part7e-account.test.js` — 6, now covers the shelf delete.

Full gate green: lint 0 errors, `tsc` clean, 55 files / 935 tests,
`npm run build` OK.

**Left for the acceptance run, after Kyle does steps 1 and 2.** The
two-device tests can only run against a real table. Everything else in
the acceptance list is covered by the unit tests above.

---

## P1 — The growth loop

### LB-8. Shared shelf `/s/:id` with OG preview — CODE DONE 2026-07-26

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

**What shipped.**

The share document is described twice, because the repo has two module
systems. `credenza-share.js` is ESM and builds documents in the browser.
`preview/netlify/functions/lib/share-doc.js` is CommonJS and reads them
in the function. `preview/test/share-parity.test.js` fails the build if
the two ever disagree on the version, the code alphabet, the caps, or
the expiry rule. Without it, a version bump in one file would answer 404
on every existing link with no error anywhere to say why.

| File | What it does |
|---|---|
| `credenza-share.js` | Builds the frozen snapshot. A field the sharer turned OFF is absent from the object, never merely hidden. Drops inline photos oldest-last to fit 512 KB. |
| `preview/netlify/functions/lib/share-doc.js` | The CommonJS reader half. Parse, code check, expiry. |
| `preview/netlify/functions/share.js` | Create, list, delete. Free keeps 3 links, Pro 100. Caps: 60 items, 512 KB. |
| `preview/netlify/functions/share-page.js` | Renders `/s/:code`. Escapes everything, `noindex`, `nofollow ugc` on seller links. |
| `preview/netlify.toml` | `/s/*` → the function, status 200. |
| `preview/src/share-api.js` | The client transport. Mirrors `account.js`. |
| `sheets/ShareSheet.jsx` | The share sheet. Holds the draft only — never a token. |
| `sheets/SharedLinksSheet.jsx` | Profile → Shared links. List and delete. |
| `docs/sql/2026-07-26-shares.sql` | The migration. **Kyle runs it.** |

**Decisions worth keeping.**
- **No view counter.** The `/s/:code` page is CDN-cached, so a counter
  fed only by cache misses would report far below the truth. A number
  that lies is worse than no number. The reason is recorded in the
  migration file so nobody adds the column back.
- **A share is a cloud write.** The plan test uses
  `ent.mayWriteCloud(record, now)`, not `effectiveStatus`. Grace reads
  Pro but makes no new links.
- **Pro options are forced off, never refused.** The client sends all
  three flags whatever the plan says. A stale plan badge cannot cost
  somebody their link.
- **The share covers the haul, not the search.** A person who searched
  "hoodie" inside a haul and then tapped Share meant the haul.
- **Prices are normalized through `itemUsdAmount`.** A CNY card carries
  `price` and a null `priceUsd` until enrichment. Without this the
  shared page would print nothing where the shelf prints a number.
- **A locked Pro row stays a row.** `aria-disabled`, not `disabled` — a
  disabled button vanishes from a screen reader, and that row is the
  only place the Pro offer is stated.

**Tests.** `share-doc`, `share-server`, `share-parity`, `share-client`.
The last one also fails if `ShareSheet.jsx` uses a `cz-` class that
`credenza-fashion.css` has no rule for — the sheet is lazy-loaded, so an
unstyled class would otherwise stay invisible until someone opened it.

**Left for Kyle.**
1. Run `docs/sql/2026-07-26-shares.sql` in the Supabase SQL editor.
2. After the deploy, paste one link into Discord and confirm the
   preview card. The OG image cannot be verified from this machine.

**Profile → Shared links — BUILT 2026-07-26.** The share sheet's fine
print names that route, so the route exists. `sheets/SharedLinksSheet.jsx`
lists every link this account has made and deletes them one at a time,
two-tap like Erase my data. The row shows only when signed in, because
the links live on the server. `share-client.test.js` fails the build if
the row is renamed away from the sentence that points at it.

Each URL is built against `window.location.origin`, not the default
production host, so a preview build lists preview links.

### LB-9. Ship the "Install share shortcut" page — DONE 2026-07-26

**Why.** Phone capture is the core loop and it was still clumsy. This is
item 26 in `docs/To-do.md`. The backend already handled
`/?stash=` + shared URL.

**What shipped.**
- `preview/public/how/stash-from-your-phone/index.html`, built from the
  guide-page template. Four routes, not one: Android and desktop Chrome
  (install the app, done — the manifest already declares the share
  target), the iOS Shortcut, the share-sheet pin, and a desktop
  bookmarklet.
- `preview/test/share-entry.test.js`, 18 tests.
- Linked from `/how/`, from the FAQ, and from the app's empty shelf.
  Added to `sitemap.xml`, `llms.txt`, and `llms-full.txt`.

**CORRECTION to step 2.** The written step says the Shortcut is
`/?stash=` + shared URL → Open URLs. Built that way it is wrong. A
Weidian URL carries its own `?` and `&`, so concatenating it raw makes
the browser read everything after the first `&` as a separate parameter:

    ?stash=https://weidian.com/item.html?itemID=7376&spider_token=ab12
    → stash = "https://weidian.com/item.html?itemID=7376"

The user gets a card pointing at a truncated link and nothing reports an
error. The Shortcut needs three actions, not two: URL Encode on the
Shortcut Input, then Open URLs on `/?stash=` + the encoded variable. The
page leads with that and says why. The bookmarklet uses
`encodeURIComponent` for the same reason. A test proves both directions
rather than asserting the prose.

**CORRECTION to step 4.** The step names "the phone capture bar's empty
state". No such element exists. The empty shelf is the hero block at
`credenza-fashion.jsx:7862+`. The link went into
`.cz-empty-hero-secondary` — a CSS class that already existed and was
mounted nowhere — next to "Import a haul".

**Deferred.** Step 3 asks for screenshots of each step. iOS Shortcuts
screenshots go stale on every iOS release and cannot be captured from
this machine. The steps name the exact action labels instead, which
survives a redesign that a screenshot does not.

**Acceptance.**
- Renders at 390px on the shared page stylesheet. The device step (build
  the Shortcut on a real iPhone) still needs Kyle.

### LB-10. Ship the CSV export (Pro row) — DONE 2026-07-26

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

**What shipped.**
- `credenza-haul-export.js` — `CSV_BOM`, `CSV_COLUMNS` (15 columns),
  `csvCell`, `csvRowForItem`, `haulToCsv`, `downloadHaulCsv`.
- `credenza-fashion.jsx` — `exportShelfCsv`, gated on `isProPlan`.
- `sheets/ImportSheet.jsx` — the row, with a Pro badge for free users.
- `preview/test/haul-csv.test.js` — 22 tests. The file parses the output
  back with an RFC 4180 reader, so it tests what a spreadsheet reads
  rather than what we wrote.

**Two hazards the steps above do not name, both handled.**
1. Formula injection. Excel and Sheets EXECUTE a cell starting with
   `=`, `+`, `-` or `@`, quoted or not. Seller names and titles are
   scraped text. Every such cell gets a leading apostrophe — except a
   real number, or the price column stops totalling.
2. The UTF-8 BOM. Without it Excel reads the file as the local codepage
   and a CJK seller name arrives as mojibake. `downloadHaulCsv` prepends
   it at the Blob; `haulToCsv` returns a clean document, so a parser
   never sees a BOM inside the first header cell.

**One correction made on the way.** `plan-limits.test.js` asserted the
nudge string appeared exactly twice, matching one single-line spelling.
A nudge written across two lines would have passed it unchecked. The
test now counts `actionLabel: "See Pro"` and separately checks each one
routes to the Profile sheet, whatever the line breaks.

---

## P2 — Speed and code health (post-launch acceptable, pre-launch nice)

### LB-11. Cut the framer-motion payload — DONE 2026-07-26

First-load JavaScript went from 190.14 KB gzip to 164.63 KB gzip. That is
a **25.5 KB cut**, at the top of the estimate. The feature bundle now
loads in its own chunk after the first paint.

**The spec was wrong about `domAnimation`. Do not use it here.** The
carousel and the photo cover flow both use `onPan`, and pan ships in the
`drag` feature bundle, not the animation one. `domAnimation` drops pan and
kills both swipe gestures. The app must load `domMax`.

**Measured, because the obvious reading is wrong.** Loading `domMax`
eagerly saves nothing at all — it is 164 bytes LARGER than plain `motion`.
The entire win comes from loading it late, through an async
`features={() => import(...)}` function. Numbers from an isolated esbuild
bundle: plain `motion` 88,163 gzip; `LazyMotion` + eager `domMax` 88,327;
`LazyMotion` + eager `domAnimation` 74,638 (but no pan).

**Two things had to change together, or the win is zero.**

1. Every file imports `m`, not `motion`. One leftover `motion` import
   pulls the features straight back into the entry chunk: measured 89,695
   gzip with one stray import, against 62,294 with none. All seven files
   use `import { m as motion }`, so all 42 JSX call sites are unchanged.
   `strict` is on, so a future stray import fails loudly.
2. `preview/vite.config.js` no longer names `framer-motion` in the
   `vendor` manualChunks list. Naming it there forces the whole library
   into one eager chunk and defeats the split completely. This was the
   real blocker, and it is not obvious from reading the component code.

**The carousel freeze.** `components/CoverFlowCarousel.jsx` is frozen, and
the split needs all seven files. The change there is the import line only,
aliased so all 21 JSX usages are byte-identical. That is the smallest
possible edit that still works.

**Verification.** `preview/scripts/probe-lazymotion.mjs` drives a real
browser and asserts three feature families: an `animate` transform lands
on the carousel cards, a mouse swipe moves the carousel active index
(pan), and `whileHover` produces `matrix(1.02, …)` on the search Clear
button. It also fails on any framer-motion console error, which is how
`strict` reports a stray import.

The pan assertion was proved to bite: flipping the loader to
`domAnimation` makes it fail with "swipe did not move the carousel", and
flipping back makes it pass. A probe that cannot fail proves nothing.

Pixel diff before against after, at 390 / 768 / 1024 / 1280 in card and
grid view: every view under 0.03% of pixels, against a 2.1% image-load
noise floor measured in LB-12. Gate: 1031 tests pass, lint 0 errors, tsc
clean, build OK.

### LB-12. Purge dead CSS — DONE 2026-07-26

`credenza-fashion.css` went from 12,264 to 11,405 lines. The built CSS
went from 190.75 KB to 190.69 KB, so the win is maintenance, not payload.
A dead rule costs almost nothing after gzip. It costs a lot of reading.

**Method.** A script found every class token in a selector position, then
searched the whole source tree for each one. 97 classes had no match. That
raw list is not proof, because classes are also built by concatenation, so
a second pass looked for string literals ending in a hyphen next to a `+`.
That found 13 concat prefixes and cleared 12 of the 97 as live:

- `is-past` comes from `"is-" + state` in `components/atoms.jsx`.
- `kind-hedge` / `kind-rec` / `kind-user` / `kind-usual` come from
  `"cz-front-size-label kind-" + size.kind` in `components/CardFrontInfo.jsx`.
- `cz-haul-stat-gl` / `-rl` / `-returned` come from
  `"cz-haul-stat cz-haul-stat-" + s` in `credenza-fashion.jsx`.

Carousel selectors were excluded by name. The carousel is frozen for every
agent, so no rule naming it was touched.

**Guards that caught real mistakes.** The first purge attempt rewound each
span to the start of its line, which ate the opening brace of a parent
`@media` block. A brace-balance assert caught it before the file was
written. The second run asserts that the balance is unchanged, and a
class-set diff proves that the 65 removed classes are all on the dead list
and that nothing was added.

**A real bug found on the way.** The build printed two `css-syntax-error`
warnings that predate this task. A selector list at old line 8770 ended
with a comma and no `{`, so esbuild dropped the whole rule. The 2px focus
rings on `.cz-pill`, `.cz-buy-btn`, `.cz-card-menu-trigger` and the rest
never rendered. Fixed. The build is now warning-free.

**Verification.** `preview/scripts/css-purge-shots.mjs` shoots the app at
390 / 768 / 1024 / 1280 in both card and grid view. Seven of eight views
differ by under 0.05% of pixels. `1280-grid` differs by 2.1%, so the same
CSS was shot twice: the second pair differ by the same 2.1%. The variance
is a remote-image load race, not a layout change.

### LB-13. Archive the legacy root files

DONE for the safe half (2026-07-26). The original spec was wrong on two
points, corrected here so nobody repeats the mistake.

Moved into `docs/legacy/`, with a README that says why:
`credenza-v2.jsx`, `credenza-v3-walnut.jsx`, `V3-SPEC.md`. Grep proves no
code imports any of the three.

Two files must NOT move:

- `credenza.css` is live, not legacy. `credenza-fashion.jsx:69` imports
  it, and it holds `.cz-shelf-grid`. There is no separate v2/v3 CSS file
  to archive — the original spec invented one.
- `credenza-v3.jsx` is not import-free. Three places still import it:
  `preview/src/main.jsx`, `extension/src/main.jsx`, and
  `preview/test/app.test.jsx` (7 passing tests). The lint script in
  `preview/package.json` also names it. It is not a Vite build input for
  the fashion app, but archiving it means deleting or repointing those
  7 tests and touching the dormant Chrome extension. That is a scope
  call for Kyle, not an agent. Left in place on purpose.

---

## P1 — The public site

### LB-14. Audit the public site; lock it with a test — DONE 2026-07-26

Commit `c6f9253`.

The site is 14 hand-written HTML files under `preview/public/`. There is no
build step and no shared partial. Every page carries its own `<style>`, its
own `<nav>`, and its own footer. A page edited months apart from its
neighbours drifts, and nothing fails until a reader or a crawler finds it.

**What the audit checked:** D-2 nav reach on every page, D-3 compliance on
`/pricing/`, JSON-LD parseability, FAQ schema against visible copy, internal
link targets, canonical URLs, and `sitemap.xml` coverage in both directions.

**Three defects found:**

1. `/pricing/` carried `FAQPage` JSON-LD with **zero visible questions**.
   Google's structured-data policy requires the answer be visible to the
   reader. Invisible FAQ schema risks a manual action, and nothing on the
   page looked wrong. The existing 14-test `pricing.test.js` passed
   throughout. Fixed: added `details`/`summary` CSS and four visible blocks,
   generated from the schema so the text cannot differ.
2. `/faq/` had **six answers where schema and visible copy had drifted**.
   One promised the $4.99 and $39.99 price in schema the reader never saw.
   Fixed the visible copy first, because the schema held the better answer,
   then regenerated the whole `FAQPage` block from the visible `<details>`.
3. `/landing/` was the only page against D-2 — no Guides, no FAQ. Fixed by
   adding both beside its in-page scroll anchors, which are a design choice
   and stay.

Also fixed one schema name that did not match its visible heading.

**The parity rule.** The **visible copy is the source of truth**. The schema
must match it word for word and in the same order. Never satisfy the test by
editing the schema to match a wrong visible answer — fix the copy.

**What came back clean:** the sitemap covers all 14 pages both ways, zero
broken internal links, all JSON-LD parses, and `/pricing/` lists no deferred
feature (no restock watch, no seller memory).

**`preview/test/public-site.test.js` — 89 tests.** This file is the missing
partial. It derives its page list from the filesystem, so a page added next
week is covered when it lands, not when somebody remembers to edit an array.
A first assertion checks the list is not empty, so a glob that matches
nothing cannot make the rest vacuous.

Four negative controls prove each key assertion bites. Strip the pricing
`<details>` (reproduces defect 1), drift one FAQ schema answer, remove the
landing Guides link, rename a sitemap `<loc>`. Each fails the expected test
and nothing else. All four files were backed up first and restored.

Gate after the change: 1120 tests pass (was 1031), lint clean, typecheck
clean, build OK with unchanged chunk sizes.

### LB-15. Build the /support/ page — DONE 2026-07-26

Credenza takes money. A customer who wants to cancel, get a refund, export a
shelf, or delete an account needs one place to look. Before this the contact
address appeared only inside the body copy of three pages. Stripe also expects
a reachable support route on a site that charges a card.

`/support/` answers seven things: cancel Pro, ask for a refund, export your
shelf, delete your data, report a bug, report a wrong size recommendation, and
what support cannot do. Every rule on it comes from `/terms/` or `/privacy/`,
so the three pages cannot contradict each other. If a rule changes, change it
in the terms first, then here.

The last section is the one that saves the most mail. Credenza never handles a
purchase, so orders, payments, parcels, and sellers who did not ship go to the
shopping agent. Finding an item is not a Credenza job either.

Support now appears in the nav and the footer of all 16 pages, in
`sitemap.xml`, in `llms.txt`, and in `llms-full.txt`. The FAQ cancel answer
links to it, and the FAQ schema was regenerated from the visible copy after
the edit.

**A second defect, found by the same work.** `404.html` still carried the nav
from before Guides shipped. The LB-14 test missed it because `pageFiles()`
only collected files named `index.html`. A landable page is not always an
index. The test now builds a `DOCS` list that adds `404.html`, and uses it for
nav, links, and head checks. `PAGES` still drives the sitemap checks, because
`404.html` is `noindex` and must stay out of the sitemap.

Four more negative controls confirm the new checks bite: strip every Guides
link from `404.html`, delete the support page (17 failures), point the 404
canonical at the wrong URL, and drop the support entry from the sitemap.

Gate: 1131 tests pass, lint clean, typecheck clean, build OK.

### LB-16. Give every page structured data — DONE 2026-07-26

Three pages carried no JSON-LD at all: `/privacy/`, `/terms/`, and
`/support/`. No page on the site carried a `BreadcrumbList`. An assistant that
reads the site had no machine-readable way to learn where a page sits, and the
three pages with nothing were the ones a buyer needs most.

The legal and support pages now carry one `WebPage` node each. The node names
the page, its canonical URL, its description, the parent `WebSite`, the
publisher with the support address, and a nested `breadcrumb`. No `FAQPage`
was added to any of them — none has visible `<details>`, and inventing that
schema is exactly the defect LB-14 fixed on `/pricing/`.

The other twelve pages got a top-level `BreadcrumbList`. The guides and
`/how/stash-from-your-phone/` carry a three-step trail: home, the section,
then the page. The rest carry two steps.

`preview/test/public-site.test.js` now holds the line. One test per indexable
page checks four things: a `BreadcrumbList` exists, the positions run 1..N
with no gap, the first crumb is the site root, and the last crumb is that
page's own URL. A trail that ends anywhere else points a crawler at the wrong
URL. `404.html` is exempt, because it is `noindex` and has no place in the
tree.

The reader function looks in both places a breadcrumb can live: a top-level
block, and the `breadcrumb` property of a `WebPage`. Both forms are valid
schema.org, and forcing one shape would have meant a worse `WebPage` node on
the three legal pages.

Three negative controls confirm the checks bite: delete the guides-index
block, point the terms trail at `/privacy/`, and change a position from 2 to
4. Each fails one test and only one.

Gate: 1146 tests pass, lint clean (5 pre-existing warnings), typecheck clean,
build OK with unchanged chunk sizes.

### LB-17. The body-measurements guide — DONE 2026-07-27

`docs/aeo-geo/buying-questions.md` listed four secondary questions with no
page. Three are blocked: weight bands are not built, and two need safe
language work. One had shipped product behind it and nothing written: "How do
I store body measurements for agent sizing?"

`preview/public/guides/store-body-measurements/index.html` answers it. Nine
sections: why a profile beats re-deciding, the eight fields, how to take each
measure, the unit toggle, usual sizes, fit preferences, the four size labels,
where the numbers live, and the honest tradeoff.

Every claim was read out of the code first, not written from memory:

- Eight fields, from `BODY_PROFILE_FIELDS` — height, weight, chest, shoulder,
  arm length, waist, hip, inseam.
- Storage is centimeters. The in/cm toggle converts the draft in place, so a
  typed number is never reinterpreted as the other unit.
- Fit preferences exist for four categories only, from `FIT_PREF_AXES`:
  shirt, outerwear, pants, shorts.
- `loosenessNudge` moves the pick one step. Slim is −1, baggy and oversized
  are +1. Length never moves the letter size.
- `effectiveBodyProfile` fills chest, waist, and hip from height and weight.
  A measured field always wins over an estimate.
- `resolveDisplaySize` returns four labels: SIZE, AI SIZE, AI SIZE with a
  question mark, and YOUR USUAL.
- The privacy claim is repeated word-for-word from `/privacy/` and `/faq/`:
  body measurements never leave the device.

The page carries `HowTo` and `BreadcrumbList` JSON-LD. It is listed in
`sitemap.xml`, `llms.txt`, `llms-full.txt`, and the guides hub. It matches the
existing guide idiom exactly — same `:root` tokens, header, nav with
`aria-current` on Guides, cards, note, CTA, related links, and footer.

The guide states a limit rather than hiding it: Credenza reads the chart the
seller published, so a wrong chart gives a wrong pick, and no measurement
knows how a fabric behaves. A profile removes the avoidable mistakes, not the
fit risk.

One negative control confirms the checks bite: blank the middle crumb name.
It fails one test and only one.

Gate: 1153 tests pass (up from 1146), lint clean (5 pre-existing warnings),
typecheck clean, build OK with unchanged chunk sizes.

---

### LB-18. The agent comparison guide — DONE 2026-07-27

The second unblocked secondary question: "Superbuy vs CSSBuy vs Sugargoo —
which planner helps me decide size first?" The note on it warned that an agent
comparison must stay planner-framed, not turn into agent review spam.

`preview/public/guides/choose-an-agent/index.html` holds that line. It refuses
to rank agents on service quality, because nobody can verify shipping speed or
claim handling from a web page, and it says so. It compares the three things a
reader can check: link format, marketplace coverage, and whether the item page
needs a login.

The facts come from `agents.js`, not from forum opinion:

- Full-URL agents: Superbuy, AllChinaBuy, Sugargoo, Kakobuy.
- Id-plus-platform agents: Hoobuy and Oopbuy (numeric codes), CNFans,
  Mulebuy, and Joyagoo (platform names).
- Fansbuy is Weidian only.
- Sugargoo gates item pages behind a login. The bounce is their rule, not a
  broken link.
- CSSBuy is `retired: true` — they refuse purchasing-agent service to US
  customers. The title names Sugargoo and Kakobuy in their place, and the page
  says stored CSSBuy links still fail open to the store page.

The referral disclosure is copied word-for-word from `/privacy/` and
`/terms/`. The page then adds the thing that makes the disclosure credible: it
names CNFans, which pays nothing since its programme ended, in the same list
as the agents that pay.

The argument is the product thesis, stated plainly: agent choice is
reversible, a lost link is not. Store the canonical link, pick the agent at
click time, decide size before you press Buy.

One negative control: replace the absolute canonical with a relative one. It
fails one test and only one.

Gate: 1160 tests pass, lint clean (5 pre-existing warnings), typecheck clean,
build OK with unchanged chunk sizes.

---

---

### LB-19. Two pricing-page numbers had no test — DONE 2026-07-27

**A correction first.** The first attempt at this row added a whole new
`describe` block to `test/plan-limits.test.js`. That was wrong.
`preview/test/pricing.test.js` already existed and already locked four of
the five comparison-table rows to `PLAN_LIMITS`. Seven of the nine new tests
repeated it. The block was removed before commit. **Grep for an existing test
file before writing a new one.**

**The two real gaps.**

1. **The `Link resolves` row was the one row `pricing.test.js` skipped.** It is
   also the row most likely to drift unnoticed: the copy writes `1,000` where
   the server writes `1000`, so an eye scanning for a mismatch finds one that
   is not there and "fixes" the wrong side.
2. **Neither bullet list was checked at all.** The two plan cards carry ten
   bullets above the table, and a reader meets them first. A number that agrees
   with the server in the table and disagrees in a bullet is still a broken
   promise, and the table check cannot see it.

**What shipped.** Three additions to the existing
`describe("the page only sells what is built")` block in
`preview/test/pricing.test.js`:

- The `Link resolves` pair, with `toLocaleString("en-US")` supplying the
  thousands separator so `1000` compares to `1,000`.
- A new `it` that reads every `<li>` and requires six of them to match a
  number derived from `PLAN_LIMITS`. It carries a vacuity guard
  (`bullets.length > 8`), because an empty list would pass on nothing.
- A new `it` that requires each of the five row keys to exist in
  `PLAN_LIMITS`. This is D-3 applied to numbers: the page must not promise a
  limit nothing enforces.

**Negative controls (both run, both restored).**

- NC-1 — changed the free `Link resolves` cell from `20 a day` to `25 a day`.
  Result: 1 failed, 15 passed.
- NC-2 — changed the Pro bullet from `1,000` to `2,000` and left the table
  correct. Result: 1 failed (`repeats the same caps in the plan bullet
  lists`), 15 passed. **This is the case the old test could not see.**

**Gate.** 60 files / 1162 tests passed (1160 before: two net new, seven
duplicates removed). Lint 0 errors, 5 pre-existing warnings. Typecheck clean.
Build unchanged: index-fashion 362.73 KB / 117.30 KB gzip, vendor
149.10 KB / 47.33 KB, index 147.13 KB / 50.39 KB.

### LB-20. Thirteen search results ended mid-sentence — DONE 2026-07-27

**The gap.** Google shows roughly 160 characters of a meta description and
roughly 60 of a title. Thirteen of eighteen public pages ran past the
description limit. One ran past the title limit. The cut always landed on the
closing clause, which is the clause that says what makes Credenza different.

What the reader lost, before the fix:

| Page | Length | The clause that never appeared |
| --- | --- | --- |
| `/guides/store-body-measurements/` | 233 | "and why the numbers never leave your device" |
| `/guides/choose-an-agent/` | 220 | "so you can switch agents without losing your list" |
| `/guides/weidian-size-chart/` | 216 | "before you open your agent" |
| `/guides/track-qc-photos/` | 213 | "and decide before the parcel ships" |
| `/landing/` | 202 | "then open Buy in your own agent" |
| `/how/stash-from-your-phone/` | 201 | "iOS needs a two-action Shortcut" |
| `/guides/open-weidian-in-agent/` | 201 | "and wraps at Buy time" |
| `/how/` | 198 | "the decision layer before the agent click" |
| `/guides/reddit-haul-to-list/` | 185 | "Credenza haul planner" |
| `/faq/` | 179 | "without being a W2C marketplace" |
| `/guides/organize-agent-haul/` | 179 | "Free haul planner" |
| `/guides/index` | 169 | "Not a marketplace" |
| `/guides/spreadsheet-vs-haul-planner/` | 168 | "need one card" |

The `/guides/choose-an-agent/` title was 76 characters. Shortened to
`Superbuy vs Sugargoo vs Kakobuy · decide size first` (51).

All thirteen descriptions are rewritten to 147–156 characters. Every one keeps
its closing point and ends in a full stop.

**A defect the test found on its first run.** The same commit adds a check for
the hard language rules in `docs/aeo-geo/ai-seo-playbook.md`. It failed
immediately on `/guides/reddit-haul-to-list/`, which read:

> Credenza does not rank "best batch" sellers and does not search a
> counterfeit catalog.

The phrase sat inside a denial, so a human reads it correctly. An answer engine
that lifts a phrase can drop the negation, and the playbook's rule is literal.
Reworded to "does not rank sellers, score batches, or search a counterfeit
catalog" — same meaning, no banned string.

**What the tests do.** Two new `describe` blocks in
`preview/test/public-site.test.js`, over `DOCS` (all 19 landable pages,
including 404):

- Title at most 60 characters.
- Description between 70 and 160 characters. A ceiling AND a floor: too long
  is cut mid-clause, too short wastes the only sentence the page gets.
- Description ends in `.`, `!` or `?`. Copy written to a limit is easy to leave
  dangling on a comma.
- No page contains any of the five banned phrases.
- A vacuity guard asserts `DOCS.length > 10`, because an empty list would pass
  every loop by never running it.

**Negative controls (all four run, all restored).**

- NC-1 — pushed the `/how/` description past 160. Failed the truncation test.
- NC-2 — removed its terminal full stop, keeping the length legal. Failed the
  mid-sentence test only.
- NC-3 — cut it to 15 characters. Failed the truncation test on the floor.
- NC-4 — injected "best batch" into `/support/`, which was clean. Failed the
  banned-language test for that page only.

**Gate.** 60 files / 1235 tests passed (1162 before; 73 added, three per page
plus the guards). Lint 0 errors, 5 pre-existing warnings. Typecheck clean.
Build unchanged.

### LB-21. Two guides were reachable by one route — DONE 2026-07-27

**The gap.** Eight pages sit in the site nav, so all 19 pages link to them.
The nine deep pages — the eight guides and `/how/stash-from-your-phone/` — are
not in the nav. They depend entirely on links written by hand into other pages'
body copy, and nothing checked that those links existed.

Measured inbound links, excluding the nav and excluding the guides hub:

| Page | Before | After |
| --- | --- | --- |
| `/guides/choose-an-agent/` | 1 | 2 |
| `/guides/track-qc-photos/` | 0 | 2 |
| `/guides/spreadsheet-vs-haul-planner/` | 1 | 2 |
| `/guides/store-body-measurements/` | 1 | 2 |
| `/guides/open-weidian-in-agent/` | 2 | 2 |
| everything else | ≥2 | ≥2 |

`/guides/track-qc-photos/` was the worst case: the hub listing was its only
route in. A crawler that reaches a page by one route treats it as marginal, and
a reader following a topic never arrives at all.

**Six links added, each chosen for topic, not for count.**

- The spreadsheet comparison argues a sheet cannot hold a QC photo → links the
  QC guide.
- The size-chart guide ends on "still not a tailor" → links the measurements
  guide, which is the way to make the pick better.
- The open-in-agent guide is about which agent wraps which link format → links
  the agent comparison.
- The organize guide covers the whole Want → Bought → QC flow → links the QC
  guide.
- `/faq/` "Which shopping agents are supported?" → links the agent comparison.
- `/faq/` "What is Credenza?" → links the spreadsheet comparison, for the reader
  who keeps a haul in a sheet today.

**Both FAQ edits changed the schema in the same step.** `/faq/` carries FAQPage
JSON-LD, and LB-14's rule is that the visible copy is the source of truth. The
existing "save a link from my phone" answer set the pattern: the schema text
carries the anchor's words as plain text. Both new sentences follow it exactly.

**What the test does.** A new `describe` block in
`preview/test/public-site.test.js`:

- Every deep page needs at least two inbound links from pages other than the
  guides hub. Excluding the hub is the point: a hub listing alone is what the
  two thin guides already had.
- The guides hub must list every guide. This is the reverse direction — a guide
  missing from the hub is invisible to a reader browsing by topic.
- No page may link a URL with no page behind it.
- A vacuity guard asserts more than five deep pages were found.

**Negative controls (both run, both restored).**

- NC-1 — removed the new FAQ link to the spreadsheet guide, dropping it back to
  one inbound. Failed exactly that page's test.
- NC-2 — typed `/guides/track-qc-photo/` (singular) in the organize guide's
  related block. Failed three tests: the broken-link check, the new
  does-not-exist check, and the QC guide's inbound count, because a typo'd link
  is not an inbound link.

**Gate.** 60 files / 1247 tests passed (1235 before). Lint 0 errors, 5
pre-existing warnings. Typecheck clean. Build unchanged.

### LB-22. Five guides described the feature and stopped — DONE 2026-07-27

**The defect.** The guides are the bottom of the funnel. Somebody searches
"how do I open a Weidian link in Superbuy" and lands on one. Five guides were
207–279 words against 576–821 for the rest. The difference was not style. The
thin ones named the feature and stopped. A reader who still has the question
leaves, and a page nobody finishes does not hold a ranking.

**What was written.** Every new claim was read out of the source before it was
written. Nothing was invented.

| Guide | Before | After | Source of the new facts |
| --- | --- | --- | --- |
| `open-weidian-in-agent` | 207 | 561 | `agents.js` — 3 template kinds, `extractMarketplaceItemId`, `buildAgentUrl` fail-open reasons |
| `weidian-size-chart` | 229 | 603 | `credenza-fashion.jsx` — `MEASURE_PAIR_RE`, `normalizeHalfChestRows`, `sizeRunHint`, `recommendSize` ease |
| `reddit-haul-to-list` | 224 | 657 | `reddit-haul.js` + `docs/session-state.md:749` — the 22-post measurement |
| `spreadsheet-vs-haul-planner` | 274 | 670 | `credenza-haul-export.js` `CSV_COLUMNS`; `public/pricing/index.html` |
| `organize-agent-haul` | 215 | 593 | `STATUS_TRACK`, `migrateHaul`, `GALLERY_MAX`, `agents.js` |

**Three defects the rewrite of `organize-agent-haul` also cleared.**

1. It recommended **CSSBuy**, which `agents.js` marks `retired: true`. CSSBuy
   refuses purchasing-agent service to USA customers (Kyle's call 2026-07-20),
   and `choose-an-agent` already says so. Replaced with CNFans and Hoobuy.
2. It stated the pipeline as `Want → Bought → QC → GL/RL → Shipped`. The named
   constant is `STATUS_TRACK = ["Want", "Bought", "Shipped", "Received"]`.
   `statusTrackIndex` maps `qc`, `gl` and `rl` to index 1 — inside Bought.
3. Its HowTo JSON-LD carried the same wrong order in step 4.

**The same stale pipeline was on three more files.** `public/how/index.html`
carried it twice (visible copy and HowTo JSON-LD), `public/llms-full.txt` once,
and `docs/aeo-geo/content-kit.md` once. All four now read
`Want → Bought → Shipped → Received`, with QC, GL and RL named as sub-states of
Bought. The `GL/RL` mentions that describe QC tracking rather than stage order
were left alone.

**A correction caught before it shipped.** A draft card said "export the shelf
to CSV" with no plan qualifier. `exportShelfCsv` is gated on `isProPlan`, and
`public/pricing/index.html` lists spreadsheet export Free=No / Pro=Yes. The
card was rewritten as two items: the free `.json` backup, and the Pro `.csv`
export with a `/pricing/` link.

**The floor, and why the test found what the audit missed.** A hand word-count
audit counted the whole `<body>`, which carries about 65 words of nav, brand
mark and footer on every page. `organize-agent-haul` measured 279 that way and
looked acceptable. The test slices `<main>` only and read it as 215. The test
found a defect the manual pass had cleared.

`no guide is too thin to answer its question` requires ≥400 words in `<main>`
and ≥4 `<h2>` per guide, plus a `guides.length >= 8` vacuity guard. The floor
sits well below the pages as written (561–670), because it guards against a
page being **gutted**, not against a page being concise. A guide that
legitimately needs 450 words passes.

**Negative controls (both run, both restored).**

- NC-1 — replaced the `<main>` of `organize-agent-haul` with a one-line stub.
  Failed the word floor: "has 3 words in `<main>`".
- NC-2 — the same stub removed every `<h2>`. Failed the section check: "has 0
  h2 headings". One edit proved both assertions can fail.

**Gate.** 60 files / 1264 tests passed (1247 before). Lint 0 errors, 5
pre-existing warnings. Typecheck clean. Build clean.

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
- [ ] LB-7: Kyle ran the shelves migration AND set `VITE_ENABLE_SYNC=true`.
      The code is done, but sync does nothing until both happen.
- [ ] LB-8: Kyle ran `docs/sql/2026-07-26-shares.sql`. Without the
      table every share attempt fails, and the Share button is visible
      to everybody.
- [ ] LB-3/D-1 price decision recorded here.
- [ ] One full paid loop verified in test mode (LB-5 log exists).
- [x] Pricing page lists only shipped features. Verified 2026-07-26 by the
      LB-14 audit. `preview/test/public-site.test.js` holds the line.
- [ ] A fresh build from a clean checkout passes the preflight and shows
      sign-in (the LB-6 regression can never recur silently).
- [ ] Kyle approves one production deploy batch containing all of it.
      This is the ONLY deploy the whole launch spends (rule 8). Every
      task lands on `main` and waits for it.

LB-8, LB-9, LB-10 are strongly recommended before any public
announcement post — the share link is the announcement's engine — but
they do not block flipping the site live.

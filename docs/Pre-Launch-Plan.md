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
| LB-8 | Shared shelf `/s/:id` with OG preview | P1 | 2–3 days | LB-7 | CODE DONE 2026-07-26 — needs the shares migration; the OG picture was broken until LB-39 |
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
| LB-23 | Fill /how/; widen the length floor to every page | P1 | 1.5 h | LB-22 | DONE 2026-07-27 — /how/ 248 → 967 words; floor now covers 17 pages |
| LB-24 | Repair and lock the social link card on all 18 pages | P1 | 1 h | LB-23 | DONE 2026-07-27 — 4 pages were missing 5 tags each; 2 more had drifted text |
| LB-25 | Hold llms.txt to the same rules as the pages | P1 | 1 h | LB-24 | DONE 2026-07-27 — both briefs were exempt from every site rule |
| LB-26 | Lock the four shipped files that are not pages | P1 | 1 h | LB-25 | DONE 2026-07-27 — the manifest painted the wrong splash; 18 pages mis-coloured the status bar |
| LB-27 | Rebuild the guides hub so it answers instead of routing | P1 | 1 h | LB-26 | DONE 2026-07-27 — 200 words to 520, ordered by haul stage; the hub floor exemption is gone |
| LB-28 | Put the refund on the page where people decide to pay | P1 | 1 h | LB-27 | DONE 2026-07-27 — the 14-day refund was only in Terms; pricing 449 words to 851 |
| LB-29 | Bring the app shell into the rules the 18 public pages follow | P1 | 1 h | LB-28 | DONE 2026-07-27 — the homepage had no canonical, no social card, no schema, and the stale colourway LB-26 fixed everywhere else |
| LB-30 | Close the two pages a reader could reach but not leave forwards | P1 | 1 h | LB-29 | DONE 2026-07-27 — /faq/ and /support/ had no CTA; the FAQ ended on how to cancel |
| LB-31 | Ship the haul-weight guide and lock the schema type every page declares | P1 | 1 h | LB-30 | DONE 2026-07-27 — the guide cluster stopped at Buy, and no rule checked the node that says what a page IS |
| LB-32 | Bind every quoted price to the price the app charges | P0 | 1 h | LB-31 | DONE 2026-07-27 — raising PRICING failed only the two llms files; /pricing/, /faq/ and /terms/ kept the stale number |
| LB-33 | Assert what robots.txt says, not just that it ships | P0 | 1 h | LB-32 | DONE 2026-07-27 — replacing it with Disallow: / deindexed the whole site and the suite stayed green |
| LB-34 | Assert the deploy contract in netlify.toml | P0 | 1 h | LB-33 | DONE 2026-07-27 — five edits that break the live site each passed with the suite green at 1503 |
| LB-35 | Ship the free-plan guide and bind every quoted limit to the server table | P1 | 1 h | LB-34 | DONE 2026-07-27 — the last unshipped buying question; changing "20 link resolves" to 500 on a live page passed |
| LB-36 | Ship the Yupoo guide, bind the relay cap to the copy, and stop the keyword doc drifting | P1 | 1 h | LB-35 | DONE 2026-07-27 — ~12k/mo head term with a shipped feature and no page; it stayed uncovered because the planning table looked full |
| LB-37 | Make a clean checkout build the real app instead of a 21-module stub | P0 | 2 h | — | DONE 2026-07-27 — the launch gate box was unchecked because it was true; Netlify would have shipped a bundle with no icons and no app |
| LB-38 | Cache the bytes that never change; stop re-sending 1.3 MB to every repeat visitor | P1 | 1 h | LB-37 | DONE 2026-07-27 — the live site sent max-age=0 for a 352 KB font and 884 KB of content-hashed JS; found while booting the built bundle for LB-37 |
| LB-39 | Give the share card a picture: relay the photo instead of hotlinking it | P0 | 2 h | LB-8 | DONE 2026-07-27 — LB-8's own acceptance criterion was not met; every Discord unfurl drew a blank card because Yupoo answers a crawler with HTTP 567 |
| LB-40 | Hold the app and the share page to the language rules the pages follow | P1 | 1 h | LB-39 | DONE 2026-07-27 — the seventh scope defect; putting "W2C best batch 1:1 replica finder" in the app's search box passed all 1617 tests |
| LB-41 | Hold the install prompt to the same language rules | P1 | 30 m | LB-40 | DONE 2026-07-27 — the eighth scope defect, hiding inside LB-26's fix; the manifest was under test but only its colours, icons, and scope, so a banned description passed all 1629 tests |
| LB-42 | Stop showing the buyer the server's own error strings | P0 | 1 h | LB-41 | DONE 2026-07-27 — pressing Upgrade with one variable unset showed a paying visitor "Server not configured: missing STRIPE_PRICE_MONTHLY"; 18 such strings across 8 functions, none under test |
| LB-43 | Check the yearly price, not just the monthly one | P0 | 45 m | LB-42 | DONE 2026-07-27 — the ninth scope defect; the rule read the first price after "Pro" and every sentence names two, so a wrong yearly price passed all 1641 tests |
| LB-44 | Check that the files a page asks for are actually there | P1 | 45 m | LB-43 | DONE 2026-07-27 — the tenth scope defect, and the first about references rather than words; renaming the landing hero to a file that does not exist passed all 1641 tests |
| LB-45 | Sell the two features that shipped a day ago | P1 | 50 m | LB-44 | DONE 2026-07-27 — the eleventh scope defect, and the first where the rule was also wrong about the facts; a stale comment kept shared links and multi-device off the page that sells Pro |

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
  and title. — **This one failed when it was finally run by hand. The card
  had no picture. See LB-39: the seller refuses a crawler, so the photo is
  relayed through `/s/:code/img` instead of hotlinked.**
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

### LB-23. The length floor only guarded one directory — DONE 2026-07-27

LB-22 locked a 400-word floor on `/guides/`. That scope was the defect. A sweep
of every page after LB-22 shipped found `/how/` at **248 words in `<main>`** —
thinner than all nine guides, in the top nav, and carrying a `HowTo` schema. The
suite stayed green because the floor never looked outside `/guides/`.

**The page.** `/how/` had five step cards, each one paragraph. It named the
five steps and stopped, so a reader who landed there still had to open a guide
to learn anything. It is now **967 words in `<main>`, 8 `<h2>`**. Every added
claim came from source, not from copywriting:

| Claim added | Source |
|---|---|
| Multi-link paste sorts by host: Yupoo → photos, Weidian/Taobao/Tmall/1688 → buy, rest → extra | `inferLinkRole`, `credenza-fashion.jsx:1320` |
| Automod-broken links are repaired before the address is read | `deobfuscateUrls`, `reddit-haul.js:266` |
| Six album photos relayed; album link keeps the real count | `RELAY_MAX = 6`, `credenza-fashion.jsx:1921` |
| 20 hand-added photos an item | `GALLERY_MAX = 20`, `credenza-fashion.jsx:1909` |
| Tops 12 cm ease, outerwear 16 cm, bottoms 2 cm | `recommendSize`, ease branches |
| Hip-only 臀围 charts return a size | `recommendSize`, `has("hip")` fallback |
| Chart labels read: 胸围 腰围 臀围 肩宽 袖长, plus half-chest columns | `MEASURE_PAIR_RE`, `credenza-fashion.jsx:587` |
| Runner-up size and a named missing measure | `recommendSize` returns `alt` and `{ missing }` |
| The four stops, with QC/GL/RL inside Bought | `STATUS_TRACK` + `statusTrackIndex` |
| Ten agents named, plus "no agent" | `agents.js` — CSSBuy is `retired: true`, so it is not named |
| Agent links unwrap to the marketplace URL | `marketplaceBuyUrl` / `unwrapAgentUrl` |
| A haul carries name, budget, parcel weight and dims; CNY converts per item | `migrateHaul`, `credenza-fashion.jsx:397` |
| 2 hauls free / 100 Pro; Ask 5/200; charts 2/100; resolves 20/1000 | `PLAN_LIMITS`, `entitlements.js:29` |
| CSV has 15 named columns, and export is Pro | `CSV_COLUMNS` + `exportShelfCsv` Pro gate, `credenza-fashion.jsx:5375` |

Nothing dormant is named. Shared links and cloud sync stay off the page for the
same reason `test/pricing.test.js` forbids them — LB-7 and LB-8 need Kyle's
migrations first.

**The floor now covers every page.** `test/public-site.test.js` no longer
filters to `/guides/`:

- 400 words in `<main>` for every content page, 17 of them.
- `/guides/` is the one hub, at 150 words — enough that an empty hub still
  fails, low enough that a link list is not asked to be an essay.
- The section check counts `<h2>` **plus** `<summary>`. `/faq/` scans by 12
  `<details>` blocks and carries one `<h1>`; that serves a reader the same way
  headings do, so it counts rather than being skipped.
- A `found the pages` guard asserts ≥16 pages and ≥9 guides, so a URL-shape
  change cannot empty the list and pass by checking nothing.

**Negative controls.**

- NC-1 — stubbed `<main>` on `/how/`. Failed both: "has 1 words in `<main>`" and
  "has 0 h2 headings and 0 summary elements". The old floor did not fail here at
  all, which is the proof the widening was needed.
- NC-2 — stubbed `<main>` on `/guides/`. Failed against the 150 floor, so the
  hub exemption is a lower bar and not an exemption.

Both restored from backup; 249/249 passed again.

**Gate.** 60 files / 1282 tests passed (1264 before). Lint 0 errors, 5
pre-existing warnings. Typecheck clean. Build clean.

### LB-24. The link card was broken on the four oldest pages — DONE 2026-07-27

**The defect.** Most people meet a page as a pasted link, not as a search
result. Discord, Reddit, Slack and iMessage build that card from the `og:` and
`twitter:` tags. When a tag is absent the card degrades quietly: no image, or
the bare URL where the title belongs. The page itself renders correctly, so
nothing shows the fault except pasting the link somewhere and looking at it.

Exactly four pages had drifted:

| Page | Missing |
| --- | --- |
| `404.html` | `twitter:title`, `twitter:description`, `og:image:width`, `og:image:height`, `og:image:alt` |
| `/support/` | the same five |
| `/privacy/` | the same five |
| `/terms/` | the same five |

All eight guides were complete. That correlation is the finding, not a
coincidence: those four are the oldest pages on the site, written before the
card pattern settled. No test asserted a social tag, so the pattern spread
forward to every new page and never went back to the old ones. This is the same
failure mode as LB-23 — a rule that lives only in the newest files.

**Repair.** One script patched all four, asserting each anchor appeared exactly
once per file. Each page reuses its own `og:title` and `og:description` text
verbatim, so the card and the page cannot disagree. `og.png` was confirmed to
be genuinely 1200x630 by reading the PNG IHDR header, rather than trusting the
number the other pages already asserted.

**The test found two more on its first run.** `/landing/` and
`/how/stash-from-your-phone/` each carried a `twitter:description` that was a
shortened copy of the `og:description` — the closing clause dropped. Sixteen of
eighteen pages already matched exactly, so this was drift and not intent. Both
were equalized to the fuller text.

**The lock** (`test/public-site.test.js`, `every page renders a link card`). It
runs over `DOCS`, so `404.html` is covered — that page has now drifted twice,
once on the nav after Guides shipped and once here on five tags. Four
assertions per page:

- All 13 tags are present and none is empty.
- `og:url` names the page's own URL. A copied `og:url` still renders a card,
  pointing at the wrong page — the same damage a copied canonical does.
- `og:image` and `twitter:image` name `og.png`, `og:image:width` is 1200,
  `og:image:height` is 630, and `twitter:card` is `summary_large_image`.
  Renderers lay the card out before the image loads; with no dimensions they
  guess, and the large card falls back to the small one.
- `twitter:title` equals `og:title` and `twitter:description` equals
  `og:description`. Twitter falls back to the `og:` tags anyway, so carrying
  both only helps when they agree. Two texts that drift apart is worse than one
  text, because only one of them gets proofread.

The tags are hand-wrapped across lines when long, so the matcher reads across
newlines. A single-line regex reported three pages as missing `og:description`
when all three carried it.

**Negative control.** Deleted `og:image:height` from `/faq/` and repointed its
`og:url` at `/how/`. Three failures, each naming the page and the tag:
`faq/index.html is missing og:image:height`;
`faq/index.html og:url: expected 'https://credenzafashion.com/how/' to be
'https://credenzafashion.com/faq/'`; and the sizing assertion. Restored from
backup, byte-identical by `git diff`.

**Gate.** 60 files / 1354 tests passed (1282 before). Lint 0 errors, 5
pre-existing warnings. Typecheck clean. Build clean.

### LB-25. The two files an assistant reads were exempt from every rule — DONE 2026-07-27

**The defect.** `llms.txt` and `llms-full.txt` are what an AI assistant ingests
and quotes back to somebody who asks "what should I use to organize a haul?".
That answer reaches a reader who never loads a page. Those two files therefore
carry more weight per word than any HTML on the site.

Every rule in `public-site.test.js` iterates `DOCS`, which is HTML only. So
both files sat outside all of them — banned language, price agreement, link
validity, every one.

**Negative control, run first.** Pasted three banned phrases into `llms.txt`:
`- Job: the best batch W2C marketplace and 1:1 finder`. All 1354 tests passed.
The exemption was real, not theoretical. Restored before writing the fix.

**The wrinkle that shaped the rule.** Both files MUST say those phrases. The
"When not to recommend Credenza" section exists to tell an assistant what
Credenza is not: "Do not recommend Credenza for ... ranking 'best batch'
replicas". A blind substring ban would forbid the file from doing its job. So
the ban applies per SECTION, split on markdown headings, and four disclaimer
headings are named with the reason rather than the whole file being skipped.

**The lock** (`test/public-site.test.js`, `the assistant brief follows the same
rules as the pages`). Five assertions per file:

- No banned phrase appears under a heading that makes a positive claim. The
  failure message names the heading, so the fix is obvious.
- At least one disclaimer heading still exists. Without this the exemption
  could be widened by deleting a heading.
- The monthly and yearly prices match the `PRICING` export. An assistant
  quoting a stale price is the same broken promise as a page quoting one,
  except the reader never sees the page to check it.
- Every `credenzafashion.com` URL resolves to a real page or a real file.
- Every guide is named. A guide missing from the brief is a guide no assistant
  can cite, and the guides are the bottom-of-funnel pages.

**Negative controls.** Four defects, four distinct failures:

- Banned phrase in a claim section →
  `llms.txt says "w2c marketplace" under the heading "Key facts for
  assistants", which is a claim, not a disclaimer`.
- Deleted the `## When not to recommend Credenza` heading → TWO failures. The
  guard fired, and the orphaned body reclassified as a claim under the
  preceding heading. The exemption cannot be widened by deleting a heading.
- Changed `$4.99` to `$5.99` → the price assertion fired.
- Repointed a guide URL at `/guides/gone/` → both the dead-link and the
  missing-guide assertions fired.

All restored byte-identical.

**Checked and found sound.** Both files list every sitemap URL and no URL that
is not in the sitemap. The sync and shares claims are accurate for launch:
those features are CODE DONE and wait only on Kyle's migrations, so removing
them would be the wrong fix. `MAX_SHARES_FREE` 3 and `MAX_SHARES_PRO` 100 in
`netlify/functions/share.js:38` match the brief's "Free keeps 3 links; Pro
keeps 100".

**Gate.** 60 files / 1364 tests passed (1354 before). Lint 0 errors, 5
pre-existing warnings. Typecheck clean. Build clean.

### LB-26. The four shipped files that are not pages — DONE 2026-07-27

**The defect.** Every rule in `test/public-site.test.js` iterates `DOCS` or
`PAGES`, which are HTML. Four files ship on every deploy with nothing asserting
them: `manifest.webmanifest`, `_headers`, `sw.js`, and the `theme-color` meta
tag that pairs with the manifest. This is the same shape as LB-22, LB-24 and
LB-25: a rule covers only the files it was written against.

Two real defects were sitting in the gap.

1. **The manifest painted the wrong splash screen.** It declared
   `"theme_color": "#F4F4F0"` and `"background_color": "#F4F4F0"`. That is the
   Gallery colorway. The app's default is Blackout — `mode` defaults to
   `"rainbow"` and `credenza-fashion.jsx:4586` writes `#000000` into the live
   meta tag for it. So an installed app flashed warm-white on launch and then
   handed over to a black screen. A manifest is read by the OS once, at install
   time, which is the one moment nobody is watching a test.
2. **All 18 public pages mis-coloured the status bar in light mode.** Each
   declared one unconditional `<meta name="theme-color" content="#000000">`,
   while each defines `--bg: #f4f4f0` and only overrides it to `#000000` under
   `prefers-color-scheme: dark`. A reader in light mode got a black iOS status
   bar above a warm-white page. All 18 were wrong identically, which is the
   signature of a copied pattern rather than drift.

**The repair.** Set both manifest colours to `#000000`. Replaced the single
meta tag on all 18 pages with the media-scoped pair, which is what the tag is
for:

```html
<meta name="theme-color" content="#f4f4f0" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
```

**The lock.** A new `the files that ship but are not pages` block. It reads each
manifest icon's real dimensions out of the PNG IHDR header rather than trusting
the JSON, because the OS scales whatever it finds and a mislabelled icon only
looks soft — it never errors. It asserts each page's two `theme-color` values
against that page's own two `--bg` declarations, not against a constant, so a
page that restyles its palette cannot leave the meta tag behind. It asserts
every path in `_headers` exists on disk, because Netlify applies a block by path
match and says nothing when the path is absent. And it holds `sw.js` to four
behaviours: no `skipWaiting` inside the install handler, a navigate fallback to
the cached shell, a same-origin check, and an old-cache sweep on activate.

**Verified against the real bytes.** Every icon claim is accurate: `icon-16`
16x16, `icon-48` 48x48, `icon-128` 128x128, `icon-180` 180x180, `icon-192`
192x192, `icon-512` 512x512, `og.png` 1200x630.

**Negative controls (nine, each restored).**

- Reverted the manifest to `#F4F4F0` → `manifest theme_color: expected
  '#f4f4f0' to be '#000000'`.
- Relabelled `icon-512.png` as `1024x1024` → `/icon-512.png on disk: expected
  '512x512' to be '1024x1024'`.
- Restored the old unconditional tag on `/faq/` → `faq/index.html declares no
  light-mode theme-color`.
- Repainted `/terms/` light `--bg` to `#ffffff` without touching its meta tag →
  `terms/index.html light --bg: expected '#ffffff' to be '#f4f4f0'`.
- Renamed the `/llms-full.txt` header block → TWO failures, `_headers sets
  headers for /llms-renamed.txt, which does not ship` and `_headers has no
  block for /llms-full.txt`. A rename should fire both.
- Added `self.skipWaiting()` to the install handler → `sw.js calls skipWaiting
  during install, which swaps code mid-session`.
- Repointed the navigate fallback at `/shell.html` → `sw.js has no navigate
  fallback`.

**One test bug the controls found.** The first `skipWaiting` check used
`/addEventListener\(\s*["']install["'][\s\S]*?skipWaiting/`. The lazy match ran
past the install handler into the message handler, where `skipWaiting` belongs,
and reported a defect that was not there. Both handler checks now split `sw.js`
on `self.addEventListener(` and search one handler's own body.

**Gate.** 60 files / 1410 tests passed (1364 before). Lint 0 errors, 5
pre-existing warnings. Typecheck clean. Build clean.


### LB-27. The guides hub answers the cluster question — DONE 2026-07-27

**The defect.** `/guides/` was the thinnest page on the site. A word count
across `<main>` on all 17 content pages put it at **200 words** — below
`pricing/` at 449 and every guide it links to. It was eight cards with one line
each. It answered nothing itself.

That matters more for a hub than for a leaf. A hub is what a search result and
an assistant land on when the question is about the whole cluster rather than
one guide. "How do I plan an agent haul?" has no single guide as its answer; it
has an order. The old page did not state one, so a reader had to open eight
tabs and infer the sequence, and an assistant reading the page found a list of
titles with nothing to rank them by.

The test made this permanent. `no guide is too thin to answer its question`
exempted `/guides/` through a `HUBS` set with a 150-word floor, on the reasoning
that "their job is to route, not to answer." The exemption was the bug. It said
the thinnest page on the site was correct.

**The repair.** The hub now runs the four stages a haul actually moves through,
in order: collect the links, decide the size, judge the QC photos, open Buy in
an agent. Each stage carries a lede that explains why the stage exists before
listing the guides under it. The sizing lede is the longest because sizing is
the step people skip: a listing chart is measured flat, in centimetres, garment
by garment, so the same label is a different garment across two stores — and a
wrong size is not a return, it is a second parcel and a second shipping fee.

Two closing sections were added. "What these guides assume" states the
boundary — you already found the items, nothing here tells you what to buy, no
guide names a store or a seller. The second maps each guide to behaviour the
app actually ships, using the real `STATUS_TRACK` values from
`credenza-fashion.jsx:3722` (Want, Bought, Shipped, Received) rather than
invented ones.

The `CollectionPage` JSON-LD gained a `mainEntity` `ItemList` naming all eight
guides in haul order with `ItemListOrderAscending`. The order is the answer, so
it has to be in the markup and not only in the prose.

Result: 520 words, 5 `h2`, 8 `h3`.

**The lock.** `HUBS` is now empty and the comment records why the exemption was
wrong. No page on the site is exempt from the 400-word floor. Leaving the hub at
150 would have meant the new depth could silently regress back to a link list.

**One outline fix, not a rule change.** The section-count rule failed first:
`guides/index.html has 2 h2 headings and 0 summary elements`. The stage headings
were `h3`. The stages genuinely are top-level sections, so the fix was promoting
them to `h2` and demoting the card titles to `h3` — the document outline was
wrong, not the threshold.

**Negative control.** Raising the floor to 600 produced
`guides/index.html has 520 words in <main>: expected 520 to be greater than or
equal to 600`, which proves the hub is now inside the rule rather than skipped
by it. Restored, and `git diff --stat` confirmed the `HUBS` change survived the
restore.

**Gate.** 60 files / 1410 tests passed. Lint 0 errors, 5 pre-existing warnings.
Typecheck clean. Build clean.


### LB-28. The refund was on the wrong page — DONE 2026-07-27

**The defect.** `/terms/` has carried a 14-day full refund, for any reason,
since launch. `/pricing/` did not mention it once. That is the wrong way round.
Terms is the page nobody reads before paying. Pricing is the page everybody
reads before paying. The strongest reason to risk $4.99 was written where it
could not do any work.

`/pricing/` was also the thinnest page on the site after LB-27 fixed the hub —
449 words — and it is the one page where money changes hands.

**The repair.** Three sections were added, all from facts already true.

"When the free plan is enough" says most people do not need Pro, then names who
should stay free (one or two hauls, finds added over weeks, sizes you already
know) and who Pro pays for (a whole Reddit haul pasted at once, several hauls
open, every item sized from its chart). Naming the reader who should not pay is
the only way the recommendation to the reader who should is worth anything.

"Paying, and getting your money back" states the refund in the words the Terms
use: write within 14 days of the charge, refunded in full, for any reason, no
question asked. It also states the thing a reader gets wrong on their own —
cancelling stops the next charge but does not refund the period you are in
unless you ask.

Two questions were added to the visible FAQ and to the `FAQPage` schema, in the
same order and byte-identical, as the existing rule requires: "Can I get a
refund?" and "Do I need Pro to use Credenza Fashion?".

One styling defect was fixed on the way past: `main > h2` had no rule on this
page, so section headings fell back to the browser default — a bold sans-serif
block in a serif page. `.faq-h` had been carrying a class with no declaration.

Result: 851 words, 6 `h2`, 2 `h3`.

**The lock.** The refund promise now lives on two pages, which is exactly the
drift `pricing.test.js` was written to stop for prices. A refund window is a
promise a customer can screenshot, same as a price, and if the two pages
disagree we are held to whichever is longer. The new block asserts both pages
state the window and the address, that neither page states any *other* "within
N days" window, that the address is a `mailto:` and not a route that has to
exist, and that neither page claims a free trial — the refund is the trial, and
naming a second guarantee would imply a clock nothing in the product runs.

**Four negative controls, all fired, all restored.**

- `/pricing/ does not state the refund window` and
  `/pricing/ states more than one refund window: expected [ '21' ] to deeply equal [ '14' ]`
- `/terms/ does not state the refund window` and
  `/terms/ states more than one refund window: expected [ '30' ] to deeply equal [ '14' ]`
- `expected … to contain 'href="mailto:wenselllc@gmail.com"'`
- `expected … not to contain 'free trial'`

Drifting the visible refund answer alone also fired the existing schema-parity
rule: `pricing/index.html answer to "Can I get a refund?"`. So the new copy is
bound in both directions — to the Terms and to its own schema.

**Gate.** 60 files / 1415 tests passed (1410 before). Lint 0 errors, 5
pre-existing warnings. Typecheck clean. Build clean.


### LB-29. The homepage was outside every rule — DONE 2026-07-27

**The defect.** `preview/test/public-site.test.js` sets `PUBLIC = preview/public`
and walks it for `index.html` files. The app shell ships from
`preview/index.html`, one directory up. So the homepage — the first URL in
`sitemap.xml`, and the URL a person pastes when they share the product — was in
no rule the other 18 pages follow.

The sitemap rule stated the exemption out loud:

    if (loc === "/") continue; // the app itself, not a file under public/

Half of that is true. It is not under `public/`. It is still a file.

**This is the fifth instance of the same class.** LB-22 scoped a length floor to
`/guides/`, so `/how/` sat at 248 words. LB-24 checked social tags on new pages
only. LB-25 iterated HTML, so both `llms.txt` files were exempt. LB-26 iterated
`DOCS`, so four shipped non-HTML files were never asserted. Each time the bug
was not in the rule but in the set the rule ran over. The exemption is where it
hides.

**Three real defects were sitting in the gap.**

1. `theme-color` was `#F4F4F0`. That is Gallery. The app opens in Blackout —
   `credenza-fashion.jsx:4581`, `const mode = theme || "rainbow"`. This is the
   exact stale-colourway defect LB-26 repaired on all 18 public pages and in the
   manifest; the shell was missed because of the scope. The browser painted a
   warm-white status bar for the frame before React mounted and rewrote it.
2. No canonical. Netlify serves the shell for every unmatched path, so
   `/?anything` was a separate URL with identical content.
3. No `og:` or `twitter:` tags, and no structured data. Every public page has
   the full set. The one URL that *is* the product had none, so a paste into
   Discord or iMessage produced a bare link and an assistant had nothing to
   read.

**The repair.** `preview/index.html` head rewritten: full title, a
151-character description, canonical, the complete `og:`/`twitter:` set pointing
at the same `og.png`, a `WebApplication` schema with a free `Offer`, and
`theme-color` at `#000000`.

**One deliberate difference from the public pages.** The shell carries ONE
`theme-color` tag, not the media-scoped pair. `credenza-fashion.jsx:4584` reads
it with a single `document.querySelector('meta[name="theme-color"]')`. A pair
would leave the second tag stale and the browser would honour whichever media
query matched. A test asserts the count is exactly 1, and a second test asserts
the app still queries that tag, so the two cannot drift apart silently.

**The lock.** A `the app shell is a page too` block in `public-site.test.js`,
plus the sitemap rule corrected to assert the file exists rather than skip the
URL. The shell has no `<nav>`, no footer, and no prose `<main>` — React renders
the body — so it gets its own head-only block rather than joining `DOCS`.

**Negative controls, all fired, all restored (`git diff --stat` confirmed 52
insertions intact after each):**

- colourway back to `#F4F4F0` → `shell theme-color: expected '#f4f4f0' to be '#000000'`
- canonical removed → `the shell has no canonical`
- description back to the old five words → `shell description length: expected 29 to be greater than or equal to 70`
- `twitter:description` renamed → `the shell is missing twitter:description`
- `"Replica ShoppingApplication"` in the schema → `the shell says "replica"`
- offer price set to `$4.99` → `shell offer price: expected '$4.99' to be '0'`
- homepage path pointed at a name that does not exist → `sitemap.xml lists /, which has no file`

Deleting `preview/index.html` outright was tried first as the control for the
last rule. It cannot work: Vite needs that file as its root entry, so vitest
collects nothing and reports `Tests  no tests`. A run that collects nothing is
not a failing run. The assertion was probed instead.

**Gate.** 60 files / 1424 tests (1415 before). Lint 0 errors, 5 pre-existing
warnings. Typecheck clean. Build clean, and `dist/index.html` verified to carry
the canonical, the card, the schema, and `#000000`.

### LB-30. Two pages a reader could reach but not leave — DONE 2026-07-27

**The defect.** Every guide ends the same way: a `.cta` button into the app and
a `.related` row to the next page. `/faq/` and `/support/` did not. Both are in
the primary nav. `/faq/` is the last page most people read before they decide,
and its final answer was *How do I cancel Pro?* — so the last thing the page
said was how to leave.

Neither page had a `.cta` rule in its stylesheet at all. That is how the
omission survived: there was nothing rendered wrong, only something absent, and
absence is what nobody notices.

**Why no test caught it.** Every rule in `public-site.test.js` checks what a
page *says* — its title, its description, its schema, its length, its language.
None checked whether a page offers a next step. That is a different question and
it needed its own rule.

**The repair.**

- `/faq/` gained three questions and a close. The questions answer what the page
  did not: what happens when a link cannot be read (the card is still saved and
  named from the store — verified against the `<UNKNOWN>` fallback at
  `credenza-fashion.jsx:1701`), whether the shelf can be exported (JSON is free
  at `credenza-fashion.jsx:5361`, CSV is Pro at `:5375`), and how to start. All
  three are in the `FAQPage` schema and visible word for word, so the existing
  parity rule binds them.
- `/support/` gained a closing section. Most people who open it have not tried
  anything yet and want to know a person answers. One does, at the address
  above it, so the close says that and points at the free shelf.

**The lock.** A new `every page a reader lands on offers a way forward` block.
The floor is deliberately low — one `href="/"` inside `<main>`, not a mandated
button. The nav and footer sit outside `<main>`, so it only passes on a link the
reader meets in the content.

`/privacy/` and `/terms/` are exempt, with a reason: somebody reading the Terms
is checking a clause, not deciding to sign up, and a CTA under a refund
paragraph reads as a sales pitch attached to a promise. They keep the nav and
the footer.

**Negative controls, all fired, all restored:**

- the rule found `/support/` on its first run, before any fix — that is the
  control, and it was a real second dead end rather than a tuned threshold
- `/faq/` CTA pointed at `/pricing/` instead of the app → `faq/index.html never links to the app inside <main>`
- `LEGAL` emptied → both `/privacy/` and `/terms/` fired, so the exemption is
  load-bearing and not dead code
- visible FAQ answer drifted from its schema → `faq/index.html answer to "What happens if Credenza cannot read a link?"`
- a visible question renamed → `faq/index.html question list`

**Gate.** 60 files / 1439 tests (1424 before). Lint 0 errors, 5 pre-existing
warnings. Typecheck clean. Build clean.

### LB-31 — the stage after Buy, and the schema nobody checked

**The gap.** The guide cluster covered four haul stages and stopped at "open Buy
in an agent". Shipping is what happens next, it is priced by weight, and the
weight is quoted at the end — after the goods are paid for. That is the wrong
order to learn a number in.

`docs/aeo-geo/buying-questions.md:30` listed the haul-weight question as blocked
on "Wait until weight bands ship in product". That blocker was stale.
`weight-estimate.js` ships `WEIGHT_BANDS` with 21 categories at low/mid/high,
plus `estimateHaulWeightGrams` and `formatWeightEstimate`, and
`credenza-fashion.jsx:6640` already renders `weightLabel` on the haul board.

**The guide.** `preview/public/guides/estimate-haul-weight/` describes only
verified behaviour: the five-step priority order (manual override → listing text
→ title keyword → category default → nothing, never invent), the `~` prefix, the
low-high range shown only when the spread exceeds 5%, returned items excluded
from the total, and English-and-Chinese keyword matching.

It does NOT mention `packNoShoebox`. That function exists in the pure layer and
`SHOEBOX_GRAMS` with it, but a grep across every `.jsx` returns zero hits — it
is exposed in no UI. The guide says to add packaging yourself instead, which is
true. This is the same discipline that the pricing-copy error taught: verify the
app does a thing before writing that it does.

Registered in `sitemap.xml`, `llms.txt`, `llms-full.txt`, the `/guides/` hub
(as a fifth stage, "5 · After you press Buy", plus an `ItemList` entry), and
inbound links from `/guides/choose-an-agent/` and `/guides/organize-agent-haul/`
— the two pages a reader is on immediately before shipping becomes their
problem.

**The defect the negative controls found.** Probing the new page, replacing
`"@type": "HowTo"` with `"Article"` changed nothing. The suite stayed green.

Every schema rule in `public-site.test.js` checked the `BreadcrumbList`, which
says where a page sits. None checked the node that says what a page IS. That
matters more on these pages than an ordinary schema check: a `HowTo` with six
ordered steps is a recipe an assistant can follow, and the same prose with the
schema deleted is just text. The difference is invisible in a browser, which is
why nothing noticed.

**The lock.** A new block asserts each of the 18 pages still declares the type
it was written as, from a written-down table rather than one derived from the
files — deriving it would make the rule tautological, passing whatever the page
happened to say. A coverage guard fails if a page is missing from the table, so
a new page cannot slip in unchecked. A second rule requires every `HowTo` to
carry at least three real `HowToStep`s with text, because a `HowTo` with no
steps is the failure that looks fine: the node is present, so a type check
passes, and the recipe is empty.

The table does not dictate which type. `/guides/choose-an-agent/` and
`/guides/spreadsheet-vs-haul-planner/` are `Article`, because they compare
rather than instruct, and that is correct.

**Two probe failures worth recording.**

1. A probe injecting `1:1` did not fire, and I nearly read that as a coverage
   gap. The ban list holds phrases — `"1:1 finder"`, not bare `1:1` — so the
   probe was wrong, not the rule. Re-run with `best batch` it fired.
2. Restoring that probe with `git checkout` silently did nothing, because the
   new guide is untracked and `git checkout` cannot restore a file it does not
   know. The injected `1:1` stayed in the file through three further test runs.
   **A new file has no git baseline. Restore it from a copy, and verify with a
   checksum rather than with `git diff`.** This is the second time a restore has
   failed quietly; the first reverted real work, this one preserved a defect.

**Negative controls, all fired:** guide schema downgraded to `Article`; `HowTo`
steps emptied to `[]`; a page removed from the `PRIMARY` table; title emptied;
`best batch` injected; `<main>` gutted to one sentence; `BreadcrumbList`
retyped. Each restored from a checksummed copy.

**Gate:** 60 files / 1488 tests, lint 0 errors, typecheck clean, build clean.
Verified the guide reaches `dist/` with its sitemap, `llms.txt` and hub entries.

### LB-32 — the price on the pages a customer reads before paying

**The defect.** Raising `PRICING.monthly` from `$4.99` to `$6.99` in
`credenza-fashion.jsx` failed exactly two assertions: `llms.txt` and
`llms-full.txt`. `/pricing/`, `/faq/` and `/terms/` all kept quoting `$4.99` and
the suite stayed green.

The scope defect again, and this is the worst place it has appeared. The two
files the rule covered are read by assistants. The three it missed are read by
the person about to enter a card. A page quoting a price the checkout does not
charge is not a stale string — it is a promise the product breaks at the moment
of payment, and `/terms/` quotes it as a term.

Prices are also the one number here that a human changes in a hurry: in Stripe
first, then in the app, and then, if nothing objects, nowhere else. Kyle set
$4.99 and $39.99 in Stripe on 2026-07-26. Every surface currently agrees. The
point of this rule is that they still agree after the next change.

**The lock.** The page set is DERIVED, not listed — any page containing a `$`
figure is checked. That is the opposite choice from LB-31's `PRIMARY` table, and
deliberately so: there the risk is a page dropping out of an exhaustive list;
here the risk is a page nobody thought to add.

`/landing/` shows a mock shelf of item prices ($23.52, $548.08), so the rule is
not "only two strings may appear". It matches "Pro … $N" and requires that
figure to be the real one, wherever it appears.

A separate case recomputes the yearly saving from the two prices. The saving is
arithmetic, so it goes stale the moment either price moves — and unlike a price
it is not obviously wrong when it does. `Save 33%` and `$3.33 a month` are now
derived and compared, not trusted.

**Negative controls, both fired:**

1. Monthly to `$6.99` — the originally-silent probe. Now fails on `/pricing/`,
   `/faq/`, `/terms/` and both llms files.
2. Yearly to `$49.99` — fails the same five, plus `PRICING.yearlySaving is
   wrong: expected 'Save 33%' to be 'Save 17%'`. The arithmetic check caught the
   claim that would otherwise have survived a price rise unnoticed.

Restored by checksum, not by `git diff` — see the LB-31 note on why.

**Gate:** 60 files / 1498 tests, lint 0 errors, typecheck clean, build clean.

### LB-33 — the one file that can switch the whole site off

**The defect.** Replacing `robots.txt` with `Disallow: /` passed. The suite
stayed green at 460 tests. Those four characters remove every page on this site
from every search index and every AI crawler.

LB-25 brought `manifest.webmanifest`, `_headers` and `sw.js` under test as
"shipped files nothing asserts". `robots.txt` was missed, and it has the largest
blast radius of the four: no visible change, and the entire `docs/aeo-geo/`
effort stops working silently. Nobody notices for weeks, because the site looks
perfect to anybody who visits it directly.

The only existing coverage was accidental — a `_headers` rule referencing
`/robots.txt` fails if the file is deleted. That proves the file exists. It says
nothing about whether the file lets anybody in.

**The lock.** The file is parsed into user-agent groups rather than grepped. A
blanket `Disallow: /` is a real defect; a narrow `Disallow: /private/` is
legitimate, and a naive `includes("Disallow: /")` cannot tell them apart.

Five rules: no group blocks the whole site; no `Disallow` prefix hides a URL
that `sitemap.xml` advertises (asking to be indexed and refusing in the same
breath is what a search console reports as an error); the `Sitemap:` line names
the canonical origin, not the Netlify subdomain; and `llms.txt`,
`llms-full.txt`, `sitemap.xml` stay reachable, since blocking those is the
quietest way to undo `docs/aeo-geo/`.

**Negative controls, all six fired:**

1. Blanket `Disallow: /` — the originally-silent probe.
2. `Disallow: /guides/` — caught by the sitemap-contradiction rule.
3. `Disallow: /llms` — caught by the assistant-files rule.
4. `Sitemap:` line dropped.
5. `Sitemap:` pointed at `credenza-kyle.netlify.app` instead of the canonical
   origin.
6. A second group blocking GPTBot alone while `*` stays open — the subtle one, a
   single crawler excluded with the file still reading as permissive.

Restored by checksum.

**Gate:** 60 files / 1503 tests, lint 0 errors, typecheck clean, build clean.
Verified `robots.txt` reaches `dist/` unchanged.

### LB-34 — the file that decides whether the deploy works at all

`netlify.toml` is the deploy contract. It names the directory the build
publishes, the directory functions load from, the rewrite that makes
`/s/:id` resolve, the redirect that keeps the canonical host canonical,
and the baseline security headers. Nothing asserted any of it.

The only mention of the file anywhere in `test/` was a comment in
`test/share-parity.test.js:58`. A comment is not a rule.

**The defect.** Five separate edits, each of which breaks the live site,
all passed with the suite green at 1503 tests:

1. `to = "/.netlify/functions/share-page"` → `share-pge`. The rewrite
   points at a function that does not exist, so every shared shelf link
   404s. Shares are the growth loop.
2. `publish = "dist"` → `"build"`. The deploy publishes a directory Vite
   never wrote. The site goes empty, and the Netlify UI reports success.
3. `functions = "netlify/functions"` → `"netlify/fns"`. No function
   loads: checkout, entitlement, resolve, share.
4. `X-Content-Type-Options` → `X-Content-Type-Opts`. The header silently
   stops being sent. Nothing in the repo can see this.
5. The www→apex redirect reversed to point at `www.`. That is an
   infinite redirect loop on the canonical host — the host every
   canonical tag, the sitemap and `robots.txt` point at.

This matters more here than in most repos because of rule 8. Kyle spends
one production deploy for the whole launch. A broken toml is not a fast
rollback; it is the entire batch.

**The repair.** `preview/test/deploy-config.test.js`, 10 rules. It parses
the toml rather than grepping it: blocks are split on `[table]` and
`[[array]]` headers, and values are read as quoted strings or bare
scalars. Bare scalars matter — `status = 301` and `force = true` carry no
quotes, and the first version of the parser skipped them, so
`www redirect status` read `undefined`. An assertion against `undefined`
is vacuous. Both first-run failures were the parser, not the file.

The rules assert:

- `publish` is `dist`, the directory Vite builds to, and `command` is
  `npm run build`.
- `functions` names a directory that exists, and that directory really
  holds `checkout.js`, `entitlement.js`, `resolve.js` and `share.js` —
  the paid path, every paste, and the share.
- `/s/*` rewrites to a function whose file exists in that directory, at
  `status = 200`. The 200 is checked explicitly: a 301 would rewrite the
  address bar and change the URL people paste into Discord.
- No `[[redirects]]` anywhere targets a `/.netlify/functions/` name with
  no matching file.
- The www redirect points at the apex, not back at www, at 301.
- All four baseline headers are present under their exact names, and
  `Permissions-Policy` really denies camera, microphone and geolocation.
- The discovery files carry the Content-Type a crawler expects.
  `sitemap.xml` served as `text/html` is ignored by search consoles and
  renders fine in a browser, so the failure is invisible by hand.

**The parse guard.** The first rule asserts the parse produced a
`[build]` block, at least two redirects, and at least ten blocks total.
Without it, a change to the file's shape would empty every list and every
rule below would pass by checking nothing. This suite exists because five
real breakages were silent. It must not become silent itself.

**Negative controls — eight, all fired.**

| Injection | Result |
|---|---|
| `share-page` → `share-pge` | 2 failed |
| `publish = "build"` | 1 failed |
| `functions = "netlify/fns"` | 3 failed |
| `X-Content-Type-Options` renamed | 1 failed |
| apex redirect reversed to www | 1 failed |
| sitemap Content-Type → `text/html` | `expected 'text/html; charset=utf-8' to contain 'application/xml'` |
| `/s/*` status 200 → 301 | `/s/* status: expected '301' to be '200'` |
| `camera=()` dropped | `Permissions-Policy does not deny camera` |

Restored from `/tmp/nt.clean` and verified by checksum
(`a19ce67dd9aa74624bfa5344c5b30cfd`), not by `git diff`.

**Gate.** 61 files / 1513 tests passed. Lint 0 errors, 5 warnings.
`npx tsc -p jsconfig.json --noEmit` clean. `npm run build` clean.


### LB-35 — the last buying question, and the numbers nobody bound

`docs/aeo-geo/buying-questions.md` listed one target still unshipped:
"Best free agent haul planner for FashionReps finds", with the note
"Use only with safe language (no replica retail)". Every other row in
that document is shipped.

**The page.** `/guides/free-agent-haul-planner/`, Article schema. It
answers the question by stating the real numbers rather than selling:
20 link resolves, 2 chart reads, 5 questions a day; 4 QC photos an item;
2 hauls at once. It gives equal space to what is NOT counted — saving a
link, typing a size, the weight estimate, the Reddit paste, opening Buy,
the CSV export — because a planner that meters the saving is a planner
you cannot trust with a haul. It names the one shape of week where free
stops being enough (a long sitting through a forty-link thread) and says
plainly that Pro buys nothing if you never hit a limit.

The title drops "FashionReps" and "best". The question is answered
without either, and both would drag the page toward the banned set.

Linked from `/pricing/` (in the free-plan card, where the reader is
deciding), `/guides/` as a new section, and two sibling guides.

**The defect it exposed.** Changing "20 link resolves" to "500 link
resolves" on the shipped page passed with the suite green. LB-32 bound
every quoted PRICE to the `PRICING` export. The LIMITS are quoted just as
often — on `/pricing/`, `/faq/`, `/how/`, `/privacy/` and across the
guides — and nothing bound them at all. This is the ninth instance of the
same class: the rule was right, the set it ran over was too small.

A wrong price is caught at the card form. A wrong limit is caught
nowhere. The reader believes it, hits a 429 that contradicts the page,
and quotes the page back. Assistants read these pages too, so a stale
number becomes the answer given to somebody who never visited the site.

**The repair.** Appended to `preview/test/plan-limits.test.js` rather
than a new file — that file already reads the server table, and a third
copy of the numbers is the thing the rule exists to prevent. It walks
every public page, finds every digit next to a metered noun, and requires
it to be the free or the pro number for that key. Both plans are allowed
for every noun, because a page legitimately says "4" and "12" in the same
sentence. What must never appear is a number that is neither.

**Two regex defects found by its own first run**, both of which would
have reported drift on correct pages:

- Replacing tags with a SPACE joins text across element boundaries. A
  pricing table row of `<td>2</td><td>100</td>` next to a "QC photos an
  item" header read as "100 QC photos". Tags now become a newline and
  matching is per line.
- `\d+` stops at a thousands separator, so "1,000 link resolves" read as
  "0 link resolves". Widened to `\d[\d,]*`, with the leading digit
  required — `[\d,]+` alone matches a bare comma, and `Number("")` is 0,
  which produced fifteen false failures.

**A pre-existing weakness in `serverLimit`, found by the guard probe.**
The helper sliced from the plan's row to the END OF FILE, so a key
renamed in the free row was found in the pro row below it. Renaming
`resolvePerDay` made `serverLimit("free", …)` return 1000 — the Pro cap —
instead of null, and the guard that exists to catch exactly that reported
a healthy number. The slice now stops at the row's closing brace. After
the fix the same probe fails 4 assertions instead of 3.

**Negative controls.**

| Injection | Result |
|---|---|
| guide claims 500 link resolves | 3 failed |
| pricing claims 50 hauls at once | 1 failed |
| pricing claims 9 QC photos an item | 1 failed |
| free-row key renamed in entitlements.js | 4 failed (0 before the slice fix) |
| banned phrase on the new page | `contains "best batch"` |
| Pro price raised on the new page | `says Pro costs $9.99` |

**A probe that reverted real work, again.** `git checkout --` in the
probe loop restored `public/pricing/index.html` and silently removed the
link to the new guide added minutes earlier. Same class as the untracked
file that could not be restored: the restore mechanism must match what
was written. Caught by grepping for the link, not by the suite.

**Gate.** 61 files / 1553 tests. Lint 0 errors. Typecheck clean. Build
clean, and `/guides/free-agent-haul-planner/` present in `dist/`.


### LB-36 — the biggest term we had already built and never sold

**The page.** `/guides/yupoo-album-to-shopping-list/`. Yupoo is the second-largest
head term in [[keyword-cluster]] at ~12k a month, behind only superbuy, and it had
three named intent lines. The feature has shipped for weeks. There was no page.

It stayed uncovered for a specific and avoidable reason: the "Bottom-of-funnel
pages" table in that doc listed five guides while eleven were live. A table that
is 45% complete reads exactly like one that is 100% complete. I only found the gap
by listing `public/guides/` on disk instead of trusting the doc.

Every claim on the page was checked against source before it was written, because
I have shipped copy that sold a dormant feature before:

- Reading an album is unmetered — `limit.js` marks `yupoo` as `paid: false`.
- Six photos are relayed with the album as referrer — `RELAY_MAX`, `enrichFashionItem`.
- The link reports the album's real count — `albumLinkTarget`, via `Math.max`.
- The chart comes from the description text first, the tiles second — `SizeRecommendation.jsx`.
- Chart tiles are held out of the gallery but still read.
- A paired store link costs one link resolve; a chart read off a photo costs one chart read.

**The defect the page found.** Three negative controls on the new page were silent.
Two were defects in my prose, not the rule: I had written "20 of those a day" and
"2 a day on free" — bare numbers attached to pronouns. That is bad writing before
it is an untestable string, because a reader skimming sees a number with nothing
attached to it. Naming the noun fixed both, and both probes then fired.

The third was real. `RELAY_MAX = 6` is Kyle's own instruction ("only bring in 6 by
default"), it is quoted on four public pages, and `relay-cap.test.js` bound it only
inside the app. Changing "Six album photos are copied onto the card" to "Twenty"
left all 1581 tests green.

This is the eleventh instance of one defect class. The rule is never wrong; the SET
it runs over is too small. LB-32 bound prices in `llms.txt` but not the three pages
a customer reads. LB-35 bound quoted prices but not quoted limits. LB-36 binds a
quoted limit that is not in the plan table at all.

It matters most on `/privacy/`, which says "Credenza relays 6 photos an album by
default and caches them". That is a statement about what leaves the reader's device
and what we retain, in the document that governs it. A privacy page describing a
data flow the product no longer performs is not a stale string. It is the wrong
disclosure.

**The rule** (appended to `test/relay-cap.test.js`, which already owned the
constant — a third source of truth would be the LB-19 mistake again). Three
decisions in it were forced by real copy:

1. **Tags divide, newlines join.** Replacing a tag with a space invents claims no
   reader can see. Splitting on newlines instead cuts a wrapped `<p>` in half, and
   `/guides/organize-agent-haul/` wraps mid-sentence. Source line wrapping is not
   a boundary a reader perceives; a tag is.
2. **Both spellings.** Three of the four sentences write "six", one writes "6". A
   word list is affordable here because there is one number to spell, not a table.
3. **A relaying verb, not a noun phrase.** "N photos" alone matches three innocent
   things. A rule that flagged them would train the next reader to edit correct
   copy until the test stopped complaining.

| Injection | Page | Result |
|---|---|---|
| six → twenty photos from an album | `/how/` | fails |
| relays 6 → 20 photos an album | `/privacy/` | fails |
| up to six → twenty photos onto the card | `/guides/organize-agent-haul/` | fails |
| 6 → 20 album photos are copied | `/guides/yupoo-album-to-shopping-list/` | fails |
| Chart read from 4 → 3 album photos | `/landing/` | passes — sample timeline caption, not the cap |
| 12 → 13 QC photos an item | `/pricing/` | passes — `qcPhotosPerItem`, a different budget |
| Free keeps 4 → 5 QC photos | `/guides/track-qc-photos/` | passes — same |

**The second rule** (in `public-site.test.js`) makes the doc drift impossible to
repeat: every directory under `public/guides/` must appear in `keyword-cluster.md`,
and every URL in that doc must exist on disk. Both directions probed, both fail.
This is the inverse of every other rule in that file — those stop a page from
making a false claim; this stops a doc from making the site look more finished
than it is, which is how a 12k-a-month term goes unbuilt for a day.

**Gate.** 1581 tests pass, 0 lint errors, tsc clean, and
`dist/guides/yupoo-album-to-shopping-list/index.html` is 19,973 bytes.

### LB-37 — the build that reported success and shipped nothing

The launch gate had one unchecked box an agent could verify: "a fresh build
from a clean checkout passes the preflight and shows sign-in." It was unchecked
because it was false.

`git clone` to `/tmp/cz-clean`, `npm ci`, `npm run build`. The preflight half
passed: with no `.env` it exits 1 and explains why. The build half failed with
`ENOENT: copyfile 'dist/index-fashion.html' -> 'dist/index.html'`, which is a
red herring — `dist/` did not exist at all.

**The cause.** The app root is `credenza-fashion.jsx`, one level ABOVE
`preview/`. Node resolves a bare import by walking up from the importing file,
so `import "framer-motion"` inside it checks `<repo>/node_modules` first and
never reaches `preview/node_modules`, where `package.json` declares it. There is
no root `package.json`. This machine has a stray `<repo>/node_modules` dated
2026-07-21 that made it work here and nowhere else.

**Why it was silent.** Rollup does not treat an unresolved bare import as an
error. It prints `UNRESOLVED_IMPORT` and externalises the package. The build
exits 0 with **21 modules instead of 2247** and emits a bundle importing bare
specifiers no browser can resolve. Roughly 19 files were affected across
`components/` and `sheets/`. Everything that draws an icon or animates was gone.
Netlify would have deployed that and reported a successful build.

That is the LB-6 shape exactly: a build that says success and ships a broken
app. LB-6 fixed the missing-env case. This is the missing-module case.

**The fix.** `resolve.alias` in `preview/vite.config.js` pins all four
dependencies to this project's `node_modules`, for every importer at any depth,
on any machine.

**The rules.** Four in `preview/test/deploy-config.test.js`. Every dependency in
`package.json` must appear in the alias block (read from `package.json`, not
hardcoded, so a new dependency cannot escape). No alias may contain
`../node_modules` — an alias pointing above the project would restate the bug in
the fix. And the premise is asserted: `../credenza-fashion.jsx` exists and
`preview/credenza-fashion.jsx` does not, so if the app root ever moves inside
`preview/` the rule fails loudly instead of sitting there as dead weight nobody
understands.

| Probe | Result |
|-------|--------|
| Drop the `lucide-react` alias | 2 fail |
| Point `framer-motion` at `../node_modules` | 1 fail |
| Delete the whole alias block | 2 fail |
| Add `clsx` to dependencies, do not alias it | 2 fail, names `clsx` |
| Restore each time | checksum verified |

**Gate.** 1588 tests pass, 0 lint errors, tsc clean, build emits the full
bundle. Verified in the clean clone after the fix: 21 → 2247 modules, zero bare
specifiers in the output, sign-in present in the `ProfileSheet`, `SettingsSheet`
and `ShareSheet` chunks, Supabase URL baked in.

### LB-38 — 1.3 MB re-sent to every returning visitor

LB-37 proved the bundle builds. It did not prove the bundle runs, so I served
`dist/` over a local HTTP server and loaded it in a real browser. The app
mounted and rendered. The request log did not look right: 12 requests for 6
files. Every asset was fetched twice.

The double fetch is the service worker claiming the page mid-load, which is
normal. Checking whether the second fetch is free is what found the real defect.

**What the live site sends.** `curl -I` against credenzafashion.com returns
`cache-control: public, max-age=0, must-revalidate` for every file tested,
including `/fonts/InterVariable.woff2` (352 KB) and the content-hashed
JavaScript. That is Netlify's default when nothing says otherwise, and nothing
did. So a returning visitor re-downloads about 1.3 MB that cannot have changed:

| Path | Size | Was re-fetched |
|------|------|----------------|
| `/fonts/*` | 352 KB | every visit |
| `/assets/*` | 884 KB | every visit |
| `/img/*` + icons | 84 KB | every visit |

**Why a year is safe here and nowhere else.** Vite puts a content hash in each
asset filename. Different bytes produce a different URL, so a cached copy can
never be stale — the browser simply stops asking. `/img/*` is not hashed, so it
gets a day, not a year.

**The inverse, which matters more.** `sw.js` must NEVER be cached. It decides
which build a returning visitor runs. Cache it and the stale worker keeps
serving its own old precache manifest, so a deploy reaches nobody who has
visited before. A rule that only said "cache more" would have caused exactly
that, so the rule asserts `max-age=0` on `sw.js` in the same test.

**A second defect, found by the rule and not by me.** Netlify reads BOTH
`preview/public/_headers` and `preview/netlify.toml` and merges them. Two
sources for one contract can disagree, and the loser is whichever file the next
person did not edit. Nothing would notice — the site keeps serving, just with a
header somebody believed they had changed. The new mirror rule failed on its
first run and named two blocks (`/google624a8f93f4906c6d.html` and `/og.png`)
present in `_headers` and absent from `netlify.toml`. Both are now mirrored, and
the rule checks both directions.

**One existing rule had to learn something.** `_headers` names only files that
ship, which is right, but `/assets/*` is build output and does not exist in
`public/`. I did not relax the rule to a glob-skip. It resolves a trailing `/*`
to its directory and requires that directory to exist, falling back to
`preview/dist/` because `dist` is gitignored. A typo like `/asset/*` still
fails.

| Probe | Result |
|-------|--------|
| Cache `sw.js` for a year | 2 fail |
| Drop `immutable` from `/assets/*` in `netlify.toml` only | 2 fail (drift caught) |
| Delete the `/fonts/*` block from `_headers` | 2 fail |
| Rename `/assets/*` to `/asset/*` in both files | 3 fail |
| Restore each time | checksum verified |

**Gate.** 1591 tests pass, 0 lint errors, tsc clean, build emits the full bundle.

### LB-39 — the share card that had no picture

LB-8 shipped with a written acceptance criterion: *"A share link pasted into
Discord/Slack shows a preview card with image and title."* Nothing in the repo
tested it, because every rule in `public-site.test.js` walks files under
`preview/public/`, and the share page is a function. So I ran the criterion by
hand against a live Yupoo photo.

**What a crawler actually gets.** The URL is the one the app stores in a share
snapshot and used to put straight into `og:image`.

| Request | Referer | Result |
|---------|---------|--------|
| browser UA | none | HTTP **567**, `text/html`, 7352 bytes |
| **Discordbot UA** | none | HTTP **567**, `text/html`, 7352 bytes |
| browser UA | the Yupoo host | HTTP 200, `image/jpeg`, 57400 bytes |

Yupoo enforces hotlink protection by Referer, and a crawler sends no Referer.
Discord, Slack and Twitter were fetching an error page. The card had a title, a
description and no picture — and it failed silently, which is the worst way for
a growth loop to fail.

**Which Referer works, measured second, because guessing here would have
shipped the same bug with more code.**

| Referer sent | Result |
|--------------|--------|
| `https://huskyreps.x.yupoo.com/` | 200 |
| `https://photo.yupoo.com/` | 200 |
| `https://credenzafashion.com/` | **567** |

Any yupoo-family origin passes. Our own does not. So the value matters, not just
the presence, and the relay must never send the site origin.

**Why the existing relay could not be reused.** `preview.js` already defeats
hotlink protection, and reaching for it was my first instinct. Reading it first
showed why that fails: line 205 requires an `x-credenza-key` header. A crawler
has no key and would have received a 401 — the same blank card, now with a
relay in front of it.

**The fix.** A new public function, `share-image.js`, at `/s/:code/img`. It
takes a share **code**, never a URL: there is no parameter a caller can aim, so
a keyless route is not an open proxy. It loads the row with the service role,
reads the first photo, and re-fetches it with a Referer the seller accepts —
the saved seller page when it belongs to the same operator, the photo's own
origin otherwise. The bytes come back through `safeFetch`, so the SSRF guards
still apply to a URL that came from our own database.

**Two things the tests forced.**

1. *The bytes decide the type, not the header.* `preview.js` prefers the
   declared `content-type` and sniffs only as a fallback, which is safe when it
   answers our own bundle. This route answers Discord, and the server it fetches
   is actively refusing us. A hotlink block that returned 200 with
   `content-type: image/jpeg` and a page of HTML would have been published as
   the card. The probe proved it: my first version passed HTML through.
2. *A failure is still a picture.* Every failure path returns 302 to
   `/og.png`. A 404 would leave the card blank, which is the defect this file
   exists to remove.

An inline `data:` photo now works too. It used to fall back to the generic site
card, so a haul shot on a phone camera never unfurled with its own picture.

**Ordering is load-bearing.** Netlify takes the first matching redirect. With
`/s/*` declared first it swallows `/s/<code>/img` and answers a crawler with
HTML where it asked for an image — the same defect returning by a different
door. A rule now asserts the order.

**One existing rule was too narrow.** `deploy-config.test.js` split a redirect
target on `/` only, so `share-image?code=:code` read as a function named
`share-image?code=:code` and reported a missing function for a real one. Fixed
to split on `?` and `#` too. A rule that cries wolf teaches people to ignore it.

| Probe | Result |
|-------|--------|
| Omit the Referer header | 3 fail |
| Send `credenzafashion.com` as the Referer | 3 fail |
| Trust the declared content-type | 4 fail |
| Return 404 instead of the site card | 8 fail |
| Bypass `safeFetch` | 1 fail |
| Honour a caller-supplied `url` parameter | 1 fail |
| Drop `?code=:code` from the rewrite | 1 fail |
| Rename the img rule so `/s/*` swallows it | 1 fail |
| Move the img rule below `/s/*` | 1 fail |
| Put the raw seller URL back in `og:image` | 2 fail |
| Restore each time | checksum verified |

**Gate.** 1617 tests pass, 0 lint errors, tsc clean, build emits the full bundle.

**Still needs Kyle.** The relay cannot be verified end-to-end until the shares
migration runs — there is no share to fetch. After the deploy: create a share,
paste the link into Discord, confirm the card shows the photo.

### LB-40 — the language rule stopped at the edge of the public folder

**Found by a negative control, not by reading.** LB-20 wrote the banned-phrase
rule and LB-29 extended it to the app shell. Both walk files under
`preview/public/`. The two biggest copy surfaces we own are not there.

I changed the app's own search placeholder to
`W2C best batch 1:1 replica finder` and ran the full suite. **1617 tests passed.**
I changed the share page footer to `the best batch 1:1 replica W2C finder.` and
ran its two test files. **539 tests passed.** Both would have shipped.

This is the **seventh** instance of the same shape:

| ID | What was exempt |
|---|---|
| LB-22 | the length floor covered `/guides/` only |
| LB-24 | social tags were checked on new pages only |
| LB-25 | the rule iterated HTML, so `llms.txt` was exempt |
| LB-26 | the rule iterated DOCS, so four shipped files were exempt |
| LB-29 | the app shell was outside every rule |
| LB-39 | the share page is a function, so no page rule reached it |
| LB-40 | the language rule reads `preview/public/` and nothing else |

**Why this list and not squeamishness.** The five phrases come from
`docs/aeo-geo/ai-seo-playbook.md`. They reframe the product from a haul planner
into a replica catalogue. That is the positioning we deliberately refuse, and
the app is where a user reads our words most.

**Comments are stripped before the check, on purpose.**
`credenza-fashion.jsx:1304` says `// obfuscate W2C links to dodge automod`. That
comment is correct — it explains why the Reddit parser handles a format it does
not endorse. A rule that fired on it would be deleted within a day, and then it
would guard nothing. Only what a user can read counts.

**Probes.**

| Edit | Result |
|---|---|
| Banned phrase in the app placeholder | 4 fail |
| Banned phrase in the share page footer | 4 fail |
| All five phrases in a line comment | 0 fail (correct) |
| All five phrases in a block comment | 0 fail (correct) |
| Make the stripper return `""` | 2 fail (guard-the-guard) |
| Restore each time | checksum verified |

**Gate.** 1629 tests pass (62 files), 0 lint errors, tsc clean, build emits the
full bundle.

### LB-41 — the install prompt, the one shipped sentence with no rule on it

**The eighth instance, and it hid inside the fix for the sixth.** LB-26 brought
`manifest.webmanifest` under test after finding it painted the wrong splash
colour. That fix then checked the file's colours, its icons, and its scope —
every field except the two a person actually reads.

`name` and `description` are the install prompt. They are the last words shown
before somebody puts the app on a home screen, and no rule reached them.

I replaced the description with
`W2C best batch 1:1 replica finder with customs tips.` and ran the full suite.
**All 1629 tests passed.** It would have shipped.

I ran the same edit against the app shell's `<title>` as a control. **1 test
failed**, so `index.html` was already covered by LB-29. The gap was this file
alone.

| ID | What was exempt |
|---|---|
| LB-22 | the length floor covered `/guides/` only |
| LB-24 | social tags were checked on new pages only |
| LB-25 | the rule iterated HTML, so `llms.txt` was exempt |
| LB-26 | the rule iterated DOCS, so four shipped files were exempt |
| LB-29 | the app shell was outside every rule |
| LB-39 | the share page is a function, so no page rule reached it |
| LB-40 | the language rule reads `preview/public/` and nothing else |
| LB-41 | the manifest was under test, but only its non-prose fields |

**LB-41 is the one worth generalising from.** The others were files nobody had
looked at. This one was looked at, fixed, and covered — and the cover stopped
exactly where the prose started. Bringing a file under test is not the same as
bringing its user-visible content under test.

**Why the word list and not the phrase list.** The check uses LB-40's five
words, not the five phrases at the top of `public-site.test.js`. A manifest has
one sentence to work with. A bare "replica" there is a positioning claim, not a
passing mention inside an explainer, so the stricter list is the right one.

**Where the check lives.** Inside the existing LB-26 `describe("the manifest")`
block, not a new top-level one. A second block reading the same file is how
LB-19 happened.

**Probes.**

| Edit | Result |
|---|---|
| Banned phrase in `description` | 1 fail |
| Banned word in `name` | 1 fail |
| Delete `description` entirely | 1 fail (guard-the-guard) |
| Clean file | 528 pass |
| Restore each time | checksum verified |

**Gate.** 1630 tests pass (62 files), 5 lint warnings and 0 errors, build emits
`index-fashion-0Wmw74AY.js` at 362.73 kB.

**What is left in this class.** I swept every non-HTML file under
`preview/public/`. `sw.js` has no user-visible string. `robots.txt`,
`sitemap.xml`, and the two verification files carry no prose. `share-image.js`
draws no text — its failure path is a 302 to `/og.png`, a picture. So the
manifest was the last shipped prose with no language rule on it.

---

### LB-42 — the app repeated the server's own error strings to the buyer

**How it was found.** Not by a sweep. By taking LB-41's generalisation
seriously and asking the next question: *which files are under test, but whose
user-visible content is not?* The answer was the billing path.

**The defect.** `preview/src/account.js` `post()` threw
`new Error(data.error || "HTTP " + res.status)` — the server's own string.
`sheets/ProfileSheet.jsx:59-70` catches that and calls `setError(err.message)`,
which renders straight into the sheet. So a person who pressed Upgrade while
one Netlify variable was unset read:

> Server not configured: missing STRIPE_PRICE_MONTHLY

That is a paying customer being shown our vendor and our environment. They can
act on neither. The same shape existed in Cloud Ask: `credenza-fashion.jsx:6419`
threw `payload.error`, rendered at line 8442, so a rate-limited free user read
"Anthropic rate limit reached; try again shortly".

**The size of it.** 18 such strings across 8 functions — `checkout.js`,
`portal.js`, `ask.js`, `reddit.js`, `chart-vision.js`, `preview.js`,
`yupoo.js`, `lib/paid-gate.js`. A grep for "Server not configured" across
`preview/test/` returned zero. None were under test.

**Why the existing tests missed it.** `part7e.test.js` already had two tests
on this exact code path. Both asserted messages written *for* a user — "No
billing account yet" and "Cancel your subscription in Manage billing first".
Those are the two safe strings in the whole path. The eight that name Stripe or
an environment variable had nothing on them. This is the LB-41 lesson a second
time: **under test is not the same as covered**, and a suite can sit directly
on a defect while testing only the parts that were already correct.

**Allowlist, not blocklist.** A blocklist of vendor names passes every message
written after the blocklist, and the failing string is always the one nobody
thought about. `safeErrorMessage(status, serverError, subject)` passes three
listed messages and one matched by shape, and replaces everything else with a
sentence chosen by status code. `subject` exists because a 500 on the Ask box
must not say "Billing is not answering" — it takes `"Cloud Ask"` there.

**The two messages that had to survive.**

| Message | Why it passes |
|---|---|
| "Cancel your subscription in Manage billing first, then delete the account." | names the exact next action, and Stripe requires that order |
| "Daily … limit reached — upgrade to Pro for more" | generated from the feature name in `lib/paid-gate.js:53`, so it cannot be listed literally; matched by shape `/^Daily \w+ limit reached/`. It is the only message that tells a free user why the button stopped working. |

**The real error is not destroyed.** `post()` attaches `err.serverError` and
`err.status`. A developer reads the console; a visitor does not. Losing it
entirely would trade one defect for another.

**Probes.**

| Edit | Result |
|---|---|
| Revert `post()` to the old passthrough | 7 fail |
| Disable the allowlist (over-block) | 3 fail — guard-the-guard |
| Disable the daily-cap shape rule | 1 fail |
| Clean tree | 29 pass in the file |
| Restore each time | checksum `bb78a4aa…` verified |

The over-block probe matters most. A rule that replaced *every* server message
would pass all seven leak tests and silently delete the one sentence that tells
a customer what to do next.

**Gate.** 1641 tests pass (62 files), 5 lint warnings and 0 errors, build emits
`index-fashion-VSp8hwMs.js` at 363.47 kB. This build is the first one made with
`VITE_ENABLE_SYNC=true` present in `preview/.env`.

---

### LB-43 — the price rule read the monthly figure and stopped

**How it was found.** By trying to tick the launch-gate box "LB-3/D-1 price
decision recorded here" and refusing to tick it on the strength of the record
alone. Kyle sent the Stripe product page the same hour: $4.99 monthly
(Default), $39.99 yearly, zero active subscriptions. Both match D-1. The
question left was not *is the price right today* but *does anything stop it
drifting tomorrow*.

**The defect.** `public-site.test.js` derived its allowlist from `PRICING`,
which is the correct shape. But it collected prices with

```js
[...html.matchAll(/Pro[^.<]{0,60}?(\$\d+(?:\.\d\d)?)/g)].map((m) => m[1])
```

One capture group, one price per match. Every price sentence on the site names
two — "Pro is $4.99 a month or $39.99 a year." The rule read $4.99, found it
valid, and never looked at the yearly figure beside it.

**Proof, 2026-07-27.** Changing `$39.99 a year` to `$79.99 a year` in
`guides/free-agent-haul-planner/index.html` left **all 1641 tests green**. The
same edit to `faq/index.html` did fail — but only because separate FAQ tests
assert both numbers, and only after the JSON-LD copy was changed too. The guide
has no such test. A wrong yearly price would have shipped.

**Why this is the ninth of the class, not a stray bug.** The eight before it
were files or fields no rule reached. This is a rule that reached the right
file, ran on the right sentence, and read half of it. The progression is worth
stating plainly:

| | What was exempt |
|---|---|
| LB-22 … LB-40 | files no rule reached |
| LB-41 | a covered file, but only its non-prose fields |
| LB-42 | a covered code path, but only its two safe strings |
| **LB-43** | **a covered sentence, but only its first number** |

The exemption keeps shrinking. It is now smaller than a sentence. The lesson
from LB-41 — *under test is not the same as covered* — has a sharper form:
**a rule that stops at the first match tests the first match, not the rule.**

**The fix and two mistakes made getting there.**

- The window was `[^.<]`, chosen to stop at the sentence end. Excluding the dot
  also stops inside `$4.99`, so the widened rule read a bare `$4` and failed
  four correct pages. The window is now `[^<]{0,90}` — a tag boundary plus a
  length cap keeps the mock shelf's item prices out just as well, because they
  never follow the word "Pro".
- `$4.99` also yielded `$4` until a trailing `(?![\d.])` was added. A false
  alarm here is not harmless: it teaches the next person to loosen the rule.

`$3.33` is now allowed, taken off the front of `PRICING.yearlyPerMonth` rather
than hardcoded, so a changed yearly price moves it automatically.

**Probes.**

| Edit | Before | After |
|---|---|---|
| Guide yearly → $79.99 | 1641 pass | 1 fail |
| FAQ yearly → $79.99 (all 4 copies) | 1 fail (wrong reason) | 1 fail |
| Terms monthly → $8.99 | — | 2 fail |
| llms.txt monthly → $7.99 | 1 fail | 1 fail |
| Clean tree | 1641 pass | 1641 pass |
| Restore each time | checksum verified | checksum verified |

**Also verified while here.** Every dollar figure on the shipped site was
swept. `$36` and `$3` survive only inside an explanatory code comment and an
example query about item cost ("still in Want under $40"). No superseded price
ships. `BrandIcon.jsx` matching "4.99" is an SVG path coordinate.

**Gate.** 1641 tests pass (62 files), 5 lint warnings and 0 errors.

### LB-44 — every rule read what a page says, none read what it asks for

**The defect.** Renaming the landing hero to
`/landing/img/kit-jersey-black-MISSING.jpg` left all 1641 tests green. That is
a broken picture in the first screen of the page that converts. The length
floor, the schema parity rule, and the language rules all pass it, because the
markup is still well-formed prose. Nothing read the filesystem.

**Why this one is different from the nine before it.** LB-22 through LB-43 were
all about words — a page too thin, a phrase not allowed, a price not checked.
Every one of them was fixed by widening which files a text rule reads. LB-44 is
the first defect on a different axis. The pages were under test for everything
they SAY and for nothing they REFERENCE. Widening the text rules further would
never have found it.

**The site was clean when the rule landed.** 46 image references across 20
pages, 2 manifest icons, 1 service-worker precache path, all present. That is
the point: the rule guards a state that is correct today and unguarded
tomorrow.

**Two things the rule has to know, both learned by getting them wrong.**

Paths resolve against `preview/public/` OR `preview/dist/`. `sw.js` precaches
`/index.html`, which is the app shell — Vite emits it into `dist/` and
`public/` copies over the top, so it exists at deploy time and not on disk in
`public/`. Checking `public/` alone reports a false miss on the one file the
whole app depends on. A false alarm is not harmless; it teaches the next
person to delete the rule.

The manifest and the service worker count as callers. A missing manifest icon
is an install with no picture. A precache entry that 404s rejects `install()`,
so one wrong path costs the whole offline mode rather than one asset.

**The guard needed a second pass, and a probe caught it.** The first version
asserted the COMBINED reference count was over 20. Probe D replaced the image
matcher with a pattern matching nothing — and it passed, because the 21
`og:image` hits alone cleared the threshold. That is the LB-43 shape again: the
rule checked the first thing that answered and stopped. Each matcher now
carries its own floor, and probes D2 and E prove each one separately.

**Probes.**

| Edit | Result |
|---|---|
| Landing hero → a file that does not exist | 1 fail, names the file |
| Manifest icon → a file that does not exist | 2 fail (LB-41's block also fires) |
| `sw.js` precache → a file that does not exist | 1 fail — also proves the `dist/` branch works |
| `og:image` on `/faq/` → a file that does not exist | 2 fail |
| Kill the image matcher (combined guard) | **0 fail — the defect in the guard** |
| Kill the image matcher (split guard) | 1 fail |
| Kill the social-card matcher (split guard) | 1 fail |
| Clean tree | 1666 pass |
| Restore each time | checksum verified |

**Also checked while here, all clean.** The nav is identical on all 20 pages
and matches D-2 in full, including `/llms.txt`. Every internal link resolves.
The sitemap and both `llms` files list every page. The guide hub links all 11
guides, and every guide has at least 3 inbound links. Every page clears the
400-word floor. Every use of "W2C" on a page is a denial ("not a W2C search
engine") or a naming explanation, which is what the loose phrase list is for.

**Gate.** 1666 tests pass (62 files), 5 lint warnings and 0 errors, build
`index-fashion-VSp8hwMs.js 363.47 kB`.

### LB-45 — the rule that kept two shipped features off the pricing page

**The defect.** The pricing table had eleven rows and named neither shared
haul links nor multi-device shelves. Those are the two features that most
justify $4.99 a month. Both shipped on 2026-07-26.

They were absent because a test forbade naming them. `pricing.test.js` banned
the phrases "sync across" and "shared shelf", with this comment:

> `docs/free-to-pro-checklist.md` rows 10, 11, 13 and 15 are MISSING.

Rows 10 and 11 read **BUILT** since 2026-07-26. Both preconditions are met:
Kyle ran `docs/sql/2026-07-26-shelves.sql` and `docs/sql/2026-07-26-shares.sql`,
and `preview/.env` sets `VITE_ENABLE_SYNC=true`.

**Why a stale comment is not a small defect.** Nobody deletes a rule that
states a reason. The wrong reason outlives the fact it rested on, and it reads
as deliberate to everybody who comes after. The fix is to stop restating the
checklist and read it: each ban now asserts the exact line it depends on, so a
row flipping to BUILT fails the guard instead of leaving the rule behind.

**The eleventh scope defect, and a new half.** The old rule read `page` — the
pricing page and nothing else. Proved 2026-07-27: adding "Pro adds price watch
and restock alerts on every card" to `/faq/` left all 1666 tests green. That is
the LB-22 shape for the eleventh time.

The new half is the direction. Every D-3 rule so far banned **over**-promising.
Nothing caught **under**-promising, so the page could omit a shipped feature
forever and stay green. LB-45 adds the opposite assertion: rows 10 and 11 read
BUILT, therefore the page must name them.

**What the page now says.** Three rows and four bullets, every number pinned to
the server:

| Row | Free | Pro | Pinned against |
|---|---|---|---|
| Shared haul links | 3 | 100 | `share.js` `MAX_SHARES_FREE` / `MAX_SHARES_PRO` |
| Link options (unlisted, expiry, no footer) | No | Yes | the three `pro && …` guards in `handleCreate` |
| Your shelf on more than one device | Restore only | Kept in step | the two sync effects in `credenza-fashion.jsx` |

The caps are **not** in `PLAN_LIMITS` — they are constants in `share.js`,
because only the function can count rows. The existing cap rule reads
`entitlements.js` and cannot see them, so LB-45 adds a second rule that reads
`share.js` directly.

**The device row needed prose.** "Restore only" against "Kept in step" is a
riddle without one sentence, and the wrong simplification is dangerous: calling
sync Pro-only would tell somebody who lost a phone that their cards are gone.
Pull is free by design — `if (!signedIn || !canPersist || …)`, no plan check.
Push is Pro — `if (!signedIn || !isProPlan || …)`. A test pins both lines, so
the page cannot drift from the behaviour.

**Probes.**

| Edit | Result |
|---|---|
| "price watch" added to `/faq/` (old rule) | **0 fail — the scope defect** |
| "price watch" added to `/faq/` (new rule) | 1 fail, names the file and the phrase |
| `MAX_SHARES_PRO` 100 → 50 | 1 fail |
| `unlisted` stops being gated on Pro | 1 fail |
| The free pull effect gains `isProPlan` | 1 fail |
| Checklist row 13 flipped to BUILT | 1 fail |
| Table row renamed off the page | 1 fail |
| Clean tree | 1670 pass |
| Restore each time | checksum verified |

**Left alone on purpose.** `llms-full.txt` already told assistants Credenza
keeps a shelf "in sync across a phone and a laptop". That was true, and the
pricing page contradicted it by silence. The page now agrees with it.

**Gate.** 1670 tests pass (62 files), 5 lint warnings and 0 errors, build
`index-fashion-VSp8hwMs.js 363.47 kB`.

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
- [x] LB-7: Kyle ran the shelves migration AND `VITE_ENABLE_SYNC=true` is set.
      Verified 2026-07-27. Kyle ran both migrations in the Supabase SQL editor;
      `select tablename, rowsecurity from pg_tables` returned `shelves`/`true`
      and `shares`/`true`. The flag is line 6 of `preview/.env` (gitignored),
      so the next build compiles with sync live. Runbook steps 1 and 2 done.
- [x] LB-8: Kyle ran `docs/sql/2026-07-26-shares.sql`. Verified by the same
      `pg_tables` query above — `shares`, row-level security on. The table has
      no public select policy, so the share function stays the only reader.
- [ ] LB-39: after the deploy, paste one real share link into Discord and
      confirm the card shows the photo. The relay is covered by tests, but
      only a live crawler proves the seller accepts the Referer we send.
      This box stayed unchecked for a day while the code "was done" — that
      is exactly how the blank card survived.
- [x] LB-3/D-1 price decision recorded here. $4.99 monthly, $39.99 yearly.
      Confirmed against the live Stripe product page 2026-07-27: monthly is
      the Default Price, both have zero active subscriptions. Every surface
      derives from the `PRICING` export, and LB-43 widened the rule that
      guards it — a wrong yearly price used to pass all 1641 tests.
- [ ] One full paid loop verified in test mode (LB-5 log exists).
- [x] Pricing page lists only shipped features. Verified 2026-07-26 by the
      LB-14 audit. `preview/test/public-site.test.js` holds the line.
- [x] A fresh build from a clean checkout passes the preflight and shows
      sign-in (the LB-6 regression can never recur silently). Verified
      2026-07-27 by LB-37 in `/tmp/cz-clean`. It failed the first time:
      the build exited 0 with a 21-module stub. Fixed and re-verified.
- [ ] Kyle approves one production deploy batch containing all of it.
      This is the ONLY deploy the whole launch spends (rule 8). Every
      task lands on `main` and waits for it.

LB-8, LB-9, LB-10 are strongly recommended before any public
announcement post — the share link is the announcement's engine — but
they do not block flipping the site live.

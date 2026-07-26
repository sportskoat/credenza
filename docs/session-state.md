# Credenza Fashion — Session State (LIVING CHECKPOINT)

**Purpose:** This file is the session black box. Any Claude/agent session in this
repo must **read it first** and **update it before context runs low** (see
`.claude/settings.json` Stop hook, which nags when this file goes stale).
Overwrite sections in place — this is current state, not a log.

**Last updated:** 2026-07-26 (ALBUM PHOTOS — honest count, 40-photo extraction, size charts held out of the gallery, thumb-strip glitch fixed — plus MODAL STACK SCROLLBARS HIDDEN (`7e065dc` — replaces the earlier stable-gutter fix), **all COMMITTED on branch `worktree-fansbuy-links-no-flip`, 685 tests passing, NOT merged to main, NOT deployed**. That branch also holds SETTINGS MODAL STACK and FANSBUY LINK FIX + CAROUSEL FLIP RETIRED — see the sections below. **The worktree has NO git remote, so no push and no PR are possible from it. NEXT STEP: Kyle decides whether to merge `worktree-fansbuy-links-no-flip` into `main`. Do not merge or deploy without a fresh explicit instruction.** Prior: CUSTOMER WALKTHROUGH AUDIT FIXES committed, NOT deployed — Kyle holds deploys for credits; Grok takes over next. Prior: HANDOFF TURN 4 SHIPPED — Fix A card-cap raise + Fix B two-column panel live and verified.
**Branch:** `main` (fast-forwarded to the work branch; `mobile-fix-loop` merged 2026-07-25)
**Production:** https://credenzafashion.com — **LIVE at `ebfb59b` (2026-07-25, deploy `6a65a2d4e173815517647bfb`): turn 4 COMPLETE — Fix A (desktop card cap min(72vw,560)xmin(86vh,820) rack, 0.85 overlay mirror; the cap lived in CSS, not the JS cardSize) + Fix B (two-column no-flip DesktopDetailPanel at >=1024px: contain-fit stage with counter/favourite/always-visible arrows/arrow keys/thumb strip + album tile left, shared DetailBody with pinned price+Buy footer right; grid-tap renders the panel directly, rack tap opens it above the rack which never flips; flip cue hidden >=1024px; stage tap opens the swipe gallery; generic thumb-hover z-index fix keeps the chrome on top). Badge fix: only an ESTIMATED deciding measurement hedges the verdict. 640 tests; gallery probe green (desktop panel + phone sheet); live screenshots verified.** Previous: `d109a2a` card-front redesign (deploy `6a65923338fa3dbb68a29676`).
**DEPLOY BLOCKER — CLEARED (2026-07-25 ~09:05Z).** Credits added; everything committed deployed in one shot (see Production line).

## 2026-07-26 — SIX OPEN ISSUES from Kyle's mobile pass. IN PROGRESS, nothing fixed yet.

Kyle reported six problems from the LIVE mobile web app at credenzafashion.com.
A read-only root-cause workflow (6 investigators + adversarial verifiers +
completeness critic) was launched. NO code is changed yet. Do not assume any of
these are fixed.

1. **Chart-hunt loading text overlaps other text.** "It's like the text is over
   the other text… looks really sloppy." Suspect: the shimmer loading state from
   commit `fb23196` stacks a loading label on the resting text in the fit block.
   Start at `components/SizeRecommendation.jsx`, `components/DetailBody.jsx`.

2. **Card price clipped in the phone shelf grid.** Screenshot shows "$31.8" cut
   mid-character and "Weidian gallery · 9 phot" truncated. "There should be no
   overlap or cutoff on the prices." Start at `components/CardFrontInfo.jsx`,
   `components/CardMetaLinks.jsx`, and the `.cz-front-*` CSS.

3. **Weidian description size chart is never picked up.**
   `https://weidian.com/item.html?itemID=7739297298` has a clear chart IMAGE in
   Product Details (S/M/L/XL, Shoulder 52-58, Chest 110-128, Length 67-76). The
   app says "AI sizing needs the chart photo on this listing." Prime suspect:
   the Weidian resolver extracts only the main carousel gallery, never the
   description/detail images. The new `isChartTile` work was YUPOO ONLY — Weidian
   has no equivalent.

4. **Close/exit buttons stick and stop responding in the photo viewer.** The X
   renders in a pressed state and taps do nothing. Suspects: a `:hover`/`:active`
   rule with no `@media (hover: hover)` guard (iOS latches :hover after a tap), a
   press-state class never cleared on `pointercancel`/`touchcancel`, or a leaving
   layer that keeps `pointer-events`.

5. **Money counter digits smear and overlap.** Header shows "$44.10" with doubled
   glyphs. STRONG LEAD found by hand: `ReelCounter` in `components/atoms.jsx`
   (~line 228-250) arms an SVG motion blur while spinning and clears it ONLY in
   `settle()`, which fires from `onTransitionEnd`. If that event never arrives —
   interrupted transition, hidden element, unchanged transform — the blur stays
   armed forever. That matches a permanently smeared counter.

6. **Move the status tag to the TOP LEFT of the card.** "bought, want, shipped"
   sits bottom-left today; Kyle wants it top-left. The favourite heart is top
   RIGHT, so check collision at the ~175px phone column. Find EVERY surface that
   positions the pill (grid card, rack card, carousel card, desktop panel) —
   Kyle wants it consistent. Start at `components/Card.jsx:92`.

---

## 2026-07-26 — TWO SESSIONS RAN IN PARALLEL. Read this before you merge.

A second session shipped the Turn 7 landing page and deployed it. That work
replaced `preview/public/landing/index.html`, regenerated `og.png`, and ran
IndexNow. It is LIVE at https://credenzafashion.com/landing/.

This worktree (`worktree-fansbuy-links-no-flip`) did NOT touch the landing page,
`og.png`, or any deploy script. Its copy of `preview/public/landing/index.html`
is still the old 226-line file at commit `7113675`. There is no file conflict
between the two efforts, with one exception:

**Both sessions edit `docs/session-state.md`.** A merge of this branch into
`main` will conflict on THIS file. The conflict is text only. Resolve it by
keeping both sets of sections — the landing sections and the sections below.

Kyle asked directly whether this session interfered with the landing work
(2026-07-26). It did not. This session read the handoff bundle
`~/Downloads/design_handoff_mobile_shelf 6` and made zero writes to it or to
the landing page. The handoff bundle is NOT ported by this branch. If you pick
that work up later, check what the other session already shipped first.

---

## 2026-07-26 — Album photos: honest count, more photos, charts hidden, thumb glitch fixed (branch `worktree-fansbuy-links-no-flip`, NOT deployed)

Kyle reported four photo problems on Mook albums
(`240336011`, `243763940`, both 38 tiles).

**1. The count lied.** The card said "View album · 8 photos" for a 30+ photo
album. Two causes. `preview/netlify/functions/yupoo.js` capped extraction at
`MAX_IMAGES = 8`. `albumLinkTarget` then counted `item.gallery.length` — what
we stored, not what the album holds.

**2. Only 8 photos arrived.** The same cap, plus `slice(0, 8)` and
`length < 8` gates in three client paths.

**3. Size charts appeared in the gallery.** Kyle wants the chart indexed for
fit, never shown in the swipe gallery.

**4. The thumb highlight glitched left to right.** `goTo` set `photoIdx` and
started a smooth scroll; `onScroll` recomputed the index from every
intermediate scroll position and overwrote it mid-flight.

**The fix — read per-photo tiles, not loose URLs.**
Yupoo wraps each photo in `.showalbum__children.image__main` and declares
`data-width`, `data-height`, `data-origin-src`, and the filename in `alt`.
The old code scraped every `src`/`data-src`/`background-image` on the page and
could not tell a photo from a banner. `extractPhotoTiles()` reads the tiles, so
the function now knows how many photos exist and how big each one is.

- `MAX_IMAGES` 8 → 40. These are URLs only; the client relays a subset.
- `partitionTiles()` splits tiles into `gallery` and `charts`.
- `isChartTile()` — filename says size/chart/screenshot/尺码, OR a PNG whose
  long edge is under 60% of the album median. Both reference albums put the
  chart in a ~490px PNG among 2000px JPGs. Detected 1/38 on each.
- `isDecentPhoto()` — drops tiles under 600px long edge and strips wider than
  3:1. Tiles with NO declared size pass: unknown is not evidence of bad.
- The response gained `photoCount` (album truth) and `chartImages` (held-out
  charts). The flat scrape stays as the fallback for older templates.
- Never returns an empty gallery: if every tile fails vetting, all tiles show.

**Client.** `migrateItem` gained `albumPhotoCount` and `chartImages` (the
whitelist drops anything not listed). `albumLinkTarget` reports
`max(albumPhotoCount, gallery.length)`, so it never understates and never
regresses for items enriched before the field existed. New `GALLERY_MAX = 20`
replaces the scattered 8/12 caps — this is a STORAGE budget, not a display
limit: each stored photo is a ~32KB base64 string in the item JSON, so 20
photos is roughly 640KB per card.

**Chart hunt.** `huntSizeChart` now scans `item.chartImages` FIRST — one vision
call on the actual chart instead of walking the album. New provenance tag
`chart-photos` with its own footer line.

**Thumb glitch.** `DesktopDetailPanel` gained a `programmatic` ref. `goTo` sets
it before the smooth scroll; `onScroll` returns early while it is set and
re-arms a 120ms settle timer on every event, so the lock lasts exactly as long
as the motion. A fixed timer did NOT work — measured a late flip at t=457ms
with a 420ms timeout, because the browser decides the scroll duration.

**Verified.** Playwright at 1400x950: thumb jumps are now one transition each
(0→1, 1→5, 5→1) with no flip-back; before the fix each jump showed a spurious
4 then 5. Card view at 1100x900 shows "View album · 37 photos" for an item with
`albumPhotoCount: 37` and "View album · 9 photos" for one without. Parser run
against both live albums: 38 tiles, 37 gallery, 1 chart each.

685 tests green (was 676): 5 new album-count tests, 4 new tile-parser tests,
1 rewritten (it asserted the old 8 cap). **NOT deployed.**

---

## 2026-07-26 — Modal stack scrollbars HIDDEN (branch `worktree-fansbuy-links-no-flip`, NOT deployed)

Kyle: "THE SIZING STILL LOOKS WEIRD… IT'S BECAUSE OF THE SCROLL BAR."
He was right and my probes could not see it.

A sub-page that overflows shows a classic ~15px scrollbar on macOS when
"always show scrollbars" is set. That steals content width, so the text
re-wraps and the measured height is wrong — and the gutter appearing between
pages changes the width mid transition.

**First fix:** `scrollbar-gutter: stable` on `.cz-modal-surface-stacked`. That
held the width steady but STILL DREW THE BAR over the settings list.

**Final fix (`7e065dc`), after Kyle saw the bar in a screenshot and said "let's
take out the scrollbars here… I think it'll move a little bit cleaner":** hide
the bar outright on `.cz-modal-surface-stacked` AND `.cz-modal-page` with
`scrollbar-width: none` + `-ms-overflow-style: none` + a zero-size
`::-webkit-scrollbar` rule. The stable gutter is REMOVED — hiding the bar
solves the width problem too. This matches the rest of the app: `.cz-carousel`,
`.cz-app[data-fashion=true]`, and `.cz-detail-scroll` all hide theirs.

**Verified** with a 15px classic bar forced on and 3000px of content pushed
into both scrollers: surface gutter 2px (its border), page gutter 0px, width
438px identical with and without overflow, and `scrollTop = 150` lands at 150
on both, so they still scroll. Kyle has NOT yet confirmed the motion by eye.

**Why the probes missed it:** headless Chrome uses OVERLAY scrollbars. Every
measurement reported a 2px gutter, which is the border alone. To reproduce
this class of bug, force it:
`::-webkit-scrollbar{width:15px;display:block!important}`. Probe kept at
`~/.claude/jobs/7984365d/tmp/probe-modal-scrollbar3.mjs`.

---

## 2026-07-26 — Settings modal stack: slide + resize, one modal (branch `worktree-fansbuy-links-no-flip`, NOT deployed)

Kyle asked to merge two transitions.dev primitives: page side-by-side and
card resize. A settings sub-page must not open a second modal. The SAME
modal slides sideways to the sub-page, resizes to it, and shows a back
button.

**Where it applies:** Your sizes (measurements), Fit preferences, Buying
agent, and Import & backup — from both the Profile sheet and the phone
Settings sheet.

**How it works.**
- `ModalShell` takes three new props: `stacked`, `subPage`, and `onBack`.
  When `stacked` is set, it renders a two-page stack instead of bare
  children. Page 1 is the parent; page 2 is the sub-page.
- The dialog tweens `max-width` with `--resize-dur` / `--resize-ease`.
  Profile is 440px; measurements 560px; agent and import 520px.
- The stack tweens height. A `useLayoutEffect` plus a `ResizeObserver`
  measures the active page and writes the height inline.
- A hold timer keeps the old sub-page mounted for the slide-out, then
  unmounts it. Reduced motion drops it immediately.
- Escape peels one layer. A sub-page returns to the parent; a second
  Escape closes the modal.
- The header is sticky in stacked modals, so a scrolled sub-page keeps the
  back button on screen.

**Measurement trap (cost ~30 minutes):** the pages are
`position: absolute; inset: 0`, so a page box is sized BY the stack. Reading
`page.scrollHeight` returns the height just written, and the modal only ever
grows. Each page wraps its content in one inner `<div>`; the measure step
reads `firstElementChild.scrollHeight`, which sizes to the content.

**Sheets gained an `embedded` prop.** `BodyProfileSheet`, `FitPrefsSheet`,
`AgentSheet`, and `ImportSheet` return their body alone when embedded. The
stack owns the shell, the title, and the back button. Standalone use is
unchanged — cards and the empty shelf still open them as full modals.

Verified live at 1280x900, 1280x520, 900x460, and 390x844: one dialog only,
title and back button swap in, width and height both tween in both
directions, the surface scrolls to reach the last control, and Escape peels
one layer. 676 tests green with NO test edits. Lint clean, build and
typecheck pass. **NOT deployed.**

---

## 2026-07-26 — Fansbuy link fix + carousel flip retired (branch `worktree-fansbuy-links-no-flip`, NOT deployed)

Kyle asked for two things: fix Fansbuy links, and stop the carousel cards
from flipping. Both are done and verified in a live browser.

**1. Fansbuy links lost the referral.** Buy opened
`fansbuy.com/item-micro-7799601727.html?promotionCode=…` — a competitor
agent front with someone else's promotion code. Cause: `recordOpen` gave the
raw stored URL to `marketplaceOf()`, which returns null for `fansbuy.com`.
The "open untouched" early return ran before the agent wrap.

Fix: unwrap the agent front to its canonical marketplace URL first.
- `recordOpen` calls `marketplaceBuyUrl()` before `marketplaceOf()`.
- `classify`, `normalizeLinks`, `inferLinkRole`, and `resolvableBuyUrl`
  store and read the marketplace URL, never the agent front.
- `migrateItem` repairs items already stored with the front as their
  primary URL. It rewrites `url`, `host`, and `canonicalKey` on load.
- `agents.js` exports `unwrapAgentUrl()`; `resolve.js` mirrors it.

Verified live: Buy now opens
`superbuy.com/en/page/buy?url=…weidian.com…itemID=7799601727`. A legacy
stored item migrates to `weidian:7799601727`. A fresh stash of the Fansbuy
link stores the canonical Weidian URL.

**2. The carousel no longer flips.** Two paths still reached a flip:
- The 768–1023px band had no detail panel, so a tap flipped the card.
- The `flipRequest` signal sets `flipped` inside `CoverFlowCard` directly.
  It bypasses the `expandedId` gate, so Space / F / E flipped a rack card
  under the open panel.

Fix: `useIsWideDetail` moves from `(min-width: 1024px)` to
`(min-width: 768px)`, and `renderCarousel` withholds `flipRequest` whenever
the panel owns detail. CSS restructured: the panel media query starts at
768px, the tablet band stacks the stage over the body
(`grid-template-rows: 44% minmax(0, 1fr)`), and the 1024px block restores
the two-column layout.

**The flip machinery stays intact and reusable — Kyle's requirement.**
`CoverFlowCard` is untouched. Only the breakpoint and the `flipRequest`
prop keep the flip dormant. Re-enable it by restoring either one.

Verified at 768 / 900 / 1023 / 1024 / 1105 / 1280px: zero flips on tap,
Space, E, and across a resize; the panel opens, its body scrolls, and Buy
stays inside the panel bounds.

676 tests green, lint clean, build and typecheck pass. **NOT deployed.**

**Trap found (cost ~20 minutes):** a new git worktree does NOT get
`preview/.env` — it is gitignored. Without it `PREVIEW_SECRET` is empty and
the Reddit reader test fails. Copy `preview/.env` into every new worktree
before running the suite.

---

## 2026-07-25 night — Customer layout (flip + smaller cards + no batch UI)

NOTE (2026-07-26): item 2 below is SUPERSEDED. `useIsWideDetail` is now
`(min-width: 768px)` and the carousel no longer flips. See the Fansbuy /
flip section above.

Kyle: cards too big; restore flip; drop batch box; status dropdown; one photo strip under hero; bigger notes.

1. Carousel desktop cap ~30% smaller: min(50vw,392) × min(60vh,574). Overlay scales with it.
2. `useIsWideDetail` always false → flip card on every width (DesktopDetailPanel not selected).
3. DetailBody: Batch cell gone; status = full-pipeline `<select>`; photos n/12 under hero only; roomier notes.
4. Data field `batch` still migrates/stores; just no UI. fashion-app tests updated (40 green).

Local: `cd preview && npm run dev -- --host 127.0.0.1 --port 5173`.

## 2026-07-25 night — Chart hunt + weight bands (Claude pure→product, no deploy)

Commits on main (local, not prod):

1. **`a2ea185` chart hunt.** Gallery scans forward windows of 10 from the start (cap 20) so early size-chart slides (Kyle Mook tee 2/9) are not dropped by `slice(-10)`. FitBlock marks `chartHuntTried` only after a finished hunt and clears hunting on abort so remounts do not stick on “Looking for the seller’s size chart…”.
2. **`644e87d` weight wire.** `itemWeightGrams` / `haulWeightGrams` call `weight-estimate.js` (title keywords + listing grams beat coarse category mids). Haul chips still `~`.
3. Prior same night: usual size FitBlock hero when no chart; pure weight-estimate + link-context L0; migrate maximal fixture.

Tests green for hunt + weight suites. **No Netlify deploy.** Batch remains unsolved. Link-context UI not on cards yet.

## 2026-07-25 night — Customer walkthrough audit fixes (K3 lane, `d0ff7f1`, NOT deployed)

Re-ran all four customer walkthroughs against the current build
(`ui-haul-sample-audit`, `ui-walkthrough`, `ui-desktop-walkthrough`,
`ui-close-audit` on a local 5199 preview). Two real defects fixed:

1. **Phone tabs-row collision.** Tabs + totals + the 132px indexing chip
   overflowed 390px and crushed into each other on every stash. The row
   now wraps; the chip takes its own line while indexing (CSS only).
2. **Blank detail heroes for photo-less items.** The desktop panel stage
   was a white void and the phone sheet hero a blank dark box. Both empty
   states now render the grid's marketplace brand tile (`CoverPlaceholder`,
   now exported from CardCover.jsx).

Probe selectors updated for the redesign everywhere (Stash button labels,
the FAB, masthead search toggle, phone DetailSheet flow, Fix B panel flow).
All four audits green. 644 tests, gate clean. **No deploy — Kyle is
conserving Netlify credits; batch this with the next ship set.**
Next offered wires (lane notes §4.3/§4.4): weight bands on the haul board,
link-context L0 on stashed cards. Taobao resolve stays with the pure lane.

---

## 0e. Execution Plan run (2026-07-24) — LOCAL ONLY

Work order: `docs/Execution-Plan.md` (11 parts). Source: `docs/Market-Launch-Review.md`.
Baseline: tag `baseline-2026-07-24` (commit `b598451`). One commit per part. Revert with the tag.

- **Part 0 DONE — freeze.** Baseline commit + tag. Gate green.
- **Part 1 DONE — data loss (`6c16a62`).** `mergeLoadedItems` fixes the hydration race: a stash during load survives the storage read. `migrateItem` now keeps `posterStats`, `posterUser`, `sourceText`, `weightGrams`, `qcPhotos`, `qcNote`, `qcVerdictAt`. Reddit imports keep the original post text. 207 tests.
- **Part 2 DONE — revenue leak + trust (`dcabfdf`).** Referral codes come ONLY from build env `VITE_CREDENZA_REF_*`. The per-user override path is gone; stored `affiliateCodes` are ignored on purpose. AgentSheet rewritten without referral inputs. FTC disclosure beside Buy and in the Agent sheet. Meta description de-replica'd. FAQ drops the Pro claim. Sample shelf is one realistic 18-item haul. 208 tests. Probe: `preview/scripts/probe-part2.mjs`.
- **Part 3 DONE — server safety (`c7f1bf9`).** `chart-vision` fetches ONLY Yupoo image hosts; every hop re-validated (DNS + private/special-use rejection incl. decimal/hex/octal IPv4, manual checked redirects, byte caps). New shared modules `preview/netlify/functions/lib/guard.js` (SSRF guards; preview.js refactored onto it) and `lib/limit.js` (per-IP + per-route windows, concurrency caps, body caps, daily cost ceiling). All six functions return 429 + Retry-After above a limit. Paid functions (ask, resolve, chart-vision) stop above `CREDENZA_DAILY_COST_CAP_USD` (default $5) using real token usage. One JSON outcome line per request (route, hashed key, status, latency — never content). Ask caps query at 1000 chars; yupoo caps the album body at 2 MB. 238 tests. **Known limit: counters are per warm instance; distributed abuse waits for accounts (Part 7).**
- **Part 4 DONE — legal pages + repair Clear (`d6429eb`).** New `/privacy/` and `/terms/` pages (on-device storage, server requests, Anthropic processing, retention, export, deletion; support wenselllc@gmail.com). FAQ + How nav/footer cross-link both. Profile sheet has the legal links row and an Erase my data danger row. `eraseAllCredenzaData` sweeps every `credenza*` localStorage key, blanks the shim keys, deletes credenza caches; storage.test.js proves no Credenza key survives (the app re-writes DEFAULT prefs on the next boot — expected, not old data). Also from Kyle mid-part: the auto-category row is gone from the card back (still editable in the capture sheet), and the desktop clipboard banner has a dismiss X that holds until the clipboard changes. The buy disclosure STAYS — required while links carry referral codes (Kyle asked). 241 tests. Probe: `preview/scripts/probe-part4.mjs`.
- **Part 5 DONE — accessibility + Tier A haul model.** Axe-clean: form labels, listbox semantics on the carousel (roving `aria-activedescendant`, `tabIndex=-1` on the listbox), color-contrast fixes, keyboard-only operation of every flow. Tier A: hauls are first-class records in `credenza-fashion-hauls-v1` (`{ id, name, createdAt, updatedAt, budget, currency, archived, parcel: { weightGrams, dims, packaging }, history[] }`, whitelist-migrated, 50-entry history cap). New `HaulBoard` on the open haul: budget with spent line, parcel editor (actual weight, dims, packaging factor) with chargeable weight `max(actual×factor, volumetric l·w·h/5)` and the note "Estimate only. The buying agent weighs and measures the final parcel.", Archive/Unarchive. Directory gains an "Archived (n)" toggle. Returned items no longer count in haul weight (`haulWeightGrams`) or haul totals. QC section: paste an image anywhere in the section, 12-photo cap with counter and disabled Add at cap, and after RL a follow-up row offers "Mark returned" / "Ask for exchange" (exchange appends a dated note and returns the item to bought). Body profile adds usual tops/bottoms/shoes sizes; they drive the (EST) size line on cards with no chart. "AI fit summary" relabeled "Fit summary" — it is local math, not AI (task 12). 265 tests. Probe: `preview/scripts/probe-part5.mjs` (haul board round-trip, archive toggle, QC cap + RL follow-up, carousel ARIA). **Lesson — firstRunIntro race:** with stored items but no stored prefs the intro flashes ONE render (prefs resolve a tick before items), unmounting the chrome mid-interaction. Gating the intro on hydration is WRONG (breaks the documented stash-during-load behavior for new users); the fix was to harden the 3 affected tests with settle-waits on stocked-shelf markers.
- **Part 6 DONE — free-beta launch build.** Six new agents in `agents.js` (Mulebuy, Joyagoo, CNFans, Hoobuy, Oopbuy, AllChinaBuy — Pro-plan §9 order), all `verified: false` until Kyle clicks one through; CNFans gets no envKey on purpose (commission ended 2026-01-22). New `idPlatformTemplate` + `platformMap` registry type (Mulebuy `shop_type=`, CNFans uppercase `platform=`, Hoobuy/Oopbuy numeric codes 1/2/3); formats probed live with curl 2026-07-24. New `monitor.js`: client error ring (`credenza-fashion-errors-v1`, 100 cap, route+status only, never URLs/bodies) via `monitoredFetch` on all 7 server call sites, and activation milestones (`credenza-fashion-activation-v1`, first-ts only) for capture/import/haulNamed/sizeDecision/qcDecision/buyClick — wired at stash, runImport, saveEdit (transitions only), and recordOpen. New `/landing/` static page with Monetization §4.1 safe framing; FAQ/How navs + llms.txt link it. Erase sweep knows the two new keys. **Real gap found by the probe: the desktop search field had no onPaste** — a pasted URL searched for nothing; now stashes like the mobile row. 281 tests. Probe: `preview/scripts/probe-part6.mjs` (all 6 Buy destinations exact, outbound has no raw URL, capture+buyClick marked). **Part 6 task 6 remains: DEPLOY — waits on Kyle's approval.** Then STOP and measure: no Pro work until users click Buy.
- **Part 7 IN PROGRESS — accounts + billing. Kyle decided 2026-07-24: Stripe (with Customer Portal), $5/mo + $39/yr.** Deploy approved and shipped same day. Done so far: **7a+b (`577053c`)** — `lib/entitlements.js` (record, effectiveStatus pro/grace/free, PLAN_LIMITS, usage counters, replay-safe applyStripeEvent, HMAC offline snapshots) + 11 lifecycle tests + `docs/Part-7-setup.md` (architecture, SQL schema, webhook events, env-var checklist for Kyle). **7d DONE (2026-07-25, `6c2cbcf`):** `checkout.js` (Bearer JWT → Stripe Checkout Session; `{ price: "monthly" | "yearly" }` maps to STRIPE_PRICE_MONTHLY/YEARLY; client_reference_id = user id so the webhook links the customer; a re-subscribe reuses the stored stripeCustomerId — no duplicate customers; success/cancel URLs built server-side from SITE_URL/URL, never from the request body), `portal.js` (Bearer JWT → Billing Portal session for the stored customer; 400 "No billing account yet" before the first payment), `lib/stripe.js` (dependency-free form-encoded Stripe POST; Stripe failures → 502, not 500), `lib/auth.js` (shared Bearer + JWKS verification; entitlement.js refactored onto it), rate limits for both routes. 9 tests in `test/part7d.test.js` (in-memory Supabase + Stripe fakes). 336 tests, gate clean. **7e DONE (2026-07-25, `0986dc9` + `c65d44d` + `d4d4b4c`):** `src/auth.js` (Supabase Auth over REST — magic link, Google redirect, URL-hash session, refresh, logout; no SDK; AUTH_ENABLED only when VITE_SUPABASE_URL+ANON_KEY exist), `src/account.js` (decode-only snapshot cache credenza-fashion-entitlement-v1; checkout/portal/delete helpers), `src/usage.js` (per-UTC-day client counters; signed-in FREE users get an honest message on Ask and quiet skips on resolve/chart-vision at cap — server stays the hard gate), ProfileSheet account card (magic link + Google; plan badge; $5/mo + $39/yr upgrade pills; Manage billing; Sign out; two-tap Delete account), `delete-account.js` (record → auth user; 409 while a subscription is active), paid calls send Bearer via authHeaders (shared key stays until 7f), session/entitlement/usage keys join the erase sweep. 23 new tests. **Account UI is invisible until Kyle sets VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY on Netlify.** **7f DONE (2026-07-25, `bdd4c24`):** `lib/paid-gate.js` — ask/resolve/chart-vision authorize by Bearer account (per-plan daily cap on the real server record, 429 + Retry-After at cap; a bad Bearer never downgrades to the shared-key path) or by the legacy shared key. REQUIRE_ACCOUNTS=true ends the anonymous path — flip it after the 7g real-card test, then drop VITE_CREDENZA_SEARCH_SECRET from the build env. 6 tests. Only 7g (real-card gate, Kyle) remains in Part 7. **7c DONE (2026-07-24):** `lib/entitlement-store.js` (PostgREST via service key; load by user id or `record->>stripeCustomerId`; upsert; processed_events with 409-tolerant mark), `lib/jwt.js` (HS256 verify of Supabase access tokens, never throws), `entitlement` function (Bearer JWT → load-or-create record → signed snapshot), `stripe-webhook` (raw-body HMAC verify, 5-min tolerance, base64-safe, replay→200 no-op, out-of-order subscription events→500 so Stripe retries after checkout links the customer). 14 tests in `test/part7c.test.js` with an in-memory fake PostgREST. **Supabase project `credenza-fashion` created (Kyle); on Netlify: SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.** Still needed: SUPABASE_URL, VITE_SUPABASE_URL, SUPABASE_JWT_SECRET, ENTITLEMENT_SIGNING_SECRET; SQL schema; Email+Google providers. **The secret key was pasted in chat — roll it in Supabase after the flow works, then update Netlify.** The Opus+Grok lane committed in-repo: `942beab` (probe scripts), `6f81456` (**Joyagoo fix** — CNFans-family `joyagoo.com/product/?id={id}&shop_type={platform}`, NOT the Superbuy wrap; the old wrap returned HTTP 200 but dumped to the homepage. agents.test.js now guards against regression), `95c4b89` (launch kit: affiliate signups, launch copy, promotion rhythm, Resend for email). Deployed `95c4b89` to production 2026-07-24 evening (Joyagoo fix live).
- **Domain verdict (2026-07-24, registry whois):** credenza.me is TAKEN (GoDaddy, expires 2027-06-19 — the earlier rdap.org 404 was wrong). haulmark.ai is AVAILABLE (whois.nic.ai "Domain not found"). Also available: credenzafashion.com, getcredenza.com, credenzahaul.com, credenza.style, credenza.shop. **DECIDED: Kyle bought credenzafashion.com at Cloudflare Registrar (2026-07-24).** Netlify site updated via API: custom_domain credenzafashion.com, alias www.credenzafashion.com. **Kyle added the two Cloudflare CNAMEs (DNS only); cert provisioned via API; VERIFIED LIVE 2026-07-24: https://credenzafashion.com 200, www 301→apex, http 301→https, /landing/ 200.** Netlify auto-provisions the Let's Encrypt cert once DNS resolves. Brand stays Credenza; tier name stays "Pro" unless Kyle says otherwise. Open: Cloudflare warns about missing MX/SPF/DKIM — only matters if Kyle wants @credenzafashion.com email (support stays wenselllc@gmail.com for now).
- **Kyle tasks after the next deploy:** (1) ~~set an Anthropic spend alert~~ **DONE 2026-07-24 ($10/mo + email, Kyle)**; (2) ~~rotate the exposed Anthropic key~~ **DONE 2026-07-24 — new key set on Netlify (all contexts) via CLI; live on next deploy. Kyle must still DISABLE the old key at console.anthropic.com → API keys or it stays valid**; (3) set `CREDENZA_DAILY_COST_CAP_USD` on Netlify if $5/day is wrong; (4) still open: Reddit env vars (To-do item 24) — **now the top production gap: without REDDIT_CLIENT_ID/SECRET the /s/ reader gets block pages, so pasting a Reddit post LINK still fails on the live site (pasting the post TEXT works). Kyle: reddit.com/prefs/apps → create app → name `credenza` → type script → redirect `http://localhost` → paste id + secret here.** Support address for legal pages: **wenselllc@gmail.com** (Kyle, 2026-07-24).
- **Reddit parser corpus-tested + DEPLOYED (2026-07-24, `66b4583`).** Kyle's mobile report: Reddit posts fail to import, pastes "don't chop up well", cards titled "W2C". Acceptance test per Kyle: run 20 real r/FashionReps posts through the parser. Reddit login-walls anonymous hot.json/old.reddit from this network, so `preview/scripts/harvest-fashionreps.mjs` browses www.reddit.com in headless chromium (passes the JS challenge), scrolls the feed, and pulls each post's raw markdown via the session's .json endpoint; `preview/scripts/corpus-fashionreps.mjs` runs the corpus through parseRedditHaul exactly as the app calls it. Corpus: `preview/scripts/corpus-fashionreps.json` (22 posts). **Before: 12/22 parsed, labels often the URL itself, agent links invisible. After: 21/22 parsed, 77/77 items labeled, 35 categorized.** Fixes (reddit-haul.js): `parseRedditHaul(text, { title, fromPost })` — the fetched post title names single-link QC posts and known provenance lets one shoppable link parse (8/22 posts are exactly that); "Name: review" colon format splits label/note; markdown anchors that repeat the URL, name a host, or say link/lien/W2C/whatsapp carry no label; agent register/invite links never card; yupoo root links join detached album paths ("…com/ albums/123"); Reddit `\_` escapes + "https:// host" breaks repair; text above the only link becomes its note (600-char pending cap, was 300 — Gats review is 380); a leading "[" alone is a markdown link, not JSON. Hosts (agents.js): agent matcher adds mycnbox/gtbuy/hipobuy; tb.cn = taobao. App: stashRedditHaul passes the fetched title through runImport → parseImport. 8 corpus regression tests (Gats, 15kg GTBuy, mycnbox Timberlands, tb.cn Prems, KZ J4 space-break, cssbuy invite, Husky album join, SLP Yupoo). **320 tests green, gate clean, deployed + verified live (mycnbox in the prod bundle).** Remaining parser nits (acceptable): seller-promo posts label cards with the seller name; "(QC)"-style parenthesized flair in titles survives cleanLabel.
- **Mobile UX consolidation (task #43) DONE + DEPLOYED (2026-07-25, `97bdaba`).** Kyle's complaints: four "Paste a link" surfaces, mode tabs, gray gradient ghost tiles, blank screens after closing sheets. Fixes: ONE auto-detecting paste box everywhere (`dispatchStash` routes by paste shape — Reddit post link or any multi-line paste → haul parser; single line → fashion gate + stash; `stashMode` pref and mode tabs deleted); empty-shelf ghost gradient tiles removed; mobile search row hidden until the shelf has cards; hero Stash runs the same auto-detect path. **Post-stash flow fixed:** a fresh stash auto-opens the Inbox tab while the card indexes (the Shelf used to lie "Nothing on the shelf yet"); the view snaps back to Shelf when indexing finishes, and the filtered-empty shelf copy points at the Inbox with an Open Inbox pill. ModalShell cleanup calls `dialog.close()` before node removal (iOS could leave the page inert). Verified with `preview/scripts/ui-close-audit.mjs` (iPhone 390×844): after stash Inbox selected with the "Enhancing…" row; after indexing Shelf selected with the card; after card/agent/profile/capture closes `scrollLocked:false, dialogsOpen:0` every time. 320 tests, gate clean, deployed + verified live (bundle `index-fashion-DR0Iwb61.js`).
- **Mobile walkthrough round 2 (tasks #44/#45/#46) DONE + DEPLOYED (2026-07-25, `a1bb223`).** `preview/scripts/ui-walkthrough.mjs` drives a fresh iPhone profile through intro → capture sheet → stash → Inbox → Shelf → card overlay → card back → Buy row → Hauls → Profile → close, screenshotting every step. Four defects found and fixed: (1) **Escape could not close the card overlay** — the overlay auto-focuses its first button and the global key handler's focused-control guard swallowed the key; the page sat scroll-locked behind the overlay (Kyle's "close gives me blank"). Escape is now exempt from that guard; open combobox menus stopPropagation their own Escape. (2) **Touch tap-to-buy trap** — the hover-only Buy pill used plain `:hover`; on touch the first tap revealed it under the finger and iOS cancelled the click (card never opened, second tap could buy). Now gated behind `@media (hover: hover) and (pointer: fine)`. (3) **Photo-less cards looked broken** — gray gradient skeleton + generic icon; now a flat brand tile (monogram + wordmark) for Weidian/Taobao/Tmall/1688/Yupoo. (4) **URL-ish titles** — Yupoo took "x" as the seller from the x.yupoo.com host ("x · 12345678"); the seller is in `/photos/<seller>/`. Weidian/Taobao items title by item id ("Weidian item 723…"). 6 regression tests (`fashion-title.test.js`). 326 tests, gate clean, live verified (bundle `index-fashion-CnyrULVX.js`). **Note for future audits: layer peeling is by design — one Escape unflips the card, the second closes the overlay.**
- **Next customer-facing candidates:** Reddit haul paste end-to-end on mobile; sample-shelf walkthrough. **Top production gap stays Reddit OAuth (Kyle action, above).** Then Part 7d (checkout + portal functions).
- **Pending Kyle decisions:** Part 7 payment provider (merchant-of-record recommended) + price ($5.99/mo + $39/yr recommended). Part 6 is a stop-and-measure gate.

Known trap (bit twice): `migrateItem` is a whitelist. ANY new item field must be added there or it vanishes on reload.

---

## 0d. Design turn 5 — fit preferences (2026-07-23) — LOCAL ONLY

Spec: `~/Downloads/design_handoff_credenza 3/README.md` §6c + Card Mockups 5a–5c.

1. **Engine.** `recommendSize(chart, profile, category, fitPref?)` applies
   looseness nudge after measure pick (`slim` −1 / `baggy|oversized` +1).
   Length is metadata only. Exports: `FIT_PREF_AXES`, `loosenessNudge`,
   `applyFitPreference`, `fitPrefHasChoice`, `fitPrefLabel`.
2. **5a Settings.** Profile → Fit preferences sheet. One row per owned
   category (shorts/pants/shirt/outerwear) with Length + Looseness chips.
3. **5b In-context.** First open of a category with chart + body profile and
   no saved/dismissed pref: "How do you wear {category}?" Save / Not sure yet.
4. **5c Payoff.** Precise rec shows base size strikethrough + sized up/down,
   pref reason line, Short/Baggy tags, Edit.
5. **Prefs.** `fitPrefs` in BOTH load paths (migrate rewrite + normal). Shape
   `{ [cat]: { length, looseness, dismissed } }`.

Verify: 178/178 vitest (+6 fit-pref tests), tsc clean, lint 12 err. **NOT deployed.**

---

## 0c. Design turn 4 — status / category / fit flow (2026-07-23) — LOCAL ONLY

Spec: `~/Downloads/design_handoff_credenza 2/README.md` §6b + Card Mockups 4a–4g.
Built on uncommitted 3b work + prior design package.

Shipped this pass (uncommitted until commit):

1. **Status 4a/4b.** Display = current stage (serif long label) + Change › +
   4-stop human track (Want · Bought · Shipped · Received). Agent sub-states
   map to Bought. Picker = grouped list (Ordering / At the agent / Shipping)
   with full labels + hints (Quality check, Approved · green light, Red light).
   Enum unchanged: want|bought|shipped|qc|gl|rl|returned.
2. **Category 4c.** `CategorySelect` auto row + expandable chip list. Used on
   card back + edit form. Kills lumpy SegmentedControl grid there.
3. **Fit 4d–4g.** Honest states, no fabricated size:
   - 4d empty: "Will it fit you?" + Add my size + Skip for now
   - 4e rough: usual size + amber Rough estimate + tappable Add chest/waist
   - 4f ask: category fields only (tops→chest, bottoms→waist+inseam) + usual
   - 4g precise: green Precise fit + prose + You / Garment / Ease row
4. **Body profile truth.** `recommendSize` uses chest (tops) / waist|hip
   (bottoms). Height and weight do **not** score. Usual size is soft fallback
   only. Full BodyProfileSheet still holds height/weight for later.

Verify: 172/172 vitest, tsc clean, lint 12 err / 70 warn (baseline 12 err).
**NOT deployed.**

---

## 0b. Design package `design_handoff_credenza` (2026-07-23) — DEPLOYED

Spec: `~/Downloads/design_handoff_credenza/README.md` (+ Card Mockups /
Onboarding / Credenza Fashion.dc.html). Builds on the earlier mobile-flow
PRs (`6b67948`…`9f19af7`). Live on Netlify.

Shipped this pass:

1. **Desktop capture + search toggle.** ≥768px: bottom bar hidden. Top row
   under masthead = capture field + Stash clipboard + glass toggle. Glass
   flips capture ⇄ search. Mobile keeps bottom split-pill bar + search field.
2. **Fit + status cleaner (3c).** Killed green `AI fit` chip and tracked-mono
   kickers. Size block = "We recommend" + large serif size + muted reason.
   Status display = order stepper (dots/connectors, money-green current).
   Status edit = underline segment row (no pill fills).
3. **Editorial grid card (2a/2b).** Photo hero, status flag, heart on photo,
   serif title, green price text. Buy fades in on hover/focus only.
4. **Edit form (2d partial).** Title / price / size / colorway first; underline
   status; Fit · auto block (read-only recommended size); photos after.
5. **Progressive onboarding.** First-run intro (Get started / Log in) when
   prefs have no prior `onboardingDone`. Empty shelf capture after Get started.
   Fit prompt was height/weight/usual (wrong). Superseded by turn 4 (0c):
   chest/waist by category + usual backup. Usual size alone = rough estimate.

Prefs: `onboardingDone` in BOTH prefs paths (migrate rewrite + normal load).
Session-only: `fitPromptSkipped`. Tests: empty-shelf stash tests dismiss intro.

Verify: 172/172 vitest, tsc clean, lint 12 err / 69 warn (baseline was 12/67;
two extra warnings pre-existing elsewhere), build green.
**DEPLOYED 2026-07-23** tag `deploy-2026-07-23` → `8c034f4`. Also set Netlify env `VITE_CREDENZA_SEARCH_SECRET` (was missing; client chart-vision/resolve calls need it baked). `ANTHROPIC_API_KEY` + `CREDENZA_SEARCH_SECRET` already present. Smoke: chart-vision authed returns 502 on bad image URL (not 401/500 missing key).

---

## 0a. Design-handoff mobile flow (2026-07-23) — 4 commits, NOT deployed

Implemented `~/Downloads/design_handoff_mobile_flow/README.md` (5 PRs) into
`credenza-fashion.jsx` + `credenza-fashion.css`. Revert path: `git revert`
each commit, or reset to `4a2df40`-parent `6b67948^` for the whole set.

1. **6b67948 — PR1 contrast.** `PALETTES` only: Gallery sub #4f545b / faint
   #6b7078; Blackout sub #b7bbc2 / faint #9ea3ab. All ≥4.5:1 on card-solid.
2. **4a2df40 — PR2 hero collapse.** Full hero only when `items.length === 0`;
   stocked shelf gets compact masthead (mark + CREDENZA Fashion + avatar),
   search, tabs, stat line. Masthead un-hidden on phones; brand restyled.
3. **1f8c5ce — PR3 capture bar + profile.** Bottom bar rebuilt: clipboard
   split pill (review | 1-tap Stash) when the clipboard-readable probe
   succeeds, else ＋ Stash pill; both open the new CaptureSheet (ModalShell).
   Agent stays a bar button; ⋯ menu DELETED (theme moved out). Masthead
   avatar opens ProfileSheet: Log in / Sign up (toast — no backend), Theme
   rows, Your sizes, Default agent, Primary currency (new `pricePrimary`
   pref reorders dual-currency labels via module `PRICE_PRIMARY`), Import &
   backup, Storage. Stocked shelf hides the top capture box; type-anywhere
   and paste open the capture sheet there. Desktop bar keeps an inline
   paste field (CSS swaps variants at 768px). Tests updated off the ⋯ menu.
4. **28c879b — PR4 AI fit summary.** `fitSummarySentence(rec, {runHint,
   units, detail})` (exported, unit-tested) renders a cz-bg callout under
   the Recommended-size block: green `AI fit` chip (new `--cz-money-bg`
   token) + "How it'll fit you" + one sentence. Prefs `fitSummary`
   (default on) + `fitDetail` (concise|detailed) in BOTH prefs paths;
   module-mirrored like PRICE_PRIMARY; toggles in ProfileSheet.
5. **PR5 hauls — no change needed.** Existing HaulCoverFan directory already
   matches the spec (fanned 3 tiles, +N badge, 2-col grid, "Your hauls").

Verify: 172/172 vitest, tsc clean, lint at baseline (12 err / 67 warn,
pre-existing), build green, mobile shots in `docs/mobile-shots/`
(01 grid, 04 capture sheet, 05 profile sheet, 08 fit callout, 09 hauls).
**NOT deployed — Kyle 2026-07-23: "don't commit to netifly we have more
changes". Deploy with `cd preview && npx netlify deploy --prod` when told.**

---

## 0. Haul-import session (2026-07-22, evening) — 7 commits, deployed

Kyle's bug report: pasting a r/FashionReps post (link or text) gave broken
cards — every card wore the NEXT item's name/review ("the jeans are the
foams"). Root cause and fixes:

1. **e0a3282 — haul parse attribution.** In-hand-review posts put
   `Name (Size M) - review…` ABOVE the `W2C:` link line; `extractItems`
   glued every URL-free line to the PREVIOUS item. Now URL-free lines are
   buffered and `headerSplit` decides header-vs-review when the next link
   arrives (dash+size, dash/size at a block boundary, bare short name at a
   boundary; post titles rejected). Blank lines and single `⸻` separators
   mark boundaries — `split(/\n+/)` had been collapsing them away. Category
   keywords gained vans/air max/asics/fresh foam/henley. Tests include
   Kyle's verbatim post.
2. **e742e7f — stash modes + reddit fn.** Front-screen toggle
   Link / Reddit haul / Note (persisted in prefs). A lone Reddit post URL
   auto-routes to the haul path even in Link mode. New
   `netlify/functions/reddit.js` resolves `/s/` share + redd.it links
   (SSRF-guarded, reddit hosts only) and returns selftext for the client
   parser. Read failures toast "paste the post text instead" — never a
   silent one-card stash.
3. **19bf18e — chart-vision committed.** Was live but untracked.
   ~~`ANTHROPIC_API_KEY` is not set on Netlify~~ **CORRECTION (later that
   night): the key IS set in the production context** — an earlier
   `netlify env:list` only showed the dev context. The chart was missing
   for a different reason; see item 5.
4. **ed3c40d + 23b834a + 8dd2906 — reddit fn vs datacenter blocks.**
   Reddit 403s anonymous .json from Netlify IPs and soft-redirects share
   links to the subreddit homepage. Function now recovers the comments
   path from hop Locations, sniffs 3xx/block bodies only when exactly ONE
   distinct post id appears, and (when `REDDIT_CLIENT_ID`/`SECRET` are
   set) does everything over oauth.reddit.com client_credentials — the
   only reliable path. **Kyle must create a script app at
   reddit.com/prefs/apps (no redirect URI) and set the two env vars.**
   Until then haul-from-LINK toasts the paste-text fallback;
   haul-from-TEXT works fully today.
5. **7c033a1 — chart-vision referer fix (sizing chart NOW WORKS live).**
   Root cause of "still missing the sizing chart": photo.yupoo.com
   (Alibaba CDN) answers **567 text/html** unless the referer looks like
   a yupoo album page. The function sent an iPhone UA +
   `referer: https://yupoo.com/` → every photo fetch died → "Could not
   fetch any album photos". Verified live: album-page referer → 200
   image/jpeg with either UA; yupoo.com referer or none → 567. Fix:
   UA + accept now match preview.js (which always worked), the client
   passes the album URL as `referer`, and the function derives
   `https://<seller>.x.yupoo.com/` from photo paths as a fallback (CDN
   accepts any *.x.yupoo.com referer). Live probe on the mook album
   returned `found:true` with a real transcribed chart (S–XL, 胸围/衣长/袖长).
   **Note: `ANTHROPIC_API_KEY` was pasted into chat in an earlier
   session — rotate it (console.anthropic.com → `netlify env:set`).**
- **Agent intel (Kyle, 2026-07-22):** Superbuy intermittently answers
  "Request too often" / "item information capture failed" on THEIR side
  (our wrap is fine — retry later); Sugargoo still login-walled; Fansbuy
  + Kakobuy confirmed working. No code change: Buy already fails open to
  the canonical link, and Direct opens originals.
- 167/167 tests, typecheck + build clean, lint at baseline (no new
  errors). Revert: `git reset --hard checkpoint-2026-07-22-prehaulfix`
  (then redeploy) or Netlify deploy rollback.

---

## 1. Where we are

- Product is a polished Yupoo/Weidian shelf + enrichment (carousel, paired
  links, sizes, photos, haul directory with cost reel). Verified working.
- **Tier A from `docs/Monetization.md` is 2/6 shipped.**
  - **A2 DONE (d400dae):** `agents.js` registry (Superbuy/Sugargoo/CSSBuy/
    Kakobuy/Direct), Buy wraps through `recordOpen` only (stored links stay
    canonical, referral params attach at open time), Agent sheet (picker,
    referral-code fields, FTC disclosure, per-agent open counts), local
    outbound click log (`credenza-fashion-outbound-v1`, cap 500).
  - **A1 DONE (5fe1427):** `reddit-haul.js` — one paste → N cards. Markdown
    links, W2C tables, stats block (height/weight/size/agent/total, imperial
    conversions), per-item review snippets, category guess, reddit source +
    poster. posterStats/findSource land on each imported item (A3 hauls will
    hoist stats). Import preview shows the stats line; toast says "from your
    Reddit haul".
  - 104/104 tests, lint at baseline (9 err/65 warn — same as HEAD; §6 note
    saying "1 err" was stale), typecheck + build clean.
  - **Needs Kyle:** ~~verify Sugargoo + Kakobuy URL templates~~ **Kakobuy +
    CSSBuy + Superbuy CONFIRMED live (2026-07-20).** Sugargoo: template fixed
    to canonical `/products?productLink=` (from their own login redirect);
    item pages sit behind Sugargoo's login wall — retest while logged in,
    then flip `verified: true`. **Sugargoo signup was failing for Kyle on
    2026-07-20 — COME BACK TO THIS.**
  - **Superbuy affiliate APPROVED (2026-07-20), account `wenselllc`.**
    Invitation code: **888c9Y**. Bronze tier (V2), 14k xp to Silver. Bonus on
    associated users' parcel totals, settled monthly on the 1st, withdraw
    anytime (paid within 10 working days), CNY. **`partnercode` param
    CONFIRMED and wired** (signup template verified live with trailing
    slash). Env for deploy: `VITE_CREDENZA_REF_SUPERBUY=888c9Y`.
  - **Fansbuy affiliate ACTIVE (Kyle's, 2026-07-21). Signup link VERIFIED end-to-end (Agent sheet "Test sign-up link" reproduces his exact invite URL).** Raw invite code:
    **Fans-VmXrpx91** (base64'd at link-build time). Weidian item template
    confirmed live: `fansbuy.com/item-micro-<itemID>.html?url=<encoded>` —
    Weidian only; taobao/1688 path prefixes unknown (fail open until
    observed). Referral is signup-only: `fansbuy.com/register?invite=`.
    Env for deploy: `VITE_CREDENZA_REF_FANSBUY=Fans-VmXrpx91`.
  - **CSSBuy RETIRED (2026-07-20):** blocks USA purchasing-agent service
    (legal reasons, forwarding only). Entry kept with `retired: true`.
  - Agent registry is now: superbuy ✅, kakobuy ✅, fansbuy ✅ (Weidian),
    sugargoo ⏳ (template fixed, needs logged-in retest; signup was failing
    for Kyle on 2026-07-20 — COME BACK TO THIS), cssbuy 🚫, + Direct.
- Still unshipped: A3 pipeline board, A4 body profile, A5 QC GL/RL, A6 weight
  estimator.
- **Mobile-fix loop shipped (2026-07-22), branch `mobile-fix-loop`:** S1 tap
  targets (528de1f) · S2 contrast tokens (34e2ef6) · S3+S4 opaque sheets /
  carousel clearance / hero collapse (f1db97d) · S5 mobile detail sheet +
  platform vocabulary (93d7fa6) · S6+S7 carousel status chips + Stash-first
  bottom bar (41cf488). 104 tests green at every step; WebKit/iPhone harness
  verification per step; fresh shots in docs/mobile-shots/. Revert: `git
  checkout pre-mobile-fix-2026-07-22` (or drop the branch). Colorway (S8):
  four mockup directions presented to Kyle in-chat — DO NOT recolor until he
  picks. Parked Qs: Remove pattern OK as ⋯+undo? hero-collapse copy OK? dots
  cap? Superbuy first-Buy hint?
- **Mobile UX audit round 2 (2026-07-22): see `docs/mobile-improvement-plan.md`**
  — 12 quick wins + 5 component changes + 8 sequenced steps (S1–S8), all
  carousel-freeze-safe and Monetization-compliant. Headliners: grid card-back
  notes are touch-unreachable (flip is keyboard-only, jsx:8689); grid detail
  expands crushed in a half-width column with Buy buried; `--cz-faint`/
  placeholder fail WCAG in BOTH themes; hero eats ~45% of first viewport;
  coarse-pointer 44px allowlist misses heart/star/chevrons/dots/morphs.
  6 open questions for Kyle at the end of the plan (colorway direction, hero
  collapse, card vocabulary, dots, Remove pattern, silent Superbuy default).
  V3-SPEC.md formally retired as design reference. Fresh WebKit shots
  regenerated in `docs/mobile-shots/`.

## 2. Decisions made by Kyle (2026-07-20) — do not re-litigate

1. **Affiliate programs signed up: NONE yet.** Kyle to sign up for Superbuy +
   Sugargoo (public programs; commission is on shipping fees, not items).
2. **Credenza-referred default agent: ACCEPTABLE.** Soft default with visible
   "change anytime" + FTC disclosure line near Buy.
3. **Legal: Arizona, USA.** Form AZ LLC (~$50, no annual report) before first
   revenue. Positioning risk level chosen: **low-moderate** — monetize the
   freight-forwarding referral, NEVER promote/rank specific replica items
   (that is the Nike v. Eben Fox / Pandabuy-influencer fact pattern).
4. **Product scope: fashion-only** (not a mode of generic Credenza).
5. **Carousel/visual polish is FROZEN** until A1–A3 ship (per Monetization doc
   kill criteria).
6. **Mobile: work from the audit list** (below), not a screenshot-driven pass.
7. **Cloud sync: Supabase** (magic-link auth, Postgres + RLS, QC photos in
   Storage buckets — also fixes localStorage quota pruning). Pro gates in
   order: multi-device sync → QC vault caps → share hauls → backup.
8. **Time budget: ~20 hrs/week.**

## 3. Build order (agreed)

| # | Workstream | Est. | Why |
|---|---|---|---|
| ~~0~~ | ~~Commit pending tree as checkpoint~~ | ✅ done | a2eda2f |
| ~~1~~ | ~~A2 agent registry + affiliate Buy + click analytics~~ | ✅ done | d400dae (local only — do not push/deploy without Kyle) |
| ~~2~~ | ~~A1 Reddit haul paste → N cards~~ | ✅ done | 5fe1427 (local only) |
| 3 | ~~Mobile-first pass (audit list, §5)~~ | ✅ done | 3e3a4ac…e0f84f0 — phone check accepted by Kyle ("good enough for now") |
| ~~3b~~ | ~~**DEPLOY**~~ | ✅ done | https://credenza-kyle.netlify.app live 2026-07-21; affiliate env vars set; smoke tests pass |
| 4 | A3 pipeline board + A5 QC GL/RL | 4–5 d | retention loop — **NEXT** |
| 5 | B4 parcel mode (weight → ship handoff, referral-attached) | 2–3 d | highest-$ affiliate surface |
| 6 | Supabase auth+sync + Stripe Pro | 1–2 wk | recurring revenue |
| 7 | A4 body profile (tiers: fit math → 2.5D SVG → lazy 3D mannequin at Pro launch), A6 weight estimator | — | decision quality; A4 tiering agreed 2026-07-21, see Monetization.md §A4 |

## 4. Research findings (2026-07-20, sourced in session transcript)

- **Superbuy affiliate:** public, tiered 1–8.5% of referred shipping fees,
  monthly redemption; new users get ¥560 coupon bundle (onboarding hook).
- **Sugargoo affiliate:** public affiliate center, pays on parcel shipping
  fees, settles 1st of month, **20 active users minimum to withdraw**, CNY.
- **CSSBuy/Kakobuy/Hoobuy/CNFans/ACBuy:** programs exist; sign up + ask.
  JadeShip runs affiliate links to ~30 agents with disclosure "commission only
  for freight forwarding" — the precedent for our low-moderate risk lane.
- **No public agent APIs.** Automation ceiling = deep links (URL templates),
  export/checklist, 17Track deep links. Do NOT scrape order/parcel flows.
- **Stripe:** counterfeit goods prohibited; "shopping organizer SaaS" copy
  passes — keep ALL marketing copy replica-free. FTC affiliate disclosure
  required (site page + near-Buy line).
- **Marketing channels ranked:** SEO ("taobao haul organizer" etc.) → haul
  creators (TikTok/YouTube, they already run referral codes) → Discord tool
  channels → share-haul viral loop (B6) → Reddit only as a person / via
  modmail approval. Never spam r/FashionReps.
- **Kyle's non-code actions this week:** ~~form AZ LLC~~ **DONE (already has an
  Arizona LLC — 2026-07-20)**, ~~sign up Superbuy~~ **DONE — approved, code
  888c9Y (`partnercode` param confirmed, wired into agents.js)**, sign up
  Sugargoo (signup was failing 2026-07-20 — retry), book 1-hr IP attorney
  consult (~$300–500).
- **w2cspreadsheet KOL program (scouted 2026-07-20, Kyle has account
  /k5wshn):** validates our Agent-sheet design (per-agent invite codes +
  site-default backfill = our env default + prefs override). Money still
  settles at the agent backends. Their "high-intent user" bar (5+ valid
  agent redirects on distinct products within 7 days) is a north-star metric
  our outbound log can already measure. **Agent candidates from their list:
  LoongBuy (paying for placement), Oopbuy.** Strategic call: don't promote
  it — it funnels Kyle's audience to their catalog; keep as telemetry only.

## 5. Mobile audit list — ✅ ALL SIX DONE (2026-07-21, commits 3e3a4ac → e0f84f0)

1. ~~Only ONE breakpoint~~ — `.cz-shelf-grid` had NO base rule (non-section
   card view was 1-col block everywhere); now 2 cols phone / 3 ≥768px /
   4 ≥1100px for both shelf grids; killed ≤700px 1-col override.
2. ~~Hover-gated features~~ — haul cover fan rests half-fanned on coarse
   pointers; carousel corner fan already tap→gallery; photo delete buttons
   verified always-visible.
3. ~~Carousel desktop-only~~ — first load below 768px defaults to the grid
   ("cards"); carousel untouched on desktop (jsdom = 1024px, tests safe).
4. ~~Holographic cursor bg~~ — new `useCoarsePointer()` hook freezes BOTH
   rAF backgrounds (cursor-follow + drifting moons) on touch/≤767px.
5. ~~Fixed-width chrome~~ — modals are bottom sheets ≤767px (full-width,
   rounded top, 88dvh cap, safe-area); totals row wraps; capture pill
   already stacked.
6. ~~Import flow~~ — all inputs 16px on touch (no more iOS focus-zoom);
   Import sheet is now a bottom sheet with stats preview.

**Phone verification (2026-07-21):** Kyle loaded his real shelf on his phone via
Import → backup restore (export on desktop, AirDrop, restore on phone) and
accepted the result — "good enough for now, we can fix more later."

**Playwright mobile harness (2026-07-21):** `preview/scripts/mobile-shots.mjs`
— WebKit (real Safari engine) + iPhone 15 Pro emulation, seeds the shelf from
a backup export into localStorage, shoots 5 states (first-run grid, scrolled
grid, carousel, import sheet, agent sheet) into `docs/mobile-shots/` (not
committed). Run: `node scripts/mobile-shots.mjs [baseUrl] [backupJson]`.
This immediately caught TWO real bugs Kyle's phone check missed:

1. **WebKit mirrored card backs (CRITICAL, fixed 2026-07-21):** WebKit ignores
   `backface-visibility` on non-composited faces — Safari painted every card
   BACK mirrored over the front (grid + carousel). Empirically ruled out:
   self-`perspective()`, `will-change`, `translateZ(0)` — none help.
   Fix: manual visibility culling. Grid cards: state-driven `visibility` +
   `visibility 0s 80ms` in the flip transition (swap at edge-on). Carousel:
   `flipped || !frontFacing` / `!flipped || frontFacing` (see
   carousel-canonical-state.md addendum). 4 A2 tests updated to flip the card
   before querying back controls (matches real UX; visibility now affects the
   a11y tree).
2. **Dead `mode === "dark"` checks (fixed 2026-07-21):** themes are `light` +
   `rainbow` ONLY, so `mode === "dark"` was never true — 4 spots rendered
   light-theme variants on the dark UI (worst: white price pill + white text =
   invisible prices on the default theme). All 4 flipped to `mode !== "light"`.

## 6. Known hygiene debt

- 1 lint error (`performance` browser global config) + 65 warnings.
- Light theme never verified (all 2026-07-18 verification was dark-only).
- `resolve.js` / `preview.js` (SSRF guards!) and `parseImport` have no tests.
- Extension renders generic v3, not fashion.
- `credenza-fashion.jsx` is 9.4k lines — expect friction; don't split it
  mid-feature, split when touching a region.

## 7. Context protocol for agents in this repo

- Read this file first; read `docs/Monetization.md` before feature work;
  read `docs/carousel-canonical-state.md` before touching the carousel.
- Update §1–§6 as decisions/state change; bump "Last updated".
- If context feels >60%, STOP new work and checkpoint here first.
- Manual `/compact` at 60–70% — auto-compact does not fire reliably under
  the Kimi/proxy setup (known harness issue).

## 8. Multi-agent lane rules (Claude + Grok Heavy, set 2026-07-20)

Two AI tools work on this project. **This file is the ONLY coordination
point** — both agents read it first and write to it; hooks/memory only exist
on the Claude side.

- **Claude (this harness):** owns ALL code implementation, tests, deploys,
  and canonical docs (`session-state.md`, `Monetization.md`,
  `carousel-canonical-state.md`).
- **Grok:** research, SEO/keyword maps, competitor teardowns, copy drafts,
  community summaries, test-case ideas, and **read-only code review** of
  Claude's diffs. Output goes to `docs/grok/` (new folder) or chat — never
  directly into app source files.
- **Hard rules:** never two agents editing the same file; `credenza-fashion.jsx`
  and `credenza-fashion.css` are Claude-only; the carousel is frozen for BOTH
  agents (see `carousel-canonical-state.md` — a past portal-morph attempt by
  another AI tool is exactly the failure these rules exist to prevent).
- If Grok ever needs to write code: separate branch, separate new files only,
  Claude reviews the diff before merge.

## 2026-07-21 — S8 colorway: Gallery + Blackout replace Horizon/Moonwalker (Kimi lane)
- Kyle picked from the S8 mockups: **Gallery** (light) + **Blackout** (dark),
  full repaint of both PALETTES. Horizon navy and Moonwalker blue-slate are gone.
- Gallery: #F4F4F0 canvas, white cards, ink #17181a, sub #565a61, faint
  #686c73, Buy = solid ink with light text. Blackout: #000000 field,
  #1a1a1d surfaces, ink #f5f5f7, sub #a3a3ab, zero blue cast, Buy = near-white
  with black text. Money green (#15803d light / #4ade80 dark) + heart red
  (#e11d48 / #f40051) are the only hue — now a `--cz-money` token (was 6
  hardcoded #4ade80 in the CSS).
- Every text/icon pair recomputed against the S2 floors (4.5 text / 3 icons):
  all pass, incl. faint on the warm canvas (4.78) and selection overlays.
- `colorScheme` is mode-aware again (`light`/`dark`) — the S2 "always dark"
  literal was only correct while both themes were dark. iOS theme-color meta
  follows (#F4F4F0 / #000000). Ambient backgrounds repainted neutral
  (Gallery paper blooms, Blackout neutral moons — no more slate/steel).
- Verified: 104 tests, tsc, build green; WebKit shots of both themes on
  iPhone + 1440px desktop in docs/mobile-shots/colorway-*.png.
- Known leftover (pre-existing, not a regression): carousel card headers
  still say "READ" — S5's platform vocabulary only reached the grid TypeMark.

## 2026-07-21 — Kyle feedback pass + size recommendation v1 (Kimi lane)
- **Kyle pass (8c00fa1):** mobile grid cards redesigned (edge-to-edge 3/4
  photo, no squeezed link row, price pill on the photo, seller hyperlink);
  app-level PhotoCoverFlow so grid/detail photos open + swipe on phones
  (was carousel-view only); thumbnail taps open the album instead of
  silently swapping the cover; duplicate notes sections deduped in
  sheetMode; Restart toast restyled; heart/price-pill collision fixed;
  iOS double-tap smart-zoom killed via touch-action: manipulation.
- **Size pick v1 (3fc532d):** parseSizeChart (labeled CJK/EN rows +
  positional tables, 版型偏大/偏小 + runs big/small hints) and
  recommendSize (chest+ease for tops — shirt 12 / outerwear 16cm — waist
  for bottoms, shoulder/sleeve nudges, run-hint shifts the pick down/up).
  Body profile (height/weight/chest/shoulder/arm/waist/hip, cm) lives in
  the ⋯ menu and persists in credenza-prefs-v1. DetailSheet shows a big
  "Your size: L — runs small, sized up" block above Notes; if no chart is
  on file, "Find size chart" pulls the Yupoo album description via
  fetchYupooImages and caches it into sizeNotes. Shoes/hats/bags/socks
  skip the block (no cm→letter mapping). 16 new tests, 120 total green,
  tsc + build clean, WebKit iPhone verified (pick / pants / no-chart).
- Not deployed — waiting on Kyle's word. Branch: mobile-fix-loop.

# CONTEXT.md — Credenza handoff

Written 2026-08-03 by O (senior planner agent), at Kyle's request, from every
Buzz channel plus the last week of commits. Read this before touching
anything. It replaces `docs/session-state.md` as the current source of
truth — that file stops at 2026-07-27 and is now stale; leave it in place
as history but do not update it.

**Baseline this file describes:** `origin/main` at `fd1222c`
(2026-08-02T18:47:14-07:00). Gate at that commit, verified in a clean
detached worktree: 104 files / 3181 tests pass, typecheck clean, lint 0
errors / 40 pre-existing warnings, `npx vite build` clean.

**Updated 2026-08-07** with the #41 chart-hunt abort loop (§1, §3.1, §5,
§9) and the chart work Kyle has approved but nobody has started (§4).
Gate on the working tree at that update: 147 files / 4096 tests pass,
typecheck clean, lint 0 errors / 61 warnings, `npm run build` clean. That
working tree carries uncommitted work from several agents, so the numbers
describe the tree, not a commit. **Not deployed — only Kyle ships.**

**Updated 2026-08-08** by the Kimi session with the size-chart redesign
program. Full spec: `docs/size-chart-redesign-spec.md` (uncommitted). It
holds every owner ruling, the locked bar geometry, the locked tolerance
bands, the no-chart Fit tab design, and the six-step build order. Summary
entry in §4 below. Nothing is built yet.

## 0. What this is

Credenza: an agent-haul planner for Chinese shopping-agent buyers
(Weidian/Yupoo/Taobao via Superbuy/Kakobuy/Fansbuy/etc). Repo
`github.com/sportskoat/credenza`. Site `credenzafashion.com`. React app in
`credenza-fashion.jsx` + `components/` + `sheets/` + `settings/`, Netlify
functions in `preview/netlify/functions/`, tests in `preview/test/`.

**Hard rules, do not relitigate:**
- No marketplace surface, ever. Credenza never takes money and never checks
  out (`docs/Monetization.md`). Banned copy: "W2C marketplace", "best
  batch", "1:1 replica", "replica retail".
- No paid ads. North star metric is outbound affiliate Buy clicks, not
  page views.
- Privacy promise is public and load-bearing: "Core shelf is local-first
  in the browser." Never add silent server-side tracking. GA4 is the one
  authorized exception (Kyle chose it, `G-2DQSJN43LF`).
- **No em dashes anywhere in rendered site content**, as of 2026-08-02
  (commit `6b5cf34`). Rewrite as a period, comma, or colon. Em dashes are
  still fine in code comments, regexes, and the font license — none of
  those render to a visitor.
- Only Kyle's Mac deploys. Netlify has **no linked git repo**
  (`has_builds: false`) — pushing to `main` ships nothing. A deploy is a
  separate, explicit `netlify deploy --prod --dir=dist` step Kyle runs.
  Merging a PR to `main` is not shipping.
- Never touch: `credenza-storage.js`, `agents.js`, the link resolver
  (`parseImport`, `runImport`, `restoreBackup`, `addSamples`),
  `components/CoverFlowCarousel.jsx` and its physics. Read
  `docs/carousel-canonical-state.md` before going near the carousel at all.

## 1. This week's architecture decisions, and why

**Sizing engine (`credenza-fashion.jsx`, `recommendSize` ~line 1334)**
- Ease bands are per garment-kind and cut, not one flat number
  (`CHEST_EASE_BANDS`, `chestEaseBand`, ~line 1258-1300). A slim knit tee
  wants far less room than an oversized coat. The declared fit in the
  seller's title (`declaredFit(title)`) is the fallback when the customer
  has no saved taste.
- **Waist has a hard physical floor, added this week (#76, `b7069d0`).**
  A non-stretch waistband cannot fit a bigger body than its own number, so
  `primaryFits` used to let a negative-ease waist compete on score anyway
  (a shorts card recommended a Large whose 31.5" waist could not fit
  Kyle's 33" body). The floor now runs *before* scoring: garment waist
  must be ≥ body waist, relaxed by up to 4cm only when the title or chart
  text says elastic/drawstring (regex + Chinese words, mirrors the
  existing `sleeveStyle`/`garmentType` pattern). **Correction that
  followed in the same PR:** the floor must compare raw `garment - body`
  only, never `garment - body - runShift` — folding the "runs big" scoring
  shift into a physical-fact floor let a genuinely-too-small waist sneak
  through. Keep these separate if you touch this again.
- **Length only breaks a tie, never outweighs a chest/waist winner**
  (Kyle's rule, 2026-07-30, still in force). It's a filter over
  already-eligible rows, not a weight — a weight needs tuning and can
  trade a good chest for a good hem at any gap; a filter cannot.
- Ties go to the bigger size (F's rule, 2026-08-01): among rows within
  `TIE_EPSILON` of the true best score, the largest measurement wins.
  Don't compare rows pairwise inside the sort comparator for this — that
  isn't transitive and `Array.sort` gives no guaranteed result. Compute
  the true best score first, then filter.
- The FIT READ table (`components/DetailBody.jsx`,
  `components/SizeRecommendation.jsx`) now draws **three tiers, not two** (#69,
  `f32f05d`): green inside the drafted ease band, amber ("close enough")
  within `FIT_READ_SOFT_DELTA` (4cm) of the nearer edge, red past that.
  Kyle's rule, 2026-08-02: a fit slightly outside range should read as
  "you can get away with it," not a hard fail. The track domain is built
  per-garment from the drafted ideal±span and every size's actual ease —
  a fixed 36/66% CSS band used to pin oversized coats at the same clamp
  regardless of their real numbers.
- Negative ease says "smaller," never "gives you room" (#75, `53661de`).
  `Math.abs(diff)` was hiding the sign everywhere; word by sign now
  (positive = room, near-zero = right at the body, negative = smaller/
  tighter), and "meant to sit" never appends after a negative primary.

**Chart-vision pipeline (`preview/netlify/functions/`, chart-hunt scoring
in `components/size-chart-hunt.js`)**
- Candidate images are scored, never hard-excluded, by aspect ratio shape
  (#82, `f968759`). A real chart at aspect 1.046 (near-square from white
  padding) used to lose the paid-read budget entirely to product shots at
  aspect ≥1.05. Shape is now a ranking signal only: padded-square and
  classic-landscape bands get boosted, banner-strip shapes (>2.2) get
  demoted, but nothing is dropped from the pool by shape alone.
- One paid read is now **reserved** for the first Product-Details photo
  (#83-adjacent, `da84dff`) — some real charts live inside tall portrait
  composites or wide tables that no aspect band can separate from a
  banner ad in the same listing. This raises the reserved slot into paid
  slot 2 if it isn't already top-3 by score; total paid reads per item
  stay ≤3 (the reservation displaces the third score pick, never adds
  cost).
- **CHART_CAP_REACHED is now a distinct sentinel** (`142e113`), separate
  from a genuine failed read. Free-tier daily cap or a server 429 used to
  return `null` from `postChartVision`, indistinguishable from "could not
  read the chart" — so a capped user saw the wrong error and the hunt
  could burn quota it shouldn't have. The sentinel fires before
  `recordPaidUsage`/`bumpUsage` runs.
- A failed photo read (any reason, including the new auth-required case)
  no longer wipes hand-typed chart numbers (#79, `896b6d9`) — the read
  path snapshots typed cells first and restores them on failure.
- **Tonight's real incident:** a 502 storm on chart-vision was
  undiagnosable from logs (#83, `f1e1540`) — both failure paths swallowed
  their real error and returned bare `null`. Two verification rounds
  burned time guessing wrong causes (CDN hotlink block, aspect-filter
  ranking) before direct production repro plus new instrumentation
  surfaced the actual cause: **the Anthropic API key has hit its
  account-level usage ceiling until 2026-09-01** — a billing/quota issue,
  not a code defect. See §3.
- **The hunt cancelled its own read, ~1×/second (#41, 2026-08-07,
  `components/DetailBody.jsx` `useChartHunt`).** A Yupoo album card never
  filled its FIT READ table. Every stage was healthy in isolation — the
  live `/yupoo` call, the chart photo, `rankChartCandidates` (score 88),
  the live `/chart-vision` read (`found: true`), and `parseSizeChart`.
  The hunt effect simply restarted before any read could finish: 21 read
  attempts in 30s against a `MAX_PAID_CANDIDATES` of 3, none completed.
  **Cause: three effect dependencies were rebuilt on every parent render**
  — `onSaveEdit` is a plain arrow in the App (`credenza-fashion.jsx:8275`,
  no `useCallback`), `item` comes from a fresh `items.find(...)`
  (`:11211`, not memoized), and `shelfItems` is the whole `items` array.
  The indexing ticker (`:9351`, a 100ms `setInterval`) re-renders the App
  ~10×/s, so the effect tore down and re-ran constantly, and its cleanup
  called `controller.abort()` on the read in flight each time. It hit
  album hunts hardest because that branch is the slowest — it can chase a
  Yupoo album's `buyUrl` to Weidian via `fetchDescImages` — so it lost
  every race. **Fix: hold `item`, `onSaveEdit` and `shelfItems` in refs;
  depend only on `[enabled, hasChart, itemId, huntFp, huntStamp]`** —
  scalars that change when the item really changes. `hasChart` is a
  boolean because `verdict.chart` is a fresh `parseSizeChart` object each
  render. **Do not re-add those three to the dependency list.** The
  `chartHuntTried.add()` claim deliberately stays AFTER the await
  (2026-07-25 rule): an aborted hunt must not strand the card on "Looking
  for the seller's size chart…" forever. Moving the claim earlier is not
  a substitute for stable dependencies — with an unstable list, the
  cleanup releases the claim and the next re-run takes it again, and the
  loop survives. Pinned by `preview/test/chart-hunt-restart.test.jsx`,
  which re-renders the card 10× and asserts one hunt and an unaborted
  signal; reverting the dependency list makes it fail 11-calls-vs-1.
  **Lesson for this file: an effect that spends money must not depend on
  anything the parent rebuilds per render.** Audit before adding a
  dependency to any paid-read effect.

**Settings / measurements (`sheets/BodyProfileSheet.jsx`, shipped
2026-08-01 in the Settings redesign, `47e3596`)**
- Two measurement modes: "Your body" and "A garment that fits," stored
  separately (`profile.chest` etc. vs `profile.garment.chest` etc.,
  `measureMode` flag). **As of tonight, `recommendSize`/
  `effectiveBodyProfile` never read `profile.garment.*` at all** — the
  garment-mode tab saves data but it has zero effect on the size pick.
  Kyle asked about this directly (general channel, thread `a31c1176`,
  2026-08-02) and considered removing body measurements in favor of
  garment-only. Ruling: **keep body measurements as the primary input,
  do not remove them** — a reference garment only teaches fit for its own
  category (an oversized crop tee can't tell you how a blazer should
  fit), while body measurements work for every category via the ease-band
  system above, and a new customer may have no matching garment to
  measure at all. Garment-mode is left reference-only for now; wiring it
  in as a per-category taste signal is scoped but not started (see §4).
- Added a body-measurement explainer paragraph (this session, PR #73,
  merged, then touched again same day by the em-dash sweep + font-size
  bump, `6b5cf34`): shown only in "Your body" mode, reminds the customer
  these are body numbers, not their usual garment size label — calls out
  chest, waist, hip, and trouser length by name since customers conflate
  body waist with pants-size labels.
- **Known layout bug I (O) introduced and fixed in the same ship:** the
  bug-4 container-query fix at `credenza-fashion.css:7980` originally
  copied a whole `@media(900px)` block wholesale, including
  `.cz-sizes-group-body{flex-direction:column}`. That bundled two
  unrelated concerns — Tops/Bottoms column-count layout vs phone-only
  stacking — under one threshold, and stacked the diagram above the
  fields on the desktop floating card where there was room for
  side-by-side. Fixed by splitting the container query so only the
  group-count layout stays there; the phone-stacking rule moved to a
  plain `@media (max-width:767px)` block. **Lesson: when converting a
  media query to a container query, check every rule inside the block
  answers the same "is this container narrow" question** — a block can
  silently bundle two different thresholds.
- A second, similar bug landed and was fixed this week (#80, `aee2ae5`):
  `.cz-sizes-group-body` kept `align-items: flex-start` in both
  column-stacking breakpoints, so the widest content (a one-line focus
  tip) re-widthed every row every time the tip text changed on focus.
  Fixed to `align-items: stretch` in the column-stacking blocks only.

**Onboarding — first-size chooser (#81, `4269d17` + `c91d810`, shipped,
Kyle reviewed and said go 2026-08-02T23:38:36Z)**
- New visitor pastes a link, hits an empty profile: a three-way chooser
  now replaces the dead-end fit block — **Guess** (two taps: usual
  letter, then how a tee should sit — anchors on the seller's own chart
  via the *same* `chestEaseBand`/looseness domain, no parallel ease
  system), **Match** (brand-data, disabled/coming-soon, Phase 2 not
  started), **Measure** (one chest number, doubled, saves and re-scores
  the whole shelf). Skip is the Fix-0 honest empty state, asked once per
  visit, fully local, works signed out.
- Fix 1 same day: the Guess path on a **no-chart** card used to promise
  "we'd keep your usual size" then dead-end anyway. `guessSizeFromUsual`'s
  no-chart branch now completes into a real pick tagged
  `firstSizeSource: "usual-no-chart"`, distinct from the chart-anchored
  `"usual-fit"` class.
- Phase 3 (a size "ladder" card) is deferred, not started, no file
  touched yet.

**Modal/layer plumbing (older, still load-bearing — `docs/session-state.md`
2026-07-27 entry, unchanged since):** `components/useBodyScrollLock.js` is
the *one* module-scope, reference-counted body-scroll lock. Every modal
used to save/restore `document.body.style.overflow` privately, and two
open layers would race on close. `ModalShell` and `DetailSheet` both use
the hook now — **any new modal must use it too, never a private overflow
effect.** `ModalShell`'s sub-page stack has no measurement left
(`ResizeObserver`/`useLayoutEffect` removed) — it holds one stable
`maxWidth` from props.

**Category inference (`fd1222c`, tip of `origin/main` right now)** — a
listing's colorway was showing where category should. Root cause: when
`resolve.js` returns `""`/`"other"` (opaque/truncated Chinese titles),
nothing tried again client-side. `refineItemCategory` now re-runs
client-side whenever category is empty/"other": checks for ≥2
size-token-shaped variants first, then re-runs `guessFashionCategory`
against the untruncated title + summary + notes + variant names combined.
A confident server category or a manual pick is never overridden.

## 2. Motion / UI system in force

`transitions.dev` motion tokens are the standard, not ad-hoc durations:
`t-modal` (desktop card open/close, #68, `c13d89f`: 250ms scale 0.96→1
open, 150ms scale→0.96 close, `cubic-bezier(0.22,1,0.36,1)`), `t-acc`
(accordion pickers, #71, `cbb93a1`: 250ms, same easing, `grid 0fr↔1fr`).
Shelf/Hauls view switch (#72, `8e50206`) now shares the same
`AnimatePresence mode="wait"` fade+scale as the shelf filter chips — a
prior version unmounted with no exit and never animated. `initial={false}`
on first load; in-shelf switches never remount and stay instant.

## 3. Current known bugs / live blockers

1. **Chart-vision paid reads are capped platform-wide right now.** The
   Anthropic API key backing chart reads hit its account usage ceiling;
   it does not reset until **2026-09-01**. This is a billing issue on
   Kyle's Anthropic account, not a code defect — do not spend time
   debugging chart-read failures as a code problem without first
   confirming this ceiling has lifted. **Second reason to check before
   debugging:** until 2026-08-07 the hunt aborted its own reads on a loop
   (#41, §1). If you are reading an older report of "chart reads never
   finish", that was the cause and it is fixed.
2. Two pre-existing test flakes, both documented, both pass in isolation:
   `fashion-app.test.jsx` "Desktop sizing destination" (order-dependent),
   and one `toast-chrome` flake. Neither is new; don't chase them as
   regressions.
3. `preview/test/public-site.test.js` reads `dist/` directly — running
   the suite in a worktree with no prior `npx vite build` reports 2 false
   failures at a perfectly good commit. **Always build before testing.**
4. Shorts length note is an estimate with no warning: 裤长 (the seller's
   printed number) is outseam, not inseam, and the chart parser has no
   thigh label at all. Pre-existing, still open, no owner assigned.
5. `CREDENZA_DAILY_COST_CAP_USD` is still `1.50` in Netlify, not raised to
   `25` — F flagged this before the signin-gate ship, Kyle has not acted
   on it. `checkDailyCap` (`preview/netlify/functions/lib/limit.js:229`)
   fails **open** when Supabase doesn't answer, so each warm serverless
   instance falls back to its own in-memory $1.50 ceiling independently.
6. `/learn/` returns 404 — no such page exists; the real nav has six
   links (`/how/ /guides/ /pricing/ /faq/ /support/ /contact/`). Not a
   regression, just don't "fix" a page that was never supposed to exist.
7. Only 3 of 11 shopping agents in the app pay Kyle affiliate commission
   today (Superbuy, Kakobuy, Fansbuy). The other eight are self-serve
   sign-ups per `docs/agent-api-outreach.md`, not yet done.
8. `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` were, as of the last growth
   review, the "top production gap" — without them a pasted Reddit post
   link fails signed-out on the live site. Verify current status before
   assuming this is still open; it was flagged in an older growth-channel
   review, not this week's engineering work.

## 4. Half-finished work, exact state

- **Size-chart redesign program** (2026-08-08, Kimi session, spec at
  `docs/size-chart-redesign-spec.md`). Approved by Kyle
  across two days of debate with five model lanes. Locked rulings that
  override earlier notes in this file: green stays for the recommended
  size, motion stays (shimmer and bar entry animation), one tap saves a
  size and the last tap wins (verified in the live app with Playwright:
  the tap persists `item.size` across reload, no confirm step, and Kyle
  ruled this stays). **Steps 1–3 SHIPPED 2026-08-08 in commit `d514f4d`**
  (gates from `preview/`: build, 4108 tests, lint 0 errors, typecheck;
  Playwright screenshots in `/tmp/cz-debate/`: `size-area.png`,
  `table-calm.png`, `busy-hunt.png`, `busy-read.png`, `shoe-pick.png`).
  Shipped: (1) garment-centered ease bars per the approved mockup plus
  locked tolerance bands, a pinned "Your size" line, a calm chart table
  row (inset marker + "Recommended" tag instead of the inverted fill),
  grey fit ladder; (2) loading states — the whole size section hides
  behind one honest status line ("Looking for the size chart photo…" /
  "Reading the size chart…"), the pinned line stays; (3) the no-chart
  Fit tab pick screen for SIZED categories — first line ("No size chart
  for this one yet." or the tier-2 no-measurements line), the saved
  usual, chips in the LISTING's scale (shoe chips show both systems,
  "EU 43 · US 10", and `extendShoeRun` in `credenza-fashion.jsx` extends
  the run to cover the buyer's converted usual), helper "Pick a size.
  It's saved on this card for when you order.", and the two Settings
  chart-entry actions. Green only means money or a recommendation: the
  pinned line is green only for a chart-based pick (`.cz-your-size.is-rec`).
  **Still open:** step 4 (photo fallback so a found chart photo always shows even
  when the parse fails); step 5 (cheap vision pre-check); step 6
  (deferred items). Accessories shipped 2026-08-08 in commit `e72fd79`
  (Kyle picked the words: "One size only. The photos show how big it
  is."). Same commit: the pick screen's chips no longer re-window on
  every tap (full sorted run; Kyle: "buttons shift around in weird
  locations"), and a hand pick that is not the saved usual names the
  usual in one gap-note line (Kyle: "measurements say 10, fit detail
  clocks me as a 9"). Shoe pairing stays on the dress chart (+33) —
  Kyle's call over the sneaker chart (+34). The size does NOT go to the buying
  agent; Kyle rejected clipboard and per-agent link ideas on 2026-08-08,
  so helper copy must never claim otherwise. Note the overlap with the
  contact-sheet and cache-miss entries below: those are pipeline-side
  approved work, this program is display-side plus the pre-check; the
  pre-check (step 5) and the contact sheet solve the same ranking
  problem, so build one, not both, and ask Kyle which.

- **Garment-mode measurements not wired to sizing** (§1 above). Scoped
  direction if resumed: ask what kind of reference garment it is
  (fitted/regular/oversized), use it as a **per-category** taste signal
  layered on top of body measurements — never a replacement, never
  cross-category (a tee reference must not set blazer ease). Kyle has
  not asked for this to be built; it's parked, not queued.
- **Mobile handoff tasks 5 and 6** (pane picker, fit read), phone-only
  behind a 767px gate. Spec: `PLANS/mobile_handoff_2026_07_30/README.md`
  in the Buzz workspace (not the repo). Not started as of this writing.
  After building, the plan calls for desktop screenshots with the gate
  removed locally, then the gate restored before commit.
- **Yupoo album link fix**: album name should be a clickable link that
  opens the album (Kyle, `#design` channel, screenshot referenced
  `2fb2d99f`; example album
  `https://mook-official.x.yupoo.com/albums/239021655?uid=1`). Also fix
  the "7 photos / 20 more" count mismatch on the same surface. Not
  started.
- **Phone carousel**: Kyle approved adding it back. `openHaul` currently
  keeps the grid (not carousel) below 767px *by design*
  (`credenza-fashion.jsx:6927`) because Kyle got stranded in a glitching
  carousel on 2026-07-25. Read `docs/carousel-canonical-state.md` and
  `docs/carousel-session-summary.md` before touching this — it's the one
  file class under a standing "never touch without reading first" rule.
- **Lighten Carousel/Grid switch + Stash button** (only those two;
  `credenza-fashion.css:4167`). Buy button stays black `#17181a` — Kyle's
  explicit "option A." Not started.
- **Moving dashes in the size panel** — assigned to Kimi via Fable,
  status unconfirmed as of this writing.
- **Stronger false-chart detection** — research only, no design or code
  started.
- **Shared chart cache banks hits but not misses** (Kyle approved the fix
  2026-08-07, not started). `preview/netlify/functions/chart-vision.js`
  saves a found chart against the photo fingerprint
  (`lib/chart-image-key.js`), so the whole customer base reads any given
  photo once — that part works. But the `!result.found` branch (~line 528)
  returns `{found: false}` **without writing anything**, so every customer
  who opens the same chartless photo pays for the same negative answer
  again. Kyle's decision, in his words: "Remember it, but re-check after a
  while" — bank the miss, share it with everyone, expire it after some
  months (a seller can add a chart later). Touches `chart-vision.js`,
  `lib/entitlement-store.js` (`loadChartText`/`saveChartText`), and needs
  a schema change alongside `docs/sql/2026-08-05-chart-cache.sql`. Note
  the per-item `sizeChartHunt` stamp is a *different* mechanism — that one
  is per-customer and already works; this is the cross-customer gap.
- **Contact sheet for chart location** (Kyle's idea, approved in
  principle, ordered after the cache work). Today the hunt pays to read up
  to 3 full-resolution photos one at a time, hoping one holds the chart.
  Instead: build one low-resolution numbered grid of all candidates, ask a
  cheap model which number is the chart, then read that one original at
  full resolution. Published names for this are **localize-then-crop** and
  **Set-of-Mark prompting**. Kyle's framing: "if you screenshot the entire
  page you'd know where the chart is instead of looking at every single
  photo." Note what two independent model lanes rejected in the same
  debate: **full-page browser screenshots as the default** (they shrink
  chart text below readable size, do not beat Taobao's bot wall, add
  browser startup cost per import, and full-page pixels defeat the shared
  cache, which keys on a stable photo URL). The contact sheet keeps the
  idea without those costs, because it still ends by reading an original.
- **Source coverage is the real chart weakness, not ranking.** Both model
  lanes in the 2026-08-07 debate reached this independently. Confirmed
  gaps, each verified in code: `reddit.js` returns text only — no images
  and no comments, where chart screenshots usually live; Taobao
  description photos stay unreachable server-side (every mtop gateway
  answers RGV587 anti-bot, `resolve.js:322`). Prefer widening sources over
  further tuning `scoreChartCandidate`.
- **GA4 custom dimensions** (agent, marketplace) and a decision on
  rotating the exposed GA4 key ("replace or later") — both waiting on
  Kyle, not blocked on engineering.
- **Trouser length / Shorts length re-save in Settings** — old inseam
  values are intentionally ignored after a schema change; Kyle needs to
  re-enter them once. Waiting on Kyle, not a bug.

## 5. Things tried and rejected — do not retry

- **Guessing a root cause before adding error logging.** The chart-vision
  502 storm (§3.1) cost two full verification rounds guessing (CDN
  hotlink block, then aspect-filter ranking) before anyone added
  `console.error` at the swallow sites. Instrument first next time a
  silent failure shows up.
- **Full account-credential automation for third-party agent sites**
  (raised in `#outreach`): auto-buying and auto-checking QC photos on
  Mulebuy, and DM automation on X, were both explicitly declined. Neither
  has a real API; both would require storing the user's password/card and
  would break on every page redesign. Categorized as an account-ban and
  fragility risk, not a judgment-automation risk — don't reopen this as
  "just needs guardrails."
- **Copying a whole `@media` block into a container query** (§1,
  Settings). Bundles unrelated concerns under one threshold. Split by
  what question each rule actually answers.
- **Playwright `newContext({ viewport })` for phone-only CSS gated on
  `pointer:coarse`.** The default context has a mouse pointer, so any
  `@media (pointer:coarse)` gate never matches and every "phone" shot
  silently renders the desktop layout. Use `hasTouch: true`.
- **Static HTML probes for this app.** Theme values and a lot of layout
  come from JS inline styles, not CSS alone — a static probe passes
  green on a broken live page. Drive the real dev server with Playwright.
- **Trusting a teammate's stated test count without re-running at the
  exact commit.** A hand-merge once left the same pill test duplicated
  under one name, and the rising test count read as "new coverage"
  instead of a duplicate. Always `git status --porcelain` in the same
  shell you ran the suite in, and grep for duplicate `describe()` names
  after any hand merge.
- **Treating "0 files uploaded" from `netlify deploy` as an error.** It
  means the asset already exists in Netlify's CDN store from an earlier
  deploy of the same commit — production still points at the new deploy.
- **"Fixing" the `useChartHunt` dependency list to satisfy
  `react-hooks/exhaustive-deps`.** Adding `item`, `onSaveEdit`, or
  `shelfItems` back restores the #41 abort loop exactly (§1). The rule is
  `warn`, not `error`, in `eslint.config.js`, and it does not currently
  flag this hook. The refs are the mechanism that keeps those values
  fresh. If you must satisfy the rule instead, the correct fix is
  upstream: `useCallback` on `saveEdit` (`credenza-fashion.jsx:8275`) and
  `useMemo` on `detailItem` (`:11211`) — not a wider dependency list.
- **Blaming the seller, the host, or the reader when a chart never
  arrives, before checking for a restart loop.** During #41 every stage
  tested healthy in isolation and the card still showed nothing. The
  cheap first check is the abort pattern in the browser console: a
  repeating `REQ` / `ABORT cancelled` pair about once a second means the
  effect is restarting, not that the read is failing.

## 6. Naming & workflow conventions

- CSS classes: `cz-` prefix throughout (`cz-sizes-*`, `cz-limit-pill`,
  `cz-modal-*`). Custom properties: `--cz-*` design tokens
  (`--cz-sub`, `--cz-faint`, `--cz-hair-strong`, etc.) — see
  `.claude/skills/credenza-design/tokens/`. Lint enforces no raw px
  values outside tokens (`no-restricted-syntax`); the 40 standing
  warnings are pre-existing exceptions, not something to "fix" in an
  unrelated PR.
- Directory split: `components/` = shared app surfaces, `sheets/` =
  modal/sheet overlays (`BodyProfileSheet.jsx`, `LimitsSheet.jsx`,
  `ImportSheet.jsx`), `settings/` = the one-page Settings shell's section
  components (`SizesSection.jsx`, `AccountPlanSection.jsx`, etc).
- Tests: `preview/test/*.test.jsx` (component) / `*.test.js` (logic).
  Probes/screenshots: `preview/scripts/probe-*.mjs` (assert something and
  print pass/fail) vs `shot-*.mjs` (just capture screenshots for human
  review) — both run against a locally started `vite --strictPort` dev
  server, never a static build.
- Commit convention this week: Conventional-Commits-ish subject lines —
  `fix(scope): what changed (#NN)` / `feat(scope): what changed (#NN)`,
  scopes seen: `chart`, `sizing`, `settings`, `category`, `copy`,
  `onboarding`, `auth`. Every commit carries **both**
  `Co-authored-by: Kyle Wensel <kylejwensel@gmail.com>` and
  `Signed-off-by: Kyle Wensel <kylejwensel@gmail.com>` trailers.
- PR review pattern in the logs: an agent named **F** (Fable) approves at
  a specific commit before merge and the merge commit records "F approved
  at `<sha>` (build clean, N files/M tests, typecheck clean, lint 0
  errors/40 warnings, zero conflicts vs main)" — then the merging agent
  independently re-verifies the same gate in a clean detached worktree
  before the actual merge. Follow this pattern for any non-trivial PR.
- Repo docs use `Title-Case-With-Dashes.md` under `docs/`
  (`Market-Launch-Review.md`, `Monetization.md`). The **Buzz workspace**
  (outside the repo, `/Users/kylewensel/.buzz/`) uses
  `ALL_CAPS_WITH_UNDERSCORES.md` under `PLANS/`, `GUIDES/`, `RESEARCH/`.
  Don't confuse the two when a plan references "the doc."
- Worktree hygiene: always `git worktree list` and `git branch -v` before
  starting a lane — multiple agents run in parallel here and duplicate
  work has happened more than once. Detached worktrees under
  `/Users/kylewensel/.buzz/.scratch/<name>` are the convention for
  throwaway verification/deploy checkouts; named checkouts like
  `/Users/kylewensel/credenza-<feature>` are longer-lived feature
  branches some agents keep around.

## 7. Deploy & ops facts

- Deploy is `npx netlify deploy --prod --dir=dist --site
  d5dbe760-ea61-4603-be4a-0435e08e707a`, run only from Kyle's Mac, only by
  hand, only after `npx vite build` → `npm test` → `npm run typecheck` →
  `npm run lint`, all from `preview/`, in that order (build before tests,
  or the two `dist/`-reading tests false-fail).
- Netlify deploys are free — no linked git build, so 81 deploys in a
  month cost nothing in build minutes. Batch for **coherence**, never for
  cost: land everything on `main` first, one deploy carries all of it.
- Billing is proven live: a real Stripe card purchase on 2026-07-30
  produced `sub_1TykPcGohjT4jvVx8zcKZqHf` (weekly $2.49, trialing), the
  webhook landed, and `limitsFor()` computes entitlement from live status
  — the stored `record.limits` field is dead data, ignore it if you see
  it in a row.
- `REQUIRE_ACCOUNTS=true` is in force in production.

## 8. Business/growth state (from the non-engineering channels)

Kept brief — a coding agent mostly needs to know these exist, not their
detail:
- `PLANS/CREDENZA_GROWTH_WORKFLOWS.md` and
  `PLANS/CREDENZA_100_VISITORS_TODAY_2026_07_30.md` (Buzz workspace) hold
  the active growth plan: Discord/X/Reddit push, weekly visits+Buy-click
  workflow, guide-freshness and buy-link-prover automations. Four
  workflows are live under `WORKFLOWS/*.yaml` and post results in
  `#money`.
- Spend tracking is manual right now — no agent has API access to pull
  real dollar totals from Anthropic/xAI billing consoles or Netlify; Kyle
  has to read those himself. Only the per-call cost estimate
  ($0.002–$0.009/call) is measured.
- `docs/Monetization.md:161` calls the size-answer engine "the real moat"
  — the competitive strategy explicitly leans on sizing accuracy + a
  paste-a-haul-into-a-shelf flow + community memory on saved items as the
  three hardest things for a competitor to copy. Don't deprioritize
  sizing engine correctness for polish work without weighing this.

## 9. Where to look for more

- `docs/Chart-Pull-Handoff.md` — the daily size-chart harvest (w2clinks feed
  → headless Chrome → Grok vision → `data/seller-charts.json`). Read before
  touching `scripts/w2clinks-chart-pull.py`, `scripts/reddit-chart-pull.py`,
  or the launchd job `com.kyle.chartpull`. Contains the Grok envelope gotcha
  and the Reddit API denial status.
- `preview/test/chart-hunt-restart.test.jsx` — the regression guard for
  #41 (§1). It renders a chartless Yupoo card, re-renders it 10× the way
  the App does (fresh `item`, fresh `onSaveEdit`, fresh `shelfItems`), and
  asserts exactly one hunt with an unaborted signal. If you change
  `useChartHunt`, this file is the fastest proof you did not reintroduce
  the abort loop. Verified to fail on the old code (11 hunts vs 1).
- `docs/session-state.md` — the OLD living checkpoint, stops 2026-07-27,
  keep as history.
- `docs/carousel-canonical-state.md`, `docs/carousel-session-summary.md`
  — read before any carousel change.
- `docs/Monetization.md` — banned language, moat reasoning, competitive
  table.
- `.claude/skills/credenza-design/` — design tokens, drift notes, rules.
  Read before any UI/CSS change.
- `/Users/kylewensel/.buzz/PLANS/CREDENZA_WISHLIST_2026_07_30.md` — Kyle's
  30 ranked feature asks; add new asks here, don't lose them in chat.
- Buzz channels worth checking directly rather than trusting this
  snapshot for anything time-sensitive: `#build`, `#design`, `general`
  (product-intent decisions get made here first), `GOALS` (future
  features), `money` (pricing/affiliate decisions — ask Fable before
  changing a price or plan).

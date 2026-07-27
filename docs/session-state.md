# Credenza Fashion — Session State (LIVING CHECKPOINT)

**Purpose:** This file is the session black box. Any Claude/agent session in this
repo must **read it first** and **update it before context runs low** (see
`.claude/settings.json` Stop hook, which nags when this file goes stale).
Overwrite sections in place — this is current state, not a log.

---

## READ THIS FIRST — two rules that override every older note

Set 2026-07-26 by Kyle: "we still need to make sure when we commit
something, it stays in commit. we've been losing progress" and "we are
running out of Netlify deployments".

**RULE A — commit and push every checkpoint. Never end a turn dirty.**

The old rule was "do not commit until Kyle says so". That rule lost work.
On 2026-07-26 an audit found 4,244 uncommitted lines in the worktree
`fansbuy-links-no-flip`, 9 unpushed commits on that branch, and 2 unpushed
commits on `main`. All of it existed on one laptop only. It is now on
GitHub. The rule that caused it is dead.

- Committing is not shipping. Pushing is not shipping. Only
  `netlify deploy --prod` ships. Never conflate them again.
- Commit as soon as the gate passes: `cd preview && npm run test`,
  `npm run lint`, `npm run typecheck`, `npm run build`.
- Run `git push` immediately after every commit.
- Before your turn ends, run `git status`. If it is not clean, make a
  `WIP:` commit and push it. A messy checkpoint beats a lost one.
- In a worktree, first push uses `git push -u origin <branch>`. Never
  leave a worktree branch local-only.

**RULE B — only Kyle ships. But deploys are NOT the thing to ration.**

Measured 2026-07-26 against the Netlify API. The earlier belief that the
site was "running out of deployments" was wrong, and it caused the work
loss Rule A now prevents. The facts:

- The team is `credit-personal`, 1,000 credits per period.
- The site has **no linked git repo** (`"has_builds": false`). Netlify
  runs no build. It receives an upload from `netlify deploy --prod`.
- Therefore a deploy spends **zero build minutes**. 81 deploys cost
  nothing. Deploy frequency is free.
- Credits go to bandwidth, function invocations and AI usage. Visitors
  drive those, not shipping.

The rules that follow:

- Do not run `netlify deploy`. Kyle says when to ship. That is about
  control, not cost.
- Batch for COHERENCE, never for cost. Do not ship a half-finished
  feature. Frequency is free; a broken shelf is not.
- Everything ships together. Land work on `main`. Never leave finished
  work on a branch — one deploy must carry all of it.
- Prove changes with tests, the local dev server and screenshots.
- Netlify functions (Stripe checkout, the webhook, the portal, resolve,
  preview) cannot run locally. If a task can only be proved live, write
  what to check under "Pending live verification" below.

**The real cost lever is the `preview` image relay, not deploys.**
Yupoo and Weidian block hotlinks, so every album image is relayed
server-side through the `preview` function, at full size, in and out.
One pasted album used to fire up to 20 relays plus `yupoo` and
`resolve`. That cost repeats for every user and every paste. See the
P0 fixes: cache relayed images, and relay 6 by default instead of 20.

`docs/Pre-Launch-Plan.md` rules 2 and 8 carry the same text. If the two
files ever disagree, this file wins.

### Pending live verification (next batch deploy must check)

- LB-5: one full Stripe loop in test mode — checkout, webhook, Pro
  snapshot, portal cancel, free snapshot.

---

**Last updated:** 2026-07-27 (**ROUTING + HEADER + SAMPLE SHELF — `5928358`, pushed, NOT deployed.** Three faults Kyle reported in one message, all fixed: every public address served the app instead of its page (dev server only; production was fine) — `preview/vite.config.js` now resolves the folder before the SPA fallback and binds `127.0.0.1` instead of IPv6 loopback; the masthead nav sat 54.9px right of centre — an equal `flex: 1 1 0` on both outer children puts it at 0.0px, measured by `preview/scripts/probe-masthead-center.mjs`; the 18-card sample shelf is deleted, generator and all, plus a silent one-time purge for devices that already hold the cards. Five new routing tests, five mutation probes all caught. 977 internal links checked, zero dead. Gate 2,114 tests / 66 files. **Two rules for every agent: LB-65 a 200 is not a page — probe the `<title>`, and a rule a comment can satisfy is not a rule; LB-66 deleting a generator does not clear data it already wrote.** See the 2026-07-27 section below. Prior: **BRANCH `worktree-fansbuy-links-no-flip` MERGED INTO `main`.** Kyle: work must never strand on a branch, and one deploy must carry everything. That branch held 10 commits and 7,191 insertions across 72 files. It is now in `main`: six mobile fixes (shimmer doubling, card price clipping, Weidian description size chart, stuck gallery close buttons, smeared money counter, status tag to top left), album photos (honest count, 40-photo extraction, charts held out of the gallery, thumb-strip glitch), modal-stack scrollbars hidden, the settings modal stack, the Fansbuy link fix and the retired carousel flip. Tag `pre-fansbuy-merge-20260726` marks `main` before the merge. **NOT deployed — Kyle ships.** Prior: HERO 2A + ONBOARDING 3B + SIGN-IN FIX — DEPLOYED, deploy `6a66b2bc5602a0684c001b9c`. Prior: CUSTOMER WALKTHROUGH AUDIT FIXES. Prior: HANDOFF TURN 4 — card-cap raise + two-column panel, live and verified.)
**Branch:** `main` (fast-forwarded to the work branch; `mobile-fix-loop` merged 2026-07-25)
**Production:** https://credenzafashion.com — **LIVE at `ebfb59b` (2026-07-25, deploy `6a65a2d4e173815517647bfb`): turn 4 COMPLETE — Fix A (desktop card cap min(72vw,560)xmin(86vh,820) rack, 0.85 overlay mirror; the cap lived in CSS, not the JS cardSize) + Fix B (two-column no-flip DesktopDetailPanel at >=1024px: contain-fit stage with counter/favourite/always-visible arrows/arrow keys/thumb strip + album tile left, shared DetailBody with pinned price+Buy footer right; grid-tap renders the panel directly, rack tap opens it above the rack which never flips; flip cue hidden >=1024px; stage tap opens the swipe gallery; generic thumb-hover z-index fix keeps the chrome on top). Badge fix: only an ESTIMATED deciding measurement hedges the verdict. 640 tests; gallery probe green (desktop panel + phone sheet); live screenshots verified.** Previous: `d109a2a` card-front redesign (deploy `6a65923338fa3dbb68a29676`).
**DEPLOY BLOCKER — CLEARED (2026-07-25 ~09:05Z).** Credits added; everything committed deployed in one shot (see Production line).

## 2026-07-27 — Stash sheet everywhere + one type token set (LB-68, LB-69, NOT deployed)

Two of the five asks in Kyle's current goal are closed. Read this before you
touch the Stash button, any `font-family`, or the exported `FONT`/`DISPLAY`.

### LB-68 — the Stash button now opens the sheet on every screen (`35ed812`)

Kyle: "The stash button just copies your clipboard in, but realistically, I
think when you hit the stash button, it should pull up the stash to shelf, how
it is in the mobile."

`heroStash` branched `if (isPhone) … else stashClipboard()`, and the sheet was
gated `{isPhone && captureSheetOpen && (`. Desktop read the clipboard and
stashed a card the user never saw. The sheet now renders on every screen.

- No new surface was needed. `ModalShell` already draws a centred `<dialog>`
  and becomes a bottom sheet only under `(max-width: 767px) and (pointer:
  coarse)`.
- The old KM-03 objection is dead: `CaptureSheet`'s textarea already calls
  `stopPropagation` on keydown.
- A deliberate ⌘V still stashes straight to the shelf on desktop. That is a
  different gesture — the user chose the text — and the toast carries Undo.
- `stashClipboard` still exists. The desktop clip banner and the phone clip
  pill both call it, and both already show the clipboard first.

### LB-69 — three type tokens, and nothing else names a font

Kyle: "Can we make some font standardizations for the entire website? … I want
it to be the fonts that the Credenza fashion logo is made out of."

The logo is two families. The site spelled them ten ways across four kinds of
file, so the type drifted per machine.

- **`--cz-display`, `--cz-sans`, `--cz-mono` are defined in the first `:root`
  of `credenza.css`. That is the ONLY place a font stack may be written.**
- All 77 declarations in `credenza-fashion.css` and all 260 across the 33
  public HTML pages now name a token. Zero literal stacks remain.
- Each public page carries its own chrome and shares no stylesheet, so each
  page holds its own copy of the three definitions. A new public page must
  copy that block, or its type falls back to the browser default face.
- `landing/index.html`'s private `--serif` / `--sans` / `--mono` are retired.
- Exported `FONT` and `DISPLAY` in `credenza-fashion.jsx` now hold
  `"var(--cz-sans)"` and `"var(--cz-display)"`. A new `MONO` joins them.
  Never spell a family in JSX — the same rule as the hex-colour ban.
- `preview/test/type-tokens.test.js` fails the build on a literal stack. It
  strips comments first, so a quoted example cannot satisfy it.

Gate 2,120 tests / 67 files. Lint 5 warnings, 0 errors (unchanged set).

### Still open in Kyle's goal
- Navigation, profile and settings card: cleaner sign-in, grouped options,
  bigger measurement inputs.
- Shelf cards and the masthead read bland. Give both more presence. **The
  carousel is frozen — do not touch it.**

## 2026-07-27 — Routing fix, header centring, sample shelf deleted (`5928358`, NOT deployed)

Kyle reported three faults in one message and asked to stop for review.
All three are fixed, committed and pushed. Read this before you touch
`preview/vite.config.js`, the masthead CSS, or anything named `sample`.

### Fault 1 — every address showed the app (LB-65)

Kyle: "every single page takes you here, these are not routed right."

**Cause.** A static host answers `/contact/` with
`public/contact/index.html`. The Vite dev server does not. It fell
through to the SPA fallback, so all twelve public addresses rendered
the app. Production was never broken this way — Netlify resolves
folder addresses itself, which is why live `/faq/` and `/landing/`
always worked.

**Fix.** `preview/vite.config.js`, inside
`fashionEntryPlugin().configureServer`. A middleware resolves the
folder before the fallback runs. Three details carry weight:

- `path.length > 1` keeps the bare root `/` on the app.
- `existsSync(candidate)` means a genuinely wrong address still
  reaches the fallback, not a blank error.
- The query string is stripped first, or `/faq/?ref=x` misses.

**Second fix in the same file.** The dev server bound IPv6 loopback
(`[::1]:5173`) only. `curl 127.0.0.1:5173` was refused;
`curl localhost:5173` worked. The server block now sets
`host: "127.0.0.1"`. **Do not change this to `host: true`** — that
publishes the dev server to every machine on the network. A test
forbids it.

**THE RULE THIS TEACHES — LB-65: a 200 is not a page.** In an earlier
turn I curled ten addresses, saw HTTP 200 on all ten, and told Kyle
every page worked. The fallback answers 200 for any address. Kyle
found the fault I had just declared absent. **Probe the title, never
the status code:**

```bash
curl -s "http://localhost:5173/contact/" | grep -o "<title>[^<]*</title>"
```

**LB-65 corollary — a rule a comment can satisfy is not a rule.** A
mutation probe deleted `host: "127.0.0.1"` and all tests still passed.
The whole-file regex had matched the **explanatory comment above the
setting**, not the setting. The test now reads the `server: {` line
specifically. Every whole-file grep in this suite is exposed to the
same flaw, because this codebase comments heavily and comments quote
the code they explain. Ask of any check you write: **could this still
pass if the feature were deleted?**

### Fault 2 — the masthead nav was not centred

Kyle, with a screenshot: "header here is not centered and doesn't look
right."

**Cause.** `.cz-masthead` uses `justify-content: space-between`, which
divides only the LEFTOVER room evenly. A ~190px brand on the left and
a single 44px avatar on the right pushed the link row right of the
true middle. Measured: **54.9px off** at 1440, 1280 and 1024.

**Fix.** `credenza-fashion.css`. `.cz-mast-nav` changed
`flex: 0 1 auto` → `flex: 0 0 auto`, plus a new block giving the two
outer children an equal `flex: 1 1 0`, scoped to `min-width: 768px`
and `:not(.is-compact)` (the phone masthead hides the nav). Measured
after: **0.0px** at all three widths.

**The base rule lives inline in JSX, not in CSS** —
`credenza-fashion.jsx:3384` holds the `.cz-masthead` display rule.
Look there first if the layout moves.

**Probe:** `preview/scripts/probe-masthead-center.mjs`. Playwright /
webkit, three widths, prints the offset and PASS/FAIL. Needs the dev
server up on `127.0.0.1:5173`. Run it after any masthead change.

### Fault 3 — the sample shelf is deleted (LB-66)

Kyle, twice: "let's take out the sample shelf for now" and "this is a
very old credenza app, this content needs to be deleted."

**Deleted:** `SAMPLE_COUNT`, `buildSampleItems()` (243 lines),
`clearSamples` (32 lines), `addSamples`, the "Clear sample shelf"
button, the ImportSheet sample card (30 lines) with its
`onAddSamples` / `onClearSamples` / `hasSamples` props at both call
sites, and 67 orphaned `.cz-import-sample*` CSS lines.

`sheets/ImportSheet.jsx` signature is now:

```js
export default function ImportSheet({ items, onImport, onClose, onExport,
  onExportCsv, onClearShelf, onRestore, isPro = false, embedded = false })
```

The empty-hero button changed from "Put it on my shelf" (which loaded
18 demo cards) to "Paste your first link" (which focuses the paste
field).

**THE RULE THIS TEACHES — LB-66: deleting a generator does not clear
data it already wrote.** Kyle's device still held 19 sample cards in
local storage after every line of generator code was gone. A stale
demo shelf reads as the real product. `credenza-fashion.jsx` now runs
a silent one-time purge, gated on `preferencesHydrated` and a ref, and
filtered on `item.sourceImport === "sample"`. It is deliberately
silent — nobody asked for it, so a toast offering Undo would only
invite them to put the demo back.

### Guards added

`preview/test/public-site.test.js`, a new `describe("dev server
routing")` block, five tests:

1. the folder-resolving rewrite exists in `vite.config.js`
2. it runs inside `configureServer`, before the fallback
3. the bare root still goes to the app
4. the server line binds `127.0.0.1` and not `true`
5. every `href="/…/"` in every page nav has an `index.html` on disk

**Test 2 has a trap.** `swPrecache()` also declares `closeBundle()`
and sits ABOVE `fashionEntryPlugin()` in the file. Slicing from index
0 finds the wrong copy and yields an empty block. Search forward from
the `configureServer` index.

**Mutation probes: five run, all five caught** (one only after the
comment fix above). Restores used `cp` from `/tmp/` and were verified
with `md5 -q`. **`git checkout --` is never used in this repo** — a
prior session destroyed real uncommitted work that way.

### Link check

`node /tmp/linkcheck.js` walked all 32 public pages: **977 links, 35
distinct addresses, zero dead.** Every folder address has an
`index.html`; `/` is the app; `/llms.txt` and `/icon-192.png` are
files.

### State

- Gate: **2,114 tests / 66 files pass** (was 2,109). Lint: **5
  warnings, 0 errors** — baseline, unchanged.
- Commit `5928358` on `main`, pushed. Working tree clean.
- **NOT deployed.** Kyle ships.
- **`/contact/` and `/pricing/` are missing from the live site.** They
  exist in the repo and have never been deployed. Kyle's next deploy
  closes this. It is a shipping gap, not a routing bug.

### Talking to Kyle

Standing instruction, his words: "CAN YOU POINT ME TO SPECIFIC PAGES
YOU ARE ACTUALLY WORKING ON … DUMB IT DOWN". In practice: name a page
by its human name AND its full address ("the Contact page at
credenzafashion.com/contact"), never as a bare path. Drop internal
vocabulary — no "cache", "404", "edge", "database row", "SPA
fallback".

## 2026-07-26 — Hero 2A, onboarding 3B, sign-in fix, pricing checklist — DEPLOYED

Two windows ran in parallel and were merged here. Window 1 worked on hero and
toast. Window 2 worked on shelves and pricing. Both are complete.

**Deployed to production 2026-07-26 (deploy `6a66b2bc5602a0684c001b9c`).**
Verified live: the Supabase URL is inlined, the specimen card and first-card
hint are in the bundle, `/img/specimen-jersey.jpg` returns 200, and the new
brand mark is on all 12 public pages.

### THE BIG ONE — sign-in was broken in PRODUCTION, not only locally

Kyle said "the sign-in's kind of gone". It was gone everywhere.

`AUTH_ENABLED` in `preview/src/auth.js:18` is `!!(VITE_SUPABASE_URL &&
VITE_SUPABASE_ANON_KEY)`. It is a **compile-time** boolean. Vite inlines it.

The Netlify site has **no linked git repo** — it deploys from the CLI with
`netlify deploy --prod --dir=dist`. The build happens on this Mac. Netlify's
build-time environment variables therefore **never reached the bundle**. The
old live bundle contained `xl=!1`, which is `AUTH_ENABLED = false`.

**The fix:** `preview/.env` now holds the five publishable `VITE_` values,
pulled from the Netlify API. `.env` is gitignored. A backup of the old file
is at `preview/.env.bak.*`.

**WARNING for every future session: you must build with `preview/.env`
populated, or you ship a signed-out app again.** If `.env` is ever lost, run
`netlify env:list` and copy the five `VITE_` keys back. `preview/.env.example`
documents them.

Two extra safeguards shipped with it:
- `sheets/ProfileSheet.jsx` now renders "Accounts are off in this build" when
  `AUTH_ENABLED` is false, instead of rendering nothing. Silence was the bug.
- `sheets/SettingsSheet.jsx` gained an Account row as its first row. It reads
  "Off in this build" / "Sign in" / the signed-in email, and opens the
  Profile sheet. Kyle looked for sign-in in Settings; it had only ever lived
  behind the avatar.

### Hero 2A — the specimen card

The empty shelf used to show two equal text links. It now shows a real card:
a photo, a title, a size, a price, and a seller. Caption: "This is what a
Weidian link becomes." The primary action is "Put it on my shelf". Import is
demoted to a quiet link below.

`credenza-fashion.jsx` markup, `.cz-specimen-*` and `.cz-empty-hero-caption`
in `credenza-fashion.css`, photo at `preview/public/img/specimen-jersey.jpg`
(43 KB).

### Onboarding 3B — first-card hint and desktop autofocus

- A hint appears under the grid after the first card lands: "Tap the card for
  sizing and QC. Buy opens your agent — Credenza never takes payment." It
  retires the first time the user opens a card.
- The hero field autofocuses on desktop only (>= 768px), and only when
  nothing else holds focus.

### CSS cleanup

The `.cz-onboard*` block is deleted. The other window removed the intro gate
JSX, so the styles had no markup left. A comment marks the spot.

### Tests

Ten tests in `preview/test/fashion-app.test.jsx` clicked a "Get started"
button that no longer exists. The intro gate is gone by design
(`const firstRunIntro = false;`). The dismiss steps are removed, and each
test's real assertion is untouched.

**Gate green: 679 tests pass, tsc clean, lint 0 errors (2 pre-existing
warnings). The esbuild `content: ""` CSS warning is pre-existing — it is
present at HEAD too.**

### Pricing — `docs/free-to-pro-checklist.md` (NEW, read this before pricing work)

The mock scored against the code: **6 BUILT, 5 PARTIAL, 4 MISSING**.

Two decisions are Kyle's and are still open:
1. **Price.** The mock says $4.99 / $36. The app and Stripe say $5 / $39.
   Stripe Prices are immutable, so a change means two new Price objects.
   Nobody has subscribed yet, so the cost of changing is zero today.
2. **Nav.** The mock says "How it works · Sizing · Pricing". The live nav
   says "How · Guides · FAQ". There is no `/pricing/` page yet.

The one true hole: **a free user gets the Pro parcel planner and the Pro QC
photo cap by accident.** `WarehouseQcSection.jsx:19` hard-codes 12 photos for
everyone; free is meant to get 4. `haulsMax: 2` is declared and never read.

The biggest missing row is the shared shelf. **Decision recorded: build
`/s/:id` as a server-rendered Netlify function, NOT a client router.** The app
has no router, the shelf is `localStorage` only, and a server page is the only
way to get an Open Graph preview on a shared link.
## 2026-07-26 — HANDOFF TURN 9 (`design_handoff_mobile_shelf 8`) — IN PROGRESS, UNCOMMITTED

**SUPERSEDED 2026-07-26. Do not follow the instruction below.** It said
"do not commit" and it lost work. RULE A at the top of this file replaces
it: commit and push every checkpoint. This work is now committed, pushed
and merged into `main`. Kept for the record only.

> ~~**Kyle's instruction:** "ok let's chill on committing stuff im runnng
> out of netifly deployments." All of this work is UNCOMMITTED in the
> worktree. **Do not commit. Do not deploy. Do not merge.**~~
>
> That instruction rested on a wrong premise. Netlify does NOT bill per
> deploy. This site has no linked git repo, so Netlify runs no build and
> spends no build minutes — 81 deploys cost nothing. Credits go to
> bandwidth, function invocations and AI usage, which visitors drive.
> The real burn is the `preview` image relay (see the cost section
> below), not shipping.

**Which spec is live:** the handoff README line 456 addendum. **Turn 9 is the
model to implement; it SUPERSEDES every earlier detail-view / card-back spec.**
Turn 8 (8a/8b/8c) is exploration — read it for rationale, do not build it.

**CRITICAL palette trap.** The handoff writes `--cz-accent` for its green. In
THIS repo `--cz-accent` is INK (the chrome is deliberately near-monochrome).
The one green is `--cz-money`. **Every turn-9 green maps to `--cz-money`.**
Also: `--cz-surface` and `--cz-muted` do NOT exist here. Use `--cz-seg` for a
neutral tint and `--cz-sub` for body text. Both mistakes shipped silently
(the browser drops an undefined var) until a screenshot caught them.

**State: 778 tests pass in 44 files. `npx vite build` clean (its 2
css-syntax-error warnings are PRE-EXISTING). Main bundle 291.37 kB.**

Sections DONE and verified: §10 tokens, §1 spec cells → chips, §2 sizing block,
§5/§6 status track + timeline, §7 notes clamp/expand, §4 photo panel + album
links, §8 Buy notch + agent picker, §9 phone sticky bar, §3 no-chart snapshot,
§11 photo morph + card depth.

Sections REMAINING: none. The turn-9 addendum is fully built.

**§11 photo morph.** The card photo is the shared element and grows into the
detail photo panel. It uses the browser's **native View Transitions API**, and
that choice is not a preference — see `docs/carousel-canonical-state.md:170`.
Two earlier morph attempts in this app cloned nodes with
`getBoundingClientRect`, flew the clones through a `createPortal` overlay, and
handed back with double-rAF plus polling. Both were glitchy. Both were deleted.
The doc forbids reintroducing clones, `getBoundingClientRect`, or a portal for
this transition. A view transition obeys every clause: the browser snapshots the
frames itself, the "shared element" is only a matching `view-transition-name` on
two nodes, and no second copy of the DOM exists at any moment. A test asserts
the node count does not change during the morph.

Parts: `runPhotoMorph` + `MORPH_NAME_PHOTO`/`MORPH_NAME_TEXT` +
`supportsViewTransition` in `credenza-fashion.jsx`; `openWithMorph` and
`morphOpenId` state in the app body; `photoRef`/`textRef`/`morphNodes` in
`components/Card.jsx`; a `morphing` prop on `DesktopDetailPanel` and
`DetailSheet` that adds `is-morphing`; four CSS blocks in
`credenza-fashion.css` (card depth, the `::view-transition-*` animations, the
desktop rail wipe, the phone hero).

**Three traps §11 hit, all fixed and commented in place:**

1. **`setMorphOpenId` must be INSIDE the `flushSync`, and the cleanup effect
   must test "no surface is open", NOT "no surface has this id".** Setting the
   flag before `startViewTransition` looks equivalent and is not: React commits
   it while no detail surface is mounted, the cleanup effect sees an id with no
   surface, and clears it before the panel reads it. The panel then mounts
   unnamed and the morph degrades to a cross-fade. `flushSync` itself is also
   mandatory — the browser captures the new frame the instant the callback
   returns, and React's default batching would still hold the update.

2. **A `lazy` detail surface has NO DOM in the captured new frame, and
   preloading the chunk does NOT fix it.** React initializes a lazy component on
   its first RENDER attempt, so the Suspense fallback tick happens regardless of
   when the module lands. `DetailSheet` is therefore a **static import with no
   Suspense boundary**. Its own chunk was 3.3 kB, so this is the whole cost.

3. **A skipped transition rejects BOTH `ready` and `finished`.** The code only
   awaits `finished`, so `ready` needs its own `.catch(() => {})` or the browser
   logs an unhandled rejection on every fast double tap.

Also: only ONE element may carry a given `view-transition-name` per frame, so
the card releases its name INSIDE the callback as the panel claims it. Two
elements sharing a name makes the browser skip the whole transition.

**Verification. A skipped transition is SILENT and looks identical to a working
one on a screenshot, so never verify this by eye.** Both real §11 bugs were
found only by asserting a matching `::view-transition-new(cz-morph-photo)` —
that pseudo-element existing is the browser confirming it accepted the pair.
`scripts/probe-turn9-morph.mjs` asserts it on both platforms. Playwright does
not composite the view-transition layer either, so its mid-flight shots show the
shelf, not a photo in flight. To measure the flight, instrument
`document.startViewTransition`, `pause()` the animations on `ready`, then set
`currentTime` and read the computed pseudo-element styles. Measured: group
280ms; box 246.5×308 at (209,241) → 467×626 at (147,71); `object-fit: cover` and
equal `old`/`new` heights at every sample, which is the no-re-crop proof;
`old(cz-morph-text)` 60ms; `new(cz-morph-rail)` 220ms after a 60ms delay.
Reduced motion calls `startViewTransition` zero times and still opens the sheet.

**Card depth lives on `article.cz-editorial-card`, not the inner `.cz-card`.**
`Card.jsx` sets an INLINE `box-shadow` for the selected/rest pair, and inline
styles win specificity, so a shadow on the inner div would never appear. Hover
lift is −6px (was −3). Blackout needs its own alpha pair: the light-theme alphas
over a black field are invisible.

**§8 Buy notch.** The chevron segment lives INSIDE the Buy action: one
container, one radius, split by a hairline. `BuyNotch` in
`components/DetailBody.jsx` reads its price from `priceLabelShort(item)`, NOT
from `footerPrice` — the phone sheet draws no footer price prop, so feeding the
picker from the layout made it silently priceless. Without `onSelectAgent` the
notch degrades to a plain button: a chevron that opens a list which saves
nothing is worse than no chevron. `chooseBuyingAgent` in `credenza-fashion.jsx`
reuses the Profile sheet's retired-agent guard. Every picker row shows the SAME
item price on purpose — agents differ on shipping and service fee, and four
different numbers would misrepresent what an agent changes. A test locks that.
The list caps at `min(44vh, 320px)` and a `listRef` effect scrolls the saved
agent into view on open; without the cap the selected row sat off-screen ABOVE
the phone viewport while every unit test passed.

**§9 phone sticky bar.** An IntersectionObserver on the hero, root = the
sheet's own scroller. The bar is a SIBLING of that scroller, never a child — a
child scrolls away with the content it exists to outlive. It animates its own
height 0→44px rather than sliding a block over the title. `aria-hidden` and
`tabIndex={-1}` while down: every control on it repeats one already in the
sheet, so a duplicate title costs a screen reader and gains nothing.
**No IntersectionObserver means no bar** — jsdom and old iOS see exactly the
pre-§9 sheet, which is why the suite stayed green with the bar in the tree.
`stickyMeta` says `AI SIZE` only when the size really is a recommendation,
otherwise `SIZE`; the bar must not upgrade a profile guess into an AI read.
Also in §9: 22px sheet radius (was 26), 38×4 handle, three 32px hero circles at
gap 6 with the heart leading the cluster, and the footer price box beside the
notch. **Trap:** the `@media (pointer: coarse)` block near line 5521 pins
`min-width/min-height: 44px` on every `.cz-favorite-button`, which clamped the
32px heart back to 44 and left it a puck beside two smaller circles. The hero
rule now releases both minimums; `.cz-detail-hero-btn::after` still gives it a
full 44px hit area.

**§3 no-chart snapshot.** Three states in one place, in the order they occur.
A live customer read outranks everything, then the no-chart ask, then the
ordinary block. All three are in `components/DetailBody.jsx`.

The ask (`SizingBlockNoChart`) only renders once the hunt has FINISHED. While
the hunt runs the ordinary block shimmers READING CHART, and asking for a photo
underneath that asks for work the app may be about to do itself.

**Two doors into one parser.** `chart-vision.js` now accepts inline `photos`
(base64 data URLs) beside the existing `images` (CDN URLs it fetches through its
SSRF allowlist). Inline means the server never fetches, so there is no request
to forge — validation is cost and shape only, and oversize is rejected BEFORE
the Buffer is allocated. `MAX_INLINE_PHOTOS = 3`, `MAX_INLINE_BYTES = 600*1024`,
route `bodyBytes: 2560*1024`. Client side both doors meet at `postChartVision`
in `credenza-fashion.jsx` and return the same `chartText`.

**The read STAGES, it does not commit.** `useCustomerChartRead` returns
`{reading, chart, text, thumb, error, read, commit, dismiss, fix}`. A photo the
customer aimed is the most likely read to be right AND the only one they can
check against the object in their hand, so the preview exists and `commit` is a
separate call. It writes `sizeChartSource: {via: "customer-photo", seller}`.

**Fix a number** (`ChartFixGrid`, spec line 493). One 38px input per cell, in
the table's own layout. Three traps, all hit and fixed:
1. Resetting the editor on `chart` closed it after ONE keystroke — `chart`
   changes on every correction. It resets on `reading` instead.
2. Re-serializing per keystroke blanked the cell: a half-typed "1" is under the
   parser's 20cm floor. `fix` holds the chart raw and sets `dirty`;
   `serializeSizeChart` runs ONCE, at commit.
3. Rebuilding a row from its own keys reordered the columns, because clearing a
   cell deletes the key and the next keystroke appends it. It rebuilds in the
   TABLE's column order.
Cells always show CM even when the display unit is inches — the tag is in cm,
and asking anyone to convert a correction back is how a second error gets in.

**`serializeSizeChart`** (exported from `credenza-fashion.jsx`) emits strategy
1's own labelled form, which `parseSizeChart` round-trips exactly. It carries NO
half-chest wording on purpose: `normalizeHalfChestRows` doubles once at parse,
and emitting 半胸 would double the already-doubled numbers on the way back in.

**The cache IS the shelf** (`chartCacheForSeller`). Every item already carries
its chart in `sizeNotes` and provenance in `sizeChartSource`, so a separate
store would be a copy that can go stale against the original. Only READ charts
qualify (`CHART_CACHE_VIA`), so a guess never spreads between items; newest `at`
wins; the CHART's own `seller` tag outranks the item's field. `useChartHunt`
checks it BEFORE the network and writes `via: "seller-cache"`, surfaced as
`FROM REPLUX'S CHART (CACHED)`. `migrateItem` keeps `sizeChartSource.seller` —
without that whitelist entry the whole lookup key vanishes on reload.

**Test trap that cost an hour.** A chartless item SWAPS `SizingBlock` for
`SizingBlockNoChart` the moment the hunt returns null, and the swap mounts a NEW
`Full chart` node. `screen.getByRole(...)` before the swap captured a node that
was detached by the time `userEvent.click` ran, so the click landed nowhere and
`editingCell` stayed null. `fireEvent` worked, `userEvent` did not, and the
button was visibly present in the dump — the tell was `btn.isConnected === false`
on the event listener. `clickFullChart()` in `test/fit-block-hunt.test.jsx`
awaits `findByText("No chart")` first.

**QC photos are NOT gallery photos** (docs/Monetization.md A5). `attachQcImage`
in `credenza-fashion.jsx` writes `qcPhotos`, so a warehouse photo can never
contaminate the product gallery. The §9 QC prompt only asks while the order can
answer: status in bought/shipped/qc AND no QC photo yet. A standing "add QC
photos" box on a WANT item asks for something that cannot exist.

**Probes** (all kept, all green): `preview/scripts/probe-turn9-notch.mjs`
(4 shots, `t9-notch-*`), `preview/scripts/probe-turn9-sticky.mjs` (4 shots,
`t9-sticky-*`, plus 3 console gate checks), and
`preview/scripts/probe-turn9-nochart.mjs` (7 shots, `t9n-*`: the ask with and
without a usual size, the scan line, the read-back, the fix grid, and the
ordinary block after Use this chart). It stubs `**/chart-vision` per request —
`photos` present means the customer's read, absent means the hunt, which always
misses so §3 renders at all. **The stub MUST return `found: true`**; without it
`postChartVision` reads the reply as a miss and every state looks broken. **The probe reads the built `dist`
on port 4173 — run `npx vite build` BEFORE re-shooting or you photograph the
old build.** That cost one wasted cycle. Probe scripts must live in
`preview/scripts/`; from elsewhere they fail `ERR_MODULE_NOT_FOUND`.

**Test-harness traps hit this session.** `cd .../preview && npx vitest run` —
`cd` does not persist between Bash calls, and running from the worktree root
produces 30 bogus `document is not defined` failures. `installShim` in
`fashion-app.test.jsx` returns a `data` object, NOT real localStorage: assert
on `JSON.parse(data[PREFS_KEY])`. Inside a JSX attribute list you are in JS —
`{/* … */}` between props is a parse error; use `//`.

## 2026-07-26 — SIX ISSUES from Kyle's mobile pass — ✅ ALL SIX FIXED (`e135126` + `1032918`, NOT deployed)

Kyle reported six problems from the LIVE mobile web app. All six are fixed and
committed on branch `worktree-fansbuy-links-no-flip`. **688 tests pass.** The
build compiles; its 2 `css-syntax-error` warnings are PRE-EXISTING — that was
proved by building with and without the changes and comparing the count.

**Do not deploy. Do not merge. Kyle authorizes both separately.**

1. ✅ **Chart-hunt loading text looked doubled.** The `.t-shimmer` primitive
   draws a SECOND copy of the string in an absolute `::before` and clips a
   gradient to it. That only registers on a single-line SIZED box. The hunting
   rule set `display: inline`, and the sentence wraps on a phone, so the two
   copies broke at different points and both stayed visible.
   Fix: a new single-layer `.t-shimmer-wrap` variant in `credenza-fashion.css`.
   It clips the gradient to the real glyphs, so it cannot double at any width.
   `components/DetailBody.jsx:216` uses it. This is STRONGER than restoring
   `inline-block` — two layers can always misregister on a wrapping line.

2. ✅ **Card price clipped mid-glyph in the phone grid.** `.cz-card-text` and
   its toggle are flex/grid items, which default to `min-width: auto`. The
   block therefore grew to the intrinsic width of its widest `nowrap` line, and
   the card shell (`overflow: hidden`) cut the price. Every `text-overflow:
   ellipsis` rule below was DEAD: ellipsis shrinks to the box, and the box was
   never smaller than the text.
   Fix: `min-width: 0` + `grid-template-columns: minmax(0, 1fr)` on both.
   The price never yields (`flex: 0 0 auto`); the size LABEL ellipsizes first,
   because "YOUR USUAL" repeats on every card and the VALUE is the information.

3. ✅ **Weidian description size chart never picked up.** Diagnosed against
   LIVE data, not by inference. Each link works: the Weidian description API
   returns 20 images for item 7739297298 and image 1 IS the chart; `resolve.js`
   returns it at `descImages[0]`; `parseSizeChart` reads 4 rows from it;
   `huntSizeChart` finds it when `descImages` is populated.
   The single gap: `descImages` shipped in `b794602` (2026-07-25) and is only
   ever populated at IMPORT time. Cards saved before that — plus any card whose
   resolve was skipped, capped, offline, or failed — hold an empty list. The
   hunt was blind to the one place the chart was.
   Fix: new `fetchDescImages()` in `credenza-fashion.jsx` (same resolve call the
   importer makes; respects plan limit, offline state, abort signal; returns []
   and never throws), called as a LAST RESORT in `components/size-chart-hunt.js`
   — only when `descImages` is EMPTY and every other path missed. 3 new tests.

4. ✅ **Gallery close buttons stuck and did nothing.** React removed the
   `<dialog>` node without ever calling `close()`, so the browser kept the stale
   dialog in the TOP LAYER: it still painted above everything, but its React
   handlers were gone. `ModalShell.jsx` already carried this exact fix (Kyle
   2026-07-24, "closing stuff gives me a blank screen"); the gallery never got
   it.
   Fix: `PhotoCoverFlow.jsx` closes the dialog in the effect cleanup, and all
   six close paths route through one guarded `requestClose()`.

5. ✅ **Money counter digits stayed smeared.** `ReelDigit` armed an SVG motion
   blur on each spin and cleared it ONLY from `onTransitionEnd`. That event is
   NOT guaranteed — it does not fire on a hidden tab, on a node detached
   mid-tween, on an interrupted tween, or when the compositor drops the
   transition. One missed event left the digits permanently smeared.
   Fix: a `setTimeout` fallback settles the digit regardless, and the filter is
   ATTACHED only while travelling (a filter left on the element keeps pushing
   glyphs through the rasteriser, so they read soft even at `stdDeviation` 0).

6. ✅ **Status tag moved to the TOP LEFT of the card.** The base
   `.cz-card-status` rule and the carousel already placed it top-left. The
   two-line card override was the only rule pushing it to the bottom.

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

## 2026-07-26 — LB-7 cloud sync: code complete, dormant (Claude lane)
- The shelf can now live on the server. Nothing syncs yet: the feature is
  behind `VITE_ENABLE_SYNC`, which stays unset until Kyle runs
  `docs/sql/2026-07-26-shelves.sql` in Supabase. Do not set the flag first
  — every call answers 404 and the app fails quietly.
- **Kyle must do two things, in order:** (1) run that SQL, (2) set
  `VITE_ENABLE_SYNC=true` on Netlify and in `preview/.env`.
- Split: `credenza-sync-merge.js` is a pure merge core (no fetch, no DOM,
  no clock) and `preview/src/sync.js` is the transport (PostgREST over
  plain fetch, no Supabase SDK — same rule as `auth.js`).
- Deletes write tombstones to `credenza-fashion-tombstones-v1`, swept
  after 90 days. Two rules that must never change: a union without
  tombstones resurrects every deleted card, and absence must NEVER mean
  delete or one empty signed-in device erases the whole account.
- Wins are per card, by `updatedAt`. Never per document, never per field.
  On an exact tie the winner comes from the two cards alone, so both
  devices pick the same one instead of pushing at each other forever.
- Free vs Pro (the plan's own recommendation; Kyle has NOT confirmed):
  pull is free because it is the lost-phone restore story; continuous
  push is Pro. A free account still saves once after the first merge.
- `delete-account.js` and Erase my data both remove the remote row.
- Tests: 60 new (merge 27, transport 17, wiring 16, account 6 extended).
  Full gate green — lint 0 errors, tsc clean, 55 files / 935 tests, build OK.
- Not deployed. Everything sits on `main` for Kyle's single deploy.

## 2026-07-26 — LB-8 shared shelf: code complete, dormant (Claude lane)
- A haul can now become a public page at `/s/<code>`. Nothing works yet:
  Kyle must run `docs/sql/2026-07-26-shares.sql` in Supabase first. Until
  then every share attempt fails, and the Share button is still visible.
- **The link is server-rendered, not a client route.** `/s/*` rewrites to
  `preview/netlify/functions/share-page.js` at status 200. That is the
  only way a shared link gets an Open Graph preview card. There is still
  no router in this app, and this does not add one.
- The share document is described twice, because the repo runs two module
  systems: `credenza-share.js` (ESM, builds) and
  `preview/netlify/functions/lib/share-doc.js` (CommonJS, reads).
  `preview/test/share-parity.test.js` fails the build if they disagree.
  Never edit one without the other.
- **A field the sharer turned off is ABSENT from the document.** Not
  hidden by CSS, not sent and ignored. Five toggles: prices, notes,
  quality, sellers, parcel. Default is photos and titles only. QC photos
  are never shared at all.
- **No view counter, on purpose.** The page is CDN-cached, so a counter
  fed by cache misses would report far below the truth. The reason is
  written into the migration file so nobody adds the column back.
- A share is a cloud write, so the plan test is
  `ent.mayWriteCloud(record, now)` — grace reads Pro but makes no new
  links. Free keeps 3 links, Pro 100. Caps: 60 items, 512 KB.
- The client sends all three Pro flags whatever the plan says. The server
  forces them off for a free account rather than refusing. A stale plan
  badge must never cost somebody their link.
- `sheets/ShareSheet.jsx` holds the draft and nothing else. It never sees
  a token; `onCreate` is the app's callback.
- **Custom share URLs are NOT built.** The code is always 12 random
  characters. Do not list it on the pricing page.
- **The list the sheet promises is BUILT:** `sheets/SharedLinksSheet.jsx`.
  The share sheet's fine print says "Delete it any time from Profile →
  Shared links", so that route exists. Reach it from Profile → Shared
  links; it is a `buildSubPage` key, `links`. Details worth keeping:
  - The row shows only when signed in. The links live on the server, so
    a signed-out person has none.
  - Delete is two-tap, like Erase my data. The armed state is filled
    red, because the resting state already uses red text.
  - The server sends the code, not the URL. `listHaulShares` builds each
    URL against `window.location.origin`, so a preview build lists
    preview links.
  - A failed load sets the error AND an empty list. "No shared links
    yet" after a network error reads as "your links are gone".
- Tests: 38 in `share-client.test.js`, on top of `share-doc`,
  `share-server` and `share-parity`. One of them fails the build if
  either sheet uses a `cz-` class the stylesheet has no rule for — the
  sheets are lazy-loaded, so an unstyled class stays invisible until
  somebody opens it.
- Full gate green — lint 0 errors, tsc clean, 59 files / 1031 tests,
  build OK (`ShareSheet` 5.34 kB, `SharedLinksSheet` 2.42 kB).
- Not deployed. Everything sits on `main` for Kyle's single deploy.

---

## 2026-07-27 — LB-70 profile, settings and measurements grouped (Claude lane)

Kyle: "make the navigation and profile setting experience much better, make
it cleaner, profile sign in cleaner, different options cleaner … It's too
clunky the way it is right now with how everything is set up. I think the
measurements could use a little bit of a bigger, better thing. Maybe the
card that pops up with all the settings is just a little bit too bland."

What changed, and what an agent must not undo:

- `sheets/ProfileSheet.jsx` — the eleven rows now sit in four
  `.cz-profile-group` cards under four `.cz-profile-label` headings:
  **Look & fit, Your shelf, Your data, Learn**. The heading text is
  asserted in order by the test. Renaming one fails the build.
- **"Erase my data" moved.** It used to hang alone at the bottom, under
  the legal links. It is now the last row of the Your data group, beside
  Import & backup and Storage. Do not move it back.
- `sheets/SettingsSheet.jsx` — the six rows now sit in three
  `.cz-settings-group` cards under **Account, Look, Fit**.
- `.cz-profile-group` uses `--cz-card-solid`; `.cz-settings-group` uses
  `--cz-bg`. That is deliberate and documented in the stylesheet. The
  settings sheet already sits on `--cz-card-solid`
  (`.cz-settings-surface`), so its group must drop to separate; the
  profile sheet has no solid surface, so its group must rise. Both give
  one step of contrast. Do not "fix" them to match.
- The card is a NEW class, not a change to `.cz-profile-row`. The share
  sheet copies the row language on purpose (see the note on `.cz-share`),
  so restyling the row itself would have moved that sheet too.
- `sheets/BodyProfileSheet.jsx` — rewritten on a local `Measure` control.
  The input is 20px with `min-height: 54px`, and the unit sits INSIDE the
  box against the right edge, so each label is the body part alone. The
  old labels read "Chest (in)".
  - The shared `Field` in `components/atoms.jsx` was deliberately NOT
    enlarged. Raising it would resize every form in the app.
  - `BODY_PROFILE_FIELDS` in `credenza-fashion.jsx` gained a **sixth
    column**, the group key. `BODY_MEASURE_GROUPS` beside it sets the
    order and the headings: **You, Upper body, Lower body**. Add a
    measurement by adding a row with a group key; the sheet needs no edit.
  - `"Inseam (leg length)"` is now `"Inseam"`.
  - A "N of 8 filled in" count sits above the first group.
- `test/settings-grouping.test.jsx` — 12 cases. It asserts on rendered
  consequence, never on a class name alone and never on a comment
  (LB-65). It reads the declared `font-size` and `min-height` out of
  `credenza-fashion.css` with comments stripped FIRST, because this repo
  quotes its own code in its comments.
  - This repo does not clear the DOM between renders. Every query in that
    file is scoped with `within(container)`. Unscoped `screen.getByText`
    fails with "found multiple elements".
- Revert probe: removed the group class from both sheets, dropped the
  card background, and shrank the input to 14px/38px. Each mutation
  failed the suite and named the row and the rule.
- Full gate green — lint 5 warnings / 0 errors (the known baseline),
  build OK, 2,132 tests.
- Not deployed. Sits on `main` for Kyle's single deploy.

**Still open from the same Kyle message:** "I think the cards are a little
bland. The top is a little bland." That is the shelf cards and the
masthead, and it is NOT started. **The carousel is frozen — do not touch
it.**

---

## 2026-07-27 — LB-71 shelf-card depth and the masthead edge (Claude lane)

Closes the last half of Kyle's goal: "I think the cards are a little bland.
The top is a little bland."

**What changed**

1. `credenza-fashion.css` — `.cz-card-editorial.cz-card-twoline:not(.is-selected)`
   now casts two shadow layers, `0 1px 2px` contact plus `0 8px 20px` ambient.
   A new `.cz-app[data-theme="dark"]` variant uses 0.5 / 0.4 alpha.
2. `credenza-fashion.jsx` KEYFRAMES — `.cz-masthead` gained
   `padding-bottom: 14px; margin-bottom: 18px; border-bottom: 1px solid var(--cz-hair)`.
3. `credenza-fashion.jsx` KEYFRAMES — `.cz-brand-word` 16px → 19px,
   `.cz-brand` 16px → 19px, `.cz-brand-sub` 9.5px → 10.5px, gap 11px → 12px.

**Facts a future agent must not lose**

- The wrapper `.cz-editorial-card` (`credenza-fashion.css:60-75`) already had the
  correct two-layer pair. The inner `!important` rule was cancelling it. Do not
  add a single-blur override on the inner selector again.
- Blackout needs its own alphas, 0.3 or higher. The light-theme alphas are
  invisible over a black field.
- The masthead has NO `.css` file. Its rules live in the `KEYFRAMES` template
  literal in `credenza-fashion.jsx` (~line 3140), injected at ~line 7486.
- `.cz-masthead.is-compact` keeps its own phone sizes in
  `credenza-fashion.css:8335-8390`. The 19px wordmark is desktop only.
- `components/Card.jsx` was deliberately not touched. Its inline shadow is
  already overridden by the `!important` CSS rule.

**Verification**

- `preview/test/card-masthead-depth.test.jsx`, 7 cases, all pass. It strips
  `/* comments */` before every read (LB-65) and counts shadow layers with the
  colour functions removed first.
- Four revert probes: flat blur restored, border removed, wordmark shrunk,
  Blackout given light alphas. Each failed the suite by name and value.
- Full suite 69 files / 2,139 tests pass. Lint 5 warnings, 0 errors (baseline).
  Build clean.

**Not deployed.** Only Kyle ships.

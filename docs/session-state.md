# Credenza Fashion — Session State (LIVING CHECKPOINT)

**Purpose:** This file is the session black box. Any Claude/agent session in this
repo must **read it first** and **update it before context runs low** (see
`.claude/settings.json` Stop hook, which nags when this file goes stale).
Overwrite sections in place — this is current state, not a log.

**Last updated:** 2026-07-23 (design_handoff_credenza package applied on branch `mobile-fix-loop`, LOCAL ONLY — do not deploy until Kyle says so)
**Branch:** `mobile-fix-loop`
**Production:** https://credenza-kyle.netlify.app (Netlify project `credenza-kyle`, id d5dbe760). Deployed 2026-07-23 via CLI (`netlify deploy --prod --dir dist` from `preview/`). Env: `ANTHROPIC_API_KEY`, `CREDENZA_SEARCH_SECRET`, `VITE_CREDENZA_SEARCH_SECRET` (set this deploy so client can call chart-vision), `VITE_CREDENZA_REF_SUPERBUY`, `VITE_CREDENZA_REF_FANSBUY`. Tag `deploy-2026-07-23` → `8c034f4`. **Follow-up: repo has NO git remote — wire GitHub → Netlify for push-to-deploy.**

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
   Fit prompt on first fit open when no body profile: height / weight / usual
   size + Save & see my fit / Skip. Usual size alone unlocks a first rec.

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

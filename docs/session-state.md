# Credenza Fashion — Session State (LIVING CHECKPOINT)

**Purpose:** This file is the session black box. Any Claude/agent session in this
repo must **read it first** and **update it before context runs low** (see
`.claude/settings.json` Stop hook, which nags when this file goes stale).
Overwrite sections in place — this is current state, not a log.

**Last updated:** 2026-07-22 (autonomous mobile-fix loop COMPLETE on branch `mobile-fix-loop` — S1–S7 shipped, S8 colorway awaiting Kyle's pick; revert tag `pre-mobile-fix-2026-07-22`; NOT deployed)
**Branch:** `credenza-fashion-yupoo-carousel`
**Production:** https://credenza-kyle.netlify.app (Netlify project `credenza-kyle`, id d5dbe760). Deployed 2026-07-21 via CLI (`netlify deploy --prod` from `preview/`). Env on site: `CREDENZA_SEARCH_SECRET` (pre-existing), `VITE_CREDENZA_REF_SUPERBUY=888c9Y`, `VITE_CREDENZA_REF_FANSBUY=Fans-VmXrpx91` (both "all context", set 2026-07-21). Smoke-tested: site 200, function auth gates pass, upstream fetch works, secrets + affiliate codes confirmed baked into bundle. **Follow-up: repo has NO git remote — wire GitHub → Netlify for push-to-deploy.**

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

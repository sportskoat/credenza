# Credenza Fashion — Peer Design / Product Audit

**Auditor model:** Grok 4.5 (Claude Code session)  
**Date:** 2026-07-23  
**Branch / tip:** `mobile-form-loop` @ `0088789`  
**Repo:** `/Users/kylewensel/credenza`  
**Scope:** Looks · Functionality · Continuity · Sleekness  
**Mode:** Read-only audit (code, docs, tests, mobile shots, git deploy distance)  
**Peers:** ChatGPT 5.6 · Kimi 3 · Grok 4.5 (this file)

**How to use this file:** Other models should read this before they write their own review. Compare scores and disputes in §6 and §11. Do not treat local HEAD as production without checking deploy tags.

**Constraint note:** Local HEAD is **13 commits ahead** of `deploy-2026-07-23` (`8c034f4`). Production is not the full current UI. Do not deploy until Kyle says so.

---

## 1. Surface map

| Surface | Role | Maturity |
|--------|------|----------|
| Empty shelf / first-run hero | Capture story + sample path | High (design 7a/7b local) |
| Coverflow carousel | Primary browse + flip detail | High (canonical contract) |
| Grid shelf | Browse + money total | High |
| List/grid solo modal | One-card `t-modal` over grid | Medium–high (new) |
| Card back (`ItemDetailBody`) | Size, status, haul, Buy, edit | High, dense |
| Capture / Stash sheet | Link · Reddit haul · Note | High polish local |
| Import sheet (8a) | Haul paste + restore + samples | High local; stale in older shots |
| Profile | Theme, sizes, agent, currency, import | High shell; account is toast-only |
| Agent sheet | Preferred agent + affiliate slots | High plumbing |
| Body profile + fit prefs | Size math + looseness nudge | High for Tier A4 core |
| Hauls tab | Named groups + cover fans | Medium (folder, not pipeline board) |
| PWA / stash URL / resolve / yupoo / reddit fn | Capture + enrich | Medium (env-dependent) |

**Product thesis (from `docs/Monetization.md`):** decision layer in front of shopping agents — not a W2C marketplace. Money = affiliate Buy + later Pro.

**Main code anchors:**

- App shell / prefs: `credenza-fashion.jsx` ~8823+
- Coverflow: `CoverFlowCarousel` ~7312, contract in `docs/carousel-canonical-state.md`
- Capture: `CaptureSheet` ~3000
- Import 8a: `ImportSheet` ~8595
- Status: `StatusStage` ~3590, enums ~3489–3537
- Fit: `BodyProfileSheet` ~6155, `FitPrefsSheet` ~5543
- Agents: `agents.js` (fail-open wrap at open time)
- Styles: `credenza-fashion.css` (`PALETTES` → `--cz-*`, `t-modal`, reduced-motion)

---

## 2. Strengths (evidence)

### Looks
- **Coverflow is product-defining.** Photo-first card, heart, price pill, agent Buy, quiet “FLIP FOR MORE,” frosted dots/chevrons. Matches approved carousel contract.
- **Gallery / Blackout tokens** are coherent (`PALETTES` light / `rainbow` key for Blackout → `--cz-*`). Money green and heart red read as system accents.
- **Editorial hierarchy works:** serif titles, mono kickers, restrained hairlines. Grid money line (`TOTAL $…`) is clear and calm.
- **Haul cover fans** look premium and hobby-native without clutter.
- **Motion system is intentional:** `t-modal`, `t-acc`, stagger hero, like-pop, reduced-motion hooks. Not random spring spam on every control.
- **Mobile chrome** (stash pill + agent secondary) matches a real phone habit: capture first, money path second.

### Functionality
- **Reddit haul → N cards** exists (`reddit-haul.js` + stash modes + `reddit.js`). This is the Tier A1 aha.
- **Agent-agnostic Buy** is correctly architected (`agents.js`: wrap at open time, fail open, retired agents kept). Superbuy / Kakobuy / Fansbuy verified in comments.
- **Size decision path is real:** chart parse, chest/waist math, usual-size rough path, fit prefs length/looseness, chart-vision for Yupoo charts.
- **Weidian resolve** enriches title/price/variants/images (Netlify `resolve.js`).
- **Storage states + backup** recovery path exists; import/export JSON.
- **Tests:** 187/187 pass across fashion, haul, size chart, agents, storage, functions.
- **Canonical carousel guards** (select echo ref, preserve-3d, wheel bail on flipped content) show rare production discipline.
- **Delete continuity** uses visible list order (`listItemsRef`) and clamps carousel index (no jump to 0).

### Continuity (where it works)
- **One detail surface** after standardization (no competing DetailSheet / row flip stacks).
- **Shared primitives** (`StatusPill`, `SellerLink`, price display, `ModalShell`) reduce random control DNA.
- **Design handoffs** (turns 4–8) land as planned packages rather than drive-by restyles.

### Sleekness
- Progressive disclosure on status (track → picker) and category (row → chips).
- Capture placeholders use real source examples (mono), not bare “enter text.”
- Prefer silence over chrome: Buy sheen, heart burst, edge rubber-band — small moments, not dashboard noise.

---

## 3. Weaknesses (ranked)

### High
1. **Tier A incomplete vs north-star job.**  
   A3 is not a haul **pipeline board** (status lives on the card; no Want→Bought→QC→GL board aggregates).  
   **A5 QC attach + GL/RL workflow** is missing as a first-class photo path (status enums exist; warehouse QC gallery does not).  
   **A6 weight/ship estimator** is missing.  
   Without A5–A6, spreadsheets still win after purchase. Monetization.md §7 says do not polish holographics ahead of Tier A — recent work spent heavy cycles on modal/import chrome.

2. **Deploy / reality drift.**  
   HEAD is 13 commits past last deploy tag. Older mobile shots still show “Import and backup,” generic save-pile copy, and a 4-button bottom bar. Reviewers can grade the wrong product. Session-state header can lag git tags.

3. **Single-file gravity.**  
   ~12k-line JSX + ~7.6k CSS + ~489KB fashion bundle. Continuity and sleekness will erode under more design turns. Dead symbols accumulate (`localAsk`, `CapturePill`, `FIND_STATUS_GROUPS`, `dismissResurfaced`, unused edit-mode status path).

4. **Hard dependencies off the happy path.**  
   Reddit datacenter 403 without OAuth env. Affiliate referral codes largely empty until signups. Sign-in is a toast (“coming soon”) while Profile sells sync. Enrichment can fail silent; user may not know why a card is thin.

5. **Primary currency is partly fake.**  
   Profile stores `pricePrimary`, but main card faces still use a USD-first short label path. Users change the setting and see little or no change on the shelf. Trust defect.

6. **Capture sheet and Import sheet compete.**  
   Same paste job, different titles and side actions (“Stash to shelf” vs “Bring a haul onto your shelf” vs “Import from Reddit” that only sets haul mode). High continuity cost.

7. **PWA meta still says “replica fashion finds.”**  
   Fights `docs/Monetization.md` positioning (no App Store / paid-ad replica framing). Fix fashion HTML description before store or share push.

### Medium
8. **Status model vs human track.**  
   Enum has 7 agent states; track has 4 human stops. `qc|gl|rl` all map to **Bought** on the track. `returned` maps to **Received**. Correct for design 4a, but pipeline progress is not visible at a glance. `FIND_STATUS_GROUPS` is defined and unused (turn-4 grouped picker not shipped).

9. **Carousel vs list open model.**  
   Carousel = in-place flip; grid = scrim + `t-modal` solo card. Intentional after user feedback, but two mental models for “open this find.” Grid overlay is not full `ModalShell` / `<dialog>` focus trap.

10. **Accessibility debt.**  
    Fashion file alone: **12 eslint errors** (static click targets without keyboard role, incomplete `role="option"` props, `performance` undefined in env). Reduced motion is better covered than keyboard parity.

11. **Copy / product DNA split.**  
    Fashion is haul-first. Residual v3 “review layer / save pile” language and older shots still show. Profile promises multi-device sync without a backend. Empty-state “paste … above” is often wrong on phone (capture is bottom bar). Search on a true empty shelf dilutes Stash / Import.

12. **Fit UI density on narrow card backs.**  
    Size block + AI fit callout + haul picker + status + edit can stack into a wall of panels. Correct data; heavy read. Settings still say “AI fit summary” after visual redesigns.

### Low
13. Lint warnings (unused catch `e`, hook deps) — hygiene noise.  
14. Uncommitted `reddit-haul` deobfuscation dirty next to fashion work.  
15. Inline style chips (`SegmentedControl`) vs token CSS elsewhere.  
16. Theme prefs key `rainbow` = Blackout dark — agent cognitive tax.  
17. UI tests thinner than parser/engine tests (currency effect, status groups, restore errors, onboarding, overlay focus).

---

## 4. Continuity gaps (explicit)

| Gap | Symptom |
|-----|---------|
| Prod vs local | Shots/docs lag Import 8a, stash polish, modal rules |
| Session-state staleness | “Last updated” can conflict with git tags |
| Status vocabulary | Short QC/GL vs long labels vs 4-stop track; groups unused |
| Open patterns | Flip vs modal; overlay not native dialog |
| Capture entry points | Empty shelf, bottom bar, desktop field, type-anywhere, import sheet — uneven visual family until recent pass |
| Dual paste IA | Capture vs Import for same haul paste job |
| Currency story | Profile toggle vs USD-first card faces |
| Theme key name | Prefs key `rainbow` = Blackout |
| Monetization vs shipped UI | Affiliate registry ready; QC/ship/pipeline not |
| Dead code after design turns | Groups, CapturePill, localAsk, StatusUnderline edit mode |
| Meta positioning | “replica fashion finds” in fashion HTML |

---

## 5. Scores

| Dimension | Score | One-sentence rationale |
|-----------|------:|------------------------|
| **Looks** | **8.3 / 10** | Carousel, grid, hauls, and colorways look premium; some sheets and card-back stacks still feel design-lab dense. |
| **Functionality** | **7.0 / 10** | Stash → enrich → size → agent Buy works; currency UI, post-purchase QC/ship, pipeline board, and Reddit auth still gap the north-star job. |
| **Continuity** | **5.8 / 10** | Strong primitives and handoffs, but deploy lag, dual paste surfaces, dual open models, status mapping, and monolith residue break the “one product” feel. |
| **Sleekness** | **7.7 / 10** | Quiet motion and progressive disclosure win when surfaces are finished; fake doors (sign-in, currency) and unfinished Tier A undercut polish. |
| **Overall** | **7.1 / 10** | Best-in-class for a personal haul browser; not yet the complete haul OS Monetization.md describes. |

**Confidence in scores:** ±0.4 if production (not HEAD) is what peers actually open in a browser.

**Impeccable-style technical snapshot (secondary, 0–4 each):** Accessibility 2.5 · Performance 3 · Responsive 3 · Theming 3.5 · Anti-patterns 3 · **~15 / 20 Good**.

---

## 6. Peer comparison frame

**Where this audit is strong**
- Ties UI to **Monetization Tier A** and refuses to score pretty carousel as “done.”
- Separates **local HEAD vs production** so peers do not grade ghosts.
- Names **concrete code anchors** (agents fail-open, status track map, overlay only when `viewMode !== "carousel"`, currency path).
- Gives **action order** that respects product law (Tier A before more motion).
- Flags **replica meta string** and **dual paste IA** as product trust issues.

**Where peers may outscore this audit**
- Live device feel (scroll jank, keyboard, haptics) — this pass is code + stills, not a full device session.
- Brand/voice microcopy pass.
- Performance instrumentation (LCP, image decode, main-thread springs).
- Competitive matrix vs spreadsheet / Weidian app / agent apps.

**Dispute hooks for peers**
1. Is A5 QC more important than list-modal polish?  
2. Should status track expose agent sub-states?  
3. Is the monolith a ship blocker or only a maintainability tax?  
4. Should Capture and Import merge before any more design turns?

---

## 7. Top recommendations (priority order)

1. **Freeze a “truth build.”** Deploy only when Kyle chooses; until then, update `session-state.md` + one set of mobile shots so every model grades the same UI.  
2. **Ship Tier A5 QC attach** (paste warehouse URLs / photos, label distinct from product gallery, one-tap GL/RL + note).  
3. **Ship a minimal A3 pipeline view** (counts by Want/Bought/QC/GL/Shipped + one-tap status from card). Do not wait for a full Kanban.  
4. **Add A6 default weights by category** + haul weight sum; ship estimate can stay manual $/g later.  
5. **Make primary currency true on card faces, or remove the Profile row.**  
6. **Unify stash + import** into one sheet (tabs: Link | Haul | Note | Backup). One title. One primary CTA.  
7. **Rewrite fashion PWA meta** off “replica fashion finds” to agent-decision / organization language.  
8. **Wire Reddit OAuth env** (or honest UI: “Reddit link needs app credentials”) so haul import does not randomly fail.  
9. **Fill affiliate codes / verify Superbuy item attribution** so Buy is a money path, not only a deep link.  
10. **Ship status picker groups** (`FIND_STATUS_GROUPS`) and **show agent sublabel under the track** (example: “Bought · Quality check”).  
11. **Empty shelf: drop Search** until the first card exists.  
12. **Stop Profile from selling multi-device sync** until a backend exists — demote to “Saved on this device.”  
13. **Kill or quarantine dead code** (`localAsk`, `CapturePill`, `FIND_STATUS_GROUPS` if still unused after fix, `StatusUnderline` if unused, resurfacing dismiss).  
14. **Document one open model for users:** carousel flips; grid pops. Keep both, but name the rule so it feels designed.  
15. **Fix the 12 jsx-a11y errors** on fashion (roles + keyboard). Overlay should match `ModalShell` focus rules.  
16. **Align fit settings names** with turn-4 “We recommend” language (drop lagging “AI fit summary” label if the chip is gone).

---

## 8. What not to do next

- Do not start a W2C search / best-batch leaderboard (Tier C ban).  
- Do not reintroduce blurred full-rack modal on carousel (user rejected; contract is in-place flip).  
- Do not spend another design turn on import/stash chrome until A5 or A3 moves **or** capture/import is unified.  
- Do not rewrite carousel physics without reading `docs/carousel-canonical-state.md`.  
- Do not deploy without an explicit Kyle order.

---

## 9. Verification snapshot (this session)

| Check | Result |
|-------|--------|
| `npm test` (preview/) | **187 / 187 pass** |
| Fashion eslint | **12 errors, ~47 warnings** on fashion file |
| Typecheck | Clean (`tsc -p jsconfig.json`) |
| Bundle | `preview/dist/assets/index-fashion-*.js` ~489KB |
| Deploy tags | `deploy-2026-07-23` → `8c034f4`; HEAD ~13 commits ahead |
| Dirty (unrelated) | `reddit-haul.js` + test (left alone) |

---

## 10. One-line verdict

**Credenza Fashion looks and feels like a serious product on the shelf and in the carousel; it is still a decision browser more than a full haul OS until QC, pipeline, ship weight, currency truth, and one capture path exist.**

---

## 11. Self-grade of this review

| Criterion | Score | Note |
|-----------|------:|------|
| Thoroughness | **9.1 / 10** | Flows, product tiers, a11y, deploy lag, dead code, currency, dual paste, meta string, tests |
| Evidence quality | **8.5 / 10** | File-level + shot-level; not a full live UX session |
| Product honesty | **9.5 / 10** | Refuses to call a pretty shelf “complete” vs Monetization.md |
| Actionability | **9 / 10** | Ranked list tied to Tier A + trust fixes |
| Fairness to craft | **9 / 10** | Carousel, tokens, agents.js get full credit |
| Peer-usability | **9 / 10** | Clear scores + dispute hooks + deploy warning |
| **Self overall** | **9.0 / 10** | Strong audit artifact; weak on live perf/device feel |

---

## 12. Filename / discovery

- **This file:** `docs/Peer-review-2026-07-23-Grok-4.5.md`  
- **Suggested peer filenames:**  
  - `docs/Peer-review-2026-07-23-ChatGPT-5.6.md`  
  - `docs/Peer-review-2026-07-23-Kimi-3.md`  
- Put compiled strengths/decision log in: `docs/Peer-review-2026-07-23-synthesis.md` (when all three exist).

---

*End of Grok 4.5 peer review — 2026-07-23.*

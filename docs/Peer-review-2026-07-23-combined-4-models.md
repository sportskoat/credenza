# Credenza Fashion — Combined Peer Audit (4 Models)

**Date:** 2026-07-23  
**Branch:** `mobile-form-loop` @ `0088789` (local HEAD; about 13 commits ahead of last deploy tag)  
**Product rule:** Read `docs/Monetization.md` before you invent features.  
**Do not deploy until Kyle says so.**

---

## Models in this package

| # | Model | File | Method |
|---|--------|------|--------|
| 1 | **Grok 4.5** | `docs/Peer-review-2026-07-23-Grok-4.5.md` | Code + product docs + tests + mobile shots + git deploy distance |
| 2 | **Kimi 3** | `docs/Peer-review-2026-07-23-Kimi-3.md` | Live Chromium drive + 17 screenshots + real shelf (18 items) + functional probes |
| 3 | **Claude Opus 4.8** | Body of `docs/Peer-review-2026-07-23-synthesis.md` (Opus entry) | Live Playwright Chrome + axe + contrast math + tests + 20 screenshots |
| 4 | **ChatGPT 5.6** | *Not found in repo yet* | Slot reserved. Paste the ChatGPT report under §11 or as `docs/Peer-review-2026-07-23-ChatGPT-5.6.md`, then refresh the score table. |

**This document** merges scores, consensus, unique finds, and one joint action list.

---

## 1. Score board

Numeric scores use each model’s own scale. Opus used letter grades; those map as shown for comparison only.

| Axis | Grok 4.5 | Kimi 3 | Claude Opus 4.8 | ChatGPT 5.6 | **Median (3)** |
|------|--------:|-------:|----------------:|------------:|---------------:|
| Looks | 8.3 | 8.5 | B− (~7.7) | — | **~8.2** |
| Functionality | 7.0 | 6.0 | B (~8.0)* | — | **~7.0** |
| Continuity | 5.8 | 8.0 | C+ (~7.3) | — | **~7.3** |
| Sleekness | 7.7 | 8.0 | C (~6.5) | — | **~7.7** |
| **Overall** | **7.1** | **7.5** | **B− (~7.7)** | — | **~7.4** |
| Self-grade of review | 9.0 | 8.5 | A− | — | — |

\*Opus grades functionality high on “everything works + tests,” but lists Buy below the fold and Reddit link failure as still open.  
Kimi grades functionality low mainly because of the **P0 type-anywhere / search bug**.

**Shared gate all three saw:** **187 / 187 tests pass.** Typecheck clean. Lint about **12 errors** (plus many warnings).

---

## 2. One-line verdicts

| Model | Verdict |
|-------|---------|
| **Grok 4.5** | Serious product on shelf and carousel; still a decision browser, not a full haul OS, until QC, pipeline, ship weight, currency truth, and one capture path exist. |
| **Kimi 3** | Strong foundation and green tests. One P0 (search hotkey) dominates. Fix P0 + delete confirm → about 8.5. |
| **Claude Opus 4.8** | Parts are good. The shell around the parts is older and weaker (nested buttons, card-back fold, two layout grids). |
| **ChatGPT 5.6** | *Pending.* |

**Combined one-liner:**  
**Core craft (carousel, tokens, tests, size honesty, agent Buy) is strong. Shell, a11y nesting, search hotkey, card-back fold, dual paste IA, and unfinished Tier A (QC / pipeline / weight) cap the grade near 7.4.**

---

## 3. Consensus — all three models agree

These findings appear in at least two reviews, or one live probe confirms another model’s code claim.

### 3.1 Strengths (keep)

1. **Coverflow carousel is signature craft.** Guarded physics, flip discipline, reduced motion.  
2. **Gallery / Blackout token system is disciplined.** Money green + heart red as main chroma. Contrast work mostly holds.  
3. **Size / fit path is honest.** Rough vs precise; does not invent a size.  
4. **Agent Buy architecture is correct.** Canonical URL in storage; wrap + referral only at open; fail open.  
5. **Haul paste → N cards is real product value** (Tier A1).  
6. **Test suite is real** (187 tests).  
7. **Empty-shelf hero is strong** when finished (serif headline + ghost cards + clear CTAs).  
8. **One detail surface refactor was right** — do not re-add DetailSheet / row stacks; fix the existing back.  
9. **Motion system is intentional** (`t-modal`, accordions, reduced-motion guards).  
10. **Stats / agent name often match the data** when not on the wrong tab.

### 3.2 High-severity faults (fix before more polish)

| ID | Fault | Grok | Kimi | Opus | Severity |
|----|--------|:----:|:----:|:----:|----------|
| H1 | Nested interactive controls: card is a button that holds Star + Buy buttons; invalid HTML; axe nested-interactive (Opus: 27 serious desktop / 18 phone); React `validateDOMNesting` | — | P2 | **Critical** | **P0 / P1** |
| H2 | Type-anywhere hotkey steals desktop search keystrokes (`isTypingTarget` misses desk search shell); capture sheet swallows input | — | **P0** | — | **P0** |
| H3 | Card back hides ~46% of content; scrollbar hidden; Buy + full status track below fold | — | — | **Critical** | **P0 / P1** |
| H4 | Two layout grids on desktop: masthead ~720 px; content near full-bleed | — | — | **Critical** | **P1** |
| H5 | “Log in / Sign up” is a dead button / toast; Profile sells multi-device sync | Yes | — | **Critical** | **P1** |
| H6 | Dual Capture vs Import sheets for same paste job; mixed titles | Yes | Partial | Partial | **P1** |
| H7 | Primary currency setting does not drive main card price UI | Yes | — | — | **P1** |
| H8 | Status track maps qc/gl/rl → Bought; returned → Received; groups unused in picker | Yes | — | — | **P1** |
| H9 | First run shows live shell under intro; phone vs desktop disagree | — | — | **Critical** | **P1** |
| H10 | PWA / meta positioning wrong (“replica” and/or old v3 “come back to” copy); brand name mismatch | Yes | — | Yes | **P1** |
| H11 | No delete confirmation | — | P1 | — | **P1** |
| H12 | Tier A incomplete: no QC attach (A5), no pipeline board (A3), no ship weight (A6) | Yes | — | Partial (product vs Monetization) | **P1 product** |
| H13 | Reddit link import blocked without OAuth env | Yes | — | Yes | **P1 ops** |
| H14 | Local HEAD ≠ production; shots/docs lag | Yes | — | — | **P1 process** |

### 3.3 Continuity faults (shared)

- Stale v3 words (“projects” in search help).  
- Hauls tab keeps Shelf toolbar / “18 SAVED” style stats.  
- Prefs key `rainbow` = Blackout dark.  
- Empty shelf still offers Search when there is nothing to search.  
- AI fit naming lags visual redesign.  
- Dead code: `localAsk`, `CapturePill`, `FIND_STATUS_GROUPS`, etc.

### 3.4 Looks / sleekness faults (shared or measured)

- Buy **border beam** uses many hues forever (Opus: four hues; Kimi: rainbow edge reads like a bug).  
- Off-system **pink/cyan rim** on card back (Opus).  
- Dark cards lose silhouette (hairline too weak).  
- Light `--cz-hair` fails UI boundary contrast (~1.18:1) — Opus.  
- Mobile agent chip cramped next to wide Stash — Kimi.  
- Hauls tab sparse on large canvas — Kimi.  
- Title wrap breaks baselines across a grid row — Opus.  
- Carousel side cards show clipped title text — Opus.

---

## 4. Unique strengths by model

| Model | Unique value in this package |
|-------|------------------------------|
| **Grok 4.5** | Ties UI to Monetization Tier A/B/C. Flags currency truth, dual paste IA, deploy lag, replica meta, agent registry quality. Strong product strategy frame. |
| **Kimi 3** | **Reproduced P0 search hotkey** with real typing. Live zero page errors. Practical fix order (hotkey → desktop capture → delete confirm → Favorite nesting → stats copy). Continuity scored high from live consistency of agent/theme/status language. |
| **Claude Opus 4.8** | **Measured** card-back 46% fold, 720 px vs full-bleed grids, axe counts, WCAG ratios. Retracted a false Buy-tap claim after re-test. Full priority list with file:line anchors. |
| **ChatGPT 5.6** | *Pending — paste here when available.* |

---

## 5. Score disagreements (resolve with data)

| Topic | How models differ | Best evidence |
|-------|-------------------|---------------|
| Continuity | Kimi 8.0 vs Grok 5.8 vs Opus C+ | Kimi judged live agent/theme/status consistency. Grok/Opus judged deploy lag, dual paste, stale vocabulary, dual open models. **Both are true on different slices.** |
| Functionality | Kimi 6.0 (P0 hotkey) vs Opus B | If hotkey is real in current tree, Kimi’s lower score is correct for “type → filter → find.” Fix hotkey before re-score. |
| Sleekness | Kimi 8.0 vs Opus C | Kimi felt motion mature. Opus measured shell misalignment and fold. **Phone may score higher than desktop.** |
| Looks | All roughly 7.7–8.5 | Consensus: strong. Deductions = beam, rim, hairline, mono prices. |

---

## 6. Joint priority list (do this order)

### Gate 0 — truth and safety (same day)

1. **Confirm or fix P0 type-anywhere vs desktop search** (Kimi). Guard `.cz-desk-search-shell` (and all typing targets) in `isTypingTarget`.  
2. **Un-nest card buttons** (Opus + Kimi). Card = container; Star and Buy are siblings of open control. Clear React + axe nested-interactive.  
3. **Make first run exclusive** (Opus). Do not show search + agent bar under the intro. Match phone and desktop.  
4. **Gate or remove dead Log in** (Grok + Opus). Honest local-only copy until sync exists.  
5. **Do not deploy** until Kyle says so. Update `session-state.md` + one shot set so all models grade the same UI.

### Gate 1 — detail surface and shell (before next design turn)

6. **Card-back fold:** sticky Buy + scroll fade (or desktop two-column back). Stop hiding 46% with no cue (Opus).  
7. **One content max-width / gutters** for masthead, tabs, stats, grid, hauls (Opus).  
8. **Delete confirmation** (Kimi; Kyle already flagged).  
9. **FavoriteButton nesting** if not fixed by H1.  
10. **Primary currency truth** on card faces, or remove Profile row (Grok).

### Gate 2 — capture, status, copy

11. **Unify Capture + Import** (Grok; Opus/Kimi partial). One sheet: Link | Haul | Note | Backup.  
12. **Status groups and/or track sublabel** for QC/GL/RL (Grok).  
13. **Empty shelf: hide Search** until first card (Grok + Opus).  
14. **Hauls tab:** drop Shelf-only toolbar; fix stats copy for hauls context (Kimi + Opus).  
15. **Manifest + meta:** Fashion name, haul description, no “replica,” no pure v3 “come back to”; theme_color matches Gallery default (Grok + Opus).  
16. **Search help:** remove “projects” (Opus).  
17. **Zero-result search:** hide `$0.00` total (Opus).

### Gate 3 — looks polish (after shell is true)

18. Cut Buy beam to one hue or white sheen; drop pink/cyan card-back rim (Opus; Kimi beam note).  
19. Raise light and dark hairlines / card silhouette (Opus).  
20. Clamp titles to two lines; hide text on non-active carousel cards (Opus).  
21. Neutral source dots on capture (not red = error) (Opus).  
22. Soften mobile agent chip layout (Kimi).  
23. Rename prefs key `rainbow` → `dark` (Grok + Opus).

### Gate 4 — product Tier A (Monetization.md)

24. **A5 QC attach + GL/RL** (Grok).  
25. **A3 minimal pipeline counts** (Grok).  
26. **A6 category weights + haul weight sum** (Grok).  
27. Reddit OAuth env + honest UI if missing (Grok + Opus).  
28. Affiliate codes / Superbuy attribution verify (Grok).  
29. Rotate Anthropic key if still pasted historically (Opus / session-state).

### Gate 5 — hygiene

30. Fix 12 jsx-a11y lint errors; add browser globals for `performance` (all).  
31. Delete dead symbols (`localAsk`, unused chips, unused groups if still unused after fix).  
32. `loading="lazy"` on images below first row (Opus).  
33. Lazy-split sheets / framer if bundle stays ~500 KB (Opus).  
34. Landmarks: one `<main>`, one h1 (Opus).

---

## 7. What not to do (all models + product law)

- Do not build a W2C marketplace or best-batch leaderboard (Tier C ban).  
- Do not reintroduce blurred full-rack modal on carousel (user rejected).  
- Do not polish import/stash chrome again before Gate 0–2 or Tier A steps.  
- Do not rewrite carousel physics without `docs/carousel-canonical-state.md`.  
- Do not add a second detail surface; fix the one card back.  
- Do not deploy without Kyle’s order.

---

## 8. Strengths matrix (who called it out)

| Strength | Grok | Kimi | Opus |
|----------|:----:|:----:|:----:|
| Coverflow craft | ✓ | ✓ | ✓ |
| Token / contrast discipline | ✓ | ✓ | ✓ (measured) |
| Honest size engine | ✓ | ✓ | ✓ |
| Agent Buy fail-open registry | ✓ | — | ✓ |
| Haul parse value | ✓ | ✓ | ✓ |
| 187 tests | ✓ | ✓ | ✓ |
| Empty hero polish | ✓ | ✓ | ✓ |
| Reduced motion | ✓ | ✓ | ✓ |
| Delete neighbor clamp | ✓ | — | — |
| Live zero page errors | — | ✓ | — |
| Haul tile economics (count · $) | — | — | ✓ |

---

## 9. Weakness matrix (who found it)

| Weakness | Grok | Kimi | Opus |
|----------|:----:|:----:|:----:|
| Nested buttons / FavoriteButton | — | ✓ | ✓ (axe) |
| Search hotkey P0 | — | ✓ | — |
| Card-back 46% fold | — | — | ✓ |
| Two desktop grids | — | — | ✓ |
| Dead Log in | ✓ | — | ✓ |
| Dual Capture/Import | ✓ | Partial | Partial |
| Currency setting | ✓ | — | — |
| Status track ambiguity | ✓ | — | — |
| First-run shell bleed | — | — | ✓ |
| Meta / manifest / replica | ✓ | — | ✓ |
| No delete confirm | — | ✓ | — |
| Tier A QC/pipeline/weight | ✓ | — | Product frame |
| Reddit OAuth gap | ✓ | — | ✓ |
| Multi-hue Buy beam | Partial | ✓ | ✓ |
| Pink/cyan back rim | — | — | ✓ |
| Hairline contrast fail | — | — | ✓ |
| Hauls toolbar wrong | — | ✓ | ✓ |
| Deploy lag | ✓ | — | — |

---

## 10. Condensed per-model abstracts

### 10.1 Grok 4.5 — abstract

**Overall 7.1.** Product-first audit. Strengths: coverflow, tokens, haul paste, agent registry, size math, tests, delete neighbor. Gaps: Tier A3/A5/A6 incomplete; deploy lag; dual paste sheets; fake currency + sign-in; status groups unused; replica meta; monolith + dead code. Top moves: truth build, QC, pipeline, weights, currency truth, one capture sheet, honest account copy.

### 10.2 Kimi 3 — abstract

**Overall 7.5.** Live-drive audit. Looks 8.5, Continuity 8, Sleekness 8, Functionality 6. Headline defect: type-anywhere steals desktop search (reproduced). Also: no delete confirm; desktop capture sheet awkward; FavoriteButton nesting; search query sticks across tabs; hauls stats copy wrong. Fix P0 + P1s → ~8.5. Self-grade 8.5.

### 10.3 Claude Opus 4.8 — abstract

**Overall B−.** Measurement-first audit. Critical: nested interactive (27 axe), card-back 46% fold, dual layout grids, first-run bleed, dead Log in. Continuity: projects copy, manifest, rainbow key, hauls toolbar, $0.00 total. Looks: pink rim, 4-hue beam, mono prices, baseline wrap, clipped carousel text, weak hairlines. Keep size honesty, contrast, tests, empty shelf, one detail surface. Self-grade A−.

### 10.4 ChatGPT 5.6 — abstract

**Status: not in repo.**  
When available, add:

1. File `docs/Peer-review-2026-07-23-ChatGPT-5.6.md`  
2. Fill the ChatGPT column in §1  
3. Mark new unique rows in §8–§9  
4. Adjust medians and Gate list if ChatGPT finds a new P0  

---

## 11. Placeholder — paste ChatGPT 5.6 full report here

```
(ChatGPT 5.6 full audit text goes here, or replace this section by linking
 docs/Peer-review-2026-07-23-ChatGPT-5.6.md)
```

---

## 12. Decision guide for Kyle

| If you want… | Do first… |
|--------------|-----------|
| Trust while typing on desktop | Kimi P0 hotkey fix |
| Valid HTML + a11y | Un-nest card buttons (Opus/Kimi) |
| Users can always find Buy | Card-back sticky Buy + fade (Opus) |
| Desktop that looks like one app | One container width (Opus) |
| Honest product claims | Kill dead Log in; fix meta/manifest (Grok/Opus) |
| One paste story | Merge Capture + Import (Grok) |
| Real haul OS | QC + pipeline + weight (Grok / Monetization) |
| Grade jump without new features | Gates 0–2 only |

**Suggested freeze rule:** No new design-handoff turn until Gate 0 items 1–4 are done and measured.

---

## 13. File index

| Path | Role |
|------|------|
| `docs/Peer-review-2026-07-23-combined-4-models.md` | **This file — master** |
| `docs/Peer-review-2026-07-23-Grok-4.5.md` | Full Grok audit |
| `docs/Peer-review-2026-07-23-Kimi-3.md` | Full Kimi audit |
| `docs/Peer-review-2026-07-23-synthesis.md` | Currently holds full Claude Opus 4.8 entry (rename later if you add a real synthesis) |
| `docs/Peer-review-2026-07-23-ChatGPT-5.6.md` | *Create when ChatGPT report arrives* |
| `docs/Monetization.md` | Product law for Tier A/B/C |
| `docs/carousel-canonical-state.md` | Carousel do-not-regress contract |

---

## 14. Combined overall grade

| | Value |
|--|------:|
| **Median of three models** | **~7.4 / 10** |
| **After Gate 0 only (predicted)** | **~8.0–8.3** |
| **After Gate 0–2 (predicted)** | **~8.5** |
| **After Gate 4 Tier A core (predicted)** | **~9.0 product completeness** (looks may stay ~8.5 until Gate 3) |

---

*Combined by Grok 4.5 session · 2026-07-23 · Sources: Grok, Kimi 3, Claude Opus 4.8 · ChatGPT 5.6 pending*

# Credenza Fashion — Handoff to Grok (2026-07-23, post design package)

Read this file first. Also read `docs/session-state.md` and `docs/Monetization.md`.

---

## 1. What this project is

Credenza Fashion is a save-it-later app for fashion hauls.
The user pastes Weidian, Taobao, Yupoo, or Reddit links.
The app resolves price, photos, and size charts onto cards.
Cards live on a "shelf". Hauls group cards under names.
Buy buttons wrap links through affiliate agents (Superbuy, Sugargoo, and others).

Main UI: `credenza-fashion.jsx` + `credenza-fashion.css` + shared `credenza.css`.
Vite app: `preview/`. Production: https://credenza-kyle.netlify.app

---

## 2. Current state — READ THIS FIRST

- Branch: `mobile-form-loop`. All work happens here.
- Design packages applied:
  1. Mobile flow PR1–PR5 (`6b67948`…`9f19af7`) — deployed earlier
  2. `design_handoff_credenza` desktop/editorial/onboarding — deployed `8c034f4`
  3. Turn 4 (`design_handoff_credenza 2` §6b): status 4a/4b, category 4c,
     fit 4d–4g — **LOCAL ONLY, not deployed**
  4. Turn 5 (`design_handoff_credenza 3` §6c): per-category Length/Looseness
     fitPrefs — **LOCAL ONLY, not deployed**
- Last prod: fit-prompt layout fix `f0b7857`. Turn 4 is ahead of prod.
- **DO NOT deploy to Netlify.** Deploy only when Kyle says so:
  `cd preview && npx netlify deploy --prod --dir dist`
- Repo has NO git remote. Commits are local only.
- Tests: 178/178 pass. Typecheck clean. Lint: 12 errors, ~70 warnings.
- Fit prefs: `fitPrefs` in prefs; Profile → Fit preferences; first-open
  category ask; looseness nudges recommendSize.
- Body profile truth: `recommendSize` uses chest / waist|hip only. Height and
  weight do not score. Usual size = rough fallback. Progressive ask is
  category-dependent (tops chest, bottoms waist+inseam).
- ASD-STE100 for all user-facing text (`~/.claude/CLAUDE.md`).

---

## 3. What this pass changed

| Area | Behavior |
|---|---|
| Desktop ≥768px capture | Top row under logo: field + Stash clipboard + glass search toggle. Bottom bar hidden. |
| Mobile ≤767px capture | Bottom split-pill / ＋ Stash + Agent. Search field stays visible. |
| Fit display | "We recommend" + large serif size + muted reason. No AI-fit chip. |
| Status display | Order stepper (past filled, current money-green + halo, future hollow). |
| Status edit | Underline segment row (no pill fills). |
| Grid card | Editorial front: photo, status flag, heart on photo, serif title, green price. Buy on hover only. |
| Edit form | Title / price / size / colorway / underline status / Fit · auto / photos… |
| Onboarding | First-run intro when prefs lack `onboardingDone`. Fit prompt on first fit open if no body profile. |

Hard rules unchanged: no carousel internals, no storage/agents/parser rewrites,
Monetization.md guardrails, both prefs paths for new keys.

---

## 4. Key anchors

Search for the symbol name; line numbers drift.

| Thing | Symbol / class |
|---|---|
| Desktop top capture | `cz-desk-capture`, `deskSearchMode` |
| Mobile bottom bar | `cz-bottom-bar`, `cz-bar-mobile` |
| Fit 4d–4g | `SizeRecommendation`, `cz-fit4`, `cz-fit4-empty`, `cz-fit-prompt` |
| Status 4a/4b | `StatusStage`, `StatusChips` mode=display |
| Category 4c | `CategorySelect` |
| Fit prefs 5a–5c | `FitPrefsSheet`, `fitPrefs`, `FIT_PREF_AXES`, `applyFitPreference` |
| Editorial grid card | `Card`, `cz-card-editorial` |
| Fit prompt | `cz-fit-prompt` |
| Intro | `cz-onboard`, `onboardingDone` pref |
| Prefs save/load | `credenza-prefs-v1` effect + both load paths |

---

## 5. Verify

```sh
cd preview
npm run typecheck
npx vitest run
npm run lint    # 12 errors, ~69 warnings — do not grow errors
npm run build
```

---

## 6. Standing items for Kyle

- Deploy only when told.
- Optional: rotate Anthropic key if still concerned about earlier paste.
- Wire git remote → Netlify for push-to-deploy.
- Sign-in is still a toast (no auth backend).

---

## 7. Spec sources

- `~/Downloads/design_handoff_credenza/README.md`
- Card Mockups / Onboarding / Credenza Fashion.dc.html in that folder
- Earlier: `~/Downloads/design_handoff_mobile_flow/` (already shipped)

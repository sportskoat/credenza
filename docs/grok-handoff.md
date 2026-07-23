# Credenza Fashion — Handoff to Grok (2026-07-23)

Read this file first. It holds the full current state of the repo.
Also read `docs/session-state.md`. It is the living checkpoint.

---

## 1. What this project is

Credenza Fashion is a save-it-later app for fashion hauls.
The user pastes Weidian, Taobao, Yupoo, or Reddit links.
The app resolves price, photos, and size charts onto cards.
Cards live on a "shelf". Hauls group cards under names.
Buy buttons wrap links through affiliate agents (Superbuy, Sugargoo, and others).

The app is one large React file: `credenza-fashion.jsx` (~10,900 lines).
Styles live in `credenza-fashion.css` and the shared `credenza.css`.
The Vite build lives in `preview/`.
Production: https://credenza-kyle.netlify.app (Netlify project `credenza-kyle`).

## 2. Current state — READ THIS FIRST

- Branch: `mobile-fix-loop`. All work happens here.
- The design-handoff mobile flow (5 PRs) is DONE and COMMITTED locally.
- **DO NOT deploy to Netlify.** Kyle said more changes are coming.
  Deploy only when Kyle says so: `cd preview && npx netlify deploy --prod`.
- The repo has NO git remote. Commits are local only.
- Tests: 172/172 pass. Typecheck clean. Lint has 12 errors and 67 warnings.
  Those lint problems are pre-existing. Do not let the count grow.
- Kyle requires ASD-STE100 Simplified Technical English in ALL user-facing
  text. The rules sit in `~/.claude/CLAUDE.md`. Short sentences. Active
  voice. One instruction per sentence. No idioms.

## 3. The five commits of this session (newest first)

| Commit | PR | What it does |
|---|---|---|
| `9f19af7` | PR5 | Hauls parity confirmed. No code change. Session-state checkpoint. |
| `28c879b` | PR4 | AI fit summary callout under the Recommended-size block. |
| `1f8c5ce` | PR3 | Capture bar + profile sheet. The ⋯ menu is gone. |
| `4a2df40` | PR2 | Hero collapse. Full hero only when the shelf is empty. |
| `6b67948` | PR1 | Contrast tokens. Sub/faint ≥4.5:1 in both themes. |

Revert one PR: `git revert <hash>`.
Revert all five: `git reset --hard 6b67948^`.

The spec lives in `~/Downloads/design_handoff_mobile_flow/README.md`.
The reference prototype is `~/Downloads/design_handoff_mobile_flow/Credenza Fashion.dc.html`.
Do not recreate the prototype's control panel or phone bezel.

## 4. What each PR changed

### PR1 — Contrast (`6b67948`)
Only the `PALETTES` object in `credenza-fashion.jsx` (~line 40).
- Gallery (light): `--cz-sub` #4f545b, `--cz-faint` #6b7078.
- Blackout (rainbow): `--cz-sub` #b7bbc2, `--cz-faint` #9ea3ab.

### PR2 — Hero collapse (`4a2df40`)
The full "One shelf for the whole haul." hero renders only when
`items.length === 0`. A stocked shelf shows: compact masthead (logo mark +
CREDENZA Fashion + profile avatar), search, tabs, then the
`N SAVED · $TOTAL` stat line. The masthead display:none rule for mobile was
removed from `credenza-fashion.css`.

### PR3 — Capture bar + profile (`1f8c5ce`)
The one behavioral PR.
- Mobile bottom bar: when the clipboard is readable, a split pill on
  `--cz-action-fill`. Left: platform dot + `Clipboard · {platform}` + host.
  Tap opens the capture sheet. Right: `Stash ↑` for the 1-tap stash.
  When the clipboard is not readable: a full-width `＋ Stash` pill.
  The Agent button stays. The ⋯ menu is deleted.
- New components in `credenza-fashion.jsx` (~line 2717): `StashModeRow`,
  `CaptureSheet`, `ProfileSheet`. Both sheets reuse `ModalShell`.
- Clipboard detection: probe `navigator.permissions.query` for
  `clipboard-read`. Read only when granted. Never prompt without a gesture.
  `clipboardPreviewFor(raw)` (~line 1224) maps URLs to platform + host.
- Masthead avatar (`cz-avatar`) opens the profile sheet. The sheet has:
  Log in / Sign up (shows an honest toast — there is no auth backend),
  Theme rows, Your sizes, Default agent, Primary currency, AI fit rows
  (added in PR4), Import & backup, Storage.
- New pref `pricePrimary` ("USD"|"CNY") reorders dual-currency price
  labels. It uses the module-mirror pattern: `PRICE_PRIMARY` +
  `setPricePrimaryPref` (~line 225) read by `priceLabel`.
- On a stocked shelf the top capture box hides. Type-anywhere and paste
  open the capture sheet instead. `kb.current` carries the sheet flags.
- Desktop keeps an inline paste field in the bar (`cz-bar-desk`).
  CSS swaps the variants at 768px.
- All capture and parse handlers are unchanged. Only trigger UI moved.

### PR4 — AI fit summary (`28c879b`)
- `fitSummarySentence(rec, { runHint, units, detail })` (~line 575,
  exported, unit-tested in `preview/test/size-chart.test.js`).
- Renders inside `SizeRecommendation` under the Recommended-size block.
  A `--cz-bg` card, 1px `--cz-hair` border, green `AI fit` chip
  (`--cz-money` on the new `--cz-money-bg` token), the label
  "How it'll fit you", and one templated sentence.
- Concise = first clause. Detailed adds the run-hint and alt-size tail
  after an em-dash.
- Prefs: `fitSummary` (default true), `fitDetail` ("concise"|"detailed").
  Both are in BOTH prefs paths (the colorway migrate rewrite AND the
  normal load path). Toggles live in the profile sheet.

### PR5 — Hauls (`9f19af7`)
No code change. The existing `HaulCoverFan` directory already matches the
spec: fanned 3-tile stack, white border, rotations, +N badge, label card,
two-column grid, "Your hauls" heading.

## 5. Hard rules — do not break these

1. Do not touch carousel internals, `credenza-storage.js`, `agents.js`,
   or the resolver/parser.
2. Respect `docs/Monetization.md`: affiliate-first, no W2C marketplace,
   keep the FTC disclosure copy, Tier A/B/C agent routing.
3. Mobile changes stay inside `@media (max-width:767px)` or behind the
   768px variant switch. Desktop coverflow stays intact.
4. New prefs keys go in BOTH the save effect AND both load paths
   (colorway migrate rewrite + normal load). See `pricePrimary`,
   `fitSummary`, `fitDetail` for the pattern.
5. Keep tests green: `cd preview && npx vitest run`.
6. Follow ASD-STE100 in every user-facing string.
7. Never print secrets. Netlify functions are gated by `x-credenza-key`.

## 6. Verify before you commit

```sh
cd preview
npm run typecheck   # tsc -p jsconfig.json
npx vitest run      # 172 tests
npm run lint        # baseline: 12 errors, 67 warnings — do not grow
npm run build
node scripts/mobile-shots.mjs http://localhost:5173   # needs vite on :5173
```

The shot script seeds the real shelf from
`~/Downloads/credenza-shelf-2026-07-21.json` and writes to
`docs/mobile-shots/`.

## 7. Key anchors in `credenza-fashion.jsx`

| Thing | Approx. line |
|---|---|
| `PALETTES` (theme tokens) | 40 |
| `PRICE_PRIMARY` / `setFitPrefs` module mirrors | 225 |
| `recommendSize` | 440 |
| `fitSummarySentence` | 575 |
| `CLIP_PLATFORMS` / `clipboardPreviewFor` | 1220 |
| `StashModeRow` / `CaptureSheet` / `ProfileSheet` | 2717 |
| `SizeRecommendation` (fit callout renders here) | 4930 |
| `ModalShell` (bottom-sheet ≤767px via credenza.css) | 6860 |
| `AgentSheet` | 7310 |
| App state (captureSheetOpen, profileOpen, bodySheetOpen, clipPreview, pricePrimary, fitSummary, fitDetail) | 7740 |
| Prefs save effect | 7860 |
| Prefs load (both paths) | 7930 |
| Type-anywhere + paste handlers | 9290 |
| Hero (empty-shelf only) | 9970 |
| Haul directory surface | 9620 |
| Bottom bar (split pill / desk variants) | 10500 |

Line numbers drift. Search for the symbol name.

## 8. Standing items for Kyle

- The Anthropic API key was pasted into chat in an earlier session.
  Rotate it: console.anthropic.com, then `npx netlify env:set ANTHROPIC_API_KEY`.
- The repo has no git remote. Wire GitHub → Netlify for push-to-deploy.
- Sign-in is a toast. A real account backend does not exist yet.

## 9. Deploy (only when Kyle says so)

```sh
cd preview
npx netlify deploy --prod
```

Site: https://credenza-kyle.netlify.app

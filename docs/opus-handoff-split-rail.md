# Handoff: split-rail item detail (for Opus)

Date: 2026-07-28. Author: Fable 5 session. Tree is clean at `9c958db`, all pushed.

## STATUS: COMPLETE (Opus 5 session, 2026-07-28)

Increments (b) through (e) are done, gated and pushed. Every commit is CSS-only.

- `3248615` desktop split body
- `d511698` desktop modal frame
- `0514fa3` desktop footer
- `eed6c3c` phone size chips
- `9de9f2f` phone facts rows
- `00971d8` phone buy bar
- `9ea489c` phone status segment
- `315e0ac` phone hero, title, actions and note
- `22a75a2` phone body gutter

Gates hold at baseline after every commit: 2347 tests / 78 files pass, lint 0
errors 4 warnings, typecheck 0, build 0.

Spec interactions (:185-200) were checked against the code, not assumed. All
five already hold: a size chip never rewrites the AI pick; the accordions close
each other; a status pill jumps directly; `FIND_STATUS_NEXT` clamps at Received;
`buildTimeline` picks its size copy from the chart state.

Open deviations are listed under "Flags" at the end of this file.

## The task

Implement the spec at `/Users/kylewensel/Desktop/design_handoff_item_detail_split_rail/README.md` (303 lines).
The companion settings spec (`/Users/kylewensel/Downloads/DeveloperHandoffSettings`) is DONE. Do not reopen it.

Kyle's standing rule (near-verbatim): the app already has older wired-in versions of some catalog
parts. Do NOT dump the whole catalog in at once. "Copy over only the parts that are missing. One at
a time. Test after each one. I will watch for exactly this."

Kyle's font ruling: Clash wins. CH-17 (Montserrat) is SKIPPED. Add no new font.

## Hard rules

1. **RULE A** — commit and push every checkpoint. Never end a session with a dirty tree.
2. **RULE B** — never run `netlify deploy`. Only Kyle ships.
3. **Never touch:** `credenza-storage.js` · `agents.js` · the link resolver / `parseImport` /
   `runImport` / `restoreBackup` / `addSamples` · `CoverFlowCarousel.jsx` and its physics ·
   monetization guardrails (no W2C surfaces, affiliate handoff semantics, FTC disclosure copy) ·
   anything in `docs/carousel-canonical-state.md`.
4. **Concurrent edits** — Kyle's night queue edits the repo mid-session. Run `git status --short`
   before every commit. Stage only your own hunks.
5. **STE100** — write all Kyle-facing text (replies, reports, commit messages, docs) in
   ASD-STE100 Simplified Technical English. The full rule is in `~/.claude/CLAUDE.md`.
6. **Lean tokens** — grep-scope, minimal reads, batch edits, one gate run per change. Do not
   re-verify green results.
7. The session is autonomous. Implement directly. Do not post option menus or status-only replies.

## Gates (run once per increment)

Run from `/Users/kylewensel/credenza/preview`. Capture output to /tmp.

- `npm test` — baseline **2347 passed, 78 files**.
- `npm run lint` — baseline **"✖ 4 problems (0 errors, 4 warnings)"**.
- `npm run typecheck` — clean.
- `npm run build` — clean.

Commit from the repo root. Trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
(keep this trailer even in the Opus session — it credits the lane, not the model; add your own
trailer too if you prefer). The git identity warning on commit is harmless noise.

## Done (all pushed)

- `d36cdd3` tokens: `--cz-fit-band`, `--cz-sheen` in both palettes.
- `8d040c6` fit-read table under the pick.
- `5e3784e` "Forget this chart" also clears stored measurements.
- `9928c31` reading shimmer on the fit-read tracks.
- `88ed62e` pick sheen on a chart-read size.
- `9c958db` tab-kill: the detail tabs are gone. `DetailBody` now renders
  `<div className="cz-detail-facts">` with four always-visible
  `<section className="cz-detail-facts-section" aria-label="…">` blocks:
  Size and fit / Colorway / Weight / Haul. Field internals and save semantics unchanged.
  Tests assert `getByRole("region", { name: "…" })`. Six test files were rewritten
  (semantics preserved): detail-body, detail-sheet, desktop-detail-panel, fashion-app,
  sizing-nochart, fit-block-hunt.

## Remaining increments — one gated commit each, in order

### (b) Desktop split body — NEXT, recon complete, no edits made yet

Spec README :87 — split body `display:grid; grid-template-columns: 1fr 208px; gap: 20px`.
Spec :125 — Column B `border-left: 1px solid var(--cz-hair); padding-left: 20px; gap: 12px`.
Spec :127 — field pattern: label `500 10px var(--cz-mono) +0.14em var(--cz-faint)`, margin-bottom
6px, over a 32px control `1px var(--cz-hair)` radius 10 `var(--cz-card-solid)`.
Spec :129 — CRITICAL: values are `500 12px`, NOT 600. "At 600 they read as headings."

Key structural finding: in `components/DetailBody.jsx` the facts div closes near :2319.
**Category (near :2326) and Status (near :2346, `<StatusChips mode="track" …>`) sit OUTSIDE
`.cz-detail-facts`.** So Column B can hold only Colorway / Weight / Haul without a DOM move.
Decision made: leave Status outside for increment (b). Flag it in the final report. A DOM move
of Status into the facts div can be its own later increment if Kyle wants the full spec Column B.

Plan (pure CSS, desktop-scoped):

1. In `credenza-fashion.css`, inside the `@media (min-width: 1024px)` block (opens near :12217):
   - `.cz-dpanel-body .cz-detail-facts { display: grid; grid-template-columns: minmax(0,1fr) 208px; gap: 20px; }`
   - Put "Size and fit" in Column A:
     `.cz-dpanel-body .cz-detail-facts-section[aria-label="Size and fit"] { grid-column: 1; grid-row: 1 / span 3; }`
   - Colorway/Weight/Haul stack in Column B with
     `border-left: 1px solid var(--cz-hair); padding-left: 20px;`.
   - Neutralize the mobile sibling rule in this scope: the base
     `.cz-detail-facts-section + .cz-detail-facts-section` rule (near :9974) adds
     `margin-top: 16px; border-top: 1px solid var(--cz-hair);` — set `border-top: none;
     margin-top: 0;` (or per-section margins) inside the desktop scope.
2. Column B typography, desktop-scoped ONLY:
   - Labels: `500 10px var(--cz-mono)`, letter-spacing 0.14em, `var(--cz-faint)`, margin-bottom 6px.
   - Values/inputs: `font-size: 12px; font-weight: 500;`.
   - **TRAP:** a global edit to `.cz-detail-custom-size, .cz-detail-panel-field` typography was
     tried and reverted in an earlier window. Mobile must keep its label style. The
     `.cz-detail-editor-input` base rule (near :10888) has the comment "16px is mandatory:
     anything smaller makes iOS zoom the page on focus" — the 16px floor and its rule stay
     untouched. Apply 12px only under `@media (min-width: 1024px)` + `.cz-dpanel-body`.
3. Gate, `git status --short`, stage only your hunks, commit
   `Split rail: desktop split body`, push.

### (c) Desktop modal frame

Spec :40–60: frame width 1080px, grid `372px 1fr`, radius 20px, shadow
`0 24px 60px rgba(23,24,26,0.16)`. Right column padding `18px 20px 0`, gap 15.

Tension: the current 1024px block (near :12217) sets `.cz-dpanel` to
`grid-template-columns: 470px minmax(0,1fr)` with a comment that 470px superseded 634px per an
OLD handoff. The NEW spec says 372px. Changing 470→372 is a real visual decision — make the
change (the new spec is newer), but flag it prominently in the final report so Kyle can veto.
Kyle's comments in that block are load-bearing: `minmax(0,1fr)` on the row is required for the
Buy footer; the lognotes notes-box is pinned to one height (no-card-resize rule, Kyle
2026-07-27). Do not disturb those.

### (d) Footer

Spec :140–149: border-top hair, `--cz-footer-bg`, padding `13px 20px 11px`.
Price `600 20px var(--cz-display) -0.03em var(--cz-money)` — **display face, NOT mono**.
Current rule near :12186: `.cz-dpanel-body .cz-detail-foot-price` is mono 700. Change it
desktop-scoped. Buy button flex-1 h44 radius 999 `600 13.5px`; caret 42px with
`border-left: 1px solid var(--cz-action-text-divider)`; agent menu bottom 62 / left 92 / w210,
radius 12, shadow `0 14px 34px rgba(23,24,26,0.18)`, z6, items 30px. Disclosure inline right,
max-width 150px. The foot-price is a `<button>` with `aria-label="Edit price: …"` (DetailBody
near :2398) — keep the button semantics.

### (e) Phone sheet

Spec :154–181: one scroll, order photo → title → pick → fit read → size → facts → status →
timeline → note. Hero 292px. 44×44 hit targets with `drop-shadow(0 1px 4px rgba(0,0,0,0.45))`
on glyphs — no pucks. Size chips full-width flex-1, 44px, 13px mono. Facts have NO dropdown
menus on phone — 48px rows (label 10px mono in an 82px gutter, value 500 13px sans, chevron)
that expand to wrapping 38px chip rows in place. Weight keeps an inline 26px g/kg segment.
Status is a segmented control on `--cz-seg`, 3px padding, four 34px pills, plus a 44px Mark
button. Buy bar 48px. Agent picker is a chip row ABOVE the bar. Touch floors ≥44px are
non-negotiable. This increment is the largest — split it further if it grows.

Spec interactions (:185–200), mostly done: Forget-chart clears measurements (done, 5e3784e);
a size chip sets the chosen size and never changes the AI pick; opening one menu closes the
others; a status row jumps directly; advance clamps at Received ("Mark bought" → "Mark
shipped" → "Mark received" → "Received"); timeline copy reacts to chart state. Verify each
against the current code before you assume it is missing.

## Structure map (anchors verified 2026-07-28; line numbers can drift — grep first)

`components/DetailBody.jsx`:
- :831 `SizeChoiceEditor`. `HaulAccordionField` lives in `components/HaulAccordionField.jsx`.
- :2077 `.cz-detail-facts` opens; :2078 section "Size and fit" (closes :2244);
  :2246 "Colorway"; :2264 "Weight" (input + `.cz-detail-unit` g/kg group);
  :2310 "Haul" (`HaulAccordionField`); :2319 facts div CLOSES.
- :2326 Category rule-head + CategorySelect; :2346 Status rule-head + StatusChips — outside facts.
- :2392 `.cz-detail-foot`; :2398 foot-price button; :2415 BuyNotch.

`credenza-fashion.css`:
- :9972–9986 facts block styles. :10072 `.cz-detail-custom-size, .cz-detail-panel-field`.
- :10887–10900 `.cz-detail-editor-input` base (16px iOS rule). :10926 `.cz-detail-unit`;
  :10934 `.cz-detail-unit-btn`. :4744+ `.cz-haul-acc*` rules.
- :11728 `@media (min-width: 768px)` dpanel block opens; :12156 `.cz-dpanel-body`;
  :12162 scroll padding; :12177 foot; :12186 foot-price (mono 700 — increment d changes it);
  :12212 block closes.
- :12217 `@media (min-width: 1024px)` block: `.cz-dpanel` 470px grid, stage, left border,
  lognotes. Kyle's load-bearing comments live here.

`components/DesktopDetailPanel.jsx`: :263 scrim dialog; :275 `.cz-dpanel`; :450
`.cz-dpanel-right`; :504 `.cz-dpanel-body` hosts DetailBody at :505.

## Known traps

- Vitest module-mock import order is load-bearing: await `DetailBody.jsx` BEFORE the app root
  in tests that mock part of `credenza-fashion.jsx`.
- Motion-tokens test: "6s" is allowlisted.
- `Edit` tool multiple-match on the sizing value-row — widen `old_string`.
- zsh: `===` as a separator fails. Capture test output to /tmp. Shell cwd persists.
- `credenza-fashion.jsx` is ~9000 lines. Read only anchored slices.

## Flags for the final STE100 report to Kyle (accumulate, deliver at the end)

- CH-17 skipped (Clash wins, Kyle's ruling). No new font.
- Sample-shelf conflict. CO-22 neutral dot vs per-source colors. Ghost tiles removed vs CH-11.
- CH-12/CH-13 superseded by modal-stack settings (deep links implemented; FitPrefsSheet deltas
  not). CH-15 disclosure-only — the spec limit numbers conflict with live Stripe pricing; live
  is canon. CH-16 fully superseded. CH-05 no-edit-mode decision.
- `--cz-display` Georgia→Clash tension: the share-card canvas is deliberately Georgia.
- Guide-fix `f1345bf`. Kyle checkpoints `bb6f760`/`3b14a65`/`57ba754`/`a5a06f7`/`92cbaea`/
  `e908d44`. `4ba9deb` mixed authorship.
- The six detail-tab test files were rewritten in the tab-kill (semantics preserved) — this
  deviates from the earlier plan constraint that named five of them "do not edit". Flag it.
- iOS 16px input floor kept over the spec's 12px value size on mobile (12px is desktop-only).
- 470px vs spec-372px photo column (increment c decision).
- Status sits outside the facts column — Column B is Colorway/Weight/Haul only (if that stands).
- FIT_DETAIL fixed by CH-14.
- The Credenza auth secret was exposed in a chat. Rotation is Kyle's action — remind him.
- No Netlify deploys were run (Rule B).

New in the Opus 5 session:

- The photo column is now 372px, per the new spec. The 470px value came from an
  older handoff. This is a real visual change Kyle can veto.
- The CSS contains dead `[data-theme="dark"]` selectors. The live palette keys
  are `light` and `rainbow`. The new modal shadow is scoped to `light`.
- Phone Colorway stays a free-text input. The spec wants a chip row, but the app
  has no fixed colorway option set, so chips would drop seller-named colorways.
  Haul already expands chips in place.
- The spec's 26px g/kg segment keeps a 44px hit area through an `::after`
  pseudo-element. The 34px status pills use the same trick.
- The phone fit scale drops `TRUE` by CSS, not by markup. The test that asserts
  `TIGHT` still passes.

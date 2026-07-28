# Split rail — remaining work

Handoff written 2026-07-28 by the Opus 5 session, for the next agent.

Read `docs/opus-handoff-split-rail.md` first. It holds the hard rules, the gate
commands and the flag list. This file holds only what is NOT done.

Spec source: `/Users/kylewensel/Desktop/design_handoff_item_detail_split_rail/README.md`.
Kyle also has a copy at `~/Downloads/Credenza detail layout iterations.zip`.

## Hard rules (unchanged)

1. Commit and push every checkpoint. Never leave the tree dirty.
2. Never run `netlify deploy`. Only Kyle ships.
3. Never touch `credenza-storage.js`, `agents.js`, the link resolver,
   `CoverFlowCarousel.jsx`, the monetization guardrails, or anything in
   `docs/carousel-canonical-state.md`.
4. Run `git status --short` before every commit. Kyle's night queue edits the
   repo at the same time. Stage only your own files.
5. Write Kyle-facing text in ASD-STE100 Simplified Technical English.
6. Gates run from `preview/`: `npm test`, `npm run lint`, `npm run typecheck`,
   `npm run build`. Baseline is 2347 tests / 78 files, lint 0 errors 4 warnings,
   typecheck 0, build 0.

## Done in the Opus 5 session

Commits `3248615` `d511698` `0514fa3` `eed6c3c` `9de9f2f` `00971d8` `9ea489c`
`315e0ac` `22a75a2` `e2398e8` `0c19cbc`.

The last one is the important one for context. Kyle opened the desktop modal and
said the size was in four places at once. `0c19cbc` deleted the "Item size"
heading, the "Recommended Large" note and the full-width Custom size bar. The
chip run plus a short OTHER field is now the only place a size is set. The
no-chart caption also stopped calling a hand-picked size "your usual".

## Kyle's two rulings (2026-07-28)

1. **Custom size stays**, on both screens. It must be inline with the pick, not
   a separate bar. Sellers use `170/92A`, `EU 44` and `One size`; chips cannot
   hold those.
2. **The phone uses the reference stacking order**, approved:
   photo → title → pick → fit read → size → facts → status → timeline → note.
   Status moves up. Today it sits below Category, near the bottom.

## Remaining increments

One gated commit each, in order. Do not batch them. Kyle watches for exactly
that.

### (1) Move the size chips into Column B — DONE `d06efc4`

SizeChoiceEditor has its own "Size" section between "Size and fit" and
Colorway. Desktop: rail row 1, 28px spec chips, ::after hit ring. The visible
rail label is desktop-only; the section keeps aria-label="Size". The Other
field stays inline (ruling 1). fashion-app.test.jsx reads the chips from the
"Size" region now.

### (2) Move the status track into Column B — DONE `49072f7`

Rule head + StatusChips live in a "Status" section after Haul, inside
.cz-detail-facts. The vertical radio list is CSS only; StatusTrackChips was
not rewritten. The advance pill is the spec's 30px outlined pill, placed
under the rows — margin-top:auto from spec :138 pins it below the fold
because our Column A is taller than the prototype's. Phone order is now
facts → status → category → timeline (Category kept its CH-07 spot; the
ruling's approved list did not mention it).

### (3) Sub line and chart-action pills — DONE `adc9f0a`

Sub line is 10px mono uppercase on desktop. Chart actions are two 32px
pills in a row on desktop (upload black primary, edit outlined), still
stacked 44px on the phone.

### (4) Colorway swatch button

Spec `README.md:130`: a 10px swatch, the value, and an 11px chevron, opening an
absolute menu. Options White `#E8E8E2`, Black `#1b1b1d`, Navy `#25314b`, Sand
`#c9bda6`.

Blocked on a decision. Colorway is free text today
(`components/DetailBody.jsx:2246`). Real items carry seller-named colorways that
are not in a fixed list. A chip-only control loses them. Ask Kyle whether the
menu keeps a free-text row at the bottom before you build this.

## Open flags for Kyle

Carry these forward; they are not resolved.

- The photo column moved from 470px to the spec's 372px. Kyle can veto it.
- The CSS holds dead `[data-theme="dark"]` selectors. The live palette keys are
  `light` and `rainbow`.
- The iOS 16px input floor beats the spec's 12px value size on the phone. Under
  16px, iOS zooms the page on focus.
- The phone fit scale drops `TRUE` by CSS, not by markup, because
  `preview/test/fit-read-table.test.jsx:153` asserts on `TIGHT`.
- The Credenza auth secret was exposed in a chat. Rotation is Kyle's action.
- No Netlify deploys were run.

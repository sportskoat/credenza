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

### (1) Move the size chips into Column B

The spec puts SIZE at the top of the 208px facts rail (`README.md:129`).
`SizeChoiceEditor` currently renders as the first child of Column A, at
`components/DetailBody.jsx:2079`, inside
`<section aria-label="Size and fit">`.

This is a DOM move, not CSS. Grid re-orders boxes inside one parent; it cannot
pull a node into a different parent.

Target chip style, spec `README.md:129`: 28px tall, `min-width: 40px`, padding
`0 10px`, radius `999px`, `11px --cz-mono` / `+0.04em`. Selected is `--cz-ink`
fill on `--cz-bg` text at weight 600. Unselected is `1px --cz-hair` on
transparent, `--cz-sub`, weight 500.

Trap: `credenza.css:476` has a `@media (pointer: coarse)` block pinning
`.cz-detail-size-choice` to 44px. A 28px visual needs a 44px `::after` hit area.
`.cz-detail-hero-btn` and the status pills already use that pattern — copy it.

Tests that will move with it, all by accessible name, so they should keep
passing if the names hold:
- `preview/test/fashion-app.test.jsx:1436` expects the X-Large button inside
  `getByRole("region", { name: "Size and fit" })`.
- `preview/test/fashion-app.test.jsx:1440,1548` read
  `getByRole("textbox", { name: "Custom item size" })`.
- `preview/test/fashion-app.test.jsx:1487` clicks `"Clear size"`.
- `preview/test/sizing-nochart.test.jsx:139` and
  `preview/test/fit-block-hunt.test.jsx:124,171` read the same textbox.

If the chips leave the "Size and fit" region, `fashion-app.test.jsx:1436` fails.
Decide whether to widen the region or update that one assertion, and say which
in the commit message.

### (2) Move the status track into Column B

`StatusChips mode="track"` renders at `components/DetailBody.jsx:2356`, far
below Category, outside `.cz-detail-facts`. The spec puts four 25px rows plus a
`Mark bought` advance button at the foot of the rail (`README.md:133-134`).

The component is `StatusTrackChips` in `components/atoms.jsx:541`. It already
renders the advance pill from `FIND_STATUS_NEXT` and already clamps at Received.
Do not rewrite it. Move the call site and restyle.

The phone stack changes with it. That is approved — see ruling 2 above.

The desktop rail CSS is at `credenza-fashion.css:12787`, inside the
`@media (min-width: 1024px)` block. The comment there says Status was left
outside on purpose. Update that comment when you move it.

### (3) Sub line and chart-action pills

- The sub line reads `saved Jul 18`. The spec wants
  `BEVERLY-LUXURY · SAVED JUL 18` in `500 10px --cz-mono` / `+0.10em` /
  `--cz-faint` (`README.md:97`). The seller name is `item.seller`.
- The two chart actions stack full width. The spec wants two 32px pills in a row
  on desktop (`README.md:106`). The phone keeps them stacked at 44px
  (`README.md:174`) — that part is already correct.

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

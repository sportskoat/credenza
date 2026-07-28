# Known drift

Places where the Design project and the repo disagree today. Checked 2026-07-28.

## 1. The display font — needs a decision from Kyle

- Design says: `--cz-display` is `"Clash Grotesk"`. The serif was retired on 2026-07-28.
- The repo says: `--cz-display` is `Georgia, "Iowan Old Style", "Times New Roman", serif`.
  See `credenza.css:30`.

`credenza-fashion.css` uses `var(--cz-display)` in at least 3 places, so this
controls real headings on the live site. The design system and the shipping app
currently show different letterforms.

**Decision needed:** keep Georgia, or switch the app to Clash Grotesk.
Nobody should change `credenza.css:30` until Kyle says which one wins.

## 2. Colour lives in two files

- Design: `tokens/colors.css`.
- Repo: the `PALETTES` object in `credenza-fashion.jsx` (~line 141), 108 entries.

The values match today. Nothing keeps them matching. If you change a colour,
change both.

## 3. Design's spacing tokens are not used in the repo

`--space-4`, `--radius-card`, `--type-body`, `--shadow-card`, `--tap-min`, and
`--shelf-gap` each return zero uses in the repo. The values are correct, but the
repo hardcodes them at each call site instead of naming them.

Only `--cz-sans` (26 uses) and `--cz-mono` (107 uses) are live.

This is why the linter reports raw px warnings. The token exists; the code does
not reach for it.

## 4. Raw values the linter now warns about

First run after wiring the rules: 33 warnings in the UI layer.

- 8 raw hex colours
- 25 raw px values
- 0 font-family violations

These are warnings, not errors. They do not block a build. Burn the count down
over time, then change `"warn"` to `"error"` in `eslint.config.js`.

`credenza-fashion.jsx` is excluded from the scan on purpose. It defines the
palette, so raw hex is correct there.

## 5. Two things Design does not have

- `CoverFlowCarousel` and its physics. Never recreate it from a design.
- The photo-morph view transition.

Both are repo-only. A design that appears to replace them is wrong.

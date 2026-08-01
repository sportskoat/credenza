# Credenza design rules

These rules come from the Claude Design project `Credenza Fashion Design System`.
They are hard constraints. Do not break one without asking Kyle first.

## Words

- Write in second person, present tense. "Paste a link." Not "Users can paste links."
- Use sentence case for every heading, button, and label. Never Title Case.
- Write short declaratives. End each one with a period.
- Say what a thing is NOT when that removes doubt. Credenza never takes money.
- Use numbers, not adjectives. "12 items" beats "several items".
- Disclose money inline, where the money is. Do not hide it in a footer.
- Use community vocabulary without a gloss. "Haul", "QC", "W2C", "spreadsheet".
- Never use an emoji. Never use an exclamation mark.
- Label buttons with a verb. "Save", "Open album", "Add to haul".
- Use the middle dot `·` as the separator. Not a pipe, dash, or slash.

## Colour

- The chrome is near-monochrome on purpose. The product photos own the colour.
- Gallery (light) canvas is `#F4F4F0`. Blackout (dark) canvas is `#050506`.
- `--cz-accent` is ink, not a colour. Do not treat it as a brand hue.
- `--cz-faint` is the lightest ink that stays readable. Never go lighter.
- Only three hues are allowed in the chrome: money green, like red, album-link blue.
- One blue per card. `--cz-link` is that blue. Do not add another.
- Brand-mark colours are identical in both themes. A mark that re-tints is not a mark.
- Never write a raw hex value in a component. Use `var(--cz-*)`.

## Type

- The display serif was retired on 2026-07-28.
- Kyle 2026-08-01 (Kimi feel): body chrome uses system UI sans. Clash Grotesk
  (the gothic face) is for the wordmark and select brand titles only. Mono is
  for sizes, weights, prices, and counts.
- Never set a heading at the wordmark's `0.16em` tracking.
- Marketing type is fluid (`clamp`). App type is fixed px. The shelf is a dense tool.

## Space

- Credenza does not sit on a 4/8px grid. Rounding a value to the grid is a defect.
- Known odd values that are correct: 13px card padding, 42px Buy, 52px hero field, 10px shelf gap.
- App shell max width is 1080px. Marketing site max width is 1120px.
- The touch floor on a coarse pointer is 44px. This is non-negotiable.
- Never write a raw px value in a component. Use a spacing or radius token.

## Motion

- One easing curve: `cubic-bezier(0.23, 1, 0.32, 1)`.
- Four durations only: 120ms press, 140ms micro, 250ms open, 300ms resize.
- Nothing bounces. Nothing overshoots.
- Two press scales only: `0.96` for small controls, `0.98` for full-width rows.
- Honour `prefers-reduced-motion`. The repo has `usePrefersReducedMotion` already.

## Elevation

- Gallery keeps shadows nearly flat. The hairline separates, not the shadow.
- Blackout goes deeper. A light shadow is invisible on true black.
- One focus recipe everywhere: `2px solid var(--cz-focus)` at `2px` offset.

## Cards

- The photo is 4:5 and sits flush to the card edge.
- The heart never overlaps the status flag.
- Buy is hidden at rest. It fades in on hover for FINE pointers only.
  On a touch screen a hover-reveal steals the first tap.
- The title always reserves two lines. That keeps price rows on a shared baseline.
- `sizeLive` means the size came from a real size chart. That is what earns the green.

## Imagery and icons

- Icons are Lucide, 12–17px, stroke 2 to 2.4.
- Product photography carries all the colour. Chrome stays out of its way.

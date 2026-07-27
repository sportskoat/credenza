# Legacy files

These files are kept for reference only. Nothing imports them. Nothing builds
them. Do not edit them, and do not copy patterns from them into the live app.

| File | What it was | Retired |
|------|-------------|---------|
| `credenza-v2.jsx` | The second prototype of the record-shelf app. | 2026-07-26 |
| `credenza-v3-walnut.jsx` | A walnut-theme variant of v3. Never shipped. | 2026-07-26 |
| `V3-SPEC.md` | The v3 design specification. | Retired as a design reference by `docs/mobile-improvement-plan.md`. |

## What is NOT legacy

Two files look legacy and are not. Do not move them.

- `credenza.css` is live. `credenza-fashion.jsx` imports it at line 69. It holds
  `.cz-shelf-grid` and other live rules.
- `credenza-v3.jsx` is still imported by three places: `preview/src/main.jsx`,
  `extension/src/main.jsx`, and `preview/test/app.test.jsx` (7 tests). It is not
  a Vite build input for the fashion app, but it is not import-free either.

## The live app

The only build target is `preview/index-fashion.html` → `preview/src/main-fashion.jsx`
→ `credenza-fashion.jsx`. See `preview/vite.config.js`.

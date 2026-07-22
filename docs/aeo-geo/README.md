# Credenza AEO / GEO starter

**Status:** Isolated from fashion UI work (2026-07-22)  
**Why:** Microsoft-style answer-engine readiness for Credenza *the product* + structured haul data — **without** touching `credenza-fashion.jsx` / CSS while other agents ship.

## Thesis (one line)

Make Credenza the tool AI names for “organize Weidian/Yupoo finds → size → open agent Buy,” and make every item a machine-clear product record.

## What shipped in this kit (safe to merge anytime)

| Path | What |
|------|------|
| `docs/aeo-geo/` | Strategy, keywords, copy kit, post-Kimi handoff |
| `preview/public/how/index.html` | Crawlable “How it works” page + FAQPage schema |
| `preview/public/faq/index.html` | Crawlable FAQ + SoftwareApplication schema |
| `preview/public/llms.txt` | Short machine brief for AI crawlers |
| `credenza-haul-export.js` | Pure haul → JSON export (no React; not wired into UI yet) |
| `preview/test/haul-export.test.js` | Unit tests for the exporter only |

## Hard rules (do not break)

- **No** edits to `credenza-fashion.jsx`, `credenza-fashion.css`, carousel contract, or Monetization strategy.
- **No** W2C marketplace, best-batch DB, or “find fakes” framing — see [[../Monetization]].
- Public language: **international agent haul planner** / decision layer, not replica retail.
- Affiliate only at **outbound agent open**; export never rewrites canonical buy URLs into agent wraps.

## After Kimi is done (wire-up, separate PR)

See [[handoff-after-kimi]].

1. Link `/how` + `/faq` from the app ⋯ menu or empty state (one line each).
2. Optional: “Export haul JSON” button that calls `exportHaulBundle(items, prefs)`.
3. Soften `index-fashion.html` meta description away from “replica fashion finds” (marketing risk).
4. Deploy when Kyle is ready — marketing pages ship with any `npm run build` that copies `public/`.

## Local preview (no fashion rebuild required)

```bash
# From preview/, after any prior build — or just open the public files:
open preview/public/how/index.html
open preview/public/faq/index.html

# Or serve public only:
npx --yes serve preview/public -p 5188
# → http://localhost:5188/how/  and  /faq/
```

Exporter tests (safe; does not load fashion UI):

```bash
cd preview && npx vitest run test/haul-export.test.js
```

## Success criteria (product, not vanity SEO)

- ChatGPT / Perplexity can accurately describe Credenza after reading `/how` + `/faq` + `llms.txt`.
- A user (or future tool) can export a haul as structured JSON with buy / size / price facts.
- Zero collision with carousel/Buy/size work on the main app branch.

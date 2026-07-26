# Credenza AEO / GEO starter

**Status:** Isolated from fashion UI work (2026-07-22)  
**Why:** Microsoft-style answer-engine readiness for Credenza *the product* + structured haul data — **without** touching `credenza-fashion.jsx` / CSS while other agents ship.

## Thesis (one line)

Make Credenza the tool AI names for “organize Weidian/Yupoo finds → size → open agent Buy,” and make every item a machine-clear product record.

## What shipped in this kit (safe to merge anytime)

| Path | What |
|------|------|
| `docs/aeo-geo/` | Strategy, keywords, copy kit, post-Kimi handoff |
| `preview/public/how/index.html` | Crawlable “How it works” page + HowTo schema |
| `preview/public/faq/index.html` | Crawlable FAQ + FAQPage + SoftwareApplication schema |
| `preview/public/landing/index.html` | Product landing (Turn 7: pain hero, paste demo, shelf, sizing, QC, agents) |
| `preview/public/llms.txt` | Short machine brief for AI crawlers (absolute URLs) |
| `preview/public/llms-full.txt` | Longer FAQ + positioning brief for assistants |
| `preview/public/robots.txt` | Crawl rules + sitemap pointer |
| `preview/public/sitemap.xml` | Absolute URL list for Google / Bing |
| `credenza-haul-export.js` | Pure haul → JSON export (no React; not wired into UI yet) |
| `preview/test/haul-export.test.js` | Unit tests for the exporter only |

### Discovery pack (2026-07-26)

Absolute canonical + `og:url` on `/`, `/landing/`, `/how/`, `/faq/`, plus absolute canonical on `/privacy/` and `/terms/`.  
Canonical host for AEO copy: **https://credenzafashion.com** (not the Netlify subdomain).

### Search engine submission

| Path | What |
|------|------|
| `docs/aeo-geo/search-console-setup.md` | Google Search Console + Bing steps |
| `preview/scripts/indexnow-submit.mjs` | Notify Bing/IndexNow of public URLs |
| `preview/public/{key}.txt` | IndexNow ownership key (deployed) |

```bash
cd ~/credenza/preview && node scripts/indexnow-submit.mjs
```

### Technical site standards pack (2026-07-26)

| Item | Status |
|------|--------|
| `/og.png` share image (1200×630) | Live on marketing pages + app shell |
| Twitter `summary_large_image` | Landing, how, faq, privacy, terms, app |
| JSON-LD on `/landing/` (SoftwareApplication + WebSite) | Shipped |
| Security headers (nosniff, referrer, frame, permissions) | `netlify.toml` + `_headers` |
| Manifest `Content-Type: application/manifest+json` | Header fixed |
| Shared nav + footer on marketing pages | Shipped |
| Custom `404.html` with product links | Shipped |
| `www` → apex 301 | `netlify.toml` redirect |

**Not in this pack (needs product UI lane):** app ⋯ menu links to How / FAQ / Privacy.

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

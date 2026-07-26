# Credenza — handoff for Claude Design

**Repo:** https://github.com/sportskoat/credenza  
**Live site:** https://credenzafashion.com  
**Landing:** https://credenzafashion.com/landing/  
**Primary app UI:** `credenza-fashion.jsx` + `credenza-fashion.css` (repo root)  
**Web shell / deployable app:** `preview/` (Vite + Netlify)

Please read the real source in GitHub. Screenshots alone are not enough for state-by-state interaction or visual audit.

---

## What Credenza is

Agent haul planner for international shopping through Chinese marketplaces (Taobao, Weidian, Yupoo, 1688).  
User pastes links → cards with photos, size, price, QC → groups into hauls → **Buy opens in the user’s shopping agent** (Superbuy, CNFans, etc.).  
Not a marketplace. Not a search engine. Not a checkout.

Product / monetization rules: `docs/Monetization.md`  
Carousel contract (do not break): `docs/carousel-canonical-state.md`

---

## Files to open first

| Priority | Path | Why |
|---|---|---|
| 1 | `credenza-fashion.jsx` | Main fashion app UI + behavior |
| 2 | `credenza-fashion.css` | Tokens, layout, components |
| 3 | `preview/public/landing/index.html` | Marketing landing (Turn 7, live) |
| 4 | `sheets/` | Capture, detail, settings, profile, agents |
| 5 | `components/` | Shared card / UI pieces |
| 6 | `docs/mobile-improvement-plan.md` | Mobile shelf / stash / card-back plan |
| 7 | `docs/Monetization.md` | What we may and may not build |

---

## Design audit request

Please audit **interaction and visual state by state**, from the real code:

1. **Shelf (empty vs filled)** — masthead, tabs, totals, grid cards, empty hero  
2. **Stash flow** — clipboard detected / empty paste / multi-link haul  
3. **Card front** — photo, status, heart, size rec shimmer, price  
4. **Detail / card back** — photo pager, tap-to-edit, size fit block, status chips, Buy footer  
5. **Hauls** — board, totals, parcel estimate  
6. **Settings / profile / agent pick**  
7. **Landing page** (`/landing/`) vs in-app look (consistency of serif, money green, cards)  
8. **Light + dark** (Gallery / Blackout)  
9. **Phone ≤767px** and desktop  

For each state, note:

- Hierarchy / density / alignment issues  
- Touch targets and sticky chrome collisions  
- Copy that feels wrong or AI-cadence  
- Token mismatches (hex outside `--cz-*`)  
- Motion that should respect reduced motion  

**Do not invent a W2C marketplace, brand-replica retail framing, or agent checkout.**

---

## Live references

- App: https://credenzafashion.com/  
- Landing: https://credenzafashion.com/landing/  
- How: https://credenzafashion.com/how/  
- FAQ: https://credenzafashion.com/faq/  

---

## Stack notes

- React 18, Vite, Netlify functions under `preview/netlify/functions/`  
- Offline-first prefs / items in local storage  
- Design tokens: CSS vars `--cz-*` from fashion palettes  
- Landing page is static HTML (no React); product UI is the JSX app  

---

## Clone

```bash
git clone https://github.com/sportskoat/credenza.git
cd credenza/preview
npm install
npm run dev
# app at http://localhost:5173
```

Thanks — start from `credenza-fashion.jsx` + CSS, then landing for marketing consistency.

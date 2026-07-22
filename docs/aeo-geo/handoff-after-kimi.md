# Handoff — wire AEO kit after Kimi (and mobile-fix-loop) settles

**Do not do this while fashion.jsx/css are mid-edit by another agent.**

## 1. App chrome (tiny, high value)

In the ⋯ menu or empty shelf state, add two external links:

- How it works → `/how/`
- FAQ → `/faq/`

No new card system. No carousel changes.

## 2. Export button (uses already-built module)

```js
import { exportHaulBundle, downloadHaulJson } from "../credenza-haul-export.js";

// on click:
downloadHaulJson(items, {
  preferredAgent: prefs.preferredAgent,
  measureUnits: prefs.measureUnits,
});
```

Place under ⋯ or shelf overflow. Free tier can cap item count later; module already accepts `options.maxItems`.

## 3. Meta / PWA copy cleanup

`preview/index-fashion.html` currently:

> “Save and organize your replica fashion finds.”

Replace with content-kit safe line, e.g.:

> “Agent haul planner — stash finds, size with confidence, open Buy.”

Same pass for `manifest.webmanifest` name/description if still generic.

## 4. Deploy checklist

1. Confirm no dirty fights with Kimi’s branch.  
2. `cd preview && npm test && npm run build`  
3. Spot-check `/how/` and `/faq/` on deploy preview.  
4. Kyle deploys prod when ready (do not auto-deploy).

## 5. Explicit non-goals for this handoff

- No public multi-user haul feed API yet  
- No Google Shopping feed of products  
- No schema that implies Credenza *sells* garments  
- No carousel or Buy beam work

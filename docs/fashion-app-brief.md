# Credenza Fashion App — Project Brief

**Date:** 2026-07-17  
**Status:** Design polish + core feature build  
**Related memory:** [[fashionreps-community-research]], [[credenza-fashion-ux-direction]], [[credenza-fashion-ui-feedback]]

---

## 1. Problem / Opportunity

r/FashionReps users browse haul posts, find items they want, and then struggle to remember what the item was, what size to buy, and where the link went. The default solution is a Google Sheet full of raw URLs with no context.

Credenza Fashion turns a Reddit haul into a structured, visual shopping list. The user copies a link (or a whole comment block) from a haul post, pastes it into the app, and gets a clean product card with:

- Item name + category
- Price in ¥ and USD
- Hero image (with fallback)
- Buy link routed through their preferred agent
- Original poster's stats and size worn
- Extracted fit/quality notes
- Link back to the original Reddit post

---

## 2. Target User Workflow

1. User sees an item in a Reddit haul post.
2. User copies either:
   - A single Weidian/Taobao/Yupoo link, or
   - The entire comment block containing all the haul links.
3. User opens Credenza Fashion and pastes into an import sheet/input.
4. App parses the paste into one or more cards.
5. User browses cards, compares sizing to their own stats, and taps Buy when ready.
6. Later, user returns to the card to re-read the review or check the source post.

---

## 3. Research Summary

r/FashionReps is a 2.3M-member community growing ~383k/year. The dominant topics are "Looking For", "W2C", "Seller", "Link", "Haul", and "QC". Emotional signals like "Struggling", "Tired", and "Hard Time" appear often — users are exhausted by link hunting.

**Common post types:** W2C, REVIEW/Haul, QC, LC, NEWS, QUESTION, SHITPOST.

**Standard haul format:**
- Catchy emoji title.
- "Link in Comment🔽" (links are separated from the main post because Reddit spam filters kill direct links).
- Poster stats block: height, weight, usual size, agent, shipping line, cost.
- Review organized by category: Accessories, Shoes, Clothes, Hoodies/Tracksuits, etc.
- Comment contains named links: `Item Name: https://weidian.com/...`.

**Popular categories:** Sneakers/Shoes, Clothes, Hoodies/Tracksuits, Accessories, Electronics, Sports/Equipment.

**Major pain points:**
- Saving links while browsing.
- Mobile-unfriendly spreadsheets.
- Link formatting hell (mobile Taobao conversion).
- Agent-specific links breaking across agents.
- Duplicate items across hauls.
- No context on a saved link.
- Sizing guesswork.

**Agent landscape (2026):** Pandabuy shut down in 2024. Active agents include CNFans, Sugargoo, Superbuy, Kakobuy, ACBuy, CSSBuy, MuleBuy, Hoobuy, OopBuy. CNFans dropped Weidian support in Jan 2026, so universal Weidian links do not work everywhere.

---

## 4. Feature Priorities

### P0 — Must have for MVP

| Feature | Why |
|---------|-----|
| Reddit comment parser | One paste becomes many cards. This is the core differentiator. |
| Link role detection | Weidian/Taobao/1688 = Buy; Yupoo = Photos/Album; Reddit = Source; agent links = Open-with. |
| Image fallback | Never show broken images. Category placeholders + manual upload. |
| Category grouping | Accessories / Shoes / Clothes / Hoodies-Tracksuits. Matches Reddit format. |
| Sizing comparator | Store poster stats; compare to user's stats; suggest size. |
| Source attribution | Link back to original Reddit post + poster username. |

### P1 — Strongly needed

| Feature | Why |
|---------|-----|
| Review extraction | Pull the sentence/paragraph for each item and highlight fit notes. |
| Agent-agnostic buy button | Store canonical link; open in user's chosen agent. |
| Duplicate detection | Warn when the same item is stashed twice. |
| Batch tags | Extract batch names (GX, PK, LJR) from review text. |

### P2 — Later

| Feature | Why |
|---------|-----|
| QC photo upload | Attach warehouse photos to a card. |
| Restock alerts | Notify when sold-out items come back. |
| Share-sheet extension | Stash directly from the Reddit mobile app. |
| W2C reverse search | Photo → matching saved haul item. |

---

## 5. UI Polish Checklist

### Header / tabs (Image #19)
- [ ] Remove or demote the "The shelf" heading; the tab already labels the view.
- [ ] Replace opaque pill tabs with underline tabs or a light segmented control.
- [ ] Active state = text color change + underline or a very light tint, not a solid opaque pill.
- [ ] Separate search bar from tabs visually; avoid nested container shapes.
- [ ] Clean up the dot separator in "Inbox · 1".

### Card transitions (Image #20)
- [ ] Replace card-over-card overlap with a bottom sheet or full-screen push.
- [ ] If overlap is kept, use a frosted-glass scrim (`rgba(0,0,0,0.4)` + `backdrop-blur`) instead of a solid dark overlay.
- [ ] Give the entering card a clear shadow and scale so it reads as foreground.
- [ ] Animate one card out while the other enters; do not pause with both visible.
- [ ] Stop using raw Yupoo album screenshots as card covers.

### General
- [ ] Audit every `opacity`, `background-color`, and `box-shadow` value; reduce inactive-state opacity.
- [ ] One dominant action per card: Buy.
- [ ] Remove generic "Links" tab; links live in their roles (Buy button, Photos source, Source chip).

---

## 6. Data Model Sketch

```ts
interface FashionItem {
  id: string;
  source: {
    platform: "reddit" | "yupoo" | "weidian" | "taobao" | "manual";
    postUrl?: string;
    postTitle?: string;
    posterUsername?: string;
    posterStats?: {
      heightCm?: number;
      weightKg?: number;
      usualSize?: string;
    };
  };
  name: string;
  category: "accessories" | "shoes" | "clothes" | "hoodies-tracksuits" | "electronics" | "sports" | "other";
  brand?: string;
  batch?: string;
  price?: {
    cny?: number;
    usd?: number;
  };
  sizeWorn?: string;
  fitNotes?: string[];        // extracted phrases: "size up", "TTS", "heavyweight"
  reviewText?: string;         // original sentence/paragraph from haul
  links: {
    buy?: string;              // canonical Weidian/Taobao/1688
    album?: string;            // Yupoo album
    source?: string;           // Reddit post/comment
    agent?: Record<string, string>; // per-agent checkout URLs
  };
  images: {
    cover?: string;
    gallery?: string[];
    fallbackCategory?: string;
  };
  status: "stashed" | "bought" | "qc" | "shipped" | "delivered";
  createdAt: string;
}
```

---

## 7. Open Questions

1. Where should canonical item data live? Local storage first, then sync?
2. Do we fetch prices/images server-side (Netlify function) to avoid CORS, or client-side with fallbacks?
3. Should the user set a default agent in settings, or pick per item?
4. How do we fingerprint duplicates? By item ID + seller, or by image hash?
5. Do we support parsing non-English haul posts, or English-only for MVP?

---

## 8. Next Steps

Current task board:

1. Clean up header and tab design.
2. Fix card overlay transitions.
3. Implement image fallback and cover handling.
4. Build Reddit comment batch parser.
5. Implement link role detection.

Recommended order: start with tasks 1–3 (visual polish) so the app feels good before adding the bigger parser features in tasks 4–5.

---

## 9. Source Links

- [GummySearch r/FashionReps analysis](https://gummysearch.com/r/FashionReps/)
- [Fishgoo FashionReps guide](https://blog.fishgoo.com/taobao-fashion-reps-guide/)
- [W2CREP](https://w2crep.com/)
- [FashionRepsSpreadsheet](https://fashionrepsspreadsheet.com/)
- [FashionRepsFind](https://fashionrepsfind.com/)
- [FashionReps Tools extension](https://www.crxsoso.com/webstore/detail/paakgokkhjhnmhblaflnckghjajlflki)
- [FashionReps Link Converter](https://chrome-stats.com/d/checcabgeleckmkmaebnojaaodmlhhnf)
- [fashionreps.it](https://fashionreps.it/)
- [Haulkit agent comparison](https://haulkit.app/guides/best-buying-agent-2026)
- [ITBuy Spreadsheet 2026](https://itbuyspreadsheet.com/)

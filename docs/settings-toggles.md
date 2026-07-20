# Settings toggles worth building

**Date:** 2026-07-19  
**Status:** Notes for a future Settings surface — not implemented yet.  
**Context:** Price display is currently **USD-first** (`$11.62 · ¥78.9`). A settings section should let people reverse that without rewriting every card.

---

## Why a settings surface

Credenza Fashion already has preferences that behave like settings (`viewMode`, `sortMode`, `theme`) persisted under `credenza-prefs-v1`. They live as ad-hoc toolbar chrome. A real Settings panel should own:

1. **Identity of defaults** — currency, agent, units, density  
2. **Things that must not be one-off UI experiments** — values that reappear on every card, haul total, and export  
3. **Things that need an explanation** — exchange source, what “primary price” means  

Keep the shelf chrome light. Put rare decisions behind one Settings entry (gear / profile).

---

## Highest-value toggles

### 1. Primary price currency — **do this first**
**What:** `USD first` (default now) vs `CNY first`.  
**Why it helps:** US buyers think in dollars; some power users still price-check in ¥ against agents. Today both are shown; order is the only real preference.  
**How it should work:**
- Single enum: `pricePrimary: "USD" | "CNY"`
- `priceLabel()` reads it; haul directory totals and the shelf cost reel stay USD-normalized for comparison, *or* follow the same toggle if we ever show a CNY reel
- Persist in `credenza-prefs-v1`
- Card edit form still stores raw `price` + `currency` + `priceUsd` — settings only change **display order**

**Copy ideas:**
- “Show dollars first”  
- Secondary line: “¥ always available as the secondary figure when known”

### 2. Show secondary currency
**What:** On/off for the trailing `· ¥…` / `· $…`.  
**Why:** Some people want a clean single number on the card face.  
**Default:** on.

### 3. Preferred agent (for Buy deep-links later)
**What:** Pandabuy / Sugargoo / CSSBuy / Oopbuy / “open Weidian raw”.  
**Why:** FashionReps workflow is agent-mediated. When we wire agent URL builders, this is the one setting that saves every Buy tap.  
**Not ready yet:** needs a real agent-link builder; don’t fake it in Settings until Buy can honor it.

### 4. Size unit preference
**What:** Prefer EU / US / UK / CM when a listing has multiple size axes.  
**Why:** Size info bubble and size dropdown should surface the user’s unit first.  
**Depends on:** cleaner variant parsing from Weidian resolve.

### 5. Theme
Already exists (light / rainbow). Move it into Settings so the capture bar stays about capture.

### 6. Default view
Carousel vs grid vs list on launch. Today it restores last `viewMode`; make that explicit (“Remember last view” vs “Always open carousel”).

### 7. Enrichment behavior
- Auto-fetch Yupoo photos on stash (on/off)  
- Auto-resolve Weidian buy details (on/off)  
- “Wi‑Fi only” for image relay  

**Why:** Enrichment is great until you’re on a flaky network or pasting 40 links. Power users will want a quiet local mode.

### 8. Privacy / data
- Export shelf  
- Clear local data  
- Session-only mode (already partially exists when storage fails)

---

## UX notes for the Settings UI itself

- **One screen, grouped:** Display · Shopping · Data  
- **Immediate apply** — no Save button for toggles; write through to prefs like card edits  
- **Show a live preview** for price order: a fake meta tile that flips `$12 · ¥80` ↔ `¥80 · $12` as you toggle  
- **Don’t put Settings on the card back** — card back is about *this item*; Settings is about *every item*  
- Use the same transitions.dev language (toggles / segmented controls), not native form chrome  

---

## Implementation sketch (when we build it)

```
prefs = {
  theme: "light" | "rainbow",
  viewMode: "carousel" | "grid" | "list",
  sortMode: "recent" | "starred",
  pricePrimary: "USD" | "CNY",      // NEW
  showSecondaryPrice: true,         // NEW
  preferredAgent: null | "pandabuy" | …,  // later
  sizeUnit: "auto" | "EU" | "US" | "UK" | "CM", // later
  autoEnrich: true,                 // later
}
```

Single reader: `usePrefs()` / `getPrefs()`.  
`priceLabel(item, prefs)` becomes the only price formatter.  
Haul directory + total reel already USD-normalize via `itemUsd` / `itemUsdAmount` — keep that for *sums* even when primary display is CNY, or offer `totalCurrency` later.

---

## What not to put in Settings yet

- Per-card fields (haul, size, note) — those stay on the card  
- Exchange-rate source picker — we don’t control FX yet; document the rate source in About when we do  
- Notification spam controls — no push layer yet  

---

## Immediate product decision (2026-07-19)

Until Settings ships:

- **Primary = USD** on every price chip and card-back PRICE tile  
- Secondary = CNY when known  
- Shelf / haul **totals stay USD** (already the reel)

That matches the majority FashionReps-buyer mental model without waiting for a panel.

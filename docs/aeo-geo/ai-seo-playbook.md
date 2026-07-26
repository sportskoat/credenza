# AI SEO playbook (Credenza)

**Status:** Adapted from public AI-visibility practice (Tanya van Gastel / Ranking on AI style) for Credenza  
**Updated:** 2026-07-26  
**Rules:** Follow `docs/Monetization.md`. No W2C marketplace, best-batch, or replica retail SEO.

This is **not** “get ChatGPT to say our name once.”  
The goal is: when a buyer asks a **buying** question, Credenza is a clear answer, and that visit can become a signup (open app) and later an affiliate Buy.

---

## What we already have

| Asset | Role |
|-------|------|
| Crawlable static CMS-style pages (`/landing/`, `/how/`, `/faq/`, `/guides/`) | Easy for Google + AI crawlers to read |
| Absolute canonical + OG + JSON-LD | Structure for answer engines |
| `llms.txt` + `llms-full.txt` | Direct brief for assistants |
| `sitemap.xml` + IndexNow | Discovery |
| Search Console setup doc | Measurement home for queries |
| Keyword + content kit | Safe language |

**Gap this pack fills:** bottom-of-funnel **guides** (comparison / how-to / alternative), a fixed buying-question list, source-outreach notes, and a customer loop (not citation vanity).

---

## Six steps (do these in order)

### 1. Keep the site crawlable

Credenza marketing pages are static HTML under `preview/public/`. Keep it that way.

| Do | Do not |
|----|--------|
| Put the real answer in HTML text | Hide the answer only in client-rendered app chrome |
| Name product facts in text (agents, size, local shelf) | Rely on logo images alone for proof |
| Keep `/how/`, `/faq/`, `/guides/` linked from nav | Ship a blank crawler view |

Check Google Search Console after each ship set. If a crawler sees a blank page, fix that first.

### 2. Start with buying questions (not “what is X”)

Informational “what is a shopping agent?” pages lose traffic to ChatGPT. Prefer **decision** questions:

- What is the best way to organize a Superbuy / agent haul?
- Spreadsheet vs haul planner — which should I use?
- How do I turn a Reddit haul comment into a shopping list?
- How do I pick a size from a Weidian chart?
- How do I open a Weidian link in my preferred agent?
- What tool keeps Yupoo photos and buy links on one card?

Source list: [[buying-questions]].

**Prompt to refresh the list (paste landing into any LLM):**

> Read this product page. List 8 bottom-of-funnel questions a buyer would ask right before they try a tool like this. Prefer “best / vs / how do I / alternatives” over “what is.” Exclude W2C, best-batch, and replica shopping queries.

### 3. Publish useful bottom-of-funnel pages

One question → one guide. Each guide must include:

- Who the page is for
- Tradeoffs (honest: when a spreadsheet is enough)
- Product evidence (what Credenza does in plain steps)
- Clear next step (Open app / How / FAQ)
- Facts in text, not only screenshots

Live guides: `/guides/` and children in `preview/public/guides/`.

### 4. Build sources that shape the answer

Your site is one source. ChatGPT often cites listicles and comparison posts.

| Action | Credenza-safe version |
|--------|------------------------|
| Ask ChatGPT the buying question | Note which URLs appear as sources |
| Contact useful authors | Offer free Pro later, honest product access, affiliate only if they already review agents/tools |
| Reddit / Discord | Answer the question; link the guide when it helps. No spam |
| G2 / Capterra | Skip until Pro exists and category fits |
| Medium / LinkedIn | Optional short versions of **one** guide for learning speed — then point home |
| YouTube | Later: one “paste Reddit haul → cards” walkthrough |

Do not buy fake reviews. Do not pitch replica W2C blogs.

### 5. Use fast surfaces carefully

Classic SEO can take months. AI citations can move faster on thin niches.

Use Medium / LinkedIn / a short video as **learning**, not the whole strategy. Durable assets stay on `credenzafashion.com`.

### 6. Track customers, not only citations

| Signal | Meaning |
|--------|---------|
| Citation / AI mention | Awareness only |
| Organic visit to `/guides/*` or `/how/` | Discovery |
| Open app / return visit | Intent |
| Affiliate Buy click (product metric) | Money path |

**Today (no extra SaaS required):**

1. Finish Google Search Console + Bing Webmaster (see [[search-console-setup]]).
2. Watch queries and landing pages for `/guides/*`, `/how/`, `/faq/`, `/landing/`.
3. In product, keep Buy / affiliate events as the north-star conversion (already product work).
4. Monthly: paste 5 buying questions into ChatGPT / Claude / Perplexity; log whether Credenza appears and which sources do.

**Later (when Kyle adds analytics):** Plausible or GA4 with privacy-respecting setup; UTM on outreach links; signup or “first stash” event if accounts ship.

A page with 1,000 visits and zero Buy intent is weaker than a guide that drives 50 opens and 5 Buys.

---

## Hard language rules (never break)

From Monetization + content kit:

- **Say:** agent haul planner, decision layer, organize links, size from chart + body, open Buy in your agent  
- **Do not say:** W2C marketplace, best batch, 1:1 finder, replica shop, customs tips  
- Affiliate only on outbound agent open  
- Do not invent customer logos or fake case studies  

---

## Ship checklist per guide

- [ ] Static HTML under `preview/public/guides/.../index.html`
- [ ] Unique title + meta description (buying intent)
- [ ] Canonical + OG absolute URLs on `credenzafashion.com`
- [ ] FAQ or HowTo or Article JSON-LD when it fits
- [ ] Sitemap row + `llms.txt` / `llms-full.txt` link
- [ ] Nav link from guides hub + from `/how/` or `/faq/` where useful
- [ ] IndexNow after production deploy
- [ ] No Tier C framing

---

## What not to build from the podcast

| Idea | Credenza call |
|------|----------------|
| Giant informational blog farm | Skip — thin AI answers win those |
| “Best replica sellers 2026” listicles | **Banned** (Monetization Tier C) |
| Paid counterfeit catalog SEO | **Banned** |
| CMS migration off static HTML | Not needed while pages stay crawlable |
| Citation dashboard as sole KPI | Skip — track visits → app → Buy |

---

## Related

- [[buying-questions]] — question list + briefs  
- [[keyword-cluster]] — intent clusters  
- [[content-kit]] — safe public copy  
- [[search-console-setup]] — GSC / Bing  
- [[../Monetization]] — product law  
- Live: https://credenzafashion.com/guides/

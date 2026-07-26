# Public content kit (ready to ship)

Use this copy on static pages and future marketing. Aligns with `docs/Monetization.md` §4.

## Brand one-liner

**Credenza** is an agent haul planner: stash Weidian / Yupoo / Taobao finds, pair photos with buy links, pick a size from the chart, then open Buy in your preferred agent.

## Tagline options

1. **One shelf for the whole haul.**  
2. **Decide size. Keep context. Open Buy.**  
3. **The decision layer in front of your shopping agent.**

## Homepage thesis (short)

You found it on Reddit, Yupoo, or Weidian.  
Credenza turns scattered links into cards you can actually act on — price, seller, size recommendation, QC status — then hands you off to Superbuy, Sugargoo, Kakobuy, or your agent of choice.

Not a marketplace. Not a W2C search engine. A haul OS for people who already know how agents work.

## How it works (5 steps)

1. **Stash** — paste a link, a multi-URL line, or (soon) a full Reddit haul comment.  
2. **See the card** — cover photo, title, price, seller.  
3. **Size** — paste or pull a size chart; match it to your body profile (in or cm).  
4. **Pipeline** — Want → Bought → QC → GL/RL → Shipped.  
5. **Buy** — one tap opens the item in your preferred agent (affiliate only on that open).

## Positioning table (public)

| We are | We are not |
|--------|------------|
| Haul planner / decision layer | Replica marketplace |
| Photo + buy pairing | Seller search engine |
| Size from *your* charts + body | “Best batch” rankings |
| Agent-agnostic handoff | In-app checkout replacing agents |

## FAQ answers (canonical)

### What is Credenza?
Credenza Fashion is a personal haul planner for international shopping through Chinese agents. You save finds, keep photos and buy links together, decide size, track QC, and open the item in your preferred agent.

### Does Credenza sell products?
No. Purchases happen on Weidian/Taobao/etc. via your agent (Superbuy, Sugargoo, Kakobuy, …). Credenza organizes the decision before that click.

### How does size recommendation work?
You set a body profile (chest, waist, hip, etc. in inches or cm). When an item has a size chart in notes or album text, Credenza parses rows (including hip-only 臀围 tables) and suggests a size with a plain-language reason.

### Which agents are supported?
Agent-agnostic by design: items store the **canonical** marketplace URL. At Buy time, Credenza wraps that URL for your preferred agent. Agents can be added without rewriting your shelf.

### Is my data on your servers?
Core shelf is local-first in the browser (device storage). Cloud features, when enabled, are optional and labeled. Export your haul anytime (JSON planned / in kit).

### Is this a W2C / replica search site?
No. Credenza does not run a product catalog of branded counterfeits, best-batch leaderboards, or seller payola. You bring links from communities and stores you already use.

### How do you make money?
Primarily agent affiliate on outbound Buy when you choose an agent that pays referral. Optional Pro later for sync, export power tools, and haul workflow — never a paid counterfeit database.

## Schema notes for pages

- `SoftwareApplication` on FAQ / product pages  
- `FAQPage` for Q&A  
- `HowTo` on step guides under `/guides/`  
- `Article` on comparison pages  
- `Organization` / brand consistent name: **Credenza**  
- Offer: free software; do not invent price props for counterfeit goods

## Guides hub (BOFU)

Public hub: https://credenzafashion.com/guides/  
Strategy: [[ai-seo-playbook]] · [[buying-questions]]

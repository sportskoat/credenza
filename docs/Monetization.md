# Credenza Fashion — Product + Monetization Game Plan

**Status:** Strategy source of truth for agents and humans  
**Created:** 2026-07-18  
**Related:** [[fashion-app-brief]], [[fashion-app-progress]], [[carousel-canonical-state]], memory `credenza-app.md`  
**Audience:** Future Claude/agent sessions. Read this before inventing revenue features, marketplaces, or “growth hacks.”

---

## 0. How to use this doc

When working on Credenza Fashion:

1. **Product scope** → follow §2 Tiers A/B/C. Do not invent Tier C work unless Kyle explicitly asks.
2. **Money** → follow §3–§5. Affiliate-first; Pro second; never “paid W2C / best batch” as core business.
3. **Positioning / risk** → follow §6. Marketing language matters as much as code.
4. **Sequencing** → follow §7. Do not polish carousel or holographics ahead of Tier A.
5. **Open questions** → §10. Ask Kyle before assuming answers.

This doc is a **game plan**, not a committed roadmap contract. Implementation order can shift, but **strategy defaults do not** without an explicit override from Kyle.

---

## 1. Strategic thesis (one paragraph)

Credenza Fashion is not a replica marketplace and must not become one. It is the **decision + organization layer in front of Chinese shopping agents** (Fansbuy, CSSBuy, Superbuy, Sugargoo, etc.): stash finds, pair photos/buy links, size with confidence, track QC → GL/RL, estimate haul cost/weight, then hand the user off to their agent with one clean Buy click.  
**Money comes from (1) agent affiliate on those handoffs and (2) a small Pro tier for workflow power** — not from selling access to counterfeit catalogs.  
**If a feature does not reduce uncertainty before the agent click, or reduce chaos after QC, it is probably wrong work.**

### North-star job

> “I found something on Reddit/Yupoo/Weidian. Help me decide size, keep context, run QC, plan the parcel, and open it in my agent — without a spreadsheet.”

### Explicit non-goals (business)

- Becoming a W2C search engine or “best batch” leaderboard
- In-app checkout that replaces agents
- Customs evasion guidance
- Paid placement of sellers that destroys community trust
- App Store / Play Store “replica shopping” positioning

---

## 2. Product build tiers

These tiers define **what makes the product real**. Monetization depends on Tier A existing; charging for a pretty Yupoo viewer will fail.

### Tier A — Make it actually haul-useful (build these or stay a toy)

Without these, Credenza is a Yupoo/Weidian card viewer with extra steps. Spreadsheets still win.

#### A1. Reddit haul paste → N cards

**Why:** This is the brief’s real differentiator. FashionReps hauls put links in comments; users copy a wall of text. One paste → structured cards is the “aha.”

**Behavior:**
- Accept paste of: full comment block, OP stats block, mixed “Name: url” lines, multi-URL lines.
- Produce **one card per item** with:
  - Display name (from label text, not only URL slug)
  - Canonical buy URL (Weidian/Taobao/1688) and/or Yupoo album
  - Source: Reddit post/comment URL when present
  - Poster username when present
  - Poster stats when parseable (height, weight, usual size, agent, total spend)
  - Per-item review snippet / fit notes when adjacent text exists
  - Category guess (shoes/clothes/etc.) when obvious
- Preserve original paste in item or haul-level raw note for re-parse.
- Deduplicate against existing shelf (Weidian itemId / Yupoo album identity already exist).

**Acceptance:**
- Paste a real haul comment → ≥80% of linked items become cards with usable titles.
- Poster height/weight/size land on a haul or profile object when present in paste.
- No network required for pure parse (enrichment can follow async).

**Out of scope for A1:** full Reddit OAuth crawl of subreddit; that’s later growth, not MVP paste.

---

#### A2. Agent-agnostic Buy

**Why:** Agents die, ban platforms, and change URL schemes (e.g. CNFans dropped Weidian). Storing “Fansbuy deep link only” is fragile. Canonical marketplace URL + user preferred agent is table stakes (link converters already do this).

**Behavior:**
- Item stores **canonical buy URL** (Weidian/Taobao/Tmall/1688), not only agent-wrapped links.
- User settings: `preferredAgent` (Fansbuy, CSSBuy, Superbuy, Sugargoo, Kakobuy, ACBuy, MuleBuy, Hoobuy, OopBuy, … extensible list).
- Optional: per-item agent override.
- Primary **Buy** action builds agent URL from canonical link + referral params (see §3).
- Secondary: “Open original” (Weidian/Yupoo) for power users.
- If no agent configured, prompt once on first Buy; don’t dead-end.

**Acceptance:**
- Same Weidian item opens correctly in at least 3 supported agents via URL templates.
- Changing preferred agent does not rewrite stored item links.
- Affiliate/referral query params attach only on agent open, never corrupt canonical storage.

**Implementation note:** Maintain a small `agents.js` (or equivalent) registry: `{ id, name, urlTemplate, supports: ['weidian','taobao','1688'], referralParam }`. Dead agents get `retired: true`, not deleted, so old settings don’t crash.

---

#### A3. Haul pipeline as first-class UI

**Why:** `findStatus` already exists (`want | bought | shipped | qc | gl | rl | returned`) but lives like an edit-form enum. The hobby is a **pipeline**, not a property.

**Behavior:**
- First-class haul board or segmented pipeline view (not only filters on a shelf).
- Default active haul concept: items the user intends to buy/ship together.
- Aggregates per active haul:
  - Item count by status
  - Sum of known ¥ / $ product cost
  - Estimated weight (from A6 when available)
  - Rough “ready to ship” count (bought + GL)
- Status transitions are one-tap from card/QC surfaces, not buried only in edit drawer.
- Status meanings (product language):
  - **Want** — stashed, not purchased
  - **Bought** — ordered via agent, awaiting warehouse
  - **QC** — warehouse photos in / under review
  - **GL** — green light, keep
  - **RL** — red light, return/exchange path
  - **Shipped** — international parcel submitted / in transit
  - **Returned** — sent back / dropped from haul

**Acceptance:**
- User can move an item Want → Bought → QC → GL without opening full edit form.
- Haul summary shows live ¥ total for non-returned items in active haul.
- Status is filterable and visible on card chrome (subtle, not noisy).

---

#### A4. Body profile + size decision

**Why:** Sizing is where money and returns are decided. Photos alone don’t answer “what size do *I* order?”

**Behavior:**
- One-time **user profile**: height, weight, usual tops/bottoms/shoes size, optional unit prefs (cm/kg vs ft/lb).
- Per item:
  - Size worn by poster (from paste or manual)
  - Recommended size (user or resolver)
  - Size run / variants (already partially from Weidian resolve)
  - Size notes / chart fields when available (肩宽, 胸围, 裤长, 脚长, etc.)
  - Fit tags: TTS / size up / size down / oversized / heavyweight (manual or extracted)
- Decision UI: show “Poster L @ 180cm/75kg → You 176cm/70kg → try **M**” style recommendation with **confidence** (low if missing chart/poster stats).
- Never invent measurements; only compute from known data + explicit rules/AI later.

**Acceptance:**
- Profile saved in prefs; used on every size panel.
- Card size panel shows poster size, your usual, recommendation, and why (one line).
- Missing data → clear “need chart/poster size” empty state, not a fake answer.

**Visual fit tiers (agreed 2026-07-21, Kyle):** build A4 in cheap-first tiers —
1. **Fit math** (core A4 above; ~0 bundle cost).
2. **2.5D SVG visual**: front/side silhouette of the user's body with the
   garment's flat measurements overlaid (hem/sleeve/chest lines land on the
   body). Ships with the Fit tab.
3. **Full 3D mannequin** (Three.js / react-three-fiber, morph-target body,
   garment shells from flat measurements): the Pro-launch delight feature.
   MUST be lazy-loaded per-tab (~150–200 KB gz) so the main bundle never pays
   it; geometry is trivial for phones, cloth sim is NOT in scope — drape
   simulation needs garment patterns sellers never publish. Honesty rule:
   accuracy = flat measurements only (chest ease, sleeve/hem landing), never
   implied fabric behavior.
- **Size-chart extraction** (Yupoo/Weidian listing images → structured
  衣长/胸围/肩宽/袖长 via the resolve/vision pipeline) is the real moat and
  gates tiers 2–3; nobody in the rep ecosystem has it.
- **Pro gate shape:** free = one body profile; Pro = multiple profiles +
  fit history (tier 3 rides the Pro launch).

---

#### A5. QC attach + GL/RL

**Why:** QC is the emotional loop of the hobby. Without attaching warehouse photos and deciding GL/RL on the card, users bounce back to agent site + Discord.

**Behavior:**
- Attach QC via:
  - Paste agent QC image URLs
  - Upload / share-sheet images (reuse existing compression pipeline)
  - Optional: note from agent message
- QC gallery distinct from product/Yupoo gallery (label: “Warehouse QC”).
- One-tap **GL** / **RL** with optional short note (“toe box flawed”, “GL stitch ok”).
- RL path suggests status **Returned** or keep in RL for exchange tracking.
- GL moves toward ship-ready in haul aggregates.

**Acceptance:**
- QC photos persist with the item; survive reload.
- GL/RL set status and timestamp; note visible on card back.
- Product photos and QC photos are not mixed without labeling.

---

#### A6. Weight / ship estimator

**Why:** International shipping anxiety dominates haul planning. The Fansbuy-style gram tables exist because people budget shipping as carefully as product cost.

**Behavior:**
- Category → default gram estimate table (sneakers, boots, hoodie, tee, jeans, etc.), overridable per item.
- Haul-level: sum grams → rough volumetric warning when many boxes/shoes.
- Show **product total + estimated ship weight**; optional user-entered $/g or route presets later (don’t scrape live agent rates in v1 unless easy).
- Copy: estimates are rough; rehearsal package on agent is still source of truth.

**Acceptance:**
- Changing category updates default weight unless user overrode.
- Active haul shows combined estimate.
- No fake precision (round sensibly; show “~”).

---

### Tier B — High leverage, still on-mission

Build after Tier A is usable end-to-end. Each item below strengthens affiliate conversion or Pro value.

| ID | Feature | Why it matters |
|----|---------|----------------|
| B1 | **Bulk “send these N to agent” checklist** | Multi-URL import exists; add size-locked checklist, mark ordered, export list. Converts shelf → action. |
| B2 | **Seller memory** | Per seller/Weidian shop: notes, batch names, RL history, “bait” flag. Trust layer Sheets can’t match easily. |
| B3 | **Dupes across hauls** | Same itemId / yupoo album / canonical key — warn, merge, or link. |
| B4 | **Parcel mode** | Select GL items → estimated weight → packing prefs (no shoebox, vacuum, bubble) → declare template fields → handoff notes. |
| B5 | **Tracking field + 17Track deep link** | Store tracking number; open external tracker. Do **not** rebuild global package tracking. |
| B6 | **Share read-only haul** | Public or link-gated haul page for flex / friend advice. Social loop; careful with ToS and what URLs are exposed. |

**Tier B acceptance mindset:** each feature should either (a) increase Buy→agent clicks, (b) increase retention through an active haul, or (c) justify Pro.

---

### Tier C — Do not build yet (looks cool, weak or dangerous ROI)

| Do not build | Why |
|--------------|-----|
| Full agent replacement / in-app checkout | You will lose to agents on warehouse, payment, dispute; huge compliance surface |
| Customs law advice / “how to beat customs” | Legal/ToS landmine; not our job |
| Marketplace of finds / scaled W2C search | Core-business kill zone (§3.5); lawsuit + processor risk |
| Paid “best batch” leaderboards / brand 1:1 rankings | Same; also community trust poison |
| Another holographic / carousel polish pass before Reddit parse | Craft debt; strategy anti-pattern |
| Live multi-agent rate scraping arms race | Fragile; agents already own this UX |
| Crypto payments, anonymous dropshipping, etc. | Wrong product universe |

**Rule for agents:** If a request smells like Tier C, surface this section and get explicit Kyle override before coding.

---

## 3. Monetization models (ranked)

### 3.1 Primary — Agent affiliate (free consumer app)

**Model:** App stays free for core stash + Buy. Every agent open can carry Kyle’s referral code.

**Why primary:**
- Matches how the hobby already pays creators/tools
- Cash collected by **agent**, not by “selling fake Nike software” on Stripe
- Aligns product incentive: better Buy handoff → more revenue
- Credenza becomes **front-end for agent acquisition**

**Requirements:**
- Settings: preferred agent + stored referral IDs per agent (or single global where agents allow)
- Buy URL builder appends referral params from registry
- Optional soft default agent with clear “you can change this” (no dark patterns that brick UX)
- Analytics (privacy-light): count outbound agent clicks by agent (no need to track what brand)

**Kyle actions (business, not code):**
- Sign up for affiliate/referral programs on target agents (Fansbuy, CSSBuy, Superbuy, etc.)
- Put codes in env/settings, not hardcode secrets in public blog posts carelessly
- Track which agents actually pay and on what attribution window

**Success metrics:**
- Outbound Buy clicks / week
- Referral-attributed signups or orders (from agent dashboards)
- Click → preferred agent set rate (onboarding)

---

### 3.2 Secondary — Credenza Pro (workflow, not “more fakes”)

**Positioning:** International shopping / agent haul planner Pro — **not** “replica finder Pro.”

**Price band (starting hypothesis):**
- **$4–8 / month**, or
- **$30–50 / year**
- Optional lifetime later (§3.3) once value is proven

**Pro unlocks (charge for workflow power):**

| Pro feature | Free tier |
|-------------|-----------|
| Cloud sync / multi-device | Local / single device |
| QC photo vault (higher cap, longer retention) | Limited local QC images |
| Multi-haul budgets + history | One active haul / basic totals |
| AI size-from-chart + review extraction | Manual size notes |
| Reddit import advanced (batch re-parse, poster stats polish) | Basic paste |
| Export to agent CSV / bulk checklist export | Manual copy |
| Priority resolve / higher enrichment rate limits | Best-effort / capped |
| Read-only haul share with custom expiry | No share or watermarked limited |

**Do not put in Pro:**
- Access to a private W2C database of branded counterfeits
- “Unlock Nike finds”
- Seller payola badges as if editorial

**Payment reality:** Prefer processors and descriptors that match **productivity / shopping organizer** software. Avoid product names, copy, and screenshots that scream counterfeit facilitation on the checkout page.

---

### 3.3 One-time “Haul OS” license

**Model:** Lifetime (or long-term) purchase for power users who hate subscriptions. Common in this culture.

**When:** After Pro value is clear and support cost is understood — not before Tier A ships.

**Hypothesis price:** roughly **$40–80 once**, or lifetime = ~2× annual Pro.

**Include:** whatever Pro includes at time of purchase; major new cloud cost features may stay subscription-only later (be honest in copy).

---

### 3.4 B2B — Agents and big sellers

**Model:** Agents (or large Yupoo sellers) pay for conversion tools:
- Embeddable shelf / album → shoppable card pack
- QC review page for warehouse customers (GL/RL on a clean UI)
- Branded “plan your haul” microsite with their affiliate baked in

**Why this is attractive:**
- Cleaner invoice story than consumer “fakes app”
- Agent already has the compliance and payment relationship with the shopper
- You sell **software**, they sell **service**

**When:** After consumer Buy handoff and QC UX are demonstrably good (you need a demo worth embedding).

**Pricing sketch:** monthly SaaS to agent ($N00/mo) or rev-share on referral lift — negotiate per partner; don’t build custom one-offs without a contract.

---

### 3.5 Avoid as core business

| Model | Why avoid |
|-------|-----------|
| Paid W2C database of branded 1:1s | Trafficking-facilitation optics; legal + processor risk |
| Automated brand search for counterfeits | Same |
| “Best batch” paid leaderboards | Trust + legal |
| Sponsored seller rankings presented as organic | Community will torch you; FashionReps culture hates this |
| In-app sale of replica goods | Actual counterfeit retail — hard no |

Side experiments that touch these require **explicit Kyle legal/risk acceptance**. Default for agents: refuse and cite this section.

---

## 4. Positioning & go-to-market language

### 4.1 Public framing (safe-ish)

| Use | Avoid |
|-----|--------|
| Agent haul planner | FashionReps replica app |
| Taobao / Weidian / 1688 shopping organizer | Fake Nike / 1:1 finds |
| Save links, sizes, QC, ship estimates | Beat customs / declare low tips |
| International agent wishlist | Counterfeit marketplace |
| QC review checklist | LC for selling fakes |

### 4.2 Community framing (where users actually are)

On Reddit/Discord you can be more hobby-native (**haul, QC, GL, W2C**) because that’s the vernacular — but **paid ads, App Store, Stripe descriptor, landing page hero** should stay on the safer framing.

### 4.3 Growth channels (realistic)

1. Organic: show haul paste → cards → agent Buy in a demo GIF
2. Agent partnership blogs / affiliate creator angle
3. Chrome extension “stash this tab” for desktop Yupoo sessions
4. **Do not** spam r/FashionReps (rules: no unapproved ads)
5. Read-only shared hauls (B6) as viral loop once built

### 4.4 Distribution constraints

- Apple/Google stores: high rejection risk if marketing is replica-first → **PWA + extension first** (already aligned with Credenza architecture)
- Paid social ads for branded fakes: assume blocked
- Affiliate + SEO + community demos: primary growth

---

## 5. Revenue architecture (product implications)

### 5.1 Free forever core (affiliate fuel)

Must remain good enough that people actually Buy through you:

- Stash + enrich (Yupoo/Weidian)
- Agent-agnostic Buy with referral
- Basic statuses + size fields
- Basic weight estimate
- Local-first shelf

**If free is crippled, affiliate dies and Pro looks predatory.**

### 5.2 Where Pro gates sit

Gate **sync, limits, AI depth, export, multi-haul history, share polish** — not the first successful agent handoff.

### 5.3 Data to store for money (minimal)

- `preferredAgent`
- `affiliateCodes: { [agentId]: string }`
- Outbound click events (agentId, timestamp, itemId hash) — optional, local or privacy-light
- Pro entitlement flag (once billing exists)

Do **not** build a shadow catalog of “all Nike reps ever saved by users” for resale.

### 5.4 Affiliate URL builder (spec sketch)

```
canonicalBuyUrl + user.preferredAgent
  → agents[agent].build(canonicalBuyUrl, { ref: user.codes[agent] || defaultRef })
  → open in new tab
```

- Fail open: if template missing, open canonical URL and toast “agent link unavailable”
- Never lose the canonical URL when agent wraps fail

---

## 6. Risk, compliance, and ethics (operating constraints)

**Not legal advice.** Constraints for product decisions:

1. **Counterfeit goods laws** exist. Organizing personal shopping links ≠ running a counterfeit store, but the more Credenza **sources, ranks, and converts** branded fakes at scale, the worse the optics and risk.
2. **Payment processors and app stores** ban counterfeit goods and often tools that primarily facilitate them. Design checkout copy and store presence accordingly.
3. **No customs evasion features.** Packing preferences and declare *templates the user fills* are OK; “how to lie to customs” is not.
4. **No bait-and-switch seller payola** as editorial truth.
5. **User data:** haul contents are sensitive; local-first remains a trust feature; cloud sync (Pro) needs clear privacy posture.
6. **Scraping:** Weidian/Yupoo/Reddit resolvers will break; build graceful degradation (enhances-never-enables still applies to enrichment). Respect platform ToS where feasible; Reddit production path should prefer OAuth over brittle scrape (per existing project notes).

---

## 7. Sequencing game plan

### Phase 0 — Now (foundation already partly done)

- Yupoo + Weidian enrichment, paired links, carousel, categories, price, variants, findStatus fields, local storage
- **Freeze:** carousel rewrites unless regression; see `carousel-canonical-state.md`

### Phase 1 — Tier A MVP (“Haul-useful”)

Order:

1. **A2 Agent-agnostic Buy + affiliate hooks** (money path + table stakes)
2. **A1 Reddit haul paste** (acquisition/delight wedge)
3. **A3 Pipeline UI** (retention through active haul)
4. **A4 Body profile + size decision** (decision quality)
5. **A5 QC + GL/RL** (emotional loop)
6. **A6 Weight estimator** (money anxiety)

Ship Phase 1 as a coherent “plan a haul” story, not six disconnected toggles.

### Phase 2 — Monetize lightly

1. Live affiliate codes + preferred agent onboarding
2. Measure outbound clicks
3. Soft-launch Pro waitlist or manual lifetime to early users if cloud sync ready
4. Landing page with **safe positioning**

### Phase 3 — Tier B + Pro depth

- B1 bulk checklist, B4 parcel mode, B5 tracking, B2 seller memory
- Pro: sync, AI size, export, QC vault caps
- Optional B6 share haul for growth

### Phase 4 — B2B experiments

- Only after consumer handoff demo is undeniable
- Pitch one agent or large seller an embeddable QC/shelf pilot

### Kill criteria

- If users won’t set an agent or click Buy, fix handoff before more AI.
- If paste quality is bad, fix parser before Pro paywall.
- If affiliate programs refuse or underpay, lean harder into Pro/lifetime — don’t pivot to W2C marketplace.

---

## 8. Success metrics

### Product (Phase 1)

| Metric | Healthy signal |
|--------|----------------|
| Paste → cards success rate | Majority of links in a haul comment become cards |
| Time to first Buy click | Minutes, not “someday when I clean my Sheet” |
| % items with size decision filled | Rising after profile set |
| % bought items with QC attached | Rising |
| Active haul ¥ tracked | Users keep totals in-app |

### Business

| Metric | Healthy signal |
|--------|----------------|
| Agent outbound clicks | Steady weekly growth |
| Affiliate dashboard attributed activity | Non-zero within 30–60 days of traffic |
| Pro conversion (later) | ~2–5% of weekly actives is a fine niche start |
| Support burden | Lifetime license only if support is sustainable |

---

## 9. Competitive stance (so we don’t rebuild the wrong thing)

| Competitor type | They win on | We win on |
|-----------------|-------------|-----------|
| Google Sheets | Flexibility, multiplayer, free | Speed, visuals, enrich, mobile feel |
| Link converters | Agent open | Full decision context around the link |
| Agent apps | Buy, warehouse, ship, pay | Pre-agent planning + multi-agent + memory |
| W2C sites | Discovery | Personal shelf + QC + size — not global search |
| Generic save-later (Raindrop etc.) | Capture everywhere | Haul-native object model |

**Do not compete on discovery at scale.** Compete on **memory, decision, and handoff**.

---

## 10. Open decisions for Kyle

Agents should not silently assume these:

1. **Default agent** for new users (and whether a Credenza referral default is OK)?
2. **Which affiliate programs** are signed up / priority order?
3. **Pro first feature:** cloud sync vs AI size vs export?
4. **Auth provider** when sync exists (email magic link, Apple, Google)?
5. **Fashion-only product** vs fashion mode inside generic Credenza long-term?
6. **Share haul:** public by default or unlisted link only?
7. **Legal entity / region** for receiving affiliate + Pro payments?

---

## 11. Agent implementation checklist (copy into plans)

When implementing features from this doc:

- [ ] Maps to Tier A/B (or explicit Tier C override)
- [ ] Does not require marketplace/W2C index
- [ ] Preserves canonical buy URL separate from agent URL
- [ ] Affiliate params only on outbound agent open
- [ ] Copy uses haul/agent planner language in user-facing product chrome where possible
- [ ] Enrichment failures degrade gracefully
- [ ] No customs-evasion UX
- [ ] Carousel: read `docs/carousel-canonical-state.md` before touching
- [ ] Fashion storage key / fashion entrypoints respected (`credenza-fashion-items-v1`, fashion build)
- [ ] Tests + verify skill for user-visible flows

---

## 12. One-page summary (for tired humans)

**Build:** Reddit paste, agent Buy, haul board, size profile, QC GL/RL, weight estimate.  
**Then:** bulk checklist, seller memory, parcel mode, tracking link, share haul.  
**Don’t:** fake marketplace, customs hacks, agent replacement, polish-only seasons.  
**Make money:** agent affiliate on every Buy, then Pro for sync/AI/export/limits, optional lifetime, later B2B embeds.  
**Say:** international agent haul planner. **Don’t say (on checkout/ads):** replica empire.

---

## 13. Document history

| Date | Change |
|------|--------|
| 2026-07-18 | Initial game plan: Tier A/B/C + monetization models 1–5 + sequencing, written from FashionReps agent-guide analysis + Credenza fashion codebase state |

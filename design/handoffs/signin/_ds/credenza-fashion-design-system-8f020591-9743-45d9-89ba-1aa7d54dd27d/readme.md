# Credenza Fashion — design system

**Line:** One shelf for the whole haul.

Credenza Fashion is an **agent haul planner**. Its users buy from Chinese marketplaces — Taobao, Weidian, Yupoo, 1688 — through a shopping agent, and today they track those buys in forty browser tabs and a note app. Credenza turns a pasted link (or a whole Reddit haul comment block) into a card carrying the photos, the price, the seller, a size pick and where the parcel is. Buy hands the item off to the customer's own agent. Credenza never takes money, never checks out, never sells anything.

The audience is the rep / haul community: r/FashionReps (2.3M members), haul TikTok, Discord. The business is affiliate-first with a $4.99/mo Pro tier for workflow caps.

## Surfaces

| Surface | What it is |
| --- | --- |
| **The app** (`credenzafashion.com`) | A local-first React shelf: paste bar, editorial card grid, card back with size reasoning and the order track, hauls with running totals and parcel-weight estimates. Two colourways: Gallery (light) and Blackout (dark). |
| **The marketing site** | Landing page plus \~17 how-to guides, pricing, FAQ, legal. Same type system, same palette, longer measure and a serif display voice. |
| **Chrome extension** | MV3 side panel for stashing from a listing page. Not recreated here — it reuses the app's chrome. |

## Sources this system was built from

- **GitHub — [github.com/sportskoat/credenza](https://github.com/sportskoat/credenza)** (branch `main`). Ground truth for everything here. Worth exploring further before building anything new: `credenza-fashion.jsx` holds `PALETTES` (the whole colour system) and the shelf; `credenza-fashion.css` (12k lines) holds every `.cz-*` rule with a dated comment explaining *why* the value is what it is; `credenza.css` holds the type tokens and the shared chrome; `components/` and `sheets/` hold the primitives; `preview/public/landing/index.html` is the marketing site; `docs/` holds the product briefs, launch plan and design handoffs.
- **Obsidian vault `Credenza/`** — the operating vault: `00-Start/Credenza Home.md`, `07-Reference/Credenza Design Index.md` (four editorial design-handoff turns plus three mobile packages), `07-Reference/Code/Credenza Code Map.md`.
- **Uploaded brand files** — `credenza-mark.svg`, `credenza-mark-1024.png`, `credenza-lockup.png` (all copied into `assets/`).

No Figma file was provided.

---

# Content fundamentals

**Voice: a knowledgeable friend who refuses to oversell.** Every claim is bounded and every limitation is stated before you find it yourself.

- **Second person, present tense.** "Your haul lives in 40 tabs and a note app." "Paste your first link." Never "we" except in the one place the product speaks as an authority: *"We recommend — Large."*
- **Sentence case everywhere.** Headings, buttons, labels, chips. The only uppercase in the system is mono: kickers (`THE SHELF`), status flags (`SHIPPED`), data labels (`SELLER`), and the wordmark.
- **Short declaratives with a period.** "A planner, not a store." "Know where every parcel is." "Your agent, one tap." Headings are complete sentences that end in a full stop — this is a house rule, not an accident.
- **Say what it isn't.** A whole section of the site is *What Credenza isn't*: not a marketplace, not a search engine, not a checkout. Constraints are marketing.
- **Numbers, not adjectives.** "6cm of room over your 98cm", "\~380 g", "20 a day", "$3.33 a month". Never "runs small", never "blazing fast". A rough number always carries `~` or `est.`
- **Admit uncertainty out loud.** *"Says when it doesn't know. No chart means no confident pick."* When there is no size chart the product falls back to your usual size and says so.
- **Money is disclosed inline, never in a footnote.** "Some agent links carry a referral code that funds the app. It never changes your price."
- **Community vocabulary is used correctly and unglossed.** haul, agent, W2C, QC, GL/RL, batch, TTS, shelf, stash. Writing around these words reads as an outsider.
- **No emoji. Ever.** Not in the app, not on the site, not in buttons. (Reddit haul titles the parser ingests are full of them; Credenza's own voice has none.)
- **No exclamation marks, no "Oops!", no cheerleading.** Errors are flat: "Couldn't read that link."
- **Buttons are verbs or verb phrases**: Stash, Buy via Superbuy, Mark received, Open the app, Import, See what Pro changes. Never "Submit", never "Click here".
- **The middle dot `·` is the house separator.** "Kit jersey · black", "Inbox · 1", "In transit · agent → you", "Free · $0". Not a pipe, not a slash, not an em dash.

**Examples to imitate**

> Your haul lives in 40 tabs and a note app. Free is the whole app. Pro is more of it. Take the Large. Its 104cm chest gives you 6cm of room over your 98cm, which is where this jersey is meant to sit. The Medium's 100cm would pull across the chest. Nothing you saved is deleted. Every card, haul, QC photo and shared link stays.

---

# Visual foundations

## The idea

**Near-monochrome chrome so the product photography owns the colour.** This is stated in the source: money green and heart red are the only hues in the system; everything else is grey. Two colourways, both extreme — Gallery is a warm-white gallery wall (#F4F4F0), Blackout is true black (#000000) with no blue cast. The layout language is editorial: one grotesk carrying both display and body — separated by weight and tracking — and mono for anything the eye scans in a column.

## Colour

`:root` is **Gallery**; `[data-theme="dark"]` is **Blackout**. See `tokens/colors.css`.

- Canvas #F4F4F0 / #000000 · cards #ffffff / #202024 · hairline #d2d2c9 / rgba(255,255,255,.16)
- Ink ramp is four steps: `--cz-ink` → `--cz-sub` → `--cz-faint` → hairline. **`--cz-faint` is the lightest ink allowed for readable text.**
- `--cz-accent` is *ink*, not a colour. Accent surfaces are ink at 6–14% alpha.
- The only hues: **money** `#147a3a` / `#4ade80`, **like** `#e11d48` / `#f40051`, **album link** `#1d5fd0` / `#7fb2ff` — one blue per card, on the album link and nothing else.
- Order-status tints are OKLCH bg/text pairs at hues 250 (bought), 290 (shipped), 85 (QC), each holding ≥ 4.5:1. `want` has no tint — the default is not a fact worth space.
- The action fill **inverts** between colourways: near-black with warm-white text on Gallery, near-white with black text on Blackout.
- Brand-mark colours are identical in both themes. A mark that re-tints per colourway is not a mark.

## Type

**One face, two voices.** Display and body are the same family, separated by weight and tracking rather than by a second typeface. A literal font stack written anywhere outside the tokens is treated as a defect.

- `--cz-display` **Clash Grotesk 600**, tracked hard: −0.03em card titles, −0.035em headings, −0.038em hero. Headings, card titles, prices, big numbers.
- `--cz-sans` **Clash Grotesk 500/600**, tracked −0.01em. Body copy, labels, every control. Weights 500/600/650/700/750/800.
- `--cz-mono` system mono. Prices, sizes, weights, IDs, kickers, status flags. Uppercase and tracked +0.08em to +0.14em.

The display serif was retired on 2026-07-28. Georgia's wide, even strokes read as heavy above \~24px, and its only job was to stand in for a serif the product never shipped. Because the wordmark is also Clash, **tracking is the only thing keeping a heading distinct from the logo** — never set a heading at the wordmark's +0.16em.

The app scale is fixed px (17 card title / 14 body / 13 chrome / 12 label / 11 micro / 10 flag); the marketing scale is fluid `clamp()`.

## Space, radii, layout

Values are lifted verbatim from the product. Credenza does **not** sit on a 4/8px grid — 13px card padding, 42px Buy, 52px hero field, 12.5px price chip. Rounding these is a defect.

- One container: **1080px** for the app, **1120px** for the site. Shell padding 28 → 22 → 16 → 14 as the viewport narrows.
- Radii: 10 field · 14 dense card / paste field · 16 grid card and primary CTA · 18 phone sheet top corners · 20 panel · 22 marketing frame · 999 every pill, chip, flag and heart.
- Shelf grid: 2-up on phones, 3 at 768px, 4 at 1100px, **10px gap**, photos at 4:5. Never 1-up — a single column wastes the whole phone screen on browsing.
- Touch floors: 40px controls on fine pointers, **44px on coarse, non-negotiable**; inputs jump to 16px font under 767px so iOS doesn't zoom.

## Backgrounds

No photographic backgrounds, no illustrations, no patterns. Gallery paints a fixed ambient layer of three white/warm-grey radial blooms at \~0.9 opacity behind the content, blurred 60px and drifting over 18s. Blackout paints soft #1a1a1d "moons" on true black — depth, never colour. Both freeze on touch devices and under `prefers-reduced-motion`. Sections on the marketing site alternate between `--cz-bg` and `--cz-footer-bg`, separated by a 1px hairline, never a gradient.

## Cards

The grid card is: 16px radius, 1px hairline, `0 6px 16px rgba(23,24,26,.06)`, a **4:5 photo flush to the card edge**, status flag top-left, heart top-right, album count bottom-right, then a 12/13/13 text block with a two-line-clamped serif title (always reserving two lines so price rows share a baseline across the row), a mono size reading and a money-green price. Buy is absent at rest and fades in over the photo on hover — **fine pointers only**, because on touch the first tap fires hover and steals the open.

## Elevation

Gallery is nearly flat: a real drop shadow reads as grey grime on warm white, so the hairline does the separating (`0 1px 2px rgba(23,24,26,.06)` on fields). Blackout goes deeper because a light shadow is invisible on black. Only three things get a real shadow: the card at rest, the modal, and the floating stash button.

## Motion

**One curve — `cubic-bezier(0.23, 1, 0.32, 1)` — and four durations: 120 press, 140 micro, 250 open, 300 resize.** Nothing bounces, nothing overshoots, nothing springs.

- **Hover:** `filter: brightness(0.98)` on pills; a 6% accent tint on rows; `translateY(-2px)` + a deeper shadow on cards. Never a colour change.
- **Press:** `scale(0.96)` on pills, chips, tabs and icon buttons; `scale(0.98)` on full-width rows and Buy.
- **Focus:** one recipe — `2px solid var(--cz-focus)` at `2px` offset. Inside a clipped card face it becomes an inset `box-shadow` ring instead.
- **Disabled:** `opacity: 0.56`, `cursor: not-allowed`.
- Everything collapses to 0.01ms under `prefers-reduced-motion`.

## Transparency and blur

Used in exactly three places: the modal backdrop (ink at 50% + 6px blur, dropped entirely under `prefers-reduced-transparency`), the carousel overlay (canvas at 74% + 14px blur), and chips riding over a photo (10px blur so the price stays legible on any image). Cards themselves are 85% white / 86% neutral over the ambient layer.

## Imagery

Real product photography only — square or 4:5, flat even light, no filter, no grain, no duotone. The palette of the photos *is* the colour of the product. When there is no photo, a flat marketplace tile stands in: Weidian orange-red, Yupoo green, Taobao orange, with the platform name set in the display serif. Never a photo-less card with a grey box.

---

# Iconography

**Lucide, at 12–17px, stroke 2–2.4.** The app imports `lucide-react`; the marketing site inlines the same paths by hand. There is no icon font and no sprite sheet in the source, so this system links Lucide from CDN when a kit needs a glyph it does not already inline.

- Sizes in use: 9px inside overlay chips, 11–13px in buttons and rows, 15–17px in fields and chrome.
- Stroke weight rises as size falls: 2.0 at 17px, 2.2 at 15px, 2.4 at 11–13px, 3–4 for the small check marks.
- Icons are always paired with a label except in `IconButton`, which requires an accessible `label` prop.
- **Brand glyphs are hand-authored inline SVG** for the services the product recognises — YouTube, X, Spotify, TikTok, Reddit — each in its real brand colour. Everything else falls back to a Google favicon fetch, then to a 6px coloured dot.
- **No emoji anywhere.** No unicode characters used as icons — except the middle dot `·`, which is punctuation, and the `+` in the Stash button, which is set in the sans at 20px/500.
- The app mark is not an icon: never place it in an icon row or scale it below 24px (use the shipped `icon-192.png` / `icon-512.png`).

Assets in `assets/`: `credenza-mark.svg`, `credenza-mark-1024.png`, `credenza-lockup.png`, `icon-192.png`, `icon-512.png`, `og.png`.

---

# Index

## Root

| Path | What it is |
| --- | --- |
| `styles.css` | The one stylesheet consumers link. `@import` list only. |
| `tokens/` | `colors.css` · `typography.css` · `spacing.css` · `elevation.css` · `motion.css` · `fonts.css` |
| `assets/` | Logos, app icons, OG image, `fonts/ClashGrotesk-Variable.woff2` (+ licence), `img/` product photography |
| `guidelines/` | 22 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `components/` | React primitives, grouped by concern |
| `ui_kits/` | Full-screen product recreations |
| `templates/` | Copyable starting folders — `shelf-screen/`, `landing-page/` |
| `SKILL.md` | Agent Skills entry point |
| `github.md` | Upstream source association |

## Components

**brand/** — `BrandMark`, `BrandLockup` **core/** — `Button`, `BuyButton`, `IconButton`, `Chip`, `SegmentedControl`, `Field`, `SearchField`, `Kicker`, `Caption` **shelf/** — `ProductCard`, `StatusPill`, `PriceChip`, `StatusTrack`, `SizeRecommendation`, `SizeChartTable`, `HaulBar` **navigation/** — `Masthead`, `ViewTabs` **feedback/** — `Toast`, `ModalShell`

Every component has a sibling `.d.ts` (props contract) and `.prompt.md` (when to use it, with the source's own rules).

### Intentional additions

- **`Kicker` / `Caption`** — the source sets these inline in a dozen places (`.kicker` on the site, the `Caption` atom in the app). Promoted to components so the mono tracking cannot drift.
- **`Masthead`** — the app masthead and the site nav are the same object in two files upstream; unified here.
- **`BrandLockup`** — exists only as markup inside the landing page's `<header>` upstream.

Everything else maps 1:1 to a source primitive (`Pill` → `Button`, `.cz-buy-btn` → `BuyButton`, `StatusTrackChips` → `StatusTrack`, `Card.jsx` → `ProductCard`, and so on).

## Templates

- **`templates/shelf-screen/`** — the app screen: masthead, paste bar, tabs, 4-up card grid, haul bar.
- **`templates/landing-page/`** — the marketing page: sticky nav, serif hero, product-card band, three-up grid, dark CTA.

Each template loads this system through its own `ds-base.js`; a consuming project edits one line in that file.

## UI kits

- **`ui_kits/fashion_app/`** — the shelf: first run, grid, card back, hauls. Click-through.
- **`ui_kits/marketing_site/`** — the landing page with the live paste demo.

## Known gaps

- No Figma source was provided, so component variants beyond what the code exercises are unknown.
- The CoverFlow carousel (`CoverFlowCarousel.jsx`, 50KB) and the photo-morph view transition are the app's signature interaction and are **not** recreated here.

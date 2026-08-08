# Size chart redesign spec — 2026-08-07

Source: a five-advisor debate (Fable, Kimi, Grok, ChatGPT, DeepSeek V4 Pro), three rounds.
Kyle overruled two points. This spec is the final word. Build order is at the bottom.

## Owner rulings (these beat the debate)

1. GREEN STAYS for the correct size. The debate voted 4-1 to remove green from sizes.
   Kyle: "I want green for the correct size, overruled." Green has two jobs now:
   money, and the recommended size. Nothing else may use green.
2. MOTION STAYS. Kyle 2026-08-07: the shimmer and the bar entry animation look good.
   His "moving weights" complaint was about lopsided bar geometry, not motion.
   Do not remove the shimmer or the animations.
3. Cheap vision pre-check: APPROVED. A cheap model looks at tiny versions of the top
   candidate photos and answers "is this a size table?" before any full paid read.
4. Loading state: HIDE the size section until there is something to show. While hidden,
   show one accurate line plus a calm animation that says what is happening right now.
   No blank hole. No wall that feels permanent.
5. EASE BARS GET A GEOMETRY REDESIGN. Kyle 2026-08-07: the bars are lopsided, and a
   marker in the middle of the green band does not depict the garment's true size.
   The bars show ease (seller minus body) on a per-row private scale. Round 4 of the
   debate is deciding the new geometry. Colors and motion stay.

## The look (step 1)

1. KEEP the shimmer and the bar entry animation. Kyle 2026-08-07: they look good.
   (This section once said to kill them. That was wrong. Ruling 2 stands.)
2. Rebuild the ease bars with the approved geometry: the garment's real number
   centered on every bar, the "YOU" line at the body number, green band for the
   body range the cut fits, amber just past it. See "The bars" above.
3. Apply the locked tolerance bands. See "Fit tolerance bands" above.
4. Pin one fixed line at the top of the size area: "Your size · M", in the same calm
   green as the band. It never jumps while content loads.
5. In the table view (SizeChartTable), the recommended row keeps a green treatment but
   a calm one: thin left mark plus the word "Recommended". No full-row green fill that
   lands at a different height on every card.
6. The fit ladder fills in grey ink, not green segments. Progress is not a size pick.

## Timing (step 2)

1. The card appears the moment an item is saved. Never hold the whole card.
2. The free hunt (seller typed text, album text) runs at save time. It costs nothing.
3. The paid photo read fires only on first open. It never fires for a card nobody opens.
   Reason: chart reads are rationed (free plan 8 lifetime, Pro 50 per month).
4. While the hunt runs, the size section stays hidden and shows one honest status line
   with a calm animation. The line names the real step:
   - "Looking for the size chart photo…"
   - "Reading the size chart…"
   - "No size chart on this listing." (final, calm)
   - "Chart reads are spent for today. Resets tomorrow." (names the real wait)
5. The current busy-wall copy goes away. Two different failures get two different lines.

## Pipeline hit rate (step 3)

1. Add the cheap pre-check to the ranking step in components/size-chart-hunt.js:
   tiny versions of the top candidates, one "table-like?" score each.
2. After the pre-check, run ONE full paid read on the winner. Today a hunt can spend
   up to 3 paid reads on blind picks (MAX_PAID_CANDIDATES = 3). The pre-check makes
   one read almost always hit.
3. Keep every existing cost rule: one paid read per image, cached by image content
   forever, never borrow a chart from another item.

## Consistency fallback (step 4)

1. When a chart photo is found, save it on the card even if the table parse fails.
2. The size area then always shows something real: the parsed table when it works,
   the seller's chart photo when it does not. Unanimous vote, all five advisors.

## Fit tolerance bands (LOCKED by Kyle 2026-08-07, after fit research)

Research: chest needs 2-4 in room for a standard fit (under 1 in = buttons strain).
Shoulder is the strictest measure (off by 1 cm reads wrong, tailors cannot fix it).
Sleeve is forgiving (industry tolerance ±1 cm). Body length is the most forgiving
(cosmetic within a couple of inches). Kyle: be more liberal on body length, a bit
more on shoulder. Decision: the extra freedom goes into AMBER, not green — green
stays honest.

New bands (cm, ease = garment minus body):
- chest: unchanged (engine's per-garment band wins when it exists; fallback 12±6)
- shoulder: green unchanged (−1..+5), amber widened +4 → +6
- sleeve: unchanged (ideal 1, span 4)
- length (shirt body): green ±3 → ±5, amber out to ±8
- pantsLength: green ±3 → ±5, amber out to ±8

## The bars (LOCKED by Kyle 2026-08-07, mockup approved)

- The garment's real number sits at the CENTER of every bar, labeled above the tick.
- One solid line marks the customer's body number, labeled "YOU · n".
- Green band = the body range this cut fits. Amber = just past it. Line inside green
  = fits. Dashed = a number is missing. Colors and entry motion stay.
- Mockup Kyle approved: ~/Desktop/ease-bar-mockup.html (second version).
- Legend: "The center of the bar is the garment's size. The line is your body. Green
  is the body range this cut fits. Amber is just past it, close enough to wear.
  A dashed band means a number is missing and we are not guessing at one."

## Size pick behavior (LOCKED by Kyle 2026-08-08)

App test 2026-08-08 (Playwright, seeded card, size=""):
- Before tap: size="". Engine picks the recommended size.
- After one tap on "Medium": storage shows size="M". No confirm step. No warning.
- After full reload: size="M" survives. The tap is a permanent save.

Kyle's ruling: this behavior STAYS. One tap saves. The last size tapped is the
saved size. No confirm step. Do not add "looking is not choosing".

The 2026-08-07 complaint ("all shirts recommend Small") is a NUMBERS problem, not
a saving problem. The figures on the card must be right: the recommendation must
match the body numbers, and the bars must show the garment's true size. That is
what the bar redesign (step 1) and the tolerance bands fix.

## No-chart Fit tab (LOCKED by Kyle 2026-08-08, after panel consult)

Panel: Fable, Grok, ChatGPT 5.6, two rounds. Owner rulings beat the panel.

### Sized categories (shoes, shirts, pants — anything with sizes)

When a card has no chart, the Fit tab shows, top to bottom:
1. "No size chart for this one yet."
2. "Your usual size is US 10 (about EU 43)." — the buyer's saved usual size,
   converted into the listing's scale in the same line.
3. One row of size chips in the LISTING's scale. Every chip shows both numbers:
   "EU 43 · US 10". The row must include the buyer's converted usual size
   (extend the range — a US 10 needs chips up to EU 43+, not 39).
   One tap saves the size (one-tap save rule stays). No green on any chip:
   no chart means no recommendation, and green only means money or a
   recommendation.
4. Helper line: "Pick a size. It's saved on this card for when you order."
   (Kyle 2026-08-08: the size does NOT go to the agent. Do not claim it does.
   No clipboard trick. No per-agent size links.)
5. Two full-width actions, same as Settings: "Upload chart photo",
   "Enter chart by hand".
6. Nothing else. No empty black area.

### Non-sized categories (keychains, wallets, jewelry, etc.)

Different approach. No size chips. No helper line. One calm line that says the
item has no sizes (exact copy TBD with Kyle). The two chart-entry actions stay
available in Settings only.

## Build order

1. Look fixes (new garment-centered bars, locked tolerance bands, pinned
   "Your size" line, calm table row, grey ladder). Display only. No pipeline risk.
2. Loading states (hide section, accurate status lines, calm animation, kill the wall).
3. No-chart Fit tab (sized categories first, then the accessories treatment).
   Display only. No pipeline risk.
4. Photo fallback (always keep and show the found chart photo).
5. Cheap pre-check + one full paid read (the hit-rate fix).

## Hard rules that still apply

- Read .claude/skills/credenza-design/ before any UI or CSS change.
- Gates from preview/: npm run test, npm run lint, npm run typecheck, npm run build.
- One change at a time. Test after each one.
- Never run netlify deploy. Only Kyle ships.

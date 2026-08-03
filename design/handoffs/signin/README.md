# Handoff: Sign-in and Pro upgrade

## Overview

Credenza Fashion today has one screen — Settings · "Account and plan" — that tries to do three
jobs at once: sign you in, sell you Pro, and be a settings tab. The in-app paywall modal's two
buttons ("Sign in, free" and "Go Pro") both navigate to that same screen, so the fork the modal
offers is not real.

This handoff splits it into three surfaces with one job each, plus a settings page that only
reports state:

1. **Cap modal** — names the cap that stopped you, then forks to two genuinely different places.
2. **Sign-in modal** — free, 20 seconds, no price anywhere on it.
3. **Upgrade route** — its own full-width route with billing period, plan cards and the comparison table.
4. **Settings · Account and plan** — shrinks to summary rows that link out to (2) and (3).

**The governing rule:** *Settings reports state. It never hosts a form or a price.* Nothing is
duplicated between settings and the dedicated surfaces, so the two cannot drift apart.

### The plan spine this rests on

The three tiers are three different things, and the copy must keep them distinct:

| Tier | What it is | What you get |
| --- | --- | --- |
| **Signed out** | A trial. No account. | 3 cards a day on this device. |
| **Free** | An account. Costs nothing. | Unlimited cards; the shelf survives a lost phone (restore only). |
| **Pro** | Money. | Raises the daily counters that call a paid model; two devices kept in step. |

> **Open product question — resolve before implementing copy.** The current paywall modal says a
> free account "raises every daily ceiling." The public pricing page says the ceilings are identical
> on Free. The design resolves this as the table above (signed-out is capped at 3 cards/day;
> Free is uncapped on cards but has the Free daily counters; Pro raises the counters). If the real
> rule differs, the copy on the cap modal, the sign-in modal and the settings signed-out state all
> need revising together.

## About the design files

The file in this bundle is a **design reference created in HTML** — a prototype showing intended
look and behaviour, not production code to copy directly. The task is to **recreate these designs
in the target codebase's existing environment** (the Credenza app is React) using its established
patterns, components and CSS. If no environment exists yet, choose the most appropriate framework
and implement there.

Concretely: Credenza already ships `components/` and `sheets/` primitives and a 12k-line
`credenza-fashion.css` full of `.cz-*` rules. Build these screens out of those primitives. The
prototype composes the design-system package's React components (`Button`, `IconButton`, `Field`,
`SegmentedControl`, `Kicker`, `BrandLockup`) — map each to its upstream equivalent
(`Pill`, `IconButton`, the field shape, the segmented radiogroup, `.kicker`, the landing header lockup).

## Fidelity

**High fidelity.** Final colours, typography, spacing, radii, copy and states. Recreate pixel-perfectly
using the codebase's existing libraries. Every value below is a Credenza design token or a literal
lifted from the product — Credenza does **not** sit on a 4/8px grid, so do not round 13px, 12.5px,
13.5px or 42px to the nearest multiple of 4. That is a defect, not a tidy-up.

The prototype is drawn in **Blackout** (dark). Every value referenced is a token, so Gallery (light)
comes for free by not hard-coding any of them.

---

## Screens / views

### 1. Cap modal — "That is your third card today."

**Purpose.** The user tried to make a fourth card while signed out. Explain why the shelf stopped,
offer the free fix first, and route Pro out to its own surface.

**Layout.** Standard modal over the shelf: blurred ink scrim (ink at 50% + 6px blur; drop the blur
entirely under `prefers-reduced-transparency`). Dialog is **520px** wide, `--radius-panel` **20px**,
1px `--cz-hair` border, `background: var(--cz-card-solid)`, `box-shadow: 0 24px 64px rgba(0,0,0,.6)`.
Padding **26px 26px 22px**. Contents are a vertical flex column, **gap 18px**.

**Components, top to bottom.**

1. **Title row** — `display:flex; align-items:flex-start; justify-content:space-between; gap:16px`.
   - Title: "That is your third card today." — `--cz-display`, weight 600, **24px**, letter-spacing
     `--track-display` (−0.035em), line-height 1.15, `--cz-ink`. Note the full stop: Credenza headings
     are complete sentences that end in one.
   - Close: **IconButton**, 40px square, `label="Close"`, containing the Lucide `x` glyph at **16px**,
     stroke 2.
2. **Progress** — three equal segments, `flex:1; height:3px; border-radius:999px; background:var(--cz-ink)`,
   **5px gap**; all three filled. Below it, 9px down: `3 OF 3 · SIGNED OUT · RESETS TOMORROW` —
   `--cz-mono`, **10px**, weight 800, letter-spacing `--track-flag` (0.08em), uppercase, `--cz-faint`.
3. **Body** — 13.5px / line-height 1.55 / `--cz-sub`, `text-wrap: pretty`:
   "Signed out, Credenza holds three cards a day on this device. A free account makes the shelf
   unlimited and keeps it if the phone goes. Pro is a separate thing: it raises the daily AI counters."
4. **Actions** — vertical stack, **10px gap**, both full width:
   - Primary Button: **"Sign in · free"** → opens the sign-in modal.
   - Default Button: **"See what Pro changes"** → navigates to the upgrade route.
5. **Dismiss** — centred subtle Button: **"Not now"**.

**Why it changed.** Previously both buttons landed on the same page. Now the primary is free and
instant, and the secondary is honest about being a different question.

---

### 2. Sign-in — modal, two states

**Purpose.** Create or return to an account. It is reached from the cap modal, the account menu,
Settings, a shared link and the Chrome extension — a *route* would throw away wherever the user was,
so this is a **modal**, never a page.

**Hard rules.**
- **No price on this surface.** If the user arrives from the Pro card, they return to Pro afterwards.
  Sign-in never becomes the checkout.
- **No "Create account" tab.** A magic link makes signing in and signing up the same act; a second
  tab would be a tab that does nothing.

**Layout.** Dialog **460px** wide, radius **20px**, 1px `--cz-hair`, `--cz-card-solid`,
`0 24px 64px rgba(0,0,0,.6)`, padding **28px 26px 24px**, column flex, **gap 18px**.

**State A — empty**

1. **BrandLockup** with `kicker=""` (mark + CREDENZA only, no "Fashion" line).
2. Heading, 8px below: "Sign in to Credenza." — `--cz-display` 600, **23px**, `--track-display`, line-height 1.15.
3. Body — 13.5px / 1.55 / `--cz-sub`: "An account is free. It makes the shelf unlimited and brings it
   back on a new phone. Your cards still live on this device."
4. **Field**, `label="Email"`, `placeholder="you@example.com"`. Radius 10px. Under 767px the input font
   goes to **16px** so iOS does not zoom.
5. **Primary Button, full width: "Email me a sign-in link."** Disabled until the value matches
   `/.+@.+\..+/`. Disabled state is `opacity:.56; cursor:not-allowed`.
6. **OR divider** — 1px `--cz-hair` rules either side of the word "OR" set in `--cz-mono` 10px,
   `--track-flag`, `--cz-faint`; 12px gaps.
7. Two full-width default Buttons, **9px gap**: "Continue with Google", "Continue with Apple".
8. Footnote — 12px / 1.5 / `--cz-faint`: "No password, ever. Nothing on your shelf is uploaded until
   you ask for sync."

**State B — link sent** (replaces the whole body; same dialog, no resize animation beyond the 300ms resize duration)

1. Kicker, `tone="money"`: `LINK SENT`.
2. Heading: "Check your email."
3. Body: "We sent a sign-in link to **you@example.com**. It works once and expires in 15 minutes."
   The address is set in `--cz-mono` 12.5px `--cz-ink` inline.
4. 1px `--cz-hair` rule.
5. Note — 12.5px `--cz-faint`: "Nothing was sent to the browser you opened it in — open the link on
   any device and this shelf signs in."
6. Two Buttons, 10px gap: default **"Use another address"** (returns to State A and clears the field),
   subtle **"Resend"**.

**Mobile.** Same content as a bottom sheet: 18px top corners, 88dvh cap, 44px control floor.

---

### 3. Upgrade — dedicated route

**Purpose.** Sell Pro. It gets a route rather than a settings pane because a billing period, two
plan cards and a nine-row table do not fit in the right-hand column of a settings page. Treat it as
the marketing pricing page rendered in app chrome — same numbers, same table, same order.

**Entry points.** The cap modal, the account menu, Settings · Account and plan, and the marketing
Pricing page's "Open Credenza" path.

**Layout.**
- **Header bar** — 15–16px vertical padding, 24px horizontal, 1px `--cz-hair` bottom border.
  Left group, 16px gap: Lucide `arrow-left` at **15px** stroke **2.2** + "Back to the shelf" (13px,
  `--cz-sub`); a 1px × 16px `--cz-hair` divider; the wordmark `CREDENZA` in `--cz-display` weight 800,
  12.5–13px, letter-spacing `--track-wordmark` **0.16em**; then "Pro" at 13px `--cz-faint`.
  Right: `SIGNED OUT · FREE` in mono 10px/800/`--track-flag`/`--cz-faint`.
- **Body** — max-width **1080px** (the app container), centred, padding 44px 50px 50px, column flex,
  **gap 32px**.
- Background is the Blackout ambient: `#000` with two soft `#1a1a1d` radial "moons". Freeze on touch
  and under `prefers-reduced-motion`.

**3.1 Hero block** (centred, gap 12px)
- Kicker: `PRO`.
- Heading: **"Free is the whole app. Pro is more of it."** — `--cz-display` 600, **38px**,
  `--track-hero` (−0.038em), line-height 1.06.
- Lede, max-width 520px, 14.5px / 1.6 / `--cz-sub`: "Nothing on your shelf is locked. Pro raises the
  daily counters on the three things that call a paid model, and funds the servers."
- **SegmentedControl**, 340px wide, 8px above: Weekly · Monthly · Yearly. Default **weekly**.

**3.2 Plan cards** — `grid-template-columns:1fr 1fr; gap:16px`. Both: radius **16px**, 1px border,
`--cz-card-solid`, padding 24px, column flex, gap 14px, with a `flex:1` spacer so the CTA/footnote sit
on a shared baseline.

*Free card* — border `--cz-hair`.
- Label row: `FREE` (mono 10px/800/`--track-flag`/`--cz-faint`) + a `YOUR PLAN` pill — mono 9.5px/800,
  `--cz-ink` on `--cz-accent-bg`, padding 4px 8px, radius 999px.
- Price: **$0** — `--cz-display` 600, **40px**, `--track-hero`, line-height 1.
- Body 13px/1.55/`--cz-sub`: "No card. No trial clock. Unlimited cards, unlimited Buy, the Reddit paste
  and the parcel planner in full."
- Footnote 12.5px/`--cz-faint`: "Most people do not need Pro. It only helps once you hit a counter."

*Pro card* — border `--cz-hair-strong`, `box-shadow: 0 6px 24px rgba(0,0,0,.45)`.
- Label row: `PRO` in `--cz-money` + a `3 DAYS FREE` pill in `--cz-money` on `--cz-money-bg`.
- Price: 40px display figure + unit at 14px `--cz-sub`; **driven by the segmented control**:

  | Period | Figure | Unit | Note (`--cz-money`, 13px) |
  | --- | --- | --- | --- |
  | Weekly | `$2.49` | a week | 3 days free, then $2.49 a week until you cancel. |
  | Monthly | `$5.99` | a month | 3 days free, then $5.99 a month until you cancel. |
  | Yearly | `$44.99` | a year | Works out to $3.75 a month. Saves 37% against weekly. |

- **Primary Button, full width: "Start 3 days free."**
- Footnote 12.5px/`--cz-faint`: "Sign in first — the button opens the sign-in sheet, then comes straight
  back here." (Signed-in users skip straight to Stripe.)

**3.3 "What changes" table** — one card, radius 16px, 1px `--cz-hair`, `--cz-card-solid`,
padding 22px 24px 8px. Grid `1fr 120px 120px`, 12px gap, each row 14px vertical padding with a 1px
`--cz-hair` bottom border. Header row: money-tone Kicker `WHAT CHANGES`, then right-aligned mono
10px/800 `FREE` (`--cz-faint`) and `PRO` (`--cz-ink`). Row name 13.5px/600/`--cz-ink`; sub-note
12px/`--cz-faint`; values right-aligned `--cz-mono` 12px (`--cz-sub` for Free, `--cz-ink` for Pro).

| Feature | Note | Free | Pro |
| --- | --- | --- | --- |
| Cards from a link | Signed out you get 3 a day. | Unlimited | Unlimited |
| AI size-chart reads | One read of one size chart. | 2 a day | 15 a day |
| Link resolves | One server read of one buy link. | 20 a day | 250 a day |
| Ask questions about your shelf | — | 5 a day | 40 a day |
| Hauls at once | Archiving a shipped haul frees a slot. | 2 | 100 |
| QC photos an item | Stored on the card. | 4 | 12 |
| Shared haul links | Unlisted, expiry and no footer on Pro. | 3 | 100 |
| Your shelf on more than one device | — | Restore only | Kept in step |
| Spreadsheet export (.csv) | — | No | Yes |

Closing note, 12.5px/`--cz-faint`: "Cards, Buy, the Reddit paste and the parcel planner are the same on
both plans. This table lists what Credenza does today."

**3.4 Two reassurance cards** — `1fr 1fr`, 16px gap, radius 16px, 1px `--cz-hair`, padding 20px 22px,
gap 8px. Each: money Kicker, a 14px/600 line, then 13px/1.55/`--cz-sub` body.
- `YOUR SHELF` / "Your cards stay yours." / "If Pro ends, nothing is deleted. Every card, haul and QC
  photo you already saved stays where it is. Only new additions go back to the free caps."
- `BILLING` / "Cancel whenever you want." / "Stripe handles the payment and the receipts. Change the
  plan or cancel from Settings · Account. Credenza never sees your card number."

---

### 4. Settings · Account and plan

**Purpose.** Report where the user stands and provide the door. **No form, no price table.**

**Chrome.** Panel radius 22px on `#000`. Header bar (15px 22px, 1px `--cz-hair` bottom): Lucide
`arrow-left` 15px/2.2 + "Back to the shelf", the `CREDENZA` wordmark (display 800, 12.5px, 0.16em),
then "Settings" at 13px `--cz-faint`. Footer bar (12px 22px, 1px `--cz-hair` top): a 22px circular
`--cz-accent-bg` avatar and the current identity at 12.5px `--cz-faint`.

**Left rail.** 230px fixed, 1px `--cz-hair` right border, 16px 14px padding, 3px row gap. Rows are
9px 12px, 13px type, radius 10px; the active row is `--cz-accent-bg` at weight 600, inactive rows
`--cz-sub`. Order: **Account and plan** (active) · Sizes and measurements · Shelf defaults
(with a right-aligned mono 9.5px `SUPERBUY · USD` value) · Your data · About and support.

**Right pane.** 26px 28px padding, column flex, gap 18px.

**4a — Signed out**
- Money Kicker `ACCOUNT AND PLAN`; heading "You are signed out." (display 600, 25px, `--track-display`);
  body 13.5px/1.55/`--cz-sub`, max-width 520px: "Credenza holds three cards a day on this device. An
  account is free, makes the shelf unlimited, and brings it back if the phone goes."
- **One row group**: radius 16px, 1px `--cz-hair`, `--cz-card-solid`, rows at 16px 18px separated by
  1px `--cz-hair`. Each row is title (14px/600) over value (12.5px/`--cz-faint`), with the action on
  the right.

  | Row | Value | Action |
  | --- | --- | --- |
  | Account | Signed out · this device only | Primary Button **"Sign in"** → sign-in modal |
  | Plan | Free · $0 · no card, no trial clock | Default Button **"See what Pro changes"** → upgrade route |
  | Today | 3 of 3 cards · 0 of 2 chart reads · resets at midnight | mono 11px `LOCAL` flag |

- Closing note, 12.5px `--cz-faint`, max-width 520px: "Two rows and a counter. The sign-in form and the
  price table used to sit here; both moved to their own surface and this page links to them."

**4b — Signed in, Pro active**
- Heading: "Signed in. Pro is on."
- Same row group, rows at 15px 17px:

  | Row | Value | Action |
  | --- | --- | --- |
  | Account | `you@example.com` (mono 12.5px) | subtle Button **"Sign out"** |
  | Plan + a `PRO` pill (mono 9.5px/800, `--cz-money` on `--cz-money-bg`, 3px 7px, radius 999px) | $2.49 a week · renews 9 Aug | default Button **"Manage billing"** → Stripe portal |
  | Devices | 2 devices · kept in step | Lucide `chevron-right` 13px/2.4 |
  | Today | 4 of 15 chart reads · 11 of 250 resolves | mono 11px `PRO CAPS` |

- Note: "Manage billing opens the Stripe portal. Credenza never sees your card number."
- **The upgrade route disappears from this state** — there is nothing left to sell.
- *Signed in, Free* (not drawn, implement by interpolation): Account shows the address + "Sign out";
  Plan shows "Free · $0" + "See what Pro changes"; Today shows the Free counters.

---

### 5. Account menu popover (revised)

**Purpose.** The masthead avatar menu. Previously "Sign in" was the last row, below Agent and Currency,
labelled "Pro, sync, links" — which merged the two decisions into one ambiguous row. Now the two
account decisions come first and read as two doors.

**Layout.** 300px wide, radius 16px, 1px `--cz-hair`, `--cz-card-solid`,
`box-shadow: 0 18px 48px rgba(0,0,0,.6)`, anchored to the avatar.

1. **Header** — 14px 16px 12px, 1px `--cz-hair` bottom: "Saved on this device" (13.5px/600) over
   "Signed out · 3 of 3 cards today" (12px/`--cz-faint`).
2. **Account group** — 8px padding. Two rows, each 11px 12px, radius 10px, title 13.5px/600 with a
   Lucide `chevron-right` 13px/2.4 inline (6px gap), sub-line 12px:
   - "Sign in" / "Free · unlimited cards" (`--cz-faint`) — shown hovered, `--cz-accent-bg`.
   - "See what Pro changes" / "3 days free, then $2.49 a week" (`--cz-money`).
3. **1px `--cz-hair` divider.**
4. **Shelf defaults group** — 8px padding, rows 10px 12px, 13.5px, label at 600 left and the value +
   `chevron-right` at `--cz-faint` right: Agent / Superbuy · Currency / USD · All settings / Sizes, fit, data.

---

## Interactions & behaviour

**Navigation graph**

```
shelf ──(4th card while signed out)──▶ cap modal
cap modal ──"Sign in · free"───────▶ sign-in modal (returns to shelf, card is created)
cap modal ──"See what Pro changes"─▶ /upgrade
cap modal ──"Not now" / close──────▶ shelf
account menu ──"Sign in"───────────▶ sign-in modal
account menu ──"See what Pro…"─────▶ /upgrade
settings·account ──"Sign in"───────▶ sign-in modal (returns to settings)
settings·account ──"See what Pro…"─▶ /upgrade
/upgrade ──"Start 3 days free"─────▶ signed out: sign-in modal, then back to /upgrade with intent kept
                                     signed in:  Stripe checkout
settings·account ──"Manage billing"▶ Stripe customer portal
```

**Return-intent is required.** Every entry into the sign-in modal records where it came from and what
the user was trying to do. Signing in from the cap modal creates the card that was blocked. Signing in
from the Pro card returns to `/upgrade` with the chosen billing period intact and advances to checkout.

**Motion.** One curve for everything: `cubic-bezier(0.23, 1, 0.32, 1)`. Four durations: **120ms** press,
**140ms** micro, **250ms** open, **300ms** resize. Nothing bounces, overshoots or springs.
- Modal open/close: 250ms.
- Sign-in State A → B height change: 300ms.
- Hover: `filter: brightness(0.98)` on pills; a 6% accent tint on rows. Never a colour change.
- Press: `scale(0.96)` on pills, chips, tabs, icon buttons; `scale(0.98)` on full-width rows and CTAs.
- Focus: `2px solid var(--cz-focus)` at 2px offset — one recipe everywhere.
- Everything collapses to 0.01ms under `prefers-reduced-motion`.

**Form validation.** The email field validates on change against `/.+@.+\..+/` and only gates the
button's disabled state — **no inline error message while typing.** Server-side failures render flat,
in Credenza's voice: "Couldn't read that address." No "Oops!", no exclamation marks.

**Loading.** "Email me a sign-in link" uses `Button loading` (renders disabled with `aria-busy`).
Never a spinner overlay on the modal.

**Responsive.** Under 767px: modals become bottom sheets (18px top corners, 88dvh cap); all controls
go to a 44px touch floor; inputs to 16px; `/upgrade` plan cards stack to one column and the comparison
table keeps its three columns but drops the sub-notes.

**Accessibility.** Modals trap focus and restore it to the trigger on close. `IconButton` requires its
`label`. The SegmentedControl is a radiogroup with `label="Billing period"`. All decorative SVGs carry
`aria-hidden="true"`.

## State management

```
session.status        'signedOut' | 'signedIn'
session.email         string | null
session.plan          'free' | 'pro'
session.renewsAt      ISO date | null
usage.cardsToday      int   // only capped at 3 when signedOut
usage.chartReadsToday int   // cap 2 free / 15 pro
usage.resolvesToday   int   // cap 20 free / 250 pro
usage.asksToday       int   // cap 5 free / 40 pro
ui.capModal           { open, cap: 'cards'|'chartReads'|'resolves'|'asks' }
ui.signIn             { open, email, sent, returnTo, pendingIntent }
upgrade.period        'weekly' | 'monthly' | 'yearly'   // default 'weekly'
```

**Transitions.** `cardsToday >= 3 && status==='signedOut'` on a stash attempt opens `ui.capModal`.
Submitting the email sets `ui.signIn.sent`; "Use another address" clears `sent` and `email`. A
successful magic-link callback sets `session`, clears the caps, then runs `pendingIntent`.

**Data.** Counters and session come from the server; the shelf itself stays local-first and is never
blocked by any of this. Checkout and the customer portal are Stripe-hosted — Credenza never touches
a card number.

## Design tokens

All values below are already defined in the design system's `tokens/` folder and in the product's
`credenza.css`. **Reference the token, never the literal.**

**Colour — Blackout (`[data-theme="dark"]`) / Gallery (`:root`)**

| Token | Blackout | Gallery |
| --- | --- | --- |
| `--cz-bg` | `#000000` | `#F4F4F0` |
| `--cz-card-solid` | `#202024` | `#ffffff` |
| `--cz-hair` | `rgba(255,255,255,.16)` | `#d2d2c9` |
| `--cz-hair-strong` | `rgba(255,255,255,.24)` | `rgba(23,24,26,.18)` |
| `--cz-ink` | `#f5f5f7` | `#17181a` |
| `--cz-sub` | `#b7bbc2` | `#4f545b` |
| `--cz-faint` | `#9ea3ab` | `#6b7078` |
| `--cz-accent-bg` | `rgba(245,245,247,.12)` | `rgba(23,24,26,.08)` |
| `--cz-action-fill` / `--cz-action-text` | `#f5f5f7` / `#000000` | `#17181a` / `#F4F4F0` |
| `--cz-money` | `#4ade80` | `#147a3a` |
| `--cz-money-bg` | `rgba(74,222,128,.12)` | `rgba(21,128,61,.09)` |
| `--cz-focus` | `#f5f5f7` | `#17181a` |

`--cz-faint` is the **lightest ink allowed for readable text**. The action fill inverts between
colourways — do not hard-code a black button.

**Type.** One family, two voices, separated by weight and tracking.
- `--cz-display` / `--cz-sans`: **Clash Grotesk**. `--cz-mono`: system mono.
- Sizes used here: 40 / 38 / 25 / 24 / 23 (display) · 14.5 / 14 / 13.5 / 13 / 12.5 / 12 (body) ·
  11 / 10 / 9.5 (mono).
- Weights: 500 regular · 600 medium · 800 flag + wordmark.
- Tracking: `--track-hero` −0.038em · `--track-display` −0.035em · `--track-tight` −0.01em ·
  `--track-kicker` 0.14em · `--track-flag` 0.08em · `--track-wordmark` 0.16em.
- Leading: 1.06 hero · 1.15–1.25 titles · 1.5–1.6 body.
- **Never set a heading at the wordmark's 0.16em** — tracking is the only thing keeping a heading
  distinct from the logo, since both are Clash.

**Radii.** 10 field / menu row · 16 plan card, table card, popover, row group · 18 phone sheet top
corners · 20 modal panel · 22 outer frame · 999 every pill, chip and flag.

**Spacing actually used.** 3 · 5 · 8 · 9 · 10 · 12 · 13 · 14 · 16 · 18 · 22 · 24 · 26 · 28 · 32 · 44 · 50.
Container 1080px (app). Do not round these to a 4/8 grid.

**Elevation.** Modal `0 24px 64px rgba(0,0,0,.6)` · popover `0 18px 48px rgba(0,0,0,.6)` ·
Pro card `0 6px 24px rgba(0,0,0,.45)`. Gallery is far flatter — the hairline does the separating there.

**Blur.** Only the modal scrim (ink 50% + 6px), dropped under `prefers-reduced-transparency`.

## Assets

- **Icons: Lucide only**, 12–17px, stroke rising as size falls (2.0 at 17px, 2.2 at 15px, 2.4 at 11–13px).
  Used here: `x` (16px/2, modal close) · `arrow-left` (15px/2.2, back links) · `chevron-right`
  (13px/2.4, disclosure rows). The app imports `lucide-react`; the marketing site inlines the paths.
  **No unicode characters as icons** — the only exception is the middle dot `·`, which is punctuation.
- **Brand:** `assets/credenza-mark.svg`, `credenza-lockup.png`, `icon-192.png`, `icon-512.png`.
  The mark is not an icon — never below 24px and never in an icon row.
- **No emoji, anywhere.** No photography or illustration is used on any of these surfaces.
- Fonts: `assets/fonts/ClashGrotesk-Variable.woff2` (licence alongside).

## Copy rules that apply to every string here

- Second person, present tense. Sentence case. Short declaratives **ending in a full stop** —
  headings included.
- The middle dot `·` is the only separator. Never a pipe, slash or em dash.
- Numbers, not adjectives: "3 a day", "$3.75 a month", "15 minutes".
- Money is disclosed inline, never in a footnote.
- Buttons are verbs: "Sign in", "Email me a sign-in link", "Start 3 days free", "See what Pro changes",
  "Manage billing". Never "Submit", never "Click here".
- Say what it isn't: "Nothing on your shelf is locked." "Credenza never sees your card number."
- No emoji, no exclamation marks, no cheerleading.

## Files

| File | What it is |
| --- | --- |
| `Sign in and Pro.dc.html` | The prototype. All five surfaces on one canvas, with live behaviour: the email field gates the send button and flips to the "Check your email" state; the Weekly/Monthly/Yearly control drives the Pro price and note. Open it directly in a browser. |
| `_ds/credenza-fashion-design-system-.../` | The bound design system — token stylesheets and the component bundle the prototype composes. |

The prototype's grey side-notes are annotation for review, not product chrome. Do not ship them.

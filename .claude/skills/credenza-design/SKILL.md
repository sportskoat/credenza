---
name: credenza-design
description: Credenza design system — colours, tokens, spacing, typography, motion, elevation, component contracts, and the brand rules. Load this before you write or change any UI, CSS, card, sheet, button, or theme code in Credenza.
---

# Credenza design system

This is the repo copy of the Claude Design project `Credenza Fashion Design System`
(projectId `8f020591-9743-45d9-89ba-1aa7d54dd27d`). It exists so every agent session
starts knowing the brand rules, without a network call.

## Read order

1. `RULES.md` — the hard constraints. Words, colour, type, space, motion, cards.
2. `tokens/` — the token values. Copy names from here, never invent one.
3. `COMPONENTS.md` — the 22 Design components and how their props map to the repo.
4. `SYNC.md` — which side owns what, and how to move changes between them.
5. `DRIFT.md` — where the repo and the Design project currently disagree.

## The three rules that break the most builds

1. Never write a raw hex colour. Use `var(--cz-*)`.
2. Never write a raw px value. Use a spacing, radius, or type token.
3. Never round a value to a 4/8px grid. Credenza's odd values are deliberate.

The linter warns on all three. See `eslint.config.js`.

## Where the tokens actually live in the repo

- Colour: `credenza-fashion.jsx`, the `PALETTES` object (~line 141). This is the
  live source of truth for colour. `tokens/colors.css` here mirrors it.
- Type and motion: `credenza.css`, the `:root` block.
- Spacing, radii, elevation: not yet defined in the repo. The values in
  `tokens/spacing.css` and `tokens/elevation.css` are correct but are currently
  hardcoded at each call site. Prefer the token name when you add new CSS.

## Product framing

Credenza is an agent haul planner. It never takes money, never checks out, and
never sells. Do not add a marketplace surface. See `docs/Monetization.md`.

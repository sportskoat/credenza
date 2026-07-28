# Sync direction

Two systems hold the same design. They can drift. This file says who owns what.

## Who owns what

- **Claude Design owns how it looks.** Colours, type, spacing, radii, motion,
  elevation, component visuals, the written rules.
- **The repo owns how it works.** State, data, storage, the resolver, the
  carousel physics, routing, tests.

When the two disagree about a colour or a size, Design wins. When they disagree
about behaviour, the repo wins.

## Moving changes

The `DesignSync` tool connects the terminal to the Design project. It does NOT
watch the repo. Nothing syncs on its own. You run it, or nothing happens.

**Pull, before you build UI.** Read the Design files, then update this skill
folder if a token changed. Then write the repo code.

**Push, after you ship.** If a shipped change alters how something looks, write
that change back into the Design project so the next design starts from truth.

**Never both at once.** A pull and a push in the same session overwrite each
other. Pick one direction per session.

## The step people skip

A design cannot be pasted into the repo. The prop shapes differ — see
`COMPONENTS.md`. You must translate. The translation is where detail gets lost,
so translate against the token names, not against the rendered picture.

## Project identity

- Design project: `Credenza Fashion Design System`
- projectId: `8f020591-9743-45d9-89ba-1aa7d54dd27d`
- Repo the Design project points at: `sportskoat/credenza`, branch `main`
- Last recorded Design→repo sync: 2026-07-28

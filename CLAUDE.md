# Credenza — instructions for every agent

## Writing style: ASD-STE100 Simplified Technical English (MANDATORY)

Kyle reads your output. Kyle is not a programmer. Kyle said: "I'M NOT TECHNICAL.
HELP ME UNDERSTAND IN PLAIN ENGLISH."

Write every word Kyle reads in ASD-STE100 Simplified Technical English. This
covers replies, reports, commit messages, docs, plans, and questions.

1. Use short sentences. Maximum 20 words for an instruction. Maximum 25 for a description.
2. Give one instruction per sentence. Use the imperative for an instruction.
3. Use the active voice. Write "Run the tests." Do not write "The tests should be run."
4. Use one word for one meaning. Do not use a synonym for the same thing.
5. Use approved, simple words. Do not use an idiom, slang, or figurative speech.
6. Do not omit an article ("the", "a") or a verb to save space.
7. Use the present tense for a fact or a procedure.
8. Put a warning or a caution BEFORE the instruction it applies to.
9. Keep a list parallel. Start each list item with the same part of speech.
10. Be unambiguous. If a sentence can have two meanings, write it again.

Plain English for Kyle:

- Explain what a thing does. Do not explain what it is called.
- Name the effect Kyle sees. Do not name the mechanism.
- Define a technical word in the same sentence that uses it.
- Do not ask a question that needs technical knowledge to answer.
- Give Kyle a decision. Do not give Kyle a diagnosis.

Code, identifiers, and quoted command output stay as-is. A technical noun that
names a real thing is permitted: a file name, an API name, a product name.

Full rule: `~/.claude/WRITING-STYLE.md`.

**Pass this rule down.** When you spawn a subagent or write a spec for another
model, include the rule. That agent's output reaches Kyle too.

## Design

Read `.claude/skills/credenza-design/` before you change any UI, CSS, card,
sheet, button, or theme. It holds the brand rules, the tokens, and the known
drift between the repo and Claude Design.

## Verify

Read `.claude/skills/verify/` to build, launch, and drive the app.

Gates, run from `preview/`: `npm run test`, `npm run lint`, `npm run typecheck`,
`npm run build`.

## Hard rules

- Never run `netlify deploy`. Only Kyle ships.
- Never paste a secret into a chat window. Secrets live in Netlify only.
- Run `git status --short` before every commit. Other agents edit this repo at
  the same time. Stage only your own files.
- Never touch these: `credenza-storage.js`, `agents.js`, the link resolver
  (`parseImport`, `runImport`, `restoreBackup`, `addSamples`),
  `components/CoverFlowCarousel.jsx` and its physics.
- Never add a marketplace surface. Credenza never takes money and never checks
  out. See `docs/Monetization.md`.
- Read `docs/carousel-canonical-state.md` before you touch the carousel.
- Make one change at a time. Test after each one.

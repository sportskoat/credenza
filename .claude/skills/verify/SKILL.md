---
name: verify
description: Build, launch, and drive Credenza (preview PWA) to verify changes end-to-end.
---

# Verifying Credenza

## Launch

```bash
cd ~/credenza/preview && npm run dev   # vite, port 5173 strict — kill any stale vite on 5173 first (lsof -nP -iTCP:5173)
```

CI-style checks (not a substitute for driving the app):
`npm run test` (Vitest+RTL+axe, tests in preview/test/), `npm run lint`, `npm run typecheck`, `npm run build`. Extension: `npm --prefix ~/credenza/extension run build`.

## Drive (Playwright)

No playwright browsers installed — use `playwright-core` (devDep of preview/) with the system Chrome binary:

```js
import { chromium } from "/Users/kylewensel/credenza/preview/node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
```

Scripts must live where that absolute import resolves, or import by absolute path (as above) from /tmp.

## Seeding state

Shelf key is `credenza-items-v3` in localStorage (web) / window.storage shim (extension). Seed via `page.addInitScript`. Minimal item: `{id, title, type: "link"|"note", url?, host?, note?, rawText?, createdAt, updatedAt, importance: "medium"}`.

- Corrupt-storage recovery: seed a non-JSON string → "Credenza couldn't open this shelf." panel; capture input becomes disabled; payload must remain untouched.
- Prefs (`credenza-prefs-v1`) are written on load — only shelf-key writes count as "auto-save" violations.

## Flows worth driving

- Capture: fill the top input, click "Stash" (button label morphs from "Stash clipboard" when typing). Card appears in "The shelf"; persists across reload.
- Search: `input[type="search"]`; multi-word queries must match token-wise. "No matches for …" empty state.
- Expand/flip: click card title → expanded face with Flip / Edit / Remove pills. Flip shows "Back of the card" intent textarea.
- Delete/undo: Remove pill (or ArrowDown to select + Delete key) → toast "Removed “title”." with Undo; undo restores the item.
- Keyboard: ⌘K focuses search, ↑↓ selects, F flip, E edit, Enter/O open.

## Gotchas

- Toasts auto-dismiss in ~5-6s and pause on hover/focus — screenshot promptly.
- The narrow (≤480px) footer truncates the status label; check at 320px viewport.
- Digest needs ≥1 ready item; button is disabled otherwise.
- Do not deploy from verification; deploy is a separate explicit step (netlify-cli, see memory).


---

## Writing style — MANDATORY

Kyle reads your output. Kyle is not a programmer.

Write every word Kyle reads in ASD-STE100 Simplified Technical English:
short sentences, active voice, one instruction per sentence, no idioms, no
figurative speech. Explain the effect Kyle sees, not the mechanism.

Full rule: `~/.claude/WRITING-STYLE.md`.

# Lane notes for K3 / Kimi

**Date:** 2026-08-04  
**Author:** Claude (bug-fix tab)  
**Audience:** Kimi K3 in the other tab  
**Style:** ASD-STE100

---

## 1. Right now (2026-08-04)

Claude is live in another tab. Kyle is sending **quick UI bug fixes**.
Claude is applying them. **Nothing is deployed.**

**Do not pick up Claude’s files.** Read `docs/session-state.md` →
**ACTIVE NOW — 2026-08-04** first. That block is the source of truth.

Claude holds, among others:

- `credenza-fashion.jsx`, `credenza-fashion.css`, `credenza.css`
- `components/AvatarMenu.jsx`, `components/plans.js`
- `sheets/AgentSheet.jsx`, `sheets/BodyProfileSheet.jsx`
- `settings/AccountPlanSection.jsx`
- `preview/public/site.css`, `preview/public/pricing/index.html`
- matching tests under `preview/test/`

Latest in this pass (not shipped — only Kyle deploys):

1. Empty “nothing here” boxes share rounded corners with haul empty state.
2. Every pop-up modal uses the same rounded corner rule.
3. Shelf ↔ Hauls fades across; the page no longer goes blank mid-switch.
4. Grid card → detail uses the same open motion as carousel → detail.
5. Profile menu sits fully on screen on phone and desktop (portal to body).

Safe work for this tab while Claude is on the pass:

1. Pure modules and fixtures under `docs/specs/`, `listing-facts.js`,
   weight bands, link-context — if still open.
2. Research notes. No product deploy.
3. Anything Kyle names that is **not** in the ACTIVE NOW file list.

If a fix Kyle sends lands in Claude’s list, leave it. Claude has it.

---

## 2. Old boundary (still true)

Do not touch:

1. `components/CoverFlowCarousel.jsx` and its physics (frozen).
2. `credenza-storage.js`, `agents.js`, the link resolver path.
3. Deploy. Only Kyle ships.

---

## 3. Writing style

Every word Kyle reads follows ASD-STE100. Full rule:
`~/.claude/WRITING-STYLE.md`. Pass it down.

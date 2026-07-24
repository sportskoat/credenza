# Credenza Fashion — Execution Plan

**Date:** 2026-07-24
**Language:** ASD-STE100 Simplified Technical English
**Sources:** `Market-Launch-Review.md` (the audit), `Pro-plan.md` (agent research and
Kyle's answers), `Monetization.md` (strategy), `To-do.md` (open defects),
`carousel-canonical-state.md` (frozen component).

**Purpose:** This document is the work order. Each part is one work session.
Each part has a goal, a file list, a test gate, and a revert point. An agent
session can start any part when the parts before it are complete.

---

## Rules for every part

1. Work on a branch. Tag a revert point before the first change.
2. Run the full gate after each part: `npm test`, `npm run lint`,
   `npm run typecheck`, `npm run build`.
3. Drive the app in a real browser. Take screenshots.
4. Do not touch the carousel internals. Read `carousel-canonical-state.md` first.
5. Do not deploy. Kyle approves each deployment.
6. Update `session-state.md` before the context ends.

---

## Decisions Kyle confirmed

| Item | Decision |
|------|----------|
| Price | $5 each month. See Part 7 for one open question. |
| Sign-in | Email with password, and Google sign-in. |
| Notifications | Email. |
| Support | Kyle answers all mail. He is the only person. |
| Affiliate signups | Kyle applies later. This does not block code. |
| Lifetime plan | Do not sell one in the first six months. |

---

## Part 0 — Freeze the baseline

**Warning: a partial commit breaks the build.** The six sheet files in
`sheets/` are untracked. The lazy imports need them. A commit without them
produces an application that does not start.

**Goal:** Make one reviewed commit that contains every required file.

**Tasks:**

1. Read every untracked and modified file.
2. Confirm that the six sheets in `sheets/` are present.
3. Confirm that the probe scripts are development tools only.
4. Make one commit with all required files.
5. Tag the commit `baseline-2026-07-24`.

**Gate:** The full test gate passes. A clean checkout builds and starts.

**Time:** 0.5 day. **Blocked by:** nothing. **Do this first.**

---

## Part 1 — Stop the data loss

**Goal:** Stop the application from losing user items.

Both defects are confirmed in the code.

**Defect 1 — the storage race.** `credenza-fashion.jsx:8182` sets
`interactionLocked` only for the `load-error` state. The `loading` state does
not lock the interface. A user can stash an item during the load. The delayed
load result then replaces the item array. The item disappears.

**Defect 2 — lost poster data.** `migrateItem` keeps `posterSize` and `seller`.
It does not keep `posterStats`. The import writes `posterStats` at
`credenza-fashion.jsx:1942`. A reload deletes it. The user loses the height,
weight, and size of the Reddit poster. That data drives the size decision.

**Tasks:**

1. Lock capture until the load finishes. Alternatively, merge the loaded items
   with the items created during the load. Prefer the merge.
2. Add `posterStats` to `migrateItem`. Add the poster username to each item.
3. Keep the original haul text for a later reparse.
4. Add a test with a delayed storage result.
5. Add a reload test for the poster data.

**Files:** `credenza-fashion.jsx`, `credenza-storage.js`, `preview/test/`.

**Gate:** Both new tests pass. The item count is correct after a fast stash.

**Time:** 1.5 days. **Blocked by:** Part 0.

---

## Part 2 — Stop the revenue leak and repair trust

**Goal:** Protect the affiliate income. Remove every false promise.

**The revenue leak is confirmed.** `sheets/AgentSheet.jsx:97` shows an input
field bound to `affiliateCodes[agent.id]`. A user can type a personal referral
code. That code replaces your attribution. You then earn nothing from that user.

**Tasks:**

1. Remove the referral-code input fields from `AgentSheet.jsx`. Keep the agent
   choice. Keep the disclosure text.
2. Move the referral codes to build configuration only.
3. Add a short affiliate disclosure beside each Buy action.
4. Replace the description in `preview/index-fashion.html`. Do not name replica
   goods. Use the safe text from `manifest.webmanifest`.
5. Replace the sample shelf. Use one realistic haul. Show capture, sizing, QC,
   status, and Buy.
6. Change the public FAQ. Remove every claim about Pro features. Show a
   waitlist instead.
7. Confirm that no Log in button appears. The `SYNC_ENABLED` flag hides it.

**Files:** `sheets/AgentSheet.jsx`, `preview/index-fashion.html`,
`credenza-fashion.jsx`, the FAQ page.

**Gate:** No referral input exists. A search for the replica words finds none.

**Time:** 1.5 days. **Blocked by:** Part 0.

---

## Part 3 — Make the server safe

**Warning: this defect costs money now. The production app is exposed.**

**Goal:** Stop a stranger from spending your money.

Three problems exist:

1. The browser holds the function key. Any visitor can copy it from the
   JavaScript file. I confirmed the key inside
   `dist/assets/index-fashion-hHWe4ZLL.js`.
2. `chart-vision.js` fetches any address that a user supplies. It does not
   reject private network addresses. It follows redirects without a check.
3. No function has a rate limit. No function has a cost ceiling.

A complete fix needs user accounts. Part 7 adds them. This part adds every
control that works without accounts.

**Tasks:**

1. Fix the address defect in `chart-vision.js`:
   - Allow only the Yupoo image hosts.
   - Reject private and special-use addresses.
   - Reject local and metadata names.
   - Stop automatic redirects. Check each redirect destination.
   - Limit the byte count and the image count.
2. Add limits to every paid function:
   - Add a limit for each address.
   - Add a limit for each route.
   - Add a limit on concurrent requests.
   - Add a limit on the request body size.
   - Add a limit on the AI token count.
   - Add a limit on the Ask query length.
   - Add a limit on the Yupoo response size.
3. Add a daily cost ceiling. Stop the functions above the ceiling.
4. Return the code `429` above a limit.
5. Record the outcome of each request. Do not record private content.
6. Add a cost alert on the Anthropic account.
7. Rotate the exposed key after the limits are active.

**Files:** `preview/netlify/functions/*.js`, a new shared limit module.

**Gate:** New tests reject private addresses, encoded addresses, and bad
redirects. A limit test returns `429`. The cost ceiling stops the function.

**Time:** 4 days. **Blocked by:** Part 0.

---

## Part 4 — Publish the legal pages

**Goal:** Meet the legal duty before strangers use the app.

**Tasks:**

1. Write the privacy notice. Explain the shelf storage, the body measurements,
   the browser storage, the extension storage, the service-worker caches, the
   outbound click records, the server requests, the Anthropic processing, the
   retention times, the export method, and the deletion method.
2. Write the product terms.
3. Publish a support address that you read.
4. Repair the Clear action. It must delete every Credenza record. Today it
   leaves the preferences, the measurements, and other records.

**Files:** new pages under `preview/`, `credenza-storage.js`,
`credenza-fashion.jsx`.

**Gate:** A test confirms that the Clear action leaves no Credenza key.

**Time:** 2 days. **Blocked by:** Part 0. **Needs Kyle:** the support address.

---

## Part 5 — Repair accessibility and complete Tier A

**Goal:** Make the app usable with a keyboard. Complete the haul model.

**Accessibility tasks:**

1. Manage the focus in the mobile card dialog. Trap the focus. Return the
   focus to the control that opened the dialog. Use `ModalShell` where possible.
2. Add arrow-key navigation to the haul combobox.
3. Add the active-option relationship to the carousel. Do not change the
   carousel physics.
4. Restore the favorite focus indicator. A later CSS rule removes it.
5. Raise every control below 44 pixels.
6. Add Axe tests for the Fashion app. Add keyboard tests.

**Tier A tasks:**

7. Create a first-class haul record with a stable identifier. Named hauls are
   repeated `item.project` values today. Add the budget, the history, the
   parcel record, and the archive state.
8. Remove returned items from the haul weight total.
9. Add volumetric weight. Add packaging adjustment. Add a clear statement that
   the buying agent measures the final parcel.
10. Add a clear QC paste flow. Suggest Returned or Exchange after an RL
    decision. Add image limits and quota recovery.
11. Add the usual tops, bottoms, and shoes sizes to the body profile.
12. Correct the AI wording. A local calculation is not an AI summary.

**Files:** `credenza-fashion.jsx`, `credenza-fashion.css`, `sheets/*.jsx`,
new haul model module.

**Gate:** Axe reports no violation. Every flow works with a keyboard only.

**Time:** 6 days. **Blocked by:** Parts 1 and 2.

---

## Part 6 — Launch the free beta

**Goal:** Earn affiliate income. Learn from real users.

**Tasks:**

1. Add the six missing agents to `agents.js`: Mulebuy, Joyagoo, CNFans,
   Hoobuy, Oopbuy, AllChinaBuy. See `Pro-plan.md` section 9.
2. Record a privacy-safe outbound event. Store the agent, the time, the
   marketplace, the wrap state, and a hashed item identifier. Do not store the
   raw marketplace address.
3. Add basic monitoring for errors and cost.
4. Measure the activation events: the first capture, the first import, the
   first named haul, the first size decision, the first QC decision, and the
   first Buy click.
5. Write the landing page. Use the safe words from `Monetization.md` section 4.
6. Deploy after Kyle approves.

**Gate:** Every agent link opens the correct destination. The events record.

**Time:** 3 days. **Blocked by:** Parts 1 to 5.
**Needs Kyle:** the affiliate approvals, and the deployment approval.

**Stop here and measure.** Do not build Pro until users click Buy. If they do
not click Buy, repair that step first.

---

## Part 7 — Add accounts, billing, and entitlements

**Goal:** Make it possible to charge money safely.

**Tasks:**

1. Add accounts. Support email with password, and Google sign-in.
2. Replace the browser key with server-issued sessions. Authorize each paid
   request on the server. Remove the `VITE_` key completely.
3. Add the payment provider. Add the customer portal, so a user can change a
   card, cancel a plan, and read invoices without your help.
4. Add a server entitlement record. Include the plan, the billing status, the
   source, the expiry time, the grace period, the limits, the usage, and the
   last check time.
5. Process the billing messages one time each, even after a repeat.
6. Cache a signed entitlement for offline use.
7. Give an expired account a short grace period. Keep the local data after a
   cancellation. Stop new cloud writes after the grace period.
8. Add account export and account deletion.

**Files:** new server directory, `credenza-fashion.jsx`, `sheets/ProfileSheet.jsx`.

**Gate:** Tests cover the full entitlement life, repeat billing messages, the
cancellation, and the grace period. A real card completes a real payment.

**Time:** 12 days. **Blocked by:** Part 6.

**Open question for Kyle — the payment provider.** A merchant-of-record
provider, for example Paddle or Lemon Squeezy, collects the sales tax for you
in every country. Stripe does not. You are one person, and your customers are
international. A merchant of record removes a large tax duty. It costs a
higher percentage. **Recommendation: use a merchant of record.**

**Open question for Kyle — the price.** You approved $5 each month. The audit
proposes $5.99 each month and $39 each year, with the year as the default
offer and a 14-day trial. **Recommendation: use $5.99 and $39.** The higher
number gives room for the payment fee and the AI cost.

---

## Part 8 — Build the Pro features

**Goal:** Give a continuing reason to pay.

Build in this order. The order follows the money value.

| # | Feature | Free limit | Pro limit | Days |
|---|---------|-----------|-----------|------|
| 1 | Encrypted cloud backup | none | included | 5 |
| 2 | Multi-device sync | none | included | 6 |
| 3 | Version history | none | 30 days | 3 |
| 4 | AI chart-scan quota | small allowance | large allowance | 2 |
| 5 | Expanded QC storage | 5 images each item | 25 images each item | 3 |
| 6 | Multiple body profiles | one profile | many profiles | 3 |
| 7 | Fit history | none | included | 3 |
| 8 | Advanced parcel planning | basic total | volumetric and split | 4 |
| 9 | Bulk agent checklist | basic CSV | full export | 3 |
| 10 | Expiring haul shares | none | private links | 4 |
| 11 | Storage deadline warnings | none | email alerts | 3 |

Enforce every AI limit and storage limit on the server. Show each limit inside
the app. Do not use a hidden limit.

**Note on QC:** KakoBuy publishes an open QC photo interface. An automatic QC
import is much stronger than a manual paste. Add 2 days to item 5 for this work.

**Time:** 8 weeks for all items. **Blocked by:** Part 7.

---

## Part 9 — Harden the app

**Goal:** Make the installed app reliable.

**PWA tasks:** Reject the worker install when a required file fails. Serve the
cached files first. Add cache limits and expiry. Remove the unused 352 KB font.
Keep the lazy chunks out of the install cache. Show a loading state for a
chunk. Keep the update action until the user applies it. Report a failed
registration. Correct the launch color.

**Performance tasks:** Stop the React state update on every animation frame.
Stop the Gallery animation under reduced motion. Remove the duplicate
background. Stop writing the whole shelf after each small change. Group the
saves. Store the image data separately. Remove the unused `data-theme="dark"`
rules.

**Time:** 5 days. **Blocked by:** Part 6. Can run beside Part 7 or 8.

---

## Part 10 — Launch the paid product

**Tasks:** Run a private paid beta. Repair the defects it finds. Complete the
support procedure. Complete the billing recovery flow. Complete the legal
review. Then open the public plan. Review the price after twenty customers.

**Time:** 2 weeks. **Blocked by:** Parts 7, 8, and 9.

---

## Excluded from this plan

The Chrome extension. `extension/src/main.jsx` still imports the old
application. Its storage does not match the Fashion app. Do not ship it with
this launch.

---

## Schedule

| Milestone | Parts | Time from start |
|-----------|-------|-----------------|
| Safe to run in public | 0, 1, 2, 3 | 1.5 weeks |
| Free beta live | + 4, 5, 6 | 4 weeks |
| Able to take payment | + 7 | 6.5 weeks |
| Pro package complete | + 8, 9 | 15 weeks |
| Public paid launch | + 10 | 17 weeks |

These times assume one engineer with agent help. Parts 8 and 9 hold
independent work, so parallel agent lanes can reduce them by about 30 percent.
Part 7 does not reduce well. Payment code needs care.

---

## What I need from Kyle, and when

| Part | Need |
|------|------|
| 4 | The support address. |
| 6 | The affiliate approvals. The deployment approval. |
| 7 | The payment provider choice. The final price. |
| 10 | The legal review. |

Everything else can proceed without you.

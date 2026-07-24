# Credenza Fashion — Pro Plan and Route to Market

**Date:** 2026-07-24
**Written for:** Kyle
**Language:** ASD-STE100 Simplified Technical English
**Related:** `Monetization.md` (strategy), `To-do.md` (defects), `session-state.md` (build state)

---

## 1. What the app does today

The code base is strong. The test gate shows 198 passed tests. The app has
11,554 lines of application code and six server functions.

These Tier A features are complete:

| ID | Feature | Status |
|----|---------|--------|
| A1 | Reddit haul paste to many cards | Complete (`reddit-haul.js`) |
| A2 | Agent-independent Buy with referral codes | Complete (`agents.js`) |
| A3 | Haul pipeline status | Complete (`findStatus`) |
| A4 | Body profile and size decision | Complete (`recommendSize`) |
| A4+ | Size chart read from photos by AI | Complete (`chart-vision.js`) |

These Tier A features are absent:

| ID | Feature | Status |
|----|---------|--------|
| A5 | QC photo storage and GL/RL decision | Not built |
| A6 | Weight and shipping estimate | Not built |

The AI size-chart reader is the strongest asset. No competitor tool reads a
size chart out of a Yupoo photo. This feature decides the size question, and
the size question decides if the user loses money.

---

## 2. WARNING — a money risk is live now

**The app is in production. The AI key has no protection. A stranger can spend
your money today.**

The facts:

1. The client sends the key `VITE_CREDENZA_SEARCH_SECRET` in a header.
2. Vite writes this value into the JavaScript file at build time.
3. The value is present in the file `dist/assets/index-fashion-hHWe4ZLL.js`.
4. Any person can read this file in a browser and copy the key.
5. The server functions have no rate limit. A search found no limit code.
6. The functions call `claude-sonnet-5` and `claude-haiku-4-5` with your
   `ANTHROPIC_API_KEY`.

Result: one person with a script can make unlimited AI calls. You pay for all
of them.

**Do this first, before any Pro work:**

1. Add a rate limit to each server function. Use one IP address limit and one
   device limit.
2. Add a daily cost ceiling. Stop the function when the app passes the ceiling.
3. Set a spend alert on the Anthropic account.

Time: 2 to 3 days. This work is also the base of the Pro quota system, so it
is not lost effort.

---

## 3. The two money paths

You have two ways to earn. They need very different amounts of work.

### Path 1 — Agent affiliate (almost ready)

Every Buy button opens a buying agent. The agent pays you a commission. The
plumbing is complete. You have a confirmed Superbuy `partnercode`.

- Additional code needed: almost none.
- Additional work: sign up for more affiliate programs. Add the codes.
- Time to first income: days, not weeks.
- Income size: small for each user, but the cost to run is near zero.

### Path 2 — Credenza Pro (needs new systems)

Pro needs accounts, cloud storage, and payment. None of these exist.

- Time to build: 5 to 6 weeks for the base systems.
- Time for the Pro features: 6 to 7 weeks more.
- Income size: larger for each user, but you must give continuous value.

**Recommendation: start Path 1 now. Build Path 2 after real users arrive.**
An app with 20 users does not need a payment system. It needs users. Affiliate
income also proves that people click Buy. If people do not click Buy, Pro will
not sell either.

---

## 4. What Pro must give

Users of this hobby lose money in four ways:

1. A wrong size. The user cannot return an item to China. The money is gone.
2. A bad QC decision. The user approves a flawed item and keeps it.
3. A bad parcel plan. The user pays too much for international shipping.
4. A lost shelf. Months of research disappear with the browser data.

Pro must remove these four risks. Do not sell decoration. Sell confidence.

Also apply this rule: **gate the features that cost you money to run.** AI
calls and cloud storage have a real cost for each use. A quota on those items
is honest. Users accept it.

**Do not gate the first Buy.** Affiliate income needs the free user to reach
the Buy button. A crippled free tier kills Path 1.

---

## 5. The Pro features, in order of money value

### Group A — The subscription anchors

These four give continuous value. They justify a monthly price.

**A1. Cloud sync and backup**
The shelf lives in browser storage today. The storage code deletes old photos
when the browser is full (`credenza-storage.js`). The user loses data as the
haul grows. Pro stores the shelf on a server. The user opens the same shelf on
the phone and the computer.
- Free tier: one device, local storage.
- Pro tier: all devices, server backup, restore.
- Build time: 8 to 12 days.

**A2. Unlimited AI size charts**
The `chart-vision` function reads a size chart from album photos. Each call
costs you money. This feature stops expensive size errors.
- Free tier: 5 charts each month.
- Pro tier: no limit, and a faster queue.
- Build time: 2 days. The engine exists. You add a counter and a check.

**A3. Restock and price watch**
Items in this market sell out often. The app checks the seller page each day.
The app sends a message when the item returns or the price changes.
- Free tier: watch 3 items.
- Pro tier: watch all items.
- Build time: 8 days. This needs a scheduled job and a notification path.

**A4. QC photo vault (Tier A5 in the strategy doc)**
QC is the emotional centre of the hobby. The user must decide GL or RL from
warehouse photos. The app has the status values but no photo storage.
- Free tier: 10 QC photos, local only.
- Pro tier: full vault, cloud storage, long retention.
- Build time: 6 days.

### Group B — The power workflow

These add value but do not alone justify a subscription. Add them to the Pro
package.

| Feature | What it does | Free tier | Build time |
|---------|--------------|-----------|------------|
| Parcel planner (A6) | Adds the weight of each item. Estimates shipping cost. | Basic total | 5 days |
| Multi-haul budgets | Keeps many hauls with separate budgets and history | One active haul | 4 days |
| Export | Writes a CSV or checklist for the agent | Manual copy | 3 days |
| Seller memory | Keeps notes, batch names, and RL history for each seller | 5 sellers | 4 days |

---

## 6. Price

`Monetization.md` proposes $4 to $8 each month. Use this start point:

| Plan | Price | Note |
|------|-------|------|
| Free | $0 | Full capture, Buy, basic size, one device |
| Pro monthly | $5 | Test this number first |
| Pro yearly | $36 | 40 percent less than monthly |
| Lifetime | $79 | Add this later, after the support cost is clear |

This community dislikes subscriptions. Offer the yearly plan clearly. Add the
lifetime plan when Pro is stable.

---

## 7. Time plan

### Phase 1 — Protect the money (do this now)

| Task | Days |
|------|------|
| Add rate limits and a cost ceiling to the server functions | 3 |
| Add usage counters for each device | 2 |
| **Phase total** | **1 week** |

### Phase 2 — Earn from affiliate (do this next)

| Task | Days |
|------|------|
| Sign up for more agent affiliate programs (your task, not code) | — |
| Add the codes. Test each agent link. | 2 |
| Add a simple outbound click count | 2 |
| Write the landing page with safe words | 3 |
| **Phase total** | **1.5 weeks** |

### Phase 3 — Build the Pro base

| Task | Days |
|------|------|
| Add accounts | 4 |
| Add cloud storage and sync | 10 |
| Add Stripe subscriptions and entitlement checks | 5 |
| Add legal pages, support address, refund rule | 2 |
| Test with real payments | 2 |
| **Phase total** | **4.5 weeks** |

### Phase 4 — Build the Pro features

| Task | Days |
|------|------|
| AI size-chart quota and Pro unlimited | 2 |
| QC photo vault and GL/RL | 6 |
| Parcel planner | 5 |
| Restock and price watch | 8 |
| Multi-haul budgets and history | 4 |
| Export | 3 |
| Seller memory | 4 |
| **Phase total** | **6.5 weeks** |

### Totals

| Scope | Time |
|-------|------|
| Safe to run in public | 1 week |
| First income (affiliate) | 2.5 weeks |
| Pro able to take payment | 7 weeks |
| Comprehensive Pro package | 13.5 weeks |

These numbers are for one person with AI help. Parallel agent lanes can
compress Phase 4 by about 30 percent, because those features are independent.
Phase 3 does not compress well. Payment code and data migration need care.

---

## 8. The shortest honest route

1. **Week 1.** Add the rate limits. Remove the money risk.
2. **Week 2 to 3.** Add affiliate codes. Write the landing page. Show the app
   to r/FashionReps within the community rules.
3. **Week 4 to 6.** Watch the numbers. Count the Buy clicks. Ask 10 users what
   they would pay for.
4. **Week 7 onward.** Build Pro only if the users click Buy and ask for sync.

Kill rule: if users do not click Buy, do not build Pro. Repair the Buy step
first.

---

## 9. Agent research (2026-07-24)

Kyle has Superbuy and Fansbuy. I researched the market to find the other
agents that United States users prefer, and which agents pay a commission.

### The agent ranking, July 2026

Source: rep.tools, July 2026. The rating comes from the user review count.

| Rank | Agent | Rating | Reviews | In your app? |
|------|-------|--------|---------|--------------|
| 1 | KakoBuy | 2.5 | 74 | Yes |
| 2 | CNFans | 4.2 | 13,300 | **No** |
| 3 | Mulebuy | 4.7 | 2,813 | **No** |
| 4 | Joyagoo | 4.6 | 2,900 | **No** |
| 5 | Oopbuy | 4.2 | 797 | **No** |
| 6 | Sugargoo | 3.4 | 630 | Yes |
| 7 | Hoobuy | 3.9 | 560 | **No** |
| 8 | AllChinaBuy | 4.1 | 215 | **No** |

**Neither Superbuy nor Fansbuy is in the top eight.** Superbuy has the longest
history, but the community moved to newer agents. Your app supports two agents
that many users do not use.

### Three important facts

1. **CNFans has the most users and pays nothing.** CNFans stopped its referral
   commission on 22 January 2026. CNFans has the highest search volume and
   13,300 reviews. Support CNFans for the users. Expect no income from it.
   This change is the reason that creators moved to other agents.

2. **Superbuy pays on shipping, not on goods.** The rate is 1 to 5.5 percent at
   the basic level. The rate reaches 8.5 percent at the diamond level. The
   payment comes from international shipment orders by your invited users.

3. **KakoBuy has an open QC photo interface.** This fact changes the Pro plan.
   See section 10.

### Add these agents to `agents.js`

Add them in this order:

1. **Mulebuy** — the best community rating (4.7). Zero commission for users.
2. **Joyagoo** — rating 4.6. 90-day storage.
3. **CNFans** — the largest user base. Add for coverage, not for income.
4. **Hoobuy** — the broadest marketplace coverage.
5. **Oopbuy** — rating 4.2.
6. **AllChinaBuy** — the budget option.

Work needed: add the URL template and the referral parameter for each agent.
The registry structure already supports this. Time: 1 day for all six, plus
your time to apply to each affiliate program.

**Warning: apply to the affiliate programs before you write the codes.** Each
agent approves affiliates separately. Some programs need a minimum audience.

---

## 10. A change to the Pro plan — QC photos

KakoBuy publishes an open interface for QC photos. This fact improves the QC
vault feature (section 5, A4).

The old plan: the user copies photo addresses by hand.
The new plan: the app reads the QC photos automatically for KakoBuy orders.

An automatic QC vault is much stronger than a manual one. It removes work
instead of adding work. Move the QC vault up the build order for this reason.

Build time stays near 6 days. Add 2 days for the KakoBuy interface work.

---

## 11. Answers from Kyle (2026-07-24)

1. **Agents:** Superbuy and Fansbuy today. Research complete. See section 9.
2. **Sign-in:** Email with password, and Google sign-in. Both are standard.
   Supabase Auth and Clerk both support the pair. Add 1 day to the account
   task for the Google connection. New account time: 5 days.
3. **Price:** $5 each month. Confirmed.
4. **Notification:** Email. This choice is simpler than browser messages.
   Email needs a sending service, for example Resend or Postmark. Email also
   works when the app is closed. Browser messages do not.

## 12. Support and sequence (answered 2026-07-24)

**Support:** Kyle answers all support mail. He is the only person.

This fact changes three decisions:

1. **Do not sell the lifetime licence yet.** A lifetime buyer needs support for
   many years. The single payment does not pay for that time. Sell the monthly
   plan and the yearly plan first. Add the lifetime plan when the support load
   is known.
2. **Use the Stripe Customer Portal.** The portal lets the user change a card,
   cancel a plan, and read invoices without help. Payment problems create the
   most support mail. The portal removes most of that mail. Cost: 0 extra days,
   because the portal is part of the Stripe task.
3. **Keep the free tier self-service.** A free user must never need support.
   Write clear empty states and clear error text instead.

**Affiliate applications:** Kyle applies later. This step does not block any
code. The registry accepts an empty code and still opens the correct agent.

**Result for the sequence:** Phase 2 (affiliate income) now waits for Kyle.
Phase 1 (protect the money) does not wait. Start Phase 1 first.

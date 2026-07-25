# Credenza Fashion — Launch Kit

Date: 2026-07-24
Status: draft for Kyle. Nothing here is posted yet.

This document holds four things:

1. The affiliate signup list, with what to do on each site.
2. The launch copy for Reddit and Discord.
3. The promotion system — what to post, where, and how often.
4. The email service decision for Part 7.

---

## 1. Affiliate signups — do these in order

Set each approved code as a Netlify environment variable. No code change is
needed. The registry reads the code at build time.

**Warning: apply before you write any code into the app.** Each agent approves
affiliates separately. Some ask for an audience you do not have yet.

| Agent | Signup page | Env var | Referral param |
|-------|-------------|---------|----------------|
| Mulebuy | `https://mulebuy.com/register` | `VITE_CREDENZA_REF_MULEBUY` | unconfirmed |
| Joyagoo | `https://www.joyagoo.com/register` | `VITE_CREDENZA_REF_JOYAGOO` | unconfirmed |
| Hoobuy | `https://hoobuy.com/` (signup is a modal; `/register` returns 404) | `VITE_CREDENZA_REF_HOOBUY` | `inviteCode` (probable) |
| Oopbuy | `https://oopbuy.com/register` | `VITE_CREDENZA_REF_OOPBUY` | unconfirmed |
| AllChinaBuy | `https://www.allchinabuy.com/en/page/partner/` | `VITE_CREDENZA_REF_ALLCHINABUY` | unconfirmed |

### What I confirmed, and what I did not

I read each site in a real browser. WebFetch returns 403 from these hosts.

**AllChinaBuy — the most documented program.** The partner portal is public at
`/en/page/partner/`. It has two affiliate types:

- **Individual affiliate** — invite friends to register and create paid
  international parcel orders.
- **Group affiliate** — apply for an organization. Pays a **6 percent bonus**
  with a **2 month probation period**.

Requirement: **you must verify your email address before you can apply.** The
portal states this directly. The portal also exposes reward, level, and
withdrawal pages, so the program is real and self-serve.

Business contact: `business@allchinabuy.com`. Marketing: `marketing@allchinabuy.com`.

**Mulebuy** — the register form shows an **"Invitation Code"** field. The
affiliate rules page sits behind Cloudflare and refused every automated read.
Community tutorials use `mulebuy.com/register/?ref=<code>`, and codes appear to
be numeric. Treat `ref` as probable, not confirmed.

**Joyagoo** — the homepage advertises an "Affiliate Program — join and earn
generous bonus" panel. The affiliate rules page redirected to the homepage and
the register page was behind Cloudflare. Community links use
`joyagoo.com/register?ref=<code>` with numeric codes. Probable, not confirmed.

**Hoobuy** — no `/register` route exists; it returns a 404 page. Signup is a
modal on the site. Affiliate links seen in the wild use
`?inviteCode=<code>` with 8-character mixed-case codes, for example
`hoobuy.com/channel/personalized?inviteCode=5EAPmq4X`. This is the best
evidenced of the unconfirmed four.

**Oopbuy** — the register page shows an **"Invitation Code (Optional)"** field,
so a referral mechanism exists. I found no public affiliate terms. Comparison
sites that partner with Oopbuy state they earn **on the freight forwarding
function, not on the item price** — the same shape as Superbuy.

### How to confirm each param in 60 seconds

You will get the exact answer once you are approved, and it costs you almost
nothing to check:

1. Log in. Find your affiliate or invite page.
2. Copy the referral link the site generates for you.
3. Read the query string. The parameter name is right there.
4. Send me the link, or set `referralParam` in `agents.js` yourself.

That single copied link settles it. My probes cannot beat it, because these
sites gate the affiliate dashboard behind an account.

---

## 2. Launch copy

### Read this first — a rules check you must do yourself

**I could not verify the current r/FashionReps rules.** Reddit blocked the
automated read, and the rule searches did not complete. Do not post until you
open the subreddit rules page and the wiki yourself.

Monetization §4.3 already records the constraint: **do not spam r/FashionReps,
because unapproved ads get removed.** Assume that is still true.

**The safe procedure:**

1. Read the subreddit rules and the wiki.
2. Message the moderators BEFORE you post. Ask permission. Describe the app in
   one paragraph. State that it is free, that it stores data locally, and that
   you make affiliate income on agent links.
3. Disclose the affiliate relationship in the post itself. Hiding it is the
   fastest way to get banned, and it is the thing communities punish hardest.
4. If the moderators say no, do not post. Use Discord instead.

Smaller and friendlier first stops: r/RepSneakers, r/QualityReps,
r/FashionRepsBST, and agent Discord servers. Agent Discords are the softest
launch surface, because the agents want the traffic.

### Post A — Reddit, community framing (Monetization §4.2)

Use this only after moderator approval.

> **Title:** I built a free haul planner — paste a W2C list, get cards with QC,
> sizes and ship weight
>
> I got tired of running my hauls out of a notes app and 40 browser tabs. So I
> built the thing I wanted.
>
> **What it does**
>
> - Paste a haul list. It becomes cards, one per item.
> - Keeps the original link forever. Your Weidian or Taobao link is never lost.
> - Buy opens through your agent. Pick your own agent once, and every Buy
>   button uses it.
> - Track status per item: found, ordered, in warehouse, shipped.
> - Store size notes and QC photos next to the item they belong to.
> - Rough ship weight so a haul does not surprise you at checkout.
>
> **What it does not do**
>
> - No marketplace. I sell nothing.
> - No account needed. Your shelf lives in your browser.
> - No spreadsheet to maintain.
>
> **Money, stated up front:** it is free. I earn an affiliate commission if you
> buy through an agent link in the app. That is the whole business model. You
> can switch to "no agent" and open the raw link — the app still works the same.
>
> Feedback wanted, especially on which agents to add next.
>
> [link] [30-second GIF]

### Post B — Discord, short form

> Made a free haul planner. Paste your W2C list → cards with status, sizes, QC
> and ship weight. Keeps your original links, opens Buy through whichever agent
> you use. No account, everything stays in your browser.
>
> Free. I get affiliate commission on agent links, that's the model — you can
> turn it off and open raw links.
>
> Would love feedback on which agents to support next. [link]

### Post C — one-line reply, for organic threads

Use when somebody complains about tracking a haul. Never lead with the link.

> I built a free thing for exactly this — paste the W2C list, get cards with
> status and QC. Affiliate-funded, no account. Happy to share if useful.

### Copy rules

Keep these words: **haul, QC, GL, W2C, agent, shelf**. Community vernacular is
approved for Reddit and Discord by Monetization §4.2.

Never use these on the landing page, in paid ads, or in an app store listing:
brand names, "replica", "1:1", "fake". §4.1 restricts the public surface to
"agent haul planner" and "Taobao / Weidian shopping organizer".

---

## 3. Promotion system

### The constraint that shapes everything

Monetization §4.4 says paid social ads for this category are blocked, and app
stores carry a high rejection risk. So **the growth engine is demos, community
presence, and SEO — not advertising.** Do not buy ads. They will be rejected,
and the rejection creates a record.

### The one asset to build first: a 30-second demo GIF

§4.3 ranks this first, and it is the highest-leverage thing you can make.

Show one continuous take: paste a haul list → cards appear → set a status →
tap Buy → the agent page opens. No narration, no logo, no music. Post the GIF
itself, not a link to it. Reddit and Discord both play inline, and a post with
an inline demo outperforms a link post by a wide margin.

### The weekly rhythm — 3 hours per week

You answer all support mail yourself (Pro-plan §12), so the plan must fit
around one person.

| Day | Action | Time |
|-----|--------|------|
| Monday | Answer every comment and support mail from the weekend | 45 min |
| Wednesday | Post one useful reply in an agent Discord. Link only if asked | 30 min |
| Friday | Ship one visible improvement. Post it as a short changelog | 60 min |
| Sunday | Read the outbound click counts. Note which agent users pick | 20 min |

The changelog post is the engine. It gives you a reason to appear weekly
without advertising. "Added Hoobuy support" is a post. "Fixed the size notes on
mobile" is a post.

### The order of channels

1. **Agent Discords.** Softest surface. The agents want traffic, so your tool
   helps them. Start here.
2. **Small subreddits.** r/RepSneakers, r/QualityReps. Lower risk than the
   flagship subreddit.
3. **r/FashionReps.** Only after moderator approval.
4. **SEO pages.** "Weidian haul tracker", "how to organize a Taobao haul",
   "agent comparison". Slow, but it compounds and no moderator can remove it.
5. **The Chrome extension** (§4.3 item 3). Your extension directory already
   exists. An extension listing is a discovery surface that carries far less
   rejection risk than an app store.

### What to measure

The app already logs outbound clicks locally (`summarizeOutbound` in
`agents.js`). Watch two numbers only:

- **Wrapped click rate** — wrapped ÷ total. If this is low, the money pipe
  leaks. Investigate immediately.
- **Clicks per agent** — tells you which affiliate program to chase next, and
  which to drop.

Ignore installs and page views for now. They do not pay.

### Do not do these

- Do not spam. One removed post can cost you the whole subreddit.
- Do not hide the affiliate relationship. Disclose it in every post.
- Do not buy ads for this category.
- Do not name brands in public-facing copy.
- Do not launch on all five channels in one week. You cannot answer that much
  mail alone.

---

## 4. Email service for Part 7 — use Resend

Pro-plan §11 chose email for notifications. Between the two candidates:

| | Resend | Postmark |
|---|--------|----------|
| Free tier | **3,000 per month**, 100 per day, 1 domain | 100 per month |
| Entry paid | $20 per month, 50,000 emails | $15 per month, 10,000 emails |
| Overage | $0.90 per 1,000 | $1.80 per 1,000 on Basic |
| Deliverability | Solid | **Best in class** — refuses marketing mail, so its IPs stay clean |
| Streams | Domain level | **Separate transactional and broadcast streams** |
| Templates | React Email — matches your React app | Mustache |

**Recommendation: Resend.**

Three reasons:

1. **The free tier is 30 times larger.** 3,000 per month covers your whole beta.
   Postmark's 100 per month barely covers testing.
2. **React Email matches your stack.** Credenza Fashion is React. You write
   notification templates as components, not as Mustache strings.
3. **Your volume is low and your mail is transactional.** Password resets and
   status notifications. Postmark's deliverability edge is real, but it matters
   most at volume you do not have.

Watch one thing: the **100 per day cap** on the free tier. A single burst — a
status change across a large haul — can hit it. Queue notifications and batch
them daily. That is better product behaviour anyway; nobody wants 40 emails.

Switch to Postmark only if delivery to inboxes becomes a real problem. The
migration is small, because both take a similar API call.

---

## 5. What is still open

1. **Four referral params are unconfirmed.** Mulebuy, Joyagoo, Oopbuy and
   AllChinaBuy. Confirm each from your own affiliate dashboard after approval.
   Hoobuy's `inviteCode` is probable but still unconfirmed.
2. **Three link formats are unverified.** Mulebuy, Oopbuy and AllChinaBuy are
   `verified: false` in `agents.js`. See the note below.
3. **The r/FashionReps rules are unread.** Read them before you post.

### Why three agents are still unverified

I tested every link in a real browser against real items. Results:

| Agent | Result |
|-------|--------|
| Hoobuy | **Confirmed.** Weidian renders a full product page |
| Joyagoo | **Confirmed after a fix.** The old format was broken — see below |
| CNFans | Weidian bounces to the homepage. Needs a look |
| Mulebuy | Blocked by Cloudflare on every attempt |
| Oopbuy | Returns a thin page shell for every item id |
| AllChinaBuy | Blocked by Cloudflare on every attempt |

**The Joyagoo find matters.** The shipped format sent buyers to the Joyagoo
homepage with no item. It returned HTTP 200, which is why the earlier curl
check passed it. Every Joyagoo Buy click would have lost the item and the sale.
It is fixed and covered by a regression test.

Cloudflare blocks automated browsers, not you. **To clear the last three, open
one item through each in your own browser and tell me what happens.** Then I
flip `verified`. That is 5 minutes of your time and it cannot be automated.

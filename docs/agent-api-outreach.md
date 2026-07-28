# Agent outreach and API cost plan

Written 2026-07-28. Plain English. Read the summary, then the parts you need.

---

## 0. The Wensel LLC sign-in

I cannot sign into an account for you. I have no browser and no password access.
Sign-in needs your hands.

Here is what "signed in as Wensel LLC" means for this work. You need four things
before you send the first email. Get them in this order.

1. **A business email address.** Use `kyle@` plus a domain you own, or
   `partners@` plus that domain. Do not use a personal Gmail address. Agents
   check the domain before they answer. A matching domain reads as a real
   company.
2. **A one-page site the agent can open.** It must show the Credenza name, what
   the app does, and a contact address. Agents ask for this in the first reply.
3. **The legal name and address of Wensel LLC**, plus the state of
   registration. Affiliate forms ask for all three.
4. **A payout method.** Most agents pay by PayPal or by bank wire. A few pay in
   store credit only. Decide which one Wensel LLC accepts before you sign a
   form. `docs/Monetization.md:522` still lists this as an open question.

You also started a Stripe sign-in in this session. Open this link in your
browser to finish it:

`https://access.stripe.com/mcp/oauth2/authorize?response_type=code&client_id=oacli_UxTUlnLFgvx2VG&code_challenge=uJQ6zenmZpFagsIzL6iSrSwVoYr_TP1HhDzAm0LgNjs&code_challenge_method=S256&redirect_uri=http%3A%2F%2Flocalhost%3A3118%2Fcallback&state=MTlvKpUzCOsC3Wp_uT7sDa5qz-9QHHgdQaYElbUnz60&resource=https%3A%2F%2Fmcp.stripe.com%2F`

---

## 1. What you are actually asking the agents for

You want two different things. Do not mix them in one email. They go to
different people and they move at very different speeds.

**Ask A — an affiliate code.** This is a short text code. You add it to the
link when a customer clicks Buy. The agent pays you a share of their fee. This
is self-serve at most agents. It takes days, not months. The app is already
built for it.

**Ask B — API access.** This is a machine connection. It would let Credenza read
product data, stock, prices and parcel status directly instead of guessing. This
needs a signed agreement at every agent. It takes months. No agent on your list
publishes an open API.

**Do Ask A first for every agent. Do Ask B only for the two or three agents that
answer Ask A well.** Ask B has no value until you have traffic to show.

---

## 2. Who to contact, in order

The app already knows eleven agents. `agents.js` records which ones pay you
today and which ones do not.

### Already working — do not email these

| Agent | State |
|---|---|
| Superbuy | Code works. Verified 2026-07-20. |
| Kakobuy | Code works. Verified against a live item. |
| Fansbuy | Sign-up invite works. Code `Fans-VmXrpx91`. |

### Priority 1 — email this week

| Agent | Why first |
|---|---|
| **Hoobuy** | Large. Runs a referral system already. Item pages render live. |
| **Mulebuy** | Publishes affiliate rules on its own help site. Lowest friction. |
| **Joyagoo** | Already verified live in the app for Weidian and Taobao. |
| **Oopbuy** | Runs referral link tracking. No public sign-up page found. |

### Priority 2 — email after the first replies land

| Agent | Why second |
|---|---|
| **AllChinaBuy** | Sister brand of Superbuy. Your Superbuy contact may open this door. |
| **Sugargoo** | The app has a code slot but nobody confirmed the name. Ask them to confirm it. |

### Do not contact

| Agent | Why |
|---|---|
| **CNFans** | Shut its creator commission program on 2026-01-22 with no notice. Do not spend effort here. |
| **CSSBuy** | Already retired in the app. It refuses USA customers. |

### How to find the address

Do not guess and do not blast. Open each agent's site and look for a "Partner",
"Affiliate" or "Business" page first. Most run the program through Discord or
Telegram, not email. If only a general address exists, the common patterns are
`business@`, `partner@`, `affiliate@` and `support@`. Send one email to one
address. Wait five working days.

Sources for the notes above:
[MuleBuy affiliate rules](https://back.mulebuy.com/help-categories/affiliate-rules/affiliate-program-affiliate-rules/partnerprogramm/) ·
[HooBuy profile](https://www.jadeship.com/agents/hoobuy) ·
[MuleBuy profile](https://www.jadeship.com/agents/mulebuy) ·
[CNFans program change](https://www.cnbuypilot.com/cnfans/) ·
[Superbuy partner program](https://www.superbuy.com/en/page/globalpartner/)

---

## 3. Email 1 — the affiliate ask (send this first)

Keep it short. Agents read hundreds of these. Replace every `<...>` field.

> **Subject:** Affiliate partnership — Credenza (shopping planner app)
>
> Hello,
>
> I am Kyle Wensel. I run Wensel LLC. We built Credenza, a web app that helps
> shoppers organise finds, size garments and plan a haul before they buy.
>
> Credenza already lists <AGENT> as a supported agent. Customers pick their
> agent inside the app. We then send them to that agent with one click. We do
> not sell products and we do not host a marketplace.
>
> I would like to join your affiliate program.
>
> Three questions:
>
> 1. What is the commission rate and the payout schedule?
> 2. What is the exact URL parameter name for a referral code? We add it to the
>    product link at click time.
> 3. Does the code survive a redirect to the product page, or must the customer
>    land on your home page first?
>
> Our site is <YOUR SITE URL>. Company: Wensel LLC, <STATE>, USA.
>
> Thank you.
>
> Kyle Wensel
> Wensel LLC
> <YOUR BUSINESS EMAIL>

Question 2 matters most. The app stores that parameter name in `agents.js`. With
the name and the code, adding an agent is a settings change, not a code change.

---

## 4. Email 2 — the API ask (send only after a good reply)

> **Subject:** Data integration — Credenza x <AGENT>
>
> Hello <NAME>,
>
> Thank you for the affiliate setup. It is live in our app.
>
> I want to ask about a deeper integration. Today Credenza reads public product
> pages to show a customer the title, price and available sizes. This is slow
> and it breaks when a page changes.
>
> Do you offer partner API access for any of the following?
>
> 1. Product lookup by marketplace URL — title, price, images, variants.
> 2. Live stock and price for a saved item.
> 3. Parcel and quality-check status for an order placed under our referral code.
>
> Item 3 is the one our customers ask for most. They want to see warehouse
> status without leaving the app. That keeps them inside your funnel.
>
> We are happy to sign an NDA and to agree rate limits and caching rules.
>
> What volume or revenue level do you need to see before we can discuss this?
>
> Kyle Wensel
> Wensel LLC

The last question is deliberate. It converts a "no" into a target number.

---

## 5. Email 3 — the follow-up (send once, after 5 working days)

> **Subject:** Re: Affiliate partnership — Credenza
>
> Hello,
>
> I am following up on the note below. If affiliate partnerships are handled on
> Discord or Telegram instead, please send me the invite and I will move there.
>
> Kyle Wensel
> Wensel LLC

Send this once. Do not send a third email. Move to the next agent.

---

## 6. What the APIs cost to run today

These are the paid services the app already calls. All Claude costs come from
`preview/netlify/functions/lib/limit.js:41`.

### Price per Claude call

| Function | What it does | Model | Cost per call |
|---|---|---|---|
| `resolve` | Translates a Chinese listing into English | Haiku 4.5 | about $0.003 |
| `chart-vision` | Reads a size chart photo | Haiku 4.5 | about $0.005 |
| `ask` | Answers a customer question | Sonnet 5 | about $0.014 |

**These are estimates.** They assume a typical listing and a typical answer. A
long chart photo or a long question costs more. Measure real numbers from the
usage log before you build a budget on them.

### Cost per customer per month

| Customer type | Saves | Chart reads | Questions | Cost |
|---|---|---|---|---|
| Light | 5 | 0 | 2 | about $0.04 |
| Typical | 20 | 3 | 10 | about $0.22 |
| Heavy | 80 | 15 | 60 | about $1.16 |

### Cost per month at scale

Assume a typical customer and a normal mix.

| Active customers | Claude | Netlify | Supabase | Total |
|---|---|---|---|---|
| 100 | about $22 | $0 free tier | $0 free tier | about $22 |
| 1,000 | about $215 | about $19 | about $25 | about $259 |
| 10,000 | about $2,150 | about $19 plus overage | about $25 plus overage | about $2,400 |

Check the Netlify and Supabase numbers on their sites before you rely on them.
Prices change. Netlify credits already burn faster than you expected.

### Compare that to the price

Your tiers are $2.49 per week, $5.99 per month and $44.99 per year. A typical
customer costs about $0.22 per month to serve. Even the heavy customer at $1.16
leaves room. **The AI cost is not your risk. Netlify build minutes and bandwidth
are the risk.** Watch those.

---

## 7. One real problem to fix before you scale

**The daily spend cap does not work.**

`limit.js:56` keeps the running daily cost in memory. Netlify starts a new copy
of the function for every wave of traffic. Each copy starts its own counter at
zero. So the $5 daily ceiling is $5 **per copy**, not $5 in total. Under load
you could spend many times that and see no error.

Fix it by storing the running total in Supabase instead of in memory. Do this
before you advertise the app anywhere.

I did not change any code for this. It needs its own gated commit.

---

## 8. What else you could add

Ranked by value for the effort.

### Worth doing soon

1. **Parcel tracking.** Track123 already carries Superbuy data and offers a
   normal REST API with webhooks. This gives customers "where is my parcel"
   without any agent agreement. It is the single most requested thing in this
   category. Cost is roughly $0 to $50 per month at your size.
2. **Currency conversion.** Prices arrive in CNY. Customers think in USD. A free
   daily rate feed removes the mental math. Cost is $0.
3. **Real cost logging.** Write every Claude call cost to Supabase. Then the
   numbers in section 6 stop being estimates. Cost is $0.

### Worth doing later

4. **Image hosting and resize.** Product photos come from Chinese servers. Those
   servers are slow from the USA and they delete images. Copy them to Cloudflare
   R2 or Supabase Storage. Cost is about $5 per month at your size.
5. **Email sending.** You need receipts, trial reminders and password resets.
   Resend or Postmark costs about $0 to $15 per month.
6. **Error reporting.** Sentry free tier tells you when a function breaks. Today
   you find out when a customer complains.

### Do not do

7. **Anything that lets a customer buy inside Credenza.** `docs/Monetization.md`
   calls this the core-business kill zone. Handing off to the agent is the whole
   business model. Keep it that way.

---

## 9. Your next three actions

1. Set up the business email address on a domain you own.
2. Send Email 1 to Hoobuy and Mulebuy. Use the exact wording in section 3.
3. Move the daily spend cap out of memory and into Supabase.

---

## Open items I could not settle

- I could not verify a contact address for any agent. Nobody publishes one.
  Check each site by hand.
- `docs/Monetization.md:517` still asks which affiliate programs are signed up.
  This document answers it. Update that file when the first reply lands.
- The Credenza auth secret was exposed in a chat. Rotation is still your action.

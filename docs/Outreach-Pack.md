# The outreach pack — how the first subscriber arrives

**Written:** 2026-07-31
**For:** Kyle. Every step is 15 to 40 minutes. No agent can send these for you.
**Companion to:** `docs/Launch-Kit.md`, which decided the channels. This file
names the targets and writes the words.

---

## The idea this plan is built on

You will not get a subscriber from a broadcast. You will get one from about
thirty conversations.

Here is why. Pro raises daily limits. A new person does not hit a daily limit.
So the person who pays first is not a new person. It is somebody who already
runs big hauls — thirty items, several at once, size charts every day. That
person exists in about six places, and there are maybe two hundred of them who
speak English.

So the plan does two things at once:

1. Put the shelf in front of the heavy users, one at a time.
2. Give everybody else the demo link, because a shared link costs nothing and
   compounds.

**Send one message at a time. Read the reply. Answer it.** Thirty real replies
beat three thousand impressions.

---

## Step 0 — do this before you send one word

Two things, both under an hour. Skip them and you burn the contacts.

### 0a. Prove a card works

`docs/Pre-Launch-Plan.md` still lists LB-5 as OPEN. Nobody has ever paid you.
If checkout is broken, your first subscriber finds out for you and leaves.

Follow step 4 of `docs/Kyle-Launch-Runbook.md`. Use the test card
`4242 4242 4242 4242` first. Write the result into `docs/Part-7-setup.md`
under `7g test log`.

**Do not send outreach until a plan badge has read Pro once.**

### 0b. Ship the demo page

`preview/public/demo/` is new. It is not live until you deploy.

```
cd ~/credenza/preview && npx vitest run && npm run lint && npm run build
cd ~/credenza/preview && netlify deploy --prod
cd ~/credenza/preview && node scripts/indexnow-submit.mjs
```

Then open `https://credenzafashion.com/demo/` and check the six garments draw.
Every message below links to that page, not to the empty app.

---

## Step 1 — make one real shelf of your own (40 minutes)

You need one public share link that is not a sample. This is the asset every
message uses.

1. Open the app. Build a haul of 15 to 25 items you would actually buy.
2. Set a status on each one. Add two or three notes.
3. Press Share. Turn on prices and notes. Leave sellers off.
4. Copy the link. Paste it into a Discord channel of your own and look at the
   preview card. **The card must show a photo.** If it shows the plain logo,
   stop and tell me — that is runbook step 5 failing.

Keep that link in a note. It is your proof.

---

## Step 2 — the agent Discords (days 1 to 4)

These are the softest surface. The agents want traffic, and your tool sends
them traffic. Nobody there will call you a spammer for having a tool.

**Warning: read each server's rules channel before you type.** Post in the
channel the rules name, and nowhere else. One removed post is cheap. One ban
closes a server forever.

| Server | Where to find it | What to do |
|---|---|---|
| Kakobuy | `discord.com/invite/kakobuy` | Answer two size questions. Then post in the tools or self-promo channel. |
| Superbuy | `discord.com/invite/KUCNqabapm` | Same. Superbuy is your one confirmed affiliate, so start here. |
| CNFans | search `cnfans` on disboard.org | Same. |
| Hoobuy | search `hoobuy` on disboard.org | Hoobuy is your best-evidenced link format. |
| Sugargoo | search `sugargoo` on disboard.org | You still owe them a signup. Do both in one visit. |

Check every invite before you rely on it. Discord invites expire.

**The order inside each server matters.** Do not post on the day you join.

- **Day you join:** read the rules. Answer two questions from other people.
  Do not mention Credenza. Not once.
- **Two days later:** post in the promo or tools channel.

### The Discord post

> Made a free haul planner because my own haul was living in 40 tabs.
>
> Paste your W2C list, get one card per item — photos, price, status, size pick
> off the seller's own chart, QC photos, rough ship weight. Buy opens in
> whichever agent you already use.
>
> Here's a finished one so you can see it before you touch anything:
> https://credenzafashion.com/demo/
>
> Free, no account needed to start. I make affiliate commission on agent links
> and that's the whole model — you can switch to "no agent" and open the raw
> link, everything still works.
>
> Which agents should I add next?

That last line is the important one. It gives people something to reply to
that is not "cool".

### The one-line reply, for when somebody complains

Use this in a normal thread, never as a top-level post. Never lead with the
link.

> I built a free thing for exactly this — paste the list, get cards with status,
> size and QC. Happy to link it if that's useful.

Then wait. If they say yes, link it. If nobody says yes, you learned something
real for free.

---

## Step 3 — the ten heavy users (days 3 to 10, one a day)

This is the step that produces the subscriber. Everything else is warm-up.

**Find them.** Search YouTube for `taobao haul unboxing 2026` and TikTok for
`taobao spreadsheet`. Skip anyone over 200k subscribers — they will not answer.
You want 2k to 50k. They post haul spreadsheets, they run referral codes
already, and they answer their comments.

Also look inside the Discords you joined in step 2. The person who answers
other people's size questions all day is a heavy user, and they are easier to
reach than any creator.

**Make a list of ten names.** One a day, ten days. Personalise every one.

### The creator message

Subject or first line: **The spreadsheet in your last haul video**

> Hi [name] — I watched the [specific video] haul. The part where you scroll the
> spreadsheet to find what a piece cost is the exact thing I got tired of.
>
> I built Credenza for it. Paste the W2C list, get one card per item with the
> photos, the price, the status, the size pick off the seller's chart, and the
> rough ship weight. Buy opens in whatever agent you use.
>
> A finished one: https://credenzafashion.com/demo/
> Mine, real: [your share link from step 1]
>
> I'd like to give you Pro free, permanently, whether or not you ever mention
> it. If you do end up using it and want to show it, that's up to you — I'm not
> asking for a post.
>
> What would you need it to do that it doesn't?
>
> — Kyle

**Two rules for this message.**

Do not ask for a post. Ask what is missing. A creator who answers that question
is a creator who opened the app.

Give the free Pro before they agree to anything. It costs you nothing, and it
removes the reason to say no.

### How to give free Pro

You have no comp path in Stripe yet. Use the Stripe dashboard: create a 100%
off coupon, apply it to a subscription, and send them a checkout link. That is
also a second real test of the payment stack, which you need anyway.

---

## Step 4 — the builder subreddits (day 7, one post)

These allow direct promotion. They will not make you money. They will find your
bugs, which is worth more right now.

Post to **r/SideProject** first. Rules change, so read the sidebar the morning
you post.

> **Title:** I got tired of running my haul out of a spreadsheet, so I built a
> shelf for it
>
> Every item you buy through a Chinese shopping agent starts as a link in
> somebody's comment. People track thirty of them in Google Sheets, with the
> photos in a different tab and the size charts in a third.
>
> Credenza turns a pasted list into one card per item: photos, price, status,
> a size pick read off the seller's own chart against your measurements, QC
> photos, and a ship-weight estimate before you pay for the parcel.
>
> Finished example, no signup: https://credenzafashion.com/demo/
>
> Local-first — the shelf is in your browser, and it works signed out. Free
> plan is real, not a trial. I make affiliate commission when someone opens a
> buy link.
>
> Built solo. The size-chart parser was the hard part: the charts are photos of
> Chinese tables with no fixed column order.
>
> Tell me what's broken.

Then answer every comment the same day. That is the whole value of the post.

**Do not post the same thing to r/FashionReps.** Your own Launch Kit says the
rules there are unread and that unapproved tool posts get removed. If you want
that subreddit, message the moderators first and describe the app in one
paragraph, including the affiliate income. If they say no, do not post.

---

## Step 5 — the weekly rhythm, forever after

Three hours a week, from `Launch-Kit.md` §3, with one change.

| Day | Action | Time |
|---|---|---|
| Monday | Answer every comment and every mail | 45 min |
| Tuesday | Send one creator message. One, not five | 20 min |
| Wednesday | Answer one question in an agent Discord. Link only if asked | 30 min |
| Friday | Ship one visible change. Post it as a one-line changelog | 60 min |
| Sunday | Read the numbers below | 20 min |

The Friday changelog is the engine. It is a reason to appear every week without
advertising. "Added Oopbuy" is a post. "Fixed size charts with no header row"
is a post.

---

## What to watch

Open Google Analytics. You set it up on 2026-07-29 and it counts `buy_click`.

Four numbers, weekly. Nothing else.

1. **Visits to `/demo/`.** If this is zero, the messages are not landing.
2. **Demo visit to app open.** If people read the demo and never open the app,
   the demo is the problem, not the outreach.
3. **`buy_click` count.** This is the only number that means somebody used it
   for real.
4. **Shares created.** Every share is a link that works while you sleep.

Ignore signups. Ignore page views. Neither one pays.

**The honest threshold:** if forty personal messages produce no `buy_click`,
the problem is the product's fit, not the outreach. Come back and we look
again. Do not send eighty.

---

## What not to do

- Do not buy ads. `Monetization.md` §4.4 says this category gets rejected, and
  a rejection creates a record against you.
- Do not name a brand in any public copy. Not on the site, not in a post.
- Do not hide the affiliate income. Say it in the first message every time.
  Communities forgive a tool. They do not forgive a hidden one.
- Do not launch on five channels in one week. You answer all the mail yourself.
- Do not post twice in one server in one week.

---

## Related

- [[Launch-Kit]] — the channel decisions this file executes
- [[Kyle-Launch-Runbook]] — step 4 is the payment proof required above
- [[Pre-Launch-Plan]] — LB-5 is the open gate

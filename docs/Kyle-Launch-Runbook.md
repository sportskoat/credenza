# Kyle's launch runbook

**Written:** 2026-07-27
**For:** Kyle only. Every step here needs a login, a card, a phone, or a
deploy approval. No agent can do any of it.

Everything else in `Pre-Launch-Plan.md` is DONE and pushed to `main`.
Forty items closed. This file is what is left.

Do the steps in order. Step 3 depends on step 1. Step 5 depends on step 4.

---

## Before you start

Open two windows:

- A terminal at `~/credenza/preview`.
- The Supabase SQL editor for project `uaweaziqrybvxfbacllb`.

**Warning: do not paste a secret key into a chat window.** Read keys with
`netlify env:list`. Set them in the terminal only.

---

## Step 1 — Run the two migrations (10 minutes) — DONE 2026-07-27

**You finished this step. Do nothing here. Go to step 3.**

The check query returned `shelves`/`true` and `shares`/`true`. Both tables
exist. Both have row-level security on. Keep the rest of this section for
reference only.

Two features are built, tested, and dormant. They stay dormant until these
tables exist. Today a signed-in user who presses Share gets a 500 error.

**Warning: paste the contents of each file, not its path.** A path in the
SQL editor gives `ERROR: 42601: syntax error at or near "docs"`.

### 1a. The shelf table

1. Run this command in the terminal. It copies the file contents:
   ```
   pbcopy < /Users/kylewensel/credenza/docs/sql/2026-07-26-shelves.sql
   ```
2. Open the Supabase SQL editor for project `uaweaziqrybvxfbacllb`.
3. Select all the text in the editor. Delete it.
4. Press Command-V. Press Run.

Expect `Success. No rows returned`. It is safe to run twice.

### 1b. The shares table

1. Run this command in the terminal:
   ```
   pbcopy < /Users/kylewensel/credenza/docs/sql/2026-07-26-shares.sql
   ```
2. Clear the editor. Paste. Run.

Run 1a first. The shares table does not depend on the shelves table, but
the file says to, and following the file is faster than checking.

### Check it worked

In the SQL editor, run:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('shelves','shares');
```

Expect two rows. Expect `true` in the `rowsecurity` column for both.

A missing row means that file did not run. A `false` means the table
exists with no row-level security, which lets one account read another
account's shelf. **Stop and tell me if you see `false`.**

**Warning: the shares table gives the anon role no select policy.** That is
correct. The `/s/:code` function reads it with the service role and only
ever asks for one exact code. Do not add a public select policy. It would
let anyone list every share on the site with one call.

---

## Step 2 — Turn on cloud sync (2 minutes) — DONE 2026-07-27

**I did this for you. Do nothing here. Go to step 3.**

`preview/.env` line 6 now reads `VITE_ENABLE_SYNC=true`. The file stays out
of git (`.gitignore` line 4). The next build compiles with sync live.

Two corrections to my earlier wording, kept so the mistakes are not repeated:

- This step said "Find the line `VITE_ENABLE_SYNC=`". No such line existed.
  The step adds a line; it does not edit one.
- `preview/.env` starts with a dot, so Finder hides it. Press
  Command-Shift-Period in Finder to show hidden files.

The command, for reference:

```
printf 'VITE_ENABLE_SYNC=true\n' >> /Users/kylewensel/credenza/preview/.env
```

The value must be the word `true`. Any other value leaves sync off.

**Warning: do this only after step 1a.** Without the table every sync call
answers 404. The app degrades quietly, so the flag would be a lie.

This turns on two things: pull-on-sign-in for every account, and continuous
push for Pro accounts.

---

## Step 3 — Ship the batch (15 minutes)

This is the ONLY deploy the launch spends. It carries all forty items.

### 3a. Check the environment first

```bash
cd ~/credenza/preview && npm run preflight
```

**Warning: a build with an empty `.env` ships a signed-out app.** The
preflight catches it. If it fails, fix `.env` before you go on.

### 3b. Check the gate

```bash
cd ~/credenza/preview && npx vitest run && npm run lint && npm run build
```

Expected: 1629 tests pass, 0 lint errors, and a bundle around 362 kB named
`index-fashion-*.js`. A bundle under 50 kB means the build shipped a stub —
stop and say so.

### 3c. Deploy

```bash
cd ~/credenza/preview && netlify deploy --prod
```

### 3d. Tell the search engines

```bash
cd ~/credenza/preview && node scripts/indexnow-submit.mjs
```

That notifies Bing and the other IndexNow partners. It does not replace
Google Search Console.

---

## Step 4 — Test one checkout (LB-5, 30 minutes)

**This is the last P0. No purchase has ever completed through the full
stack.** An untested payment path is not a payment path.

It cannot be tested locally. Stripe checkout, the webhook, and the portal
are all Netlify functions. Do step 3 first.

### 4a. Prefer test mode

Use `sk_test_` keys and card `4242 4242 4242 4242`. Any future expiry date
and any CVC work. A live key needs a real card.

### 4b. Run the loop

1. Sign in with a real account. Use the magic link or Google.
2. Buy the monthly plan with the test card. The price is $4.99.
3. Confirm the webhook fired: the entitlement record flips to Pro.
4. Reload the app. Confirm four things are live in the client:
   - the plan badge reads Pro
   - the Ask cap is 200 a day
   - the QC photo cap is 12
   - the haul cap is 100
5. Open the Stripe portal from the Profile sheet. Cancel.
6. Confirm the record returns to free after the webhook.

### 4c. Write it down

Record every step and its result in `docs/Part-7-setup.md`, under a heading
named `7g test log`. Each step needs evidence: a screenshot or a log line.

### 4d. After it passes

1. Set `REQUIRE_ACCOUNTS=true` on Netlify.
2. Remove `VITE_CREDENZA_SEARCH_SECRET` from the build environment.
3. Roll the Stripe secret key if it was ever pasted into a chat window.
   Then re-set it on Netlify, in the terminal only.

**Warning: do not set `REQUIRE_ACCOUNTS=true` before 4b passes.** It closes
the signed-out path while the paid path is unproven.

---

## Step 5 — Check the share card in Discord (LB-39, 5 minutes)

The card had no picture until yesterday. Yupoo answers a crawler with HTTP
567 because the crawler sends no Referer. The site now relays the photo
through `/s/:code/img` with a Referer Yupoo accepts.

This is covered by tests, not by a live crawler. Prove it once:

1. Open the app. Sign in.
2. Add one item that has a Yupoo photo.
3. Press Share. Copy the link.
4. Paste the link into any Discord channel. Your own DM works.
5. Look at the unfurled card.

**Pass:** the card shows the item photo.
**Fail:** the card shows the plain Credenza logo, or no picture.

A fail means the relay returned a fallback. Say so and I will read the
function log.

---

## Step 6 — Build the iPhone Shortcut (LB-9, 15 minutes)

The page at `/how/stash-from-your-phone/` is live. The Shortcut itself is
built on the phone, once, by you.

Follow the live page. It carries the same steps this section carries.

Warning: do not skip the URL Encode action. A Weidian link carries its
own `?` and `&`. Without the encode, the browser reads everything after
the first `&` as a separate parameter and the link arrives truncated.

Build these two actions, in order:

1. **URL Encode** — set the input to Shortcut Input.
2. **Open URLs** — set the URL to `https://credenzafashion.com/?stash=`
   followed by the **URL Encoded Text** variable from action 1.

Then:

1. Name it `Stash in Credenza`.
2. Turn on **Show in Share Sheet**.
3. Set the accepted input to URLs and Text.

### Test it

1. Open Weidian or Yupoo in Safari on the phone.
2. Press Share. Pick `Stash in Credenza`.
3. Credenza opens and the item is on the shelf.

If it opens Credenza but the shelf is empty, the Open URLs action points
at Shortcut Input instead of the URL Encoded Text variable.

---

## Step 7 — Two-device sync check (LB-7, 10 minutes)

Do this after step 3, because the flag from step 2 only ships with a build.

1. Sign in on your laptop. Add three items.
2. Sign in as the same account on your phone.
3. Confirm the three items appear on the phone.
4. Add a fourth item on the phone.
5. Sign out on the laptop. Sign in again. Confirm the fourth item appears.

**Read this before you call step 5 a failure.** The two plans behave
differently, by design:

| Plan | On sign-in | While you edit |
|---|---|---|
| Free | pulls, merges, saves the merge once | nothing |
| Pro | pulls, merges, saves the merge once | pushes continuously |

So on a **free** account, a laptop reload shows nothing new. The pull runs
once per session. You must sign out and back in. On a **Pro** account, the
fourth item pushes within about two seconds and a reload is enough.

The pull always runs first. Pushing before the merge would overwrite the
account with one device's shelf, which is the accident this order prevents.

---

## The launch gate

Check each box only when the step above it passed.

- [ ] Step 1 — both migrations ran; `shares` and `shelves` exist.
- [ ] Step 2 — `VITE_ENABLE_SYNC=true` in `preview/.env`.
- [ ] Step 3 — the batch deployed; IndexNow pinged.
- [ ] Step 4 — one full paid loop, with evidence in `Part-7-setup.md`.
- [ ] Step 4d — `REQUIRE_ACCOUNTS=true`; search secret removed.
- [ ] Step 5 — a real Discord paste showed the photo.
- [ ] Step 6 — the Shortcut works from the iPhone share sheet.
- [ ] Step 7 — two devices show the same shelf.

---

## If something fails

Tell me the step number and what you saw. Every one of these paths has
tests behind it, so a failure is information: it means the live environment
differs from the test environment in a way worth finding.

See also: [[Pre-Launch-Plan]] · [[Part-7-setup]] · [[search-console-setup]]

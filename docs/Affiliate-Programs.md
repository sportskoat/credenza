# Affiliate Programs — terms, rates, and link shapes

**Status:** Reference. Recorded from Kyle's affiliate dashboards (screenshots/pastes).
**Audience:** Future Claude/agent sessions. Read this before touching `agents.js` referral plumbing or planning monetization copy.
**Updated:** 2026-07-28.

Codes live in Netlify env (`VITE_CREDENZA_REF_*`), read at build time by `agents.js`. Link shapes and tests: `agents.js` + `preview/test/agents.test.js`.

## Wired (code set in Netlify)

### Kakobuy — PAYS
- Code: `7pc32`. Env: `VITE_CREDENZA_REF_KAKOBUY`.
- Item links: `?ref=` appended at open time (verified live 2026-07-20).
- Register link: `kakobuy.com/register/?affcode=7pc32`. Short link: `ikako.vip/r/7pc32` (301 → `sl.kakobuy.com/r/` → 302 → register).
- Rates (rebate on international shipping fees): Basic 3.5% → Bronze 4.5% (5,000 credit) → Silver 5.5% (20,000) → Gold 6.5% (80,000) → Platinum 7.5% (400,000).
- Payout: withdraw, or deduct against Kakobuy service fees. "No ceiling."
- New-user promo: signups get $410 coupons (their side, not ours).
- Contact: biz@kakobuy.com.

### Mulebuy — PAYS
- Code: `201444039`. Env: `VITE_CREDENZA_REF_MULEBUY`.
- Register link: `mulebuy.com/register?ref=201444039`. Signup-only; item links carry no code.
- Rates: start 3% on international shipping fees; level rises with points ("Higher level = Higher rate"). Kyle: 0 points, 3%.
- Leaderboard shows top promoters at $3–5k/mo — real volume exists here.

### Oopbuy — PAYS
- Code: `NCTD1YA8A`. Env: `VITE_CREDENZA_REF_OOPBUY`.
- Register link: `oopbuy.com/register?inviteCode=NCTD1YA8A`. Signup-only.
- Rates: 3%–7.5% on international shipping fees. Levels V1–V8 (50 signed orders → V2).
- Extras: $20 per invited new user (limited-time first-order bonus ticker). Monthly withdrawal limit: 2.
- Their stats: $15.9M paid to members since 2024; 27,140 earners; $586 average.

### Superbuy — PAYS
- Code: `888c9Y`. Env: `VITE_CREDENZA_REF_SUPERBUY`.
- Item links: `?partnercode=` (confirmed from Kyle's live affiliate dashboard 2026-07-20).
- Register link: `superbuy.com/en/page/login/?partnercode={code}&type=register`.
- Rates: not recorded yet. Pull from the affiliate dashboard when Kyle next opens it.

### Fansbuy — PAYS
- Code: `Fans-VmXrpx91` (stored raw, base64 at link time). Env: `VITE_CREDENZA_REF_FANSBUY`.
- Register link: `fansbuy.com/register?invite=BASE64(code)`. Signup-only.
- Rates: not recorded yet.

### CNFans — DEAD PROGRAM, link wired anyway
- Code: `17545386`. Env: `VITE_CREDENZA_REF_CNFANS`.
- Register link: `cnfans.com/register?ref=17545386`. Signup-only.
- Rates were: Basic 3% → Bronze 4% (5,000 pt) → Silver 5% (20,000) → Gold 6% (80,000) → Platinum 7% (400,000).
- **CNFans stopped paying commission on new referral orders 2026-01-22** (their notice). Kyle wanted the link in the system regardless (2026-07-28). Expect $0.

## Signed up, not yet wired

### JoyaGoo — PAYS
- Code: `301044677` (from Kyle's earlier signup; self-serve, no outreach).
- Rates: 4–8% CNY tiers.
- Register link shape: not confirmed. Wire it when Kyle pastes the invite link.

## Not signed up (slot ready in agents.js)

- **Sugargoo** — env slot `VITE_CREDENZA_REF_SUGARGOO`. Item-link param `inviteCode` is a GUESS; confirm from the affiliate center after signup. Reddit's most-recommended agent post-Pandabuy.
- **AllChinaBuy** — env slot `VITE_CREDENZA_REF_ALLCHINABUY`. Superbuy sister site.
- **Hoobuy** — env slot `VITE_CREDENZA_REF_HOOBUY`, but reports say Hoobuy ceased operations in 2025 (payment issues). Skip unless Kyle says otherwise; candidate for `retired: true`.

## Retired

- **CSSBuy** — refuses USA purchasing-agent service (2026-07-20). `retired: true`.
- **Pandabuy** — dead (2024 raid). Host recognized for link parsing only.

## Candidates not in the registry

- **ACBuy** — 0% service fee, community favorite; the link parser already recognizes acbuy hosts. Best next add.
- **USFans** — sneaker-focused, large signup bonus; new and less proven.
- **Basetao** — old, alive, parser recognizes it. Small base.
- **Litbuy, HubbuyCN, Fishgoo** — very new. Watch, don't add.

## The pattern for wiring a new code

1. Kyle pastes the invite link from the agent's affiliate page.
2. Add/confirm `signupTemplate` (register links) or `referralParam` (item links) in `agents.js`.
3. `npx netlify env:set VITE_CREDENZA_REF_<AGENT> <code>` from `preview/` (all contexts; needs a redeploy — Kyle ships).
4. Add a `buildSignupUrl` test in `preview/test/agents.test.js`.
5. Record the program's rates and payout rules in this file.

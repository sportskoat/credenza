# Parser audit — 2026-07-27

Ran 30 real-world paste formats through `parseImport` and `unwrapAgentUrl`
(battery: agent fronts, Chinese share text, short links, Reddit/Discord/X/TikTok
shapes). What the audit found and what was done.

## Fixed (server side, shipped in this working tree)

- **m.tb.cn / tb.cn / s.click.taobao.com short links.** `classifyBuyLink` needed
  a numeric id, so the most common Taobao mobile share format 422'd and the card
  stayed a bare link. `resolve.js` now follows id-less Taobao-family links to
  the item page (every hop re-validated against the family hosts, never the open
  web) and classifies the landing URL. HTML interstitials are read for the first
  Taobao-family item link. Tests: `resolve-function.test.js` (3 new).

## Good (verified, no change needed)

- All seven agent fronts unwrap to canonical marketplace URLs (CNFans, Superbuy,
  Fansbuy, Hoobuy, Mulebuy, Pandabuy legacy, Kakobuy family).
- Weidian/Taobao/Tmall/1688 desktop links parse with ids, tracking params and
  all. Yupoo album + www photos shapes are clean.
- Discord `<url>` embed suppression survives with a clean URL.

## HELD — client fixes waiting on the ChatGPT diff in credenza-fashion.jsx

Do NOT apply until that file is committed or reverted (Kyle 2026-07-27).

1. **Trailing punctuation kept.** The messy-lines path (`parseImport` path 4)
   uses its own `line.match(/https?:\/\/[^\s<>"')\]]+/g)` — no trailing-punct
   trim, no deobfuscation. `https://weidian.com/item.html?itemID=123,` keeps the
   comma, the id regex fails, the card never resolves and never dedupes against
   the same item pasted clean. Fix: use `extractUrls(line)` (trims + dedupes).
2. **Space-broken URLs unrepaired.** Same path: `https://wei dian.co m/...`
   becomes a junk "https://wei" card. `extractUrls` deobfuscates via
   reddit-haul.js; the messy-lines path does not call it. Same fix as 1.
3. **Chinese share-text chrome leaks into titles.** `【Yeezy 350 尾货】<url>
   复制这段描述后打开微店APP` produces titleHint "【Yeezy 350 尾货】 复制这段描述…".
   Fix in the label builder: strip `【…】` wrappers (keep inner text), drop
   `复制…打开…APP` instruction tails, unwrap markdown `[label](url)` to `label`,
   and strip 「」 quotes. Taobao share text should title as `Nike Dunk Low 熊猫`.
4. **Taokouling tokens (淘口令).** `￥CZ0001 aBcDeFg￥` has no URL and becomes an
   empty junk card. Detect the token pattern in the URL-free branch and give the
   card a real title ("Taobao share code — open in the Taobao app") instead.
5. **Client resolve gate.** `resolvableBuyUrl` requires an id, so short links
   never reach the (now capable) server. Add a `taobaoShortHost` check beside
   the id checks so m.tb.cn/s.click cards get resolved.

## Accepted gaps (no action)

- t.co wrappers, Linktree pages, X/TikTok posts: generic cards. Fine — they are
  context links, not buy links.
- Google Sheets haul links: the sheet parsers exist; a bare docs.google.com URL
  is a generic card by design.

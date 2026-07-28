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

## APPLIED 2026-07-28 — client fixes (were HELD on the ChatGPT diff)

The hold released when the CH-03..CH-06 commits landed. All five fixes are in
the working tree, covered by `preview/test/parser-paste.test.js` (14 tests),
full gate green at 2317. A sixth fix surfaced during testing: the Reddit-haul
path had the same trailing-punctuation bug as the messy-lines path — the held
list only covered path 4, but two bullet lines route to `parseRedditHaul`.
Fixed in `reddit-haul.js` (same trim as `extractUrls`).

1. **Trailing punctuation kept.** FIXED. The messy-lines path now calls
   `extractUrls(line)` (trims + dedupes). A dirty paste (`itemID=123,`) and a
   clean paste of the same item now dedupe to ONE card with the canonical key.
2. **Space-broken URLs unrepaired.** FIXED by the same change — `extractUrls`
   deobfuscates via reddit-haul.js.
3. **Chinese share-text chrome leaks into titles.** FIXED. New exported
   `shareTextLabel(line)` unwraps `[label](url)`, drops URLs, strips
   `【平台】` tags and 「」 quotes, and removes `复制…打开…APP` tails.
4. **Taokouling tokens (淘口令).** FIXED. New exported `taokoulingTitle(text)`
   detects `￥…￥` tokens (internal spaces allowed) and titles the card
   "Taobao share code — open in the Taobao app".
5. **Client resolve gate.** FIXED. New exported `taobaoShortHost(url)` covers
   id-less m.tb.cn / tb.cn / s.click.taobao.com links; `resolvableBuyUrl` and
   `isResolvable` accept them, so the cards reach the server follow-up shipped
   above.
6. **Reddit-haul trailing punctuation** (found by the new tests, not the audit).
   FIXED. `reddit-haul.js` trims `/[),.;:!?'"\]]+$/` off matched URLs before the
   agent-signup filter.

## Accepted gaps (no action)

- t.co wrappers, Linktree pages, X/TikTok posts: generic cards. Fine — they are
  context links, not buy links.
- Google Sheets haul links: the sheet parsers exist; a bare docs.google.com URL
  is a generic card by design.

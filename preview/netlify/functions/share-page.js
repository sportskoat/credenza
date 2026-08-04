// ═══════════════════════════════════════════════════════════════════════════════
// share-page.js — the public shared haul at GET /s/:code (LB-8)
//
// This is the only page on the site rendered by a function instead of a file,
// and it is a function for exactly one reason: Open Graph. A crawler that
// unfurls a link in Discord or Reddit does not run JavaScript. A client route
// would give every share the same generic card; a server-rendered page gives
// each share its own image and title. That is the whole viral loop.
//
// Three rules govern the HTML below.
//
//   1. The document decides. A field the sharer turned off is ABSENT from the
//      stored snapshot, so it cannot be printed here. Nothing on this page is
//      hidden with CSS — hidden is still shipped, and "shipped" is what
//      View Source shows.
//   2. Everything is escaped. The snapshot holds text the sharer typed and
//      URLs a seller wrote. Both reach this page as attacker-controlled input
//      the moment a link is public.
//   3. A miss is a 404, always the same 404. A wrong code, a deleted share and
//      an expired share are one response. Telling them apart turns this route
//      into an oracle for probing which codes exist.
// ═══════════════════════════════════════════════════════════════════════════════

const limit = require("./lib/limit.js");
const share = require("./lib/share-doc.js");
const purge = require("./lib/purge.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");

const ROUTE = "share-page";
const HTML = { "content-type": "text/html; charset=utf-8" };
const SITE = "https://credenzafashion.com";

// A share is frozen: once written it never changes, so the page for one code
// is safe to hold at the edge. `durable` shares that entry between edge nodes,
// which matters here more than anywhere except the preview relay — a link
// posted to a busy Discord is one function call and then thousands of hits.
// The window stays short enough that a deleted share leaves the web quickly.
const PAGE_CACHE = "public, durable, max-age=300, stale-while-revalidate=3600";
// A 404 is cached briefly too: without it, a bot walking random codes bills a
// function call per guess.
const MISS_CACHE = "public, durable, max-age=120";

// No entity table lookup, no library. Five characters, in the order that
// matters: & first, or it double-escapes the ones written after it.
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// An href gets a second check even though the snapshot was filtered at build
// time. The snapshot is data from the database; this file is the last place
// before it becomes an attribute, and a `javascript:` URL that reaches an
// href is a cross-site scripting bug on a public page.
function safeHref(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.length > 2048 ? null : trimmed;
}

// An <img src> may also be an inline data:image/ — that is how a shelf photo
// gets into the snapshot when the source blocks hotlinking.
function safeSrc(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) return trimmed;
  return safeHref(trimmed);
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return "$" + n.toFixed(2);
}

function code(event) {
  const path = (event && event.path) || "";
  const fromPath = /\/s\/([^/?#]+)/.exec(path);
  if (fromPath) return decodeURIComponent(fromPath[1]);
  const q = (event && event.queryStringParameters) || {};
  return typeof q.code === "string" ? q.code : "";
}

// ————— The page —————

const STYLE = `
@font-face{font-family:"Clash Grotesk";src:url("/fonts/ClashGrotesk-Variable.woff2") format("woff2-variations");font-weight:200 700;font-display:swap}
:root{--bg:#f4f4f0;--ink:#17181a;--muted:#5c5f66;--faint:#8a857c;--card:#ffffff;--line:#e2e2dc;
--display:"Clash Grotesk",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
--sans:'Clash Grotesk',ui-sans-serif,system-ui,-apple-system,sans-serif;
--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#050506;--ink:#f4f4f0;--muted:#a1a1aa;--faint:#8a857c;--card:#0d0d10;--line:#2a2a2e}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--sans);
padding:2.5rem 1.25rem 3rem;font-synthesis:none;-webkit-font-smoothing:antialiased}
.wrap{max-width:1040px;margin:0 auto}
a{color:inherit}
header{border-bottom:1px solid var(--line);padding-bottom:1.25rem;margin-bottom:1.5rem}
.brand{display:inline-flex;align-items:center;gap:9px;text-decoration:none;margin:0 0 1rem}
.brand-name{display:inline-flex;flex-direction:column;gap:3px;line-height:1}
.wordmark{font-family:var(--sans);font-size:13.5px;font-weight:800;letter-spacing:.16em}
.kicker{font-family:var(--sans);font-size:8.5px;font-weight:700;letter-spacing:.30em;text-transform:uppercase;color:var(--muted)}
h1{font-family:var(--display);font-size:2rem;line-height:1.15;margin:.4rem 0 .5rem;font-weight:500}
.meta{color:var(--muted);margin:0;font-family:var(--sans);font-size:.9rem}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));padding:0;margin:0;list-style:none}
.item{background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;
box-shadow:0 1px 2px rgb(0 0 0/.08),0 12px 24px rgb(0 0 0/.05)}
.shot{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;background:var(--line)}
.shot.empty{display:flex;align-items:center;justify-content:center;color:var(--faint);
font-family:var(--sans);font-size:.8rem}
.body{padding:.8rem .85rem 1rem}
.title{margin:0;font-family:var(--display);font-size:1.06rem;line-height:1.3;font-weight:500}
.title a{text-decoration:none}
.title a:hover{text-decoration:underline}
.sub{margin:.35rem 0 0;color:var(--muted);font-family:var(--mono);font-size:.78rem;line-height:1.5}
.price{margin:.45rem 0 0;font-family:var(--display);font-size:1.05rem}
.note{margin:.5rem 0 0;font-size:.88rem;color:var(--muted)}
.more{margin:1.5rem 0 0;color:var(--muted);font-family:var(--sans);font-size:.9rem}
footer{border-top:1px solid var(--line);margin-top:2.5rem;padding-top:1.25rem;
font-family:var(--sans);font-size:.9rem;color:var(--muted)}
.cta{display:inline-block;margin-top:.75rem;padding:.7rem 1.25rem;background:var(--ink);color:var(--bg);
text-decoration:none;font-family:var(--sans);font-weight:600;font-size:.95rem;border-radius:999px}
`.trim();

const MARK = `<svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true" focusable="false">
<rect width="40" height="40" rx="12.4" fill="#0f1114"/>
<path fill="#e9edf2" d="M21.30 27.80Q19.21 27.80 17.64 26.50Q16.07 25.20 15.21 22.84Q14.34 20.48 14.34 17.26Q14.34 14.15 15.29 11.81Q16.24 9.48 17.84 8.20Q19.43 6.91 21.39 6.91Q22.54 6.91 23.42 7.12Q24.30 7.33 24.98 7.67Q25.32 7.87 25.32 8.27L25.40 12.56Q25.40 13.04 25.06 13.04Q24.75 13.04 24.67 12.68L24.38 11.63Q23.79 9.43 23.01 8.58Q22.23 7.73 21.16 7.73Q19.18 7.73 17.87 10.17Q16.55 12.62 16.55 17.26Q16.55 20.42 17.21 22.60Q17.88 24.78 18.94 25.88Q20.00 26.98 21.19 26.98Q22.46 26.98 23.24 26.19Q24.02 25.40 24.55 23.14L24.89 21.75Q24.98 21.33 25.34 21.39Q25.66 21.44 25.66 21.87L25.54 26.45Q25.54 26.84 25.17 27.04Q24.50 27.38 23.58 27.59Q22.66 27.80 21.30 27.80Z"/>
<rect x="11.03" y="29.66" width="17.93" height="2.76" rx="1.38" fill="#4da3ff"/></svg>`;

const BRAND = `<a class="brand" href="${SITE}/">${MARK}<span class="brand-name">
<span class="wordmark">CREDENZA</span><span class="kicker">Fashion</span></span></a>`;

function itemHtml(card) {
  if (!card || typeof card !== "object") return "";
  const title = escapeHtml(card.title || "Untitled");
  const src = safeSrc(card.image);
  const href = safeHref(card.link);

  const shot = src
    ? `<img class="shot" src="${escapeHtml(src)}" alt="${title}" loading="lazy" decoding="async" />`
    : `<div class="shot empty">No photo</div>`;

  // rel="nofollow ugc noopener" — these links point at seller pages the sharer
  // pasted. They are user-generated content, not endorsements, and they must
  // not pass ranking signal or reach window.opener.
  const heading = href
    ? `<h2 class="title"><a href="${escapeHtml(href)}" rel="nofollow ugc noopener" target="_blank">${title}</a></h2>`
    : `<h2 class="title">${title}</h2>`;

  const bits = [];
  if (card.size) bits.push("Size " + escapeHtml(card.size));
  if (card.colorway) bits.push(escapeHtml(card.colorway));
  if (card.seller) bits.push(escapeHtml(card.seller));
  if (card.batch) bits.push(escapeHtml(card.batch));
  if (card.qcCount) bits.push(escapeHtml(card.qcCount) + " QC photo" + (card.qcCount === 1 ? "" : "s"));
  if (card.weightGrams) bits.push(escapeHtml(card.weightGrams) + " g");

  const price = money(card.priceUsd);
  return (
    `<li class="item">${shot}<div class="body">${heading}` +
    (bits.length ? `<p class="sub">${bits.join(" · ")}</p>` : "") +
    (price ? `<p class="price">${escapeHtml(price)}</p>` : "") +
    (card.note ? `<p class="note">${escapeHtml(card.note)}</p>` : "") +
    `</div></li>`
  );
}

// v1 renderer. Keep this path byte-stable for old links.
function pageHtmlV1(doc, opts) {
  const title = escapeHtml(doc.title || "A Credenza haul");
  const items = Array.isArray(doc.items) ? doc.items : [];
  const count = Number(doc.count) || items.length;

  const summary = [count + (count === 1 ? " item" : " items")];
  const total = money(doc.totalUsd);
  if (total) summary.push(total + " total");

  // Unlisted changes the preview, not the page. Everything below <body> is the
  // same for both, because the code is the access control and the person
  // holding it was given it on purpose. What changes is what a link leaks
  // BEFORE anyone opens it: a pasted link normally unfurls the haul's real
  // title, its item count, its total, and a photo of an item — into whatever
  // room it was pasted in, to people who never opened it. An unlisted link
  // unfurls a card that says a haul is here and nothing else.
  const unlisted = !!(opts && opts.unlisted);
  const ogTitle = unlisted ? "A Credenza haul" : title;
  const description = unlisted
    ? "A private haul list shared with Credenza Fashion. Open the link to see it."
    : title + ". " + summary.join(" · ") + ". Shared with Credenza Fashion.";

  // The OG image never points at the seller's own URL, even though that URL is
  // right there in the snapshot. Yupoo answers a request with no Referer with
  // HTTP 567 and a page of HTML (measured 2026-07-27, LB-39), and a crawler
  // sends no Referer — so the card that was supposed to carry the photo carried
  // nothing. /s/:code/img re-fetches the same photo with a Referer the seller
  // accepts and hands back the bytes. See share-image.js.
  //
  // A data: image counts as a photo here: share-image decodes it and serves it,
  // so a haul shot on a phone camera now unfurls like any other.
  //
  // An unlisted share never points at /img. share-image refuses that row too,
  // so this is belt and braces — but the meta tag is what a crawler reads, and
  // a crawler that never asks for the photo cannot cache it either.
  const hasPhoto = !unlisted && items.some((card) => card && safeSrc(card.image));
  const ogImage = hasPhoto && opts && opts.code ? SITE + "/s/" + encodeURIComponent(opts.code) + "/img" : SITE + "/og.png";

  // noindex: a shared haul belongs to the person who shared it. It should
  // unfurl in a chat, not accumulate in a search index — and an unlisted
  // share that Google lists is a broken promise.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${ogTitle} · Credenza Fashion</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Credenza Fashion" />
<meta property="og:title" content="${ogTitle}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta name="twitter:card" content="${unlisted ? "summary" : "summary_large_image"}" />
<meta name="twitter:title" content="${ogTitle}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header>
${BRAND}
<h1>${title}</h1>
<p class="meta">${escapeHtml(summary.join(" · "))}</p>
</header>
<main>
<ul class="grid">${items.map(itemHtml).join("")}</ul>
${doc.truncated ? `<p class="more">This link shows the first ${items.length} items of a larger haul.</p>` : ""}
</main>
${
  opts && opts.hideFooter
    ? ""
    : `<footer>
<p style="margin:0">Made with <a href="${SITE}/">Credenza Fashion</a>, the agent haul planner for Weidian, Yupoo, and Taobao finds.</p>
<a class="cta" href="${SITE}/">Plan your own haul</a>
</footer>`
}
</div>
</body>
</html>`;
}

// ————— v2 haul share page (haul sharing redesign) —————

const STYLE_V2 = `
@font-face{font-family:"Clash Grotesk";src:url("/fonts/ClashGrotesk-Variable.woff2") format("woff2-variations");font-weight:200 700;font-display:swap}
:root{
--cz-bg:#F4F4F0;--cz-ink:#17181a;--cz-sub:#4f545b;--cz-faint:#6b7078;
--cz-inset-bg:#FAFAF6;--cz-card-solid:#ffffff;--cz-strip-bg:#EAEAE4;--cz-footer-bg:#EFEFE9;
--cz-hair:#d2d2c9;--cz-money:#147a3a;--cz-money-bg:rgba(20,122,58,.10);
--cz-accent-bg:rgba(23,24,26,.06);--cz-error-text:#be123c;--cz-error-bg:rgba(225,29,72,.10);
--cz-action-fill:#17181a;--cz-action-text:#F4F4F0;--cz-seg:rgba(23,24,26,.06);--cz-focus:#4da3ff;
--cz-display:"Clash Grotesk",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
--cz-sans:"Clash Grotesk",ui-sans-serif,system-ui,-apple-system,sans-serif;
--cz-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{
--cz-bg:#000000;--cz-ink:#f5f5f7;--cz-sub:#b7bbc2;--cz-faint:#9ea3ab;
--cz-inset-bg:#26262b;--cz-card-solid:#202024;--cz-strip-bg:#151517;--cz-footer-bg:#0c0c0e;
--cz-hair:rgba(255,255,255,.16);--cz-money:#4ade80;--cz-money-bg:rgba(74,222,128,.12);
--cz-accent-bg:rgba(255,255,255,.07);--cz-error-text:#f08a92;--cz-error-bg:rgba(244,63,94,.16);
--cz-action-fill:#f5f5f7;--cz-action-text:#17181a;--cz-seg:rgba(255,255,255,.07)}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--cz-bg);color:var(--cz-ink);font:16px/1.55 var(--cz-sans);font-synthesis:none;-webkit-font-smoothing:antialiased}
a{color:inherit}
button{font:inherit;color:inherit}
.cz-s{max-width:1120px;margin:0 auto}
.cz-cover{position:relative;height:320px;background:var(--cz-inset-bg);overflow:hidden}
.cz-cover-clip{position:absolute;inset:0;overflow:hidden}
.cz-marquee{display:flex;gap:8px;height:100%;width:max-content;padding:0 4px;animation:cz-marquee linear infinite}
/* No hover pause (Kyle 2026-08-04): the cover is ambience, not a control.
   Stopping it under the reader's cursor read as a stalled page. */
.cz-tile{flex:none;height:100%;aspect-ratio:4/5;background-color:var(--cz-inset-bg);background-size:cover;background-position:center}
@keyframes cz-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.cz-marquee{animation:none!important}}
.cz-cover-bar{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;z-index:3}
.cz-blur-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 11px 7px 8px;border-radius:999px;background:rgba(23,24,26,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;text-decoration:none}
.cz-blur-chip .mark{width:18px;height:18px;display:block}
.cz-blur-chip .wm{font-family:var(--cz-mono);font-size:9px;font-weight:800;letter-spacing:.16em}
.cz-tab-chip{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:rgba(23,24,26,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.cz-tab-chip button{border:0;padding:7px 13px;border-radius:999px;background:transparent;color:#fff;font-size:12px;font-weight:650;letter-spacing:-.01em;cursor:pointer}
.cz-tab-chip button.is-on{background:#fff;color:#17181a}
.cz-sticky{display:none;position:sticky;top:0;z-index:5;align-items:center;justify-content:space-between;gap:24px;padding:14px 28px;background:var(--cz-bg);border-bottom:1px solid var(--cz-hair)}
.cz-sticky-left{display:flex;align-items:center;gap:18px;min-width:0}
.cz-sticky-title{font-family:var(--cz-display);font-size:19px;font-weight:600;letter-spacing:-.035em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cz-sticky-sum{font-family:var(--cz-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cz-faint);white-space:nowrap}
.cz-sticky-right{display:flex;align-items:center;gap:16px;flex:none}
.cz-seg{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:var(--cz-seg)}
.cz-seg button{border:0;padding:8px 16px;border-radius:999px;background:transparent;color:var(--cz-sub);font-size:13px;font-weight:650;letter-spacing:-.01em;cursor:pointer}
.cz-seg button.is-on{background:var(--cz-action-fill);color:var(--cz-action-text)}
.cz-desk-landed{display:flex;flex-direction:column;align-items:flex-end}
.cz-desk-landed .k{font-family:var(--cz-mono);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint)}
.cz-desk-landed .v{font-family:var(--cz-display);font-size:19px;font-weight:600;letter-spacing:-.035em;color:var(--cz-money)}
.cz-plate-wrap{position:relative;z-index:2;margin-top:-64px;padding:0 14px 4px}
.cz-plate{display:flex;flex-direction:column;gap:14px;padding:18px;background:var(--cz-bg);border:1px solid var(--cz-hair);border-radius:16px;box-shadow:0 6px 16px rgba(23,24,26,.06)}
.cz-kicker{font-family:var(--cz-mono);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint);margin:0}
.cz-plate-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px}
.cz-plate-title{font-family:var(--cz-display);font-size:36px;font-weight:600;letter-spacing:-.038em;line-height:1;margin:0}
.cz-plate-landed{display:flex;flex-direction:column;align-items:flex-end}
.cz-plate-landed .k{font-family:var(--cz-mono);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint)}
.cz-plate-landed .v{font-family:var(--cz-display);font-size:27px;font-weight:600;letter-spacing:-.038em;line-height:1;color:var(--cz-money)}
.cz-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:14px;border-top:1px solid var(--cz-hair)}
.cz-stat{display:flex;flex-direction:column;gap:3px}
.cz-stat .k{font-family:var(--cz-mono);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint)}
.cz-stat .v{font-family:var(--cz-display);font-size:16px;font-weight:600;letter-spacing:-.03em}
.cz-timeline{font-family:var(--cz-mono);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint)}
.cz-timeline .agent-only{display:none}
.cz-body{padding:16px 16px 0}
.cz-intro{font-size:12px;line-height:1.5;color:var(--cz-faint);margin:0 0 4px}
.cz-item{padding:18px 16px;display:flex;flex-direction:column;gap:13px}
.cz-item-grid{display:contents}
.cz-item-copy{display:flex;flex-direction:column;gap:13px;min-width:0}
.cz-show{position:relative;aspect-ratio:4/5;border-radius:14px;overflow:hidden;background:var(--cz-inset-bg)}
.cz-show-track{display:flex;height:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none}
.cz-show-track::-webkit-scrollbar{display:none}
.cz-frame{flex:none;width:100%;height:100%;scroll-snap-align:center;background-size:cover;background-position:center;background-color:var(--cz-inset-bg)}
.cz-no-photo{flex:none;width:100%;height:100%;scroll-snap-align:center;background:var(--cz-inset-bg);border:1px solid var(--cz-hair);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.cz-no-photo .plat{font-family:var(--cz-display);font-size:20px;font-weight:600;letter-spacing:-.03em;color:var(--cz-faint)}
.cz-no-photo .lbl{font-family:var(--cz-mono);font-size:10px;letter-spacing:.1em;color:var(--cz-faint)}
.cz-counter{position:absolute;top:10px;left:10px;padding:6px 10px;border-radius:999px;background:rgba(23,24,26,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;font-family:var(--cz-mono);font-size:10px;font-weight:700;letter-spacing:.08em}
.cz-nav{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border:0;border-radius:999px;background:rgba(23,24,26,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;font-size:16px;line-height:1;cursor:pointer}
.cz-nav.prev{left:8px}
.cz-nav.next{right:8px}
@media (hover:none){.cz-nav{display:none}}
.cz-title-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.cz-title-left{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0}
.cz-item-title{font-family:var(--cz-display);font-size:20px;font-weight:600;letter-spacing:-.03em;margin:0}
.cz-price{font-family:var(--cz-display);font-size:17px;font-weight:600;letter-spacing:-.03em;color:var(--cz-money);white-space:nowrap}
.cz-rating{display:inline-flex;align-items:baseline;gap:2px;padding:3px 8px;border-radius:999px;white-space:nowrap}
.cz-rating .n{font-family:var(--cz-display);font-size:14px;font-weight:700;letter-spacing:-.03em}
.cz-rating .d{font-family:var(--cz-mono);font-size:9px;letter-spacing:.08em}
.cz-rating.good{background:var(--cz-money-bg);color:var(--cz-money)}
.cz-rating.mid{background:var(--cz-accent-bg);color:var(--cz-sub)}
.cz-rating.bad{background:var(--cz-error-bg);color:var(--cz-error-text)}
.cz-meta{font-family:var(--cz-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cz-faint)}
.cz-fit{display:flex;flex-direction:column;gap:7px;padding:14px;background:var(--cz-inset-bg);border-radius:12px}
.cz-fit-t{font-family:var(--cz-display);font-size:19px;font-weight:600;letter-spacing:-.035em;line-height:1.15}
.cz-fit-run{font-size:13px;line-height:1.5;color:var(--cz-sub)}
.cz-fit-r{font-size:13px;line-height:1.5;color:var(--cz-sub)}
.cz-fit-a{font-size:13px;line-height:1.5;font-weight:650;color:var(--cz-money)}
.cz-fit-s{font-family:var(--cz-mono);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint)}
.cz-note{font-size:14px;line-height:1.55;margin:0;text-wrap:pretty}
.cz-qc .k{font-family:var(--cz-mono);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint);margin:0 0 6px}
.cz-qc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cz-qc-grid .t{aspect-ratio:1;border-radius:8px;background-size:cover;background-position:center;background-color:var(--cz-inset-bg)}
.cz-actions{display:flex;flex-direction:column;gap:8px}
.cz-btns{display:flex;align-items:center;gap:8px}
.cz-btn{display:inline-flex;align-items:center;justify-content:center;height:42px;padding:0 16px;border-radius:999px;border:1px solid var(--cz-hair);background:var(--cz-card-solid);text-decoration:none;font-size:13px;font-weight:650;letter-spacing:-.01em;flex:1;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
.cz-buy{background:var(--cz-action-fill);color:var(--cz-action-text);border-color:transparent}
.cz-rebuy{font-family:var(--cz-mono);font-size:10px;font-weight:700;letter-spacing:.08em}
.cz-rebuy.yes{color:var(--cz-money)}
.cz-rebuy.no{color:var(--cz-error-text)}
.cz-receipt-m{display:block}
.cz-receipt-d{display:none}
.cz-rrow{border-bottom:1px solid var(--cz-hair)}
.cz-rbtn{width:100%;display:flex;align-items:center;gap:12px;padding:12px 16px;background:none;border:0;text-align:left;cursor:pointer}
.cz-rbtn:hover{background:var(--cz-accent-bg)}
.cz-rbtn:active{transform:scale(.98)}
.cz-rthumb{width:44px;height:55px;border-radius:8px;flex:none;background-size:cover;background-position:center;background-color:var(--cz-inset-bg)}
.cz-rthumb.empty{border:1px solid var(--cz-hair);display:flex;align-items:center;justify-content:center;font-family:var(--cz-mono);font-size:8px;letter-spacing:.08em;color:var(--cz-faint);text-align:center;line-height:1.2}
.cz-rname{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.cz-rname .n{font-family:var(--cz-display);font-size:15px;font-weight:600;letter-spacing:-.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cz-rname .m{font-family:var(--cz-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cz-faint)}
.cz-rside{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:none}
.cz-rside .p{font-family:var(--cz-mono);font-size:13px;font-weight:600;color:var(--cz-money)}
.cz-rside .a{font-family:var(--cz-mono);font-size:9px;letter-spacing:.08em;color:var(--cz-faint)}
.cz-rexp{display:none;padding:0 16px 16px;flex-direction:column;gap:12px}
.cz-rrow.is-open .cz-rexp{display:flex}
.cz-rrow.is-open .cz-rside .a{/* toggled by script */}
.cz-totals{padding:16px;display:flex;flex-direction:column;gap:10px}
.cz-trow{display:flex;justify-content:space-between;font-size:13px}
.cz-trow .l{color:var(--cz-sub)}
.cz-trow .r{font-family:var(--cz-mono)}
.cz-tline{height:1px;background:var(--cz-hair)}
.cz-tlanded{display:flex;justify-content:space-between;align-items:baseline}
.cz-tlanded .l{font-family:var(--cz-display);font-size:16px;font-weight:600;letter-spacing:-.03em}
.cz-tlanded .r{font-family:var(--cz-display);font-size:22px;font-weight:600;letter-spacing:-.03em;color:var(--cz-money)}
.cz-rail{display:none}
.cz-foot{border-top:1px solid var(--cz-hair);padding:18px 16px 22px;display:flex;flex-direction:column;gap:12px;background:var(--cz-footer-bg)}
.cz-foot-ref{font-size:12px;line-height:1.5;color:var(--cz-faint);margin:0}
.cz-foot-made{font-size:13px;line-height:1.5;color:var(--cz-sub);margin:0}
.cz-foot-made a{text-decoration:underline}
.cz-cta{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 18px;border-radius:16px;background:var(--cz-action-fill);color:var(--cz-action-text);text-decoration:none;font-size:14px;font-weight:650;letter-spacing:-.01em;width:100%}
.cz-view-receipt .cz-view-review{display:none!important}
.cz-view-review .cz-view-receipt{display:none!important}
@media (min-width:1080px){
.cz-cover{height:480px}
.cz-cover-bar{display:none}
.cz-sticky{display:flex}
.cz-plate-wrap{margin-top:-96px;padding:0 28px}
.cz-plate{flex-direction:row;align-items:flex-end;justify-content:space-between;gap:40px;padding:26px 28px;border-radius:18px}
.cz-plate-left{display:flex;flex-direction:column;gap:10px;min-width:0}
.cz-plate-title{font-size:56px;line-height:.96}
.cz-plate-head{display:block}
.cz-plate-landed{display:none}
.cz-stats{display:flex;align-items:flex-end;gap:28px;padding:0 0 0 28px;border-top:0;border-left:1px solid var(--cz-hair);grid-template-columns:none}
.cz-stat .v{font-size:20px;letter-spacing:-.035em}
.cz-stat.landed .v{font-size:34px;letter-spacing:-.038em;color:var(--cz-money);line-height:1}
.cz-timeline .agent-only{display:inline}
.cz-body{padding:28px}
.cz-intro{font-size:15px;line-height:1.6;color:var(--cz-sub);max-width:640px}
.cz-item{padding:28px 0 0;border-top:1px solid var(--cz-hair)}
.cz-item-grid{display:grid;grid-template-columns:520px 1fr;gap:32px}
.cz-item-copy{gap:16px;max-width:480px}
.cz-show{width:520px;border-radius:16px}
.cz-no-photo .plat{font-size:28px}
.cz-counter{top:14px;left:14px}
.cz-nav{width:40px;height:40px;font-size:18px}
.cz-nav.prev{left:12px}
.cz-nav.next{right:12px}
.cz-item-title{font-size:30px;letter-spacing:-.035em}
.cz-price{font-size:22px}
.cz-rating{padding:4px 10px}
.cz-rating .n{font-size:16px}
.cz-rating .d{font-size:10px}
.cz-fit{gap:8px;padding:18px;border-radius:14px}
.cz-fit-t{font-size:24px}
.cz-fit-r,.cz-fit-a{font-size:14px}
.cz-note{font-size:15px;line-height:1.6}
.cz-btns{flex-wrap:wrap}
.cz-btn{flex:none}
.cz-receipt-m{display:none}
.cz-receipt-d{display:grid;grid-template-columns:1fr 320px;gap:28px;align-items:start;padding:28px}
.cz-table{border:1px solid var(--cz-hair);border-radius:16px;overflow:hidden}
.cz-thead{display:grid;grid-template-columns:minmax(240px,1fr) 200px 100px;gap:14px;padding:12px 18px;background:var(--cz-strip-bg);border-bottom:1px solid var(--cz-hair)}
.cz-thead span{font-family:var(--cz-mono);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint);min-width:0;overflow:hidden}
.cz-drow{border-bottom:1px solid var(--cz-hair)}
.cz-dbtn{width:100%;display:grid;grid-template-columns:minmax(240px,1fr) 200px 100px;gap:14px;align-items:center;padding:12px 18px;background:none;border:0;text-align:left;cursor:pointer}
.cz-dbtn:hover{background:var(--cz-accent-bg)}
.cz-ditem{display:flex;align-items:center;gap:12px;min-width:0;overflow:hidden}
.cz-dthumb{width:40px;height:50px;border-radius:8px;flex:none;background-size:cover;background-position:center;background-color:var(--cz-inset-bg)}
.cz-dthumb.empty{border:1px solid var(--cz-hair)}
.cz-dcopy{display:flex;flex-direction:column;gap:3px;min-width:0;overflow:hidden}
.cz-dcopy .n{font-family:var(--cz-display);font-size:16px;font-weight:600;letter-spacing:-.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cz-dcopy .m{font-family:var(--cz-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cz-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cz-dfit{display:flex;flex-direction:column;gap:3px;min-width:0;overflow:hidden}
.cz-dfit .t{font-size:13.5px;line-height:1.35;color:var(--cz-sub)}
.cz-dfit .a{font-family:var(--cz-mono);font-size:9.5px;letter-spacing:.08em;color:var(--cz-faint);white-space:nowrap}
.cz-dprice{font-family:var(--cz-mono);font-size:14px;font-weight:600;color:var(--cz-money);text-align:right;min-width:0}
.cz-dexp{display:none;grid-template-columns:minmax(0,1fr) 240px;gap:24px;padding:0 18px 18px 70px;align-items:start}
.cz-drow.is-open .cz-dexp{display:grid}
.cz-dexp-l{display:flex;flex-direction:column;gap:8px;min-width:0;max-width:520px}
.cz-dexp-r{display:flex;flex-direction:column;gap:8px;width:240px}
.cz-dexp-r .cz-btn{width:100%;flex:none}
.cz-rail{display:flex;position:sticky;top:96px;flex-direction:column;gap:14px;padding:20px;border:1px solid var(--cz-hair);border-radius:16px;background:var(--cz-card-solid)}
.cz-rail .rk{font-family:var(--cz-mono);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cz-faint);margin:0}
.cz-rail .cz-trow{font-size:13.5px}
.cz-rail .cz-tlanded .l{font-size:17px}
.cz-rail .cz-tlanded .r{font-size:26px}
.cz-foot{padding:24px 28px 28px;flex-direction:row;align-items:center;justify-content:space-between;gap:24px}
.cz-foot-copy{display:flex;flex-direction:column;gap:8px;max-width:620px}
.cz-cta{width:auto;flex:none}
}
`.trim();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso) {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
}

function daySpan(orderedAt, receivedAt) {
  if (!orderedAt || !receivedAt) return null;
  const a = new Date(orderedAt);
  const b = new Date(receivedAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  return Number.isFinite(days) ? days : null;
}

function moneyOrEmpty(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return "$" + n.toFixed(2);
}

function bgUrl(src) {
  // CSS url() needs quotes and escape of special characters inside the value.
  return "url(&quot;" + escapeHtml(src).replace(/\(/g, "%28").replace(/\)/g, "%29") + "&quot;)";
}

function collectCoverPhotos(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const candidates = [];
    if (item.image) candidates.push(item.image);
    if (Array.isArray(item.photos)) candidates.push(...item.photos);
    if (Array.isArray(item.ownPhotos)) candidates.push(...item.ownPhotos);
    for (const raw of candidates) {
      const src = safeSrc(raw);
      if (!src || seen.has(src) || isChartPhoto(item, src)) continue;
      seen.add(src);
      out.push(src);
      if (out.length >= 12) return out;
    }
    // Never blank the cover because the vetting was too strict: if every
    // candidate read as a chart, keep the item's own image (the yupoo.js
    // guard does the same for the shelf gallery).
    if (item.image && !candidates.some((raw) => {
      const src = safeSrc(raw);
      return src && seen.has(src);
    })) {
      const cover = safeSrc(item.image);
      if (cover && !seen.has(cover)) {
        seen.add(cover);
        out.push(cover);
      }
    }
  }
  return out;
}

// A size chart is not a cover photo (Kyle 2026-08-04: "no images of sizing
// charts in the slideshow"). Two tells, no AI: the doc marked it as a chart,
// or the CDN URL carries table-shaped dims (…_W_H, wider than tall — the same
// 1.25 rule resolve.js uses to hold tables out of the shelf gallery). The
// shape tell catches docs frozen before the doc builder marked charts.
function isChartPhoto(item, src) {
  if (Array.isArray(item.chartImages) && item.chartImages.includes(src)) return true;
  const m = /_(\d{2,5})_(\d{2,5})(?:\.[a-z0-9]+)?$/i.exec(String(src || "").split("?")[0]);
  if (!m) return false;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return !!w && !!h && w / h > 1.25;
}

function itemFrames(item) {
  const frames = [];
  const seen = new Set();
  const push = (raw) => {
    const src = safeSrc(raw);
    if (!src || seen.has(src) || isChartPhoto(item, src)) return;
    seen.add(src);
    frames.push(src);
  };
  if (item && item.image) push(item.image);
  if (item && Array.isArray(item.photos)) item.photos.forEach(push);
  if (item && Array.isArray(item.ownPhotos)) item.ownPhotos.forEach(push);
  // Never blank the show because the vetting was too strict: if every frame
  // read as a chart, keep the first candidate so the item still has a face.
  if (!frames.length && item && item.image) {
    const cover = safeSrc(item.image);
    if (cover) frames.push(cover);
  }
  return frames;
}

function ratingClass(rating) {
  const n = Number(rating);
  if (!Number.isFinite(n)) return "";
  if (n >= 8) return "good";
  if (n === 7) return "mid";
  return "bad";
}

function platformLabel(platform) {
  if (!platform) return "Store";
  const p = String(platform).toLowerCase();
  if (p === "weidian") return "Weidian";
  if (p === "taobao") return "Taobao";
  if (p === "yupoo") return "Yupoo";
  if (p === "1688") return "1688";
  return String(platform);
}

function metaLine(item) {
  const bits = [];
  if (item.size) bits.push("SIZE " + escapeHtml(item.size));
  if (item.weightGrams) bits.push(escapeHtml(String(item.weightGrams)) + " G");
  if (item.fabric) bits.push(escapeHtml(String(item.fabric).toUpperCase()));
  if (item.seller) bits.push(escapeHtml(item.seller));
  return bits.join(" · ");
}

function runLine(run) {
  if (run === "small") return "It ran small on me.";
  if (run === "true") return "It ran true to size on me.";
  if (run === "large") return "It ran large on me.";
  return "";
}

// Fit block: translation, optional run line, room, advice, source.
// The run line is on the item (item.run), not inside fit.
function fitBlock(fit, noteClass, run) {
  const parts = [];
  if (fit && typeof fit === "object") {
    if (fit.translation) parts.push(`<span class="cz-fit-t">${escapeHtml(fit.translation)}</span>`);
  }
  const runText = runLine(run);
  if (runText) parts.push(`<span class="cz-fit-run">${escapeHtml(runText)}</span>`);
  if (fit && typeof fit === "object") {
    if (fit.roomLine) parts.push(`<span class="cz-fit-r">${escapeHtml(fit.roomLine)}</span>`);
    if (fit.advice) parts.push(`<span class="cz-fit-a">${escapeHtml(fit.advice)}</span>`);
    if (fit.source) parts.push(`<span class="cz-fit-s">${escapeHtml(fit.source)}</span>`);
  }
  if (!parts.length) return "";
  return `<div class="cz-fit${noteClass ? " " + noteClass : ""}">${parts.join("")}</div>`;
}

// A yupoo album page 404s without a uid query (see ensureYupooAlbumUid in the
// app). Shared docs are frozen, so fix the link here at render time: any doc,
// old or new, gets a working album link (Kyle 2026-08-04: "store store takes
// you to bad link").
function ensureYupooUid(href) {
  try {
    const u = new URL(href);
    if (!/(^|\.)yupoo\.com$/i.test(u.hostname)) return href;
    if (!/\/albums\/\d+/i.test(u.pathname)) return href;
    if (!u.searchParams.get("uid")) u.searchParams.set("uid", "1");
    return u.toString();
  } catch {
    return href;
  }
}

// Old docs often lack item.platform. Read the market from the store URL so
// the button says "Store · Yupoo" instead of the broken "Store · Store"
// (Kyle 2026-08-04). Returns "" when the market is unknown.
function platformFromUrl(href) {
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (/(^|\.)yupoo\.com$/.test(host)) return "yupoo";
    if (/(^|\.)weidian\.com$/.test(host)) return "weidian";
    if (/(^|\.)taobao\.com$/.test(host)) return "taobao";
    if (/(^|\.)tmall\.com$/.test(host)) return "taobao";
    if (/(^|\.)1688\.com$/.test(host)) return "1688";
    return "";
  } catch {
    return "";
  }
}

function actionButtons(item, agentName) {
  const store = safeHref(item.storeUrl);
  const buy = safeHref(item.buyUrl);
  if (!store && !buy) return "";
  const platform = item.platform || (store ? platformFromUrl(store) : "");
  const storeBtn = store
    ? `<a class="cz-btn" href="${escapeHtml(ensureYupooUid(store))}" rel="nofollow noopener" target="_blank">${platform ? `Store · ${escapeHtml(platformLabel(platform))}` : "Store"}</a>`
    : "";
  // The "No agent" choice must not read "Buy via No agent — open marketplace
  // directly" (Kyle 2026-08-04: the text overflowed the pill). Keep it short.
  let buyLabel = "Buy";
  if (agentName) {
    buyLabel = /^no agent/i.test(agentName) ? "Buy direct" : `Buy via ${escapeHtml(agentName)}`;
  }
  const buyBtn = buy
    ? `<a class="cz-btn cz-buy" href="${escapeHtml(buy)}" rel="nofollow noopener" target="_blank">${buyLabel}</a>`
    : "";
  return `<div class="cz-btns">${storeBtn}${buyBtn}</div>`;
}

function rebuyLine(item) {
  if (item.rebuy === true) return `<span class="cz-rebuy yes">I would buy it again.</span>`;
  if (item.rebuy === false) return `<span class="cz-rebuy no">I would not buy it again.</span>`;
  return "";
}

function slideshowHtml(item, idx) {
  const title = escapeHtml(item.title || "Untitled");
  const frames = itemFrames(item);
  const platform = escapeHtml(platformLabel(item.platform));
  if (!frames.length) {
    return `<div class="cz-show" data-show="${idx}">
<div class="cz-show-track">
<div class="cz-no-photo"><span class="plat">${platform}</span><span class="lbl">NO LISTING PHOTO</span></div>
</div>
<span class="cz-counter">NO PHOTO</span>
</div>`;
  }
  const framesHtml = frames
    .map((src) => `<div class="cz-frame" role="img" aria-label="${title}" style="background-image:${bgUrl(src)}"></div>`)
    .join("");
  const arrows =
    frames.length > 1
      ? `<button type="button" class="cz-nav prev" aria-label="Previous photo" data-dir="-1">‹</button>
<button type="button" class="cz-nav next" aria-label="Next photo" data-dir="1">›</button>`
      : "";
  return `<div class="cz-show" data-show="${idx}">
<div class="cz-show-track">${framesHtml}</div>
<span class="cz-counter">1 / ${frames.length}</span>
${arrows}
</div>`;
}

function reviewItemHtml(item, idx, agentName) {
  const title = escapeHtml(item.title || "Untitled");
  const price = moneyOrEmpty(item.priceUsd);
  const rating = Number(item.rating);
  const hasRating = Number.isFinite(rating) && rating >= 1 && rating <= 10;
  const rClass = hasRating ? ratingClass(rating) : "";
  const ratingHtml = hasRating
    ? `<span class="cz-rating ${rClass}"><span class="n">${escapeHtml(String(Math.round(rating)))}</span><span class="d">/10</span></span>`
    : "";
  const meta = metaLine(item);
  const fit = fitBlock(item.fit, "", item.run);
  const note = item.note ? `<p class="cz-note">${escapeHtml(item.note)}</p>` : "";
  let qc = "";
  if (Array.isArray(item.qcPhotos) && item.qcPhotos.length) {
    const thumbs = item.qcPhotos
      .map(safeSrc)
      .filter(Boolean)
      .map((src) => `<div class="t" role="img" aria-label="QC photo" style="background-image:${bgUrl(src)}"></div>`)
      .join("");
    if (thumbs) {
      qc = `<div class="cz-qc"><p class="k">QC PHOTOS · ${item.qcPhotos.length}</p><div class="cz-qc-grid">${thumbs}</div></div>`;
    }
  }
  const actions = actionButtons(item, agentName);
  const rebuy = rebuyLine(item);
  const actionsBlock = actions || rebuy ? `<div class="cz-actions">${actions}${rebuy}</div>` : "";
  return `<article class="cz-item">
<div class="cz-item-grid">
${slideshowHtml(item, idx)}
<div class="cz-item-copy">
<div class="cz-title-row">
<div class="cz-title-left"><h2 class="cz-item-title">${title}</h2>${ratingHtml}</div>
${price ? `<span class="cz-price">${escapeHtml(price)}</span>` : ""}
</div>
${meta ? `<div class="cz-meta">${meta}</div>` : ""}
${fit}
${note}
${qc}
${actionsBlock}
</div>
</div>
</article>`;
}

function receiptMobileRow(item, idx, agentName) {
  const title = escapeHtml(item.title || "Untitled");
  const price = moneyOrEmpty(item.priceUsd);
  const frames = itemFrames(item);
  const thumb = frames.length
    ? `<span class="cz-rthumb" role="img" aria-label="${title}" style="background-image:${bgUrl(frames[0])}"></span>`
    : `<span class="cz-rthumb empty">NO<br>PHOTO</span>`;
  const shortFit = item.fit && item.fit.short ? escapeHtml(item.fit.short) : "";
  const fit = fitBlock(item.fit, "", item.run);
  const note = item.note ? `<p class="cz-note" style="font-size:13.5px">${escapeHtml(item.note)}</p>` : "";
  const actions = actionButtons(item, agentName);
  return `<div class="cz-rrow" data-row="${idx}">
<button type="button" class="cz-rbtn" data-toggle-row="${idx}">
${thumb}
<span class="cz-rname"><span class="n">${title}</span>${shortFit ? `<span class="m">${shortFit}</span>` : ""}</span>
<span class="cz-rside">${price ? `<span class="p">${escapeHtml(price)}</span>` : ""}<span class="a" data-row-label>FIT + LINKS</span></span>
</button>
<div class="cz-rexp">${fit}${note}${actions}</div>
</div>`;
}

function receiptDesktopRow(item, idx, agentName) {
  const title = escapeHtml(item.title || "Untitled");
  const price = moneyOrEmpty(item.priceUsd);
  const frames = itemFrames(item);
  const thumb = frames.length
    ? `<span class="cz-dthumb" role="img" aria-label="${title}" style="background-image:${bgUrl(frames[0])}"></span>`
    : `<span class="cz-dthumb empty"></span>`;
  const bits = [];
  if (item.size) bits.push("SIZE " + escapeHtml(item.size));
  if (item.weightGrams) bits.push(escapeHtml(String(item.weightGrams)) + " G");
  if (item.seller) bits.push(escapeHtml(item.seller));
  const meta = bits.join(" · ");
  const shortFit = item.fit && item.fit.short ? escapeHtml(item.fit.short) : item.fit && item.fit.translation ? escapeHtml(item.fit.translation) : "";
  const runText = runLine(item.run);
  const run = runText ? `<span class="cz-fit-run">${escapeHtml(runText)}</span>` : "";
  const room = item.fit && item.fit.roomLine ? `<span class="cz-fit-r">${escapeHtml(item.fit.roomLine)}</span>` : "";
  const advice = item.fit && item.fit.advice ? `<span class="cz-fit-a">${escapeHtml(item.fit.advice)}</span>` : "";
  const note = item.note ? `<p class="cz-note">${escapeHtml(item.note)}</p>` : "";
  const actions = actionButtons(item, agentName);
  return `<div class="cz-drow" data-row="${idx}">
<button type="button" class="cz-dbtn" data-toggle-row="${idx}">
<span class="cz-ditem">${thumb}<span class="cz-dcopy"><span class="n">${title}</span>${meta ? `<span class="m">${meta}</span>` : ""}</span></span>
<span class="cz-dfit">${shortFit ? `<span class="t">${shortFit}</span>` : ""}<span class="a" data-row-label>FIT + LINKS</span></span>
<span class="cz-dprice">${price ? escapeHtml(price) : ""}</span>
</button>
<div class="cz-dexp"><div class="cz-dexp-l">${run}${room}${advice}${note}</div><div class="cz-dexp-r">${actions}</div></div>
</div>`;
}

function costRows(doc, count) {
  const rows = [];
  const goods = moneyOrEmpty(doc.goodsUsd);
  if (goods) {
    rows.push({ label: "Goods · " + count + (count === 1 ? " item" : " items"), value: goods });
  }
  const ship = moneyOrEmpty(doc.shipUsd);
  if (ship) {
    const line = doc.shipLine ? String(doc.shipLine) : "Shipping";
    const weightBit = doc.chargeableG ? " · " + doc.chargeableG + " g chargeable" : "";
    rows.push({ label: line + weightBit, value: ship });
  } else if (doc.chargeableG) {
    rows.push({ label: "Chargeable", value: doc.chargeableG + " g" });
  }
  const landed = moneyOrEmpty(doc.landedUsd);
  if (landed && count > 0) {
    const per = Number(doc.landedUsd) / count;
    if (Number.isFinite(per) && per > 0) {
      rows.push({ label: "Landed per piece", value: "$" + per.toFixed(2) });
    }
  }
  const ordered = shortDate(doc.orderedAt);
  const received = shortDate(doc.receivedAt);
  const days = daySpan(doc.orderedAt, doc.receivedAt);
  if (ordered && received) {
    rows.push({
      label: "Ordered " + ordered + " → received " + received,
      value: days != null ? days + " d" : "",
    });
  }
  return { rows, landed };
}

function totalsHtml(doc, count) {
  const { rows, landed } = costRows(doc, count);
  if (!rows.length && !landed) return "";
  const body = rows
    .map((r) => `<div class="cz-trow"><span class="l">${escapeHtml(r.label)}</span><span class="r">${escapeHtml(r.value)}</span></div>`)
    .join("");
  const land = landed
    ? `<div class="cz-tline"></div><div class="cz-tlanded"><span class="l">Landed total</span><span class="r">${escapeHtml(landed)}</span></div>`
    : "";
  return `<div class="cz-totals">${body}${land}</div>`;
}

function railHtml(doc, count) {
  const { rows, landed } = costRows(doc, count);
  // Rail omits the timeline row; keep cost lines only.
  const costOnly = rows.filter((r) => !String(r.label).startsWith("Ordered "));
  if (!costOnly.length && !landed) return "";
  const body = costOnly
    .map((r) => `<div class="cz-trow"><span class="l">${escapeHtml(r.label)}</span><span class="r">${escapeHtml(r.value)}</span></div>`)
    .join("");
  const land = landed
    ? `<div class="cz-tline"></div><div class="cz-tlanded"><span class="l">Landed</span><span class="r">${escapeHtml(landed)}</span></div>`
    : "";
  return `<aside class="cz-rail"><p class="rk">WHAT IT COST</p>${body}${land}
<p class="cz-foot-ref">Buy links on this page carry the author's referral codes. They cost the reader nothing.</p>
</aside>`;
}

function marqueeHtml(photos) {
  if (!photos.length) return `<div class="cz-cover"></div>`;
  const tile = (src, decorative) => {
    const label = decorative ? "" : ' role="img" aria-label="Haul photo"';
    const hidden = decorative ? ' aria-hidden="true"' : "";
    return `<div class="cz-tile"${label}${hidden} style="background-image:${bgUrl(src)}"></div>`;
  };
  const first = photos.map((src) => tile(src, false)).join("");
  const second = photos.map((src) => tile(src, true)).join("");
  // ~4.5s per tile so any haul drifts at the same speed.
  const duration = Math.max(photos.length * 4.5, 9);
  return `<div class="cz-cover"><div class="cz-cover-clip">
<div class="cz-marquee" style="animation-duration:${duration}s">${first}${second}</div>
</div></div>`;
}

function pageHtmlV2(doc, opts) {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const count = Number(doc.count) || items.length;
  const titleRaw = doc.title || "A Credenza haul";
  const title = escapeHtml(titleRaw);
  const layout = doc.layout === "review" || doc.layout === "receipt" || doc.layout === "both" ? doc.layout : "both";
  const showReview = layout === "review" || layout === "both";
  const showReceipt = layout === "receipt" || layout === "both";
  const agent = doc.agent ? String(doc.agent) : "";
  const unlisted = !!(opts && opts.unlisted);
  const covers = collectCoverPhotos(items);

  const summary = [count + (count === 1 ? " item" : " items")];
  const landedMoney = moneyOrEmpty(doc.landedUsd);
  if (landedMoney) summary.push(landedMoney + " landed");
  const ogTitle = unlisted ? "A Credenza haul" : title;
  const description = unlisted
    ? "A private haul list shared with Credenza Fashion. Open the link to see it."
    : title + ". " + summary.join(" · ") + ". Shared with Credenza Fashion.";
  const hasPhoto =
    !unlisted &&
    (covers.some((src) => safeSrc(src)) || items.some((card) => card && (safeSrc(card.image) || (Array.isArray(card.photos) && card.photos.some(safeSrc)))));
  const ogImage = hasPhoto && opts && opts.code ? SITE + "/s/" + encodeURIComponent(opts.code) + "/img" : SITE + "/og.png";

  const ordered = shortDate(doc.orderedAt);
  const received = shortDate(doc.receivedAt);
  const days = daySpan(doc.orderedAt, doc.receivedAt);
  let timeline = "";
  if (ordered && received) {
    timeline = "Ordered " + ordered + " → received " + received + (days != null ? " · " + days + " days" : "");
  }

  const kicker = "SHARED HAUL · " + count + (count === 1 ? " ITEM" : " ITEMS");

  // Masthead stats: hide any absent value.
  const stats = [];
  const goods = moneyOrEmpty(doc.goodsUsd);
  if (goods) stats.push({ k: "Goods", v: goods, landed: false });
  const ship = moneyOrEmpty(doc.shipUsd);
  if (ship) stats.push({ k: doc.shipLine ? String(doc.shipLine) : "Shipping", v: ship, landed: false });
  if (doc.chargeableG) stats.push({ k: "Chargeable", v: doc.chargeableG + " g", landed: false });
  if (landedMoney) stats.push({ k: "Landed", v: landedMoney, landed: true, deskOnly: true });

  const statsHtml = stats.length
    ? `<div class="cz-stats">${stats
        .map((s) => {
          const cls = s.landed ? "cz-stat landed" : "cz-stat";
          return `<div class="${cls}"${s.deskOnly ? ' data-desk-stat="landed"' : ""}><span class="k">${escapeHtml(s.k)}</span><span class="v">${escapeHtml(s.v)}</span></div>`;
        })
        .join("")}</div>`
    : "";

  const mobileLanded = landedMoney
    ? `<div class="cz-plate-landed"><span class="k">LANDED</span><span class="v">${escapeHtml(landedMoney)}</span></div>`
    : "";

  const timelineHtml = timeline
    ? `<div class="cz-timeline">${escapeHtml(timeline)}${
        agent ? `<span class="agent-only"> · ${escapeHtml(agent)}</span>` : ""
      }</div>`
    : "";

  const plate = `<div class="cz-plate-wrap"><div class="cz-plate">
<div class="cz-plate-left">
<p class="cz-kicker">${escapeHtml(kicker)}</p>
<div class="cz-plate-head">
<h1 class="cz-plate-title">${title}</h1>
${mobileLanded}
</div>
${timelineHtml}
</div>
${statsHtml}
</div></div>`;

  // Tabs: only the views the layout allows.
  const bothTabs = showReview && showReceipt;
  const tabButtons = bothTabs
    ? `<button type="button" data-view="review" class="is-on">Review</button><button type="button" data-view="receipt">Receipt</button>`
    : showReview
      ? `<button type="button" data-view="review" class="is-on">Review</button>`
      : `<button type="button" data-view="receipt" class="is-on">Receipt</button>`;

  // One-view layouts still show a label chip so the reader knows which body is open.
  const singleViewChip = !bothTabs
    ? `<span class="cz-blur-chip"><span class="wm">${showReceipt && !showReview ? "RECEIPT" : "REVIEW"}</span></span>`
    : "";
  const coverBar = `<div class="cz-cover-bar">
<a class="cz-blur-chip" href="${SITE}/">${MARK.replace('width="30" height="30"', 'width="18" height="18" class="mark"')}<span class="wm">CREDENZA</span></a>
${bothTabs ? `<span class="cz-tab-chip">${tabButtons}</span>` : singleViewChip}
</div>`;

  const stickySummaryBits = [count + (count === 1 ? " item" : " items")];
  if (agent) stickySummaryBits.push(agent.toLowerCase());
  if (doc.shipLine) stickySummaryBits.push(String(doc.shipLine).toLowerCase());
  if (days != null) stickySummaryBits.push(days + " d");
  const stickyLanded = landedMoney
    ? `<span class="cz-desk-landed"><span class="k">Landed</span><span class="v">${escapeHtml(landedMoney)}</span></span>`
    : "";
  // Sticky masthead uses its own tab buttons so mobile chips stay independent.
  const stickyTabs = bothTabs
    ? `<span class="cz-seg"><button type="button" data-view="review" class="is-on">Review</button><button type="button" data-view="receipt">Receipt</button></span>`
    : "";
  const stickyFixed = `<div class="cz-sticky">
<div class="cz-sticky-left">
<a class="brand" href="${SITE}/" style="margin:0">${MARK.replace('width="30" height="30"', 'width="26" height="26"')}<span class="brand-name"><span class="wordmark">CREDENZA</span><span class="kicker">Fashion</span></span></a>
<span style="width:1px;height:22px;background:var(--cz-hair)"></span>
<span class="cz-sticky-title">${title}</span>
<span class="cz-sticky-sum">${escapeHtml(stickySummaryBits.join(" · "))}</span>
</div>
<div class="cz-sticky-right">
${stickyTabs}
${stickyLanded}
<a class="cz-cta" style="width:auto;height:40px;border-radius:999px;padding:0 16px;font-size:13px" href="${SITE}/">Plan your own haul</a>
</div>
</div>`;

  const intro = doc.intro ? `<p class="cz-intro">${escapeHtml(doc.intro)}</p>` : "";
  const receiptMobile = items.map((item, i) => receiptMobileRow(item || {}, i, agent)).join("");
  const receiptDesk = items.map((item, i) => receiptDesktopRow(item || {}, i, agent)).join("");
  const totals = totalsHtml(doc, count);
  const rail = railHtml(doc, count);

  // Initial view: receipt-only layout, or both starting on review.
  const initialView = layout === "receipt" ? "receipt" : "review";
  const bodyClass = initialView === "receipt" ? "cz-view-receipt" : "cz-view-review";

  const footer =
    opts && opts.hideFooter
      ? ""
      : `<footer class="cz-foot">
<div class="cz-foot-copy">
<p class="cz-foot-ref">Buy links on this page carry the author's referral codes. They cost the reader nothing.</p>
<p class="cz-foot-made">Made with <a href="${SITE}/">Credenza Fashion</a>, the agent haul planner for Weidian, Yupoo and Taobao finds.</p>
</div>
<a class="cz-cta" href="${SITE}/">Plan your own haul</a>
</footer>`;

  // Desk-only landed stat: hidden on mobile (the plate already shows LANDED
  // top-right there — one place for the numbers), shown in the desktop rail.
  const deskStatCss = `[data-desk-stat="landed"]{display:none}@media (min-width:1080px){[data-desk-stat="landed"]{display:flex}}`;

  const script = bothTabs
    ? `<script>(function(){
var root=document.getElementById("cz-share-root");
if(!root)return;
var tabs=root.querySelectorAll("[data-view]");
function setView(v){
var receipt=v==="receipt";
root.classList.toggle("cz-view-receipt",receipt);
root.classList.toggle("cz-view-review",!receipt);
var rev=document.getElementById("view-review");
var rec=document.getElementById("view-receipt");
if(rev){if(receipt)rev.setAttribute("hidden","");else rev.removeAttribute("hidden");}
if(rec){if(receipt)rec.removeAttribute("hidden");else rec.setAttribute("hidden","");}
tabs.forEach(function(b){b.classList.toggle("is-on",b.getAttribute("data-view")===(receipt?"receipt":"review"));});
try{
var url=new URL(window.location.href);
if(receipt)url.searchParams.set("v","receipt");else url.searchParams.delete("v");
history.replaceState(null,"",url.pathname+url.search+url.hash);
}catch(e){}
}
tabs.forEach(function(b){b.addEventListener("click",function(){setView(b.getAttribute("data-view"));});});
try{
var q=new URL(window.location.href).searchParams.get("v");
if(q==="receipt")setView("receipt");
}catch(e){}
})();</script>`
    : "";

  const slideScript = `<script>(function(){
document.querySelectorAll(".cz-show").forEach(function(show){
var track=show.querySelector(".cz-show-track");
var counter=show.querySelector(".cz-counter");
if(!track)return;
var frames=track.querySelectorAll(".cz-frame");
if(!frames.length)return;
function idx(){return Math.round(track.scrollLeft/Math.max(track.clientWidth,1));}
function paint(){if(counter)counter.textContent=(idx()+1)+" / "+frames.length;}
track.addEventListener("scroll",paint,{passive:true});
show.querySelectorAll(".cz-nav").forEach(function(btn){
btn.addEventListener("click",function(){
var next=Math.max(0,Math.min(frames.length-1,idx()+Number(btn.getAttribute("data-dir")||0)));
track.scrollTo({left:next*track.clientWidth,behavior:"smooth"});
});
});
});
document.querySelectorAll("[data-toggle-row]").forEach(function(btn){
btn.addEventListener("click",function(){
var id=btn.getAttribute("data-toggle-row");
document.querySelectorAll('[data-row="'+id+'"]').forEach(function(row){
var open=row.classList.toggle("is-open");
row.querySelectorAll("[data-row-label]").forEach(function(lab){lab.textContent=open?"CLOSE":"FIT + LINKS";});
});
});
});
})();</script>`;

  // Fix initial hidden state for both-layout review default.
  const reviewHidden = initialView === "receipt" ? "hidden" : "";
  const receiptHidden = initialView === "review" && showReceipt && showReview ? "hidden" : "";
  const reviewBodyFinal = showReview
    ? `<div class="cz-view-review" id="view-review" ${reviewHidden}>
<div class="cz-body">${intro}${items.map((item, i) => reviewItemHtml(item || {}, i, agent)).join("")}</div>
</div>`
    : "";
  const receiptBodyFinal = showReceipt
    ? `<div class="cz-view-receipt" id="view-receipt" ${receiptHidden}>
<div class="cz-receipt-m">${receiptMobile}${totals}</div>
<div class="cz-receipt-d">
<div class="cz-table">
<div class="cz-thead"><span>Item</span><span>Fit</span><span>Price</span></div>
${receiptDesk}
</div>
${rail}
</div>
</div>`
    : "";

  const cover = marqueeHtml(covers).replace('<div class="cz-cover">', `<div class="cz-cover">${coverBar}`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${ogTitle} · Credenza Fashion</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Credenza Fashion" />
<meta property="og:title" content="${ogTitle}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta name="twitter:card" content="${unlisted ? "summary" : "summary_large_image"}" />
<meta name="twitter:title" content="${ogTitle}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />
<style>${STYLE_V2}
${deskStatCss}
.brand{display:inline-flex;align-items:center;gap:9px;text-decoration:none}
.brand-name{display:inline-flex;flex-direction:column;gap:3px;line-height:1}
.wordmark{font-family:var(--cz-sans);font-size:13.5px;font-weight:800;letter-spacing:.16em}
.kicker{font-family:var(--cz-sans);font-size:8.5px;font-weight:700;letter-spacing:.30em;text-transform:uppercase;color:var(--cz-sub)}
</style>
</head>
<body>
<div id="cz-share-root" class="cz-s ${bodyClass}">
${stickyFixed}
${cover}
${plate}
${reviewBodyFinal}
${receiptBodyFinal}
${footer}
</div>
${script}
${slideScript}
</body>
</html>`;
}

// Route v2 haul docs to the redesign; keep every other doc on v1.
function pageHtml(doc, opts) {
  if (doc && doc.v === 2 && Array.isArray(doc.items)) return pageHtmlV2(doc, opts || {});
  return pageHtmlV1(doc, opts);
}

// The same page for a wrong code, a deleted share and an expired one.
function missHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Share not found · Credenza Fashion</title>
<meta name="robots" content="noindex, nofollow" />
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header>
${BRAND}
<h1>This share is not available</h1>
<p class="meta">The link may have expired, or the person who made it removed it.</p>
</header>
<main>
<a class="cta" href="${SITE}/">Open Credenza</a>
</main>
<footer>
<p style="margin:0">Credenza Fashion, the agent haul planner for Weidian, Yupoo, and Taobao finds.</p>
</footer>
</div>
</body>
</html>`;
}

// The cache tag is what makes a delete take effect (LB-62). Without it the
// only way off the edge is waiting out max-age, and PAGE_CACHE is an hour with
// stale-while-revalidate. `Netlify-Cache-Tag` rather than `Cache-Tag`: Netlify
// strips it from the client response, and this tag is an internal handle, not
// something a visitor or a downstream cache has any use for.
function reply(statusCode, body, cache, code) {
  const headers = { ...HTML, "cache-control": cache };
  if (code) headers["netlify-cache-tag"] = purge.tagFor(code);
  return { statusCode, headers, body };
}

async function handle(event) {
  const env = process.env;
  if (!event || (event.httpMethod !== "GET" && event.httpMethod !== "HEAD")) {
    return reply(405, missHtml(), "no-store");
  }
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[name]) return reply(500, missHtml(), "no-store");
  }

  // The code is checked for SHAPE before anything touches the database. A
  // walk through random paths then costs no query at all.
  const id = code(event);
  if (!share.isShareCode(id)) return reply(404, missHtml(), MISS_CACHE);

  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) {
    return { statusCode: blocked.status, headers: { ...HTML, "retry-after": String(blocked.retryAfter) }, body: missHtml() };
  }

  try {
    const row = await storeFromEnv(env).loadShare(id);
    if (!row) return reply(404, missHtml(), MISS_CACHE, id);
    if (share.isExpired(row, Date.now())) return reply(404, missHtml(), MISS_CACHE, id);

    const doc = share.parseShareSnapshot(row.data);
    if (!doc) return reply(404, missHtml(), MISS_CACHE, id);

    return reply(200, pageHtml(doc, { hideFooter: row.hideFooter, unlisted: row.unlisted, code: id }), PAGE_CACHE, id);
  } finally {
    limit.leave(ROUTE);
  }
}

exports.handler = async (event) => {
  const started = Date.now();
  let res;
  try {
    res = await handle(event);
  } catch {
    res = reply(500, missHtml(), "no-store");
  }
  limit.logOutcome(ROUTE, limit.clientKey(event), res.statusCode, { ms: Date.now() - started });
  return res;
};

// Exported for the tests. Nothing else imports these.
exports._internal = { escapeHtml, safeHref, safeSrc, pageHtml, pageHtmlV1, pageHtmlV2, missHtml, itemHtml };

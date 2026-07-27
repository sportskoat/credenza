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
:root{--bg:#f4f4f0;--ink:#17181a;--muted:#5c5f66;--card:#ffffff;--line:#e2e2dc}
@media (prefers-color-scheme:dark){:root{--bg:#000000;--ink:#f4f4f0;--muted:#a1a1aa;--card:#1a1a1d;--line:#2a2a2e}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Georgia,'Times New Roman',serif;
padding:2.5rem 1.25rem 3rem}
.wrap{max-width:1040px;margin:0 auto}
a{color:inherit}
header{border-bottom:1px solid var(--line);padding-bottom:1.25rem;margin-bottom:1.5rem}
.brand{display:inline-flex;align-items:center;gap:9px;text-decoration:none;margin:0 0 1rem}
.brand-name{display:inline-flex;flex-direction:column;gap:3px;line-height:1}
.wordmark{font-size:13.5px;font-weight:800;letter-spacing:.16em}
.kicker{font-size:8.5px;font-weight:700;letter-spacing:.30em;text-transform:uppercase;color:var(--muted)}
h1{font-size:2rem;line-height:1.15;margin:.4rem 0 .5rem;font-weight:500}
.meta{color:var(--muted);margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:.9rem}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));padding:0;margin:0;list-style:none}
.item{background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column}
.shot{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;background:var(--line)}
.shot.empty{display:flex;align-items:center;justify-content:center;color:var(--muted);
font-family:system-ui,-apple-system,sans-serif;font-size:.8rem}
.body{padding:.8rem .85rem 1rem}
.title{margin:0;font-size:1rem;line-height:1.3}
.title a{text-decoration:none}
.title a:hover{text-decoration:underline}
.sub{margin:.35rem 0 0;color:var(--muted);font-family:system-ui,-apple-system,sans-serif;font-size:.85rem}
.price{margin:.45rem 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:.95rem}
.note{margin:.5rem 0 0;font-size:.9rem;color:var(--muted)}
.more{margin:1.5rem 0 0;color:var(--muted);font-family:system-ui,-apple-system,sans-serif;font-size:.9rem}
footer{border-top:1px solid var(--line);margin-top:2.5rem;padding-top:1.25rem;
font-family:system-ui,-apple-system,sans-serif;font-size:.9rem;color:var(--muted)}
.cta{display:inline-block;margin-top:.75rem;padding:.7rem 1.1rem;background:var(--ink);color:var(--bg);
text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-size:.95rem}
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

function pageHtml(doc, opts) {
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
    : title + " — " + summary.join(" · ") + ". Shared with Credenza Fashion.";

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
<p style="margin:0">Made with <a href="${SITE}/">Credenza Fashion</a> — the agent haul planner for Weidian, Yupoo, and Taobao finds.</p>
<a class="cta" href="${SITE}/">Plan your own haul</a>
</footer>`
}
</div>
</body>
</html>`;
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
<p style="margin:0">Credenza Fashion — the agent haul planner for Weidian, Yupoo, and Taobao finds.</p>
</footer>
</div>
</body>
</html>`;
}

function reply(statusCode, body, cache) {
  return { statusCode, headers: { ...HTML, "cache-control": cache }, body };
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
    if (!row) return reply(404, missHtml(), MISS_CACHE);
    if (share.isExpired(row, Date.now())) return reply(404, missHtml(), MISS_CACHE);

    const doc = share.parseShareSnapshot(row.data);
    if (!doc) return reply(404, missHtml(), MISS_CACHE);

    return reply(200, pageHtml(doc, { hideFooter: row.hideFooter, unlisted: row.unlisted, code: id }), PAGE_CACHE);
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
exports._internal = { escapeHtml, safeHref, safeSrc, pageHtml, missHtml, itemHtml };

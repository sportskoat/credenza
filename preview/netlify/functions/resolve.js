// Buy-link resolver for Credenza (fashion build). Weidian: public SKU API +
// Claude translate. Taobao/Tmall: world.taobao.com HTML og:title/og:image (price
// often missing — photo + title still beat monogram cards). 1688: detail page
// HTML og + JSON-LD Product (same fail-open pattern). Fail open on Claude.
// SSRF via safeFetch for HTML hosts. No dependencies.

const { safeFetch, readCapped, assertSafeUrl } = require("./lib/guard.js");
const limit = require("./lib/limit.js");
const paidGate = require("./lib/paid-gate.js");

const ROUTE = "resolve";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const WEIDIAN_API = "https://thor.weidian.com/detail/getItemSkuInfo/1.0";
// world.taobao serves its SSR data island only to crawlers ("traffic":
// "crawler" vs "people"). Ask for the crawler page — that is what it is for.
const CRAWLER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
// Product Details body (Kyle 2026-07-25: size charts live here as images —
// the SKU feed's gallery never carries them, so the chart hunt was blind).
const WEIDIAN_DESC_API = "https://thor.weidian.com/detail/getDetailDesc/1.0";
// Item page HTML carries overseas_kmm.user_connection.whats_app for some shops.
const WEIDIAN_PAGE_HOST = /(^|\.)weidian\.(com|cn)$/i;
const MAX_DESC_IMAGES = 20;
// The SKU feed carries the main photo and the variant photos only, so a listing
// that shows five photos arrived as two (Kyle 2026-07-29, item 7744643744). The
// Product Details feed carries the rest, and the gallery holds at most ten.
const MAX_GALLERY_IMAGES = 10;
// A size table is wider than it is tall; a product shot is square or portrait.
// Chart photos stay out of the gallery — Kyle's rule from 2026-07-26.
const CHART_SHAPE_RATIO = 1.25;
const FX_API = "https://open.er-api.com/v6/latest/CNY";
// Top-8 display currencies (lane 2, 2026-08-02). One live fetch returns every
// rate; offline fallbacks keep shelf totals stable when the free service is
// down. USD/EUR literals stay in the form the three-copy pin expects.
const FX_CODES = ["USD", "EUR", "CNY", "GBP", "JPY", "KRW", "CAD", "AUD"];
const FX_FALLBACK_USD_PER_CNY = 0.14;
// Rough offline EUR rate (2026-08-01): the euro is stronger than the dollar,
// so fewer CNY buy one EUR than one USD. Fallback only — the live FX_API wins.
const FX_FALLBACK_EUR_PER_CNY = 0.13;
const FX_FALLBACK_PER_CNY = {
  USD: FX_FALLBACK_USD_PER_CNY,
  EUR: FX_FALLBACK_EUR_PER_CNY,
  CNY: 1,
  GBP: 0.11,
  JPY: 21,
  KRW: 190,
  CAD: 0.19,
  AUD: 0.21,
};
const WHOLE_UNIT_CODES = new Set(["CNY", "JPY", "KRW"]);
const TIMEOUT_MS = 20000;
const MAX_VARIANT_VALUES = 60;
const MAX_HTML_BYTES = 1.5 * 1024 * 1024;
const MODEL = process.env.CREDENZA_RESOLVE_MODEL || "claude-haiku-4-5";
// world.taobao + redirects stay on taobao hosts (not arbitrary web).
const TAOBAO_PAGE_HOST = /(^|\.)(world\.)?taobao\.com$/i;
// detail.1688.com and redirects stay on 1688.com only.
const ALI1688_PAGE_HOST = /(^|\.)1688\.com$/i;

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

function weidianItemId(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!/(^|\.)weidian\.(com|cn)$/.test(host)) return null;
  // Length sanity: every working Weidian item id in the corpus is 10+ digits.
  // A shorter id used to classify fine and then resolve to nothing — the 422
  // below now says honestly that the link is not resolvable (2026-08-04 audit).
  const id = u.searchParams.get("itemID") || u.searchParams.get("itemId") || u.searchParams.get("item_id");
  if (id && /^\d{10,}$/.test(id)) return id;
  const pathMatch = u.pathname.match(/\/item\/(\d{10,})/);
  return pathMatch ? pathMatch[1] : null;
}

/** Taobao or Tmall numeric id from common listing URL shapes. */
function taobaoFamilyItemId(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const isTaobao = /(^|\.)(taobao|tmall)\.com$/.test(host) || host === "m.tb.cn" || /(^|\.)tb\.cn$/.test(host);
  if (!isTaobao) return null;
  const id =
    u.searchParams.get("id") ||
    u.searchParams.get("itemId") ||
    u.searchParams.get("item_id");
  if (id && /^\d{5,}$/.test(id)) {
    const marketplace = /tmall/.test(host) ? "tmall" : "taobao";
    return { marketplace, itemId: id };
  }
  const path = u.pathname.match(/\/item\/(\d{5,})/);
  if (path) return { marketplace: /tmall/.test(host) ? "tmall" : "taobao", itemId: path[1] };
  return null;
}

/** 1688 offer id from detail.1688.com/offer/{id}.html and common aliases. */
function ali1688ItemId(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!/(^|\.)1688\.com$/.test(host)) return null;
  const path = u.pathname.match(/\/offer\/(\d{5,})(?:\.html)?/i);
  if (path) return path[1];
  const id =
    u.searchParams.get("offerId") ||
    u.searchParams.get("offer_id") ||
    u.searchParams.get("id");
  if (id && /^\d{5,}$/.test(id)) return id;
  return null;
}

// Agent hosts we recognize for inbound unwrap (wider than outbound registry).
// Hoisted 2026-08-04: the 422 failure code switch below reuses it.
const AGENT_HOST_RE = /(^|\.)(superbuy|youshop10|sugargoo|cssbuy|kakobuy|fansbuy|hoobuy|cnfans|mulebuy|acbuy|oopbuy|basetao|wegobuy|pandabuy|allchinabuy|joyabuy|joyagoo|mycnbox|gtbuy|hipobuy|usfans)\.[a-z.]{2,}$/i;

/**
 * Unwrap agent front URLs to a marketplace buy target.
 * Mirrors agents.js unwrapAgentUrl for the Netlify CommonJS side (agents.js
 * is ESM + import.meta.env — not importable here).
 * Returns { marketplace, itemId } or null.
 */
function unwrapAgentBuyLink(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!AGENT_HOST_RE.test(host)) return null;

  // Embedded ?url= / productLink (Superbuy family, Fansbuy with url param).
  for (const key of ["url", "productLink", "product_url", "productUrl", "link"]) {
    const v = u.searchParams.get(key);
    if (!v) continue;
    let decoded = v;
    try {
      decoded = decodeURIComponent(v);
    } catch {
      /* keep */
    }
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        /* keep */
      }
    }
    const direct = classifyBuyLinkDirect(decoded);
    if (direct) return direct;
  }

  // Fansbuy: item-micro-{weidianId}.html (?promotionCode optional, ?url= often absent).
  if (/(^|\.)fansbuy\.com$/i.test(host)) {
    const m = u.pathname.match(/\/item-micro-(\d{5,})(?:\.html)?/i);
    if (m) return { marketplace: "weidian", itemId: m[1] };
  }

  // mulebuy / joyagoo / cnfans: ?id= + shop_type|platform
  const idQ = u.searchParams.get("id") || u.searchParams.get("itemId") || u.searchParams.get("item_id");
  const platformQ =
    u.searchParams.get("shop_type") ||
    u.searchParams.get("platform") ||
    u.searchParams.get("shopType");
  if (idQ && /^\d{5,}$/.test(idQ) && platformQ) {
    const p = String(platformQ).toLowerCase();
    if (p === "weidian" || p === "2") return { marketplace: "weidian", itemId: idQ };
    if (p === "taobao" || p === "1") return { marketplace: "taobao", itemId: idQ };
    if (p === "tmall") return { marketplace: "tmall", itemId: idQ };
    if (p === "1688" || p === "3") return { marketplace: "1688", itemId: idQ };
  }

  // hoobuy / oopbuy / usfans: /product/{code}/{id}
  // Numeric codes are PER-AGENT (mirrors agents.js, probed live 2026-07-28):
  // hoobuy/oopbuy 2 weidian / 3 1688 — usfans 3 weidian / 4 1688 / 5 taobao.
  const pathCode = u.pathname.match(/\/product\/([a-z0-9]+)\/(\d{5,})\/?$/i);
  if (pathCode) {
    const p = pathCode[1].toLowerCase();
    const id = pathCode[2];
    if (/(^|\.)usfans\.com$/i.test(host)) {
      if (p === "3") return { marketplace: "weidian", itemId: id };
      if (p === "4") return { marketplace: "1688", itemId: id };
      if (p === "5") return { marketplace: "taobao", itemId: id };
      if (p === "6") return { marketplace: "tmall", itemId: id };
      return null;
    }
    if (p === "2" || p === "weidian") return { marketplace: "weidian", itemId: id };
    if (p === "1" || p === "taobao") return { marketplace: "taobao", itemId: id };
    if (p === "tmall") return { marketplace: "tmall", itemId: id };
    if (p === "3" || p === "1688") return { marketplace: "1688", itemId: id };
  }

  return null;
}

/** Direct marketplace classify — no agent unwrap (avoids recursion). */
function classifyBuyLinkDirect(raw) {
  const w = weidianItemId(raw);
  if (w) return { marketplace: "weidian", itemId: w };
  const a = ali1688ItemId(raw);
  if (a) return { marketplace: "1688", itemId: a };
  return taobaoFamilyItemId(raw);
}

/** Classify a buy URL. Returns { marketplace, itemId } or null. */
function classifyBuyLink(raw) {
  const direct = classifyBuyLinkDirect(raw);
  if (direct) return direct;
  return unwrapAgentBuyLink(raw);
}

// One 422 string covered every reject shape, so the card could not say WHY a
// link failed (2026-08-04 audit, six dead links / four causes in one paste).
// The `code` field names the cause — same convention as paid-gate's
// sign_in_required — and the client stores it as item.failCode for the UI.
// Falls back to "not-a-buy-link" so unknown shapes keep the old behavior.
function buyLinkFailCode(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    // "e.t b.cn" — a link the paste split in half will not even parse.
    return "link-cut-off";
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (/(^|\.)weidian\.(com|cn)$/.test(host)) {
    // An itemID that failed the 10-digit sanity check is a truncated ITEM
    // link (corpus: itemID=77615274, 8 digits), not a storefront.
    const id =
      u.searchParams.get("itemID") || u.searchParams.get("itemId") || u.searchParams.get("item_id");
    if (id && /^\d+$/.test(id)) return "link-cut-off";
    return "shop-front";
  }
  if (AGENT_HOST_RE.test(host)) return "agent-short";
  // A host with no dot or a one-letter tail ("e.t") is a link cut mid-paste.
  if (!host.includes(".") || /\.[a-z]$/i.test(host)) return "link-cut-off";
  return "not-a-buy-link";
}

// Short links carry no item id: m.tb.cn/h.xxx is THE Taobao mobile share
// format, and s.click.taobao.com is the affiliate redirector Telegram/WeChat
// curators paste (parser audit, 2026-07-27). Follow them to the item page —
// every hop re-validated against the Taobao family hosts, never the open web,
// same SSRF discipline as safeFetch — and classify where they land.
const REDIRECT_FOLLOW_HOST = /(^|\.)((taobao|tmall)\.com|tb\.cn)$/i;
const REDIRECT_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const REDIRECT_BODY_BYTES = 256 * 1024;

function taobaoShortHost(raw) {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    return REDIRECT_FOLLOW_HOST.test(host) && !taobaoFamilyItemId(raw);
  } catch {
    return false;
  }
}

async function classifyViaRedirect(raw, signal) {
  let url = raw;
  for (let i = 0; i <= 4; i++) {
    const direct = taobaoFamilyItemId(url);
    if (direct) return direct;
    let u;
    try {
      u = await assertSafeUrl(url, { hosts: REDIRECT_FOLLOW_HOST });
    } catch {
      return null;
    }
    let res;
    try {
      res = await fetch(u.href, {
        headers: { "user-agent": REDIRECT_UA, accept: "text/html,*/*;q=0.8" },
        redirect: "manual",
        signal,
      });
    } catch {
      return null;
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      url = new URL(loc, u.href).href;
      continue;
    }
    // A short link can answer an HTML interstitial instead of a 302. The item
    // URL is in the body — the first link with a Taobao-family id wins.
    const buf = await readCapped(res, REDIRECT_BODY_BYTES).catch(() => null);
    if (!buf) return null;
    const links = buf.toString("utf8").match(/https?:\/\/[^\s"'<>\\]+/g) || [];
    for (const link of links) {
      const hit = taobaoFamilyItemId(link);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

/** Parse world.taobao HTML for title + main image (og tags). Price often absent. */
// The world.taobao SEO page embeds a JSON island (`var b = {...}` next to
// __ICE_APP_CONTEXT__) with normalItemResponse: the real title, the full
// gallery list, the actual price, and the seller name — everything og tags
// lack. Taobao's description photos stay unreachable server-side (every
// mtop gateway answers RGV587 anti-bot, 2026-07-25), so this island is the
// richest sanctioned source. Brace-walk with string/escape tracking.
function parseWorldTaobaoIsland(html) {
  const src = String(html || "");
  const marker = src.indexOf('"loaderData"');
  if (marker === -1) return null;
  const assign = src.lastIndexOf("var b = ", marker);
  if (assign === -1) return null;
  const open = src.indexOf("{", assign);
  if (open === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          const data = JSON.parse(src.slice(open, i + 1));
          const httpData =
            data && data.loaderData && data.loaderData["pdp-pc"] && data.loaderData["pdp-pc"].data
              ? data.loaderData["pdp-pc"].data.httpData || {}
              : {};
          const item = (httpData.normalItemResponse && httpData.normalItemResponse.item) || {};
          const price = (httpData.normalItemResponse && httpData.normalItemResponse.itemPrice) || {};
          const seller = (httpData.normalItemResponse && httpData.normalItemResponse.seller) || {};
          const norm = (u) => {
            if (typeof u !== "string" || !u) return null;
            const clean = u.startsWith("//") ? "https:" + u : u;
            return /^https:\/\//i.test(clean) ? clean : null;
          };
          const images = (Array.isArray(item.images) ? item.images : []).map(norm).filter(Boolean);
          const priceNum = parseFloat(price.promotionPrice || price.originalPrice || "");
          return {
            title: typeof item.title === "string" ? item.title.trim() : "",
            images: [...new Set(images)],
            priceCny: isFinite(priceNum) && priceNum > 0 && priceNum < 1e6 ? priceNum : null,
            sellerName: typeof seller.shopName === "string" ? seller.shopName.trim() : "",
          };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseWorldTaobaoHtml(html) {
  const src = String(html || "");
  const og = (prop) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']og:${prop}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:${prop}["']`,
      "i"
    );
    const m = src.match(re);
    return (m && (m[1] || m[2]) || "").trim();
  };
  let title = og("title");
  if (title) {
    title = title
      .replace(/\s*[-–|].{0,40}(淘寶|淘宝|Taobao|Tmall|天貓|天猫).*$/i, "")
      .replace(/\.\.\.\s*$/, "…")
      .trim();
  }
  if (!title) {
    const t = src.match(/<title>([^<]+)<\/title>/i);
    title = t ? t[1].replace(/\s*[-–|].{0,40}(淘寶|淘宝|Taobao|Tmall).*$/i, "").trim() : "";
  }
  let mainImage = og("image") || null;
  if (mainImage && mainImage.startsWith("//")) mainImage = "https:" + mainImage;
  // Optional price: ¥123 or "price":"123.00"
  let priceCny = null;
  const priceMatch =
    src.match(/[¥￥]\s*([0-9]+(?:\.[0-9]{1,2})?)/) ||
    src.match(/"price"\s*:\s*"?(?:¥|￥)?([0-9]+(?:\.[0-9]{1,2})?)"?/);
  if (priceMatch) {
    const n = parseFloat(priceMatch[1]);
    if (isFinite(n) && n > 0 && n < 1e6) priceCny = n;
  }
  return {
    title: title || "",
    mainImage,
    images: mainImage ? [mainImage] : [],
    priceCny,
    priceCnyHigh: null,
    stock: null,
    attrGroups: [],
  };
}

async function fetchTaobaoWorldFacts(itemId, signal) {
  const pageUrl = `https://world.taobao.com/item/${itemId}.htm`;
  const res = await safeFetch(pageUrl, {
    headers: {
      "user-agent": CRAWLER_UA,
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8",
    },
    signal,
    hosts: TAOBAO_PAGE_HOST,
    maxRedirects: 4,
  });
  if (!res.ok) throw { status: 502, msg: `Taobao page failed (${res.status})` };
  const buf = await readCapped(res, MAX_HTML_BYTES);
  const html = buf.toString("utf8");
  const island = parseWorldTaobaoIsland(html);
  const parsed = parseWorldTaobaoHtml(html);
  const images = island && island.images.length ? island.images : parsed.images;
  if (!island && !parsed.title && !parsed.mainImage) throw { status: 404, msg: "Taobao item not found" };
  return {
    itemId: String(itemId),
    title: (island && island.title) || parsed.title || `Taobao item ${itemId}`,
    mainImage: images[0] || parsed.mainImage,
    images,
    priceCny: (island && island.priceCny != null ? island.priceCny : null) ?? parsed.priceCny,
    priceCnyHigh: null,
    stock: null,
    attrGroups: [],
    sellerName: (island && island.sellerName) || "",
  };
}

/**
 * Parse 1688 detail HTML: og tags first, then Schema.org Product JSON-LD.
 * Price often a MOQ tier; take the first positive CNY figure when present.
 */
function parse1688Html(html) {
  const src = String(html || "");
  const og = (prop) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']og:${prop}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:${prop}["']`,
      "i"
    );
    const m = src.match(re);
    return ((m && (m[1] || m[2])) || "").trim();
  };
  let title = og("title");
  let mainImage = og("image") || null;
  let priceCny = null;

  // JSON-LD Product (common on public detail pages when og is thin).
  const ldBlocks = src.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const body = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>\s*$/i, "");
    let data;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : data && data["@graph"] ? data["@graph"] : [data];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const type = String(node["@type"] || "");
      if (!/product/i.test(type) && type !== "Product") continue;
      if (!title && typeof node.name === "string") title = node.name.trim();
      if (!mainImage) {
        const img = node.image;
        if (typeof img === "string") mainImage = img;
        else if (Array.isArray(img) && img.length) {
          mainImage = typeof img[0] === "string" ? img[0] : img[0] && img[0].url;
        } else if (img && typeof img === "object" && img.url) mainImage = img.url;
      }
      if (priceCny == null) {
        const offers = node.offers;
        const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
        for (const o of offerList) {
          if (!o) continue;
          const p = parseFloat(o.price != null ? o.price : o.lowPrice);
          if (isFinite(p) && p > 0 && p < 1e6) {
            priceCny = p;
            break;
          }
        }
      }
    }
  }

  if (title) {
    title = title
      .replace(/\s*[-–|].{0,40}(1688|阿里巴巴|Alibaba).*$/i, "")
      .replace(/\.\.\.\s*$/, "…")
      .trim();
  }
  if (!title) {
    const t = src.match(/<title>([^<]+)<\/title>/i);
    title = t ? t[1].replace(/\s*[-–|].{0,40}(1688|阿里巴巴|Alibaba).*$/i, "").trim() : "";
  }
  if (mainImage && mainImage.startsWith("//")) mainImage = "https:" + mainImage;
  if (priceCny == null) {
    const priceMatch =
      src.match(/[¥￥]\s*([0-9]+(?:\.[0-9]{1,2})?)/) ||
      src.match(/"price"\s*:\s*"?(?:¥|￥)?([0-9]+(?:\.[0-9]{1,2})?)"?/);
    if (priceMatch) {
      const n = parseFloat(priceMatch[1]);
      if (isFinite(n) && n > 0 && n < 1e6) priceCny = n;
    }
  }
  return {
    title: title || "",
    mainImage,
    images: mainImage ? [mainImage] : [],
    priceCny,
    priceCnyHigh: null,
    stock: null,
    attrGroups: [],
  };
}

async function fetch1688Facts(itemId, signal) {
  const pageUrl = `https://detail.1688.com/offer/${itemId}.html`;
  const res = await safeFetch(pageUrl, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8",
      referer: "https://www.1688.com/",
    },
    signal,
    hosts: ALI1688_PAGE_HOST,
    maxRedirects: 4,
  });
  if (!res.ok) throw { status: 502, msg: `1688 page failed (${res.status})` };
  const buf = await readCapped(res, MAX_HTML_BYTES);
  const html = buf.toString("utf8");
  const parsed = parse1688Html(html);
  if (!parsed.title && !parsed.mainImage) throw { status: 404, msg: "1688 item not found" };
  return {
    itemId: String(itemId),
    title: parsed.title || `1688 item ${itemId}`,
    mainImage: parsed.mainImage,
    images: parsed.images,
    priceCny: parsed.priceCny,
    priceCnyHigh: parsed.priceCnyHigh,
    stock: null,
    attrGroups: [],
  };
}

async function fetchWeidianItem(itemId, signal) {
  const param = encodeURIComponent(JSON.stringify({ itemId }));
  const res = await fetch(`${WEIDIAN_API}?param=${param}`, {
    headers: {
      "user-agent": UA,
      referer: `https://weidian.com/item.html?itemID=${itemId}`,
      accept: "application/json",
    },
    signal,
  });
  if (!res.ok) throw { status: 502, msg: `Weidian request failed (${res.status})` };
  const data = await res.json();
  if (!data || !data.status || data.status.code !== 0 || !data.result) {
    throw { status: 404, msg: "Weidian item not found" };
  }
  return data.result;
}

// Seller description photos live in item_detail.desc_content. Three shapes:
//   type 2  — single photo block with .url (most apparel shops)
//   type 13 — album block itemDetailImgAlbum.albumImgList[].thumbnail
//             (common on multi-model shoe shops; was dropped before 2026-07-26)
//   type 10000 — the folded tail of the page. One long stacked strip (.url)
//             under a label (.text, e.g. 购前说明). Sellers put their whole
//             lower page in this strip, size tables included — Kyle 2026-08-04,
//             weidian 7636215363: every chart sat in one folded 2250x4929 PNG
//             and the pool never saw it ("WHY IS THIS SO INCONSISTENT").
// Pure: blocks -> ordered, deduped https photo URLs. Any failure is silent.
function pushDescUrl(urls, raw) {
  if (typeof raw !== "string" || !raw) return;
  const clean = raw.split("?")[0].replace(/\.webp$/i, "");
  if (!/^https:\/\//i.test(clean)) return;
  if (!urls.includes(clean)) urls.push(clean);
}

function descImageUrls(descContent) {
  const blocks = Array.isArray(descContent) ? descContent : [];
  const urls = [];
  for (const block of blocks) {
    if (!block) continue;
    if (block.type === 2 || block.type === 10000) {
      pushDescUrl(urls, block.url);
      continue;
    }
    // Type 13: nested product-detail album. Charts and table photos live here.
    if (block.type === 13) {
      const list =
        block.itemDetailImgAlbum && Array.isArray(block.itemDetailImgAlbum.albumImgList)
          ? block.itemDetailImgAlbum.albumImgList
          : [];
      for (const entry of list) {
        if (!entry || typeof entry !== "object") continue;
        pushDescUrl(urls, entry.url || entry.thumbnail || entry.img || entry.src);
      }
    }
  }
  return urls.slice(0, MAX_DESC_IMAGES);
}

// A Weidian CDN path ends in _WIDTH_HEIGHT before the extension, e.g.
// ...-unadjust_861_629.png (a size table) next to ..._4284_4284.jpg (a product
// shot). Returns width / height, or null when the path carries no size.
function urlAspect(raw) {
  const m = /_(\d{2,5})_(\d{2,5})(?:\.[a-z0-9]+)?$/i.exec(String(raw || "").split("?")[0]);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return null;
  return w / h;
}

/** True for a landscape image — the shape a size table has and a product shot does not. */
function isChartShaped(url) {
  const aspect = urlAspect(url);
  return aspect != null && aspect > CHART_SHAPE_RATIO;
}

// Product Details photos the gallery never showed. An unknown shape counts as a
// photo: hiding a real product shot costs the customer more than one stray
// table, and the chart hunt still reads every desc photo either way.
function galleryWithDescPhotos(images, descImages) {
  const out = Array.isArray(images) ? [...images] : [];
  for (const url of Array.isArray(descImages) ? descImages : []) {
    if (out.length >= MAX_GALLERY_IMAGES) break;
    if (isChartShaped(url)) continue;
    if (!out.includes(url)) out.push(url);
  }
  return out;
}


// Pull bare and full Yupoo shop links from seller free text (desc type 1).
// Chart-empty multi-model shops often only post "Yupoo1 :shop.x.yupoo.com".
function extractYupooLinksFromText(text) {
  const src = String(text || "");
  if (!src.trim()) return [];
  const found = [];
  const re = /(?:https?:\/\/)?([\w-]+\.x\.yupoo\.com)(\/[^\s"'<>]*)?/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const host = String(m[1] || "").toLowerCase();
    if (!/^[\w-]+\.x\.yupoo\.com$/.test(host)) continue;
    let path = String(m[2] || "");
    path = path.replace(/[),.;，。]+$/g, "");
    const url = "https://" + host + path;
    if (!found.includes(url)) found.push(url);
  }
  return found.slice(0, 8);
}

function descType1Text(descContent) {
  const blocks = Array.isArray(descContent) ? descContent : [];
  return blocks
    .filter((b) => b && b.type === 1 && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

// Returns { descImages, sellerYupooLinks }. Empty arrays on any failure.
async function fetchWeidianDescBundle(itemId, signal) {
  try {
    const param = encodeURIComponent(JSON.stringify({ vItemId: itemId }));
    const res = await fetch(`${WEIDIAN_DESC_API}?param=${param}`, {
      headers: {
        "user-agent": UA,
        referer: `https://weidian.com/item.html?itemID=${itemId}`,
        accept: "application/json",
      },
      signal,
    });
    if (!res.ok) return { descImages: [], sellerYupooLinks: [] };
    const data = await res.json();
    const content = data && data.result && data.result.item_detail && data.result.item_detail.desc_content;
    return {
      descImages: descImageUrls(content),
      sellerYupooLinks: extractYupooLinksFromText(descType1Text(content)),
    };
  } catch {
    return { descImages: [], sellerYupooLinks: [] };
  }
}

// Back-compat for tests that still call the old name.
async function fetchWeidianDescImages(itemId, signal) {
  const bundle = await fetchWeidianDescBundle(itemId, signal);
  return bundle.descImages;
}

/**
 * WhatsApp from the public item page (not the SKU API).
 * Pages embed: overseas_kmm.user_connection.whats_app = "+86 …"
 * Fail open — empty string when fetch or parse fails.
 */
async function fetchWeidianWhatsApp(itemId, signal) {
  try {
    const pageUrl = `https://weidian.com/item.html?itemID=${itemId}`;
    const res = await safeFetch(pageUrl, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal,
      hosts: WEIDIAN_PAGE_HOST,
    });
    if (!res.ok) return "";
    const html = (await readCapped(res, MAX_HTML_BYTES)).toString("utf8");
    const decoded = String(html)
      .replace(/&#34;/g, '"')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
    const m =
      decoded.match(/"whats_app"\s*:\s*"([^"]{6,32})"/i) ||
      decoded.match(/"whatsapp"\s*:\s*"([^"]{6,32})"/i);
    if (!m || !m[1]) return "";
    const raw = String(m[1]).trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return "";
    return raw;
  } catch {
    return "";
  }
}

/** True when a seller axis title is a size run (keep original over Claude rewrite). */
function isSizeAxisTitle(title) {
  return /^(size|sizes?|garment\s*size|size\s*run|clothing\s*size|尺码\d*|尺碼\d*|尺寸|鞋码|码数|長度|长度(?:\s*\(cm\))?|사이즈|サイズ)$/i.test(
    String(title || "").trim()
  );
}

/** True when a seller axis title is a color run. */
function isColorAxisTitle(title) {
  return /^(color|colour|colors?|颜色|顏色|颜色分类|顏色分類|カラー|색상|색|款式\/颜色|款式\/顏色)$/i.test(
    String(title || "").trim()
  );
}

// Flattens the Weidian result into the facts we care about. Prices arrive in
// fen (1/100 CNY). attrList groups carry the variant axes (often size/color);
// per-value images are the closest thing to a gallery the API exposes.
function extractFacts(result) {
  const attrGroups = (result.attrList || []).map((group) => ({
    title: group.attrTitle || "",
    values: (group.attrValues || [])
      .slice(0, MAX_VARIANT_VALUES)
      .map((v) => ({ name: String(v.attrValue || ""), img: v.img || null })),
  }));
  const images = [];
  if (result.itemMainPic) images.push(result.itemMainPic);
  for (const group of attrGroups) {
    for (const v of group.values) {
      if (v.img && !images.includes(v.img)) images.push(v.img);
    }
  }
  const low = result.itemDiscountLowPrice;
  const high = result.itemDiscountHighPrice;
  return {
    itemId: String(result.itemId || ""),
    title: result.itemTitle || "",
    mainImage: result.itemMainPic || null,
    images: images.slice(0, 10),
    priceCny: typeof low === "number" ? low / 100 : null,
    priceCnyHigh: typeof high === "number" && high !== low ? high / 100 : null,
    stock: typeof result.itemStock === "number" ? result.itemStock : null,
    attrGroups,
  };
}

// One fetch, every top-8 currency (lane 2, 2026-08-02). The FX_API response
// already carries every rate in one answer, so USD/EUR/GBP/… all read the
// SAME response. That free rate service has a daily request limit; a second
// call per item burns through it twice as fast, and once it blocks us the
// app silently falls back to the fixed rates with no error shown.
function pickRate(rates, code) {
  const fallback = FX_FALLBACK_PER_CNY[code];
  if (code === "CNY") return 1;
  const raw = rates && rates[code];
  if (typeof raw !== "number" || !(raw > 0)) return fallback;
  // USD/EUR historically cap below 1 (per-CNY). Other codes (JPY, KRW) are
  // larger than 1 — accept any positive finite number for those.
  if ((code === "USD" || code === "EUR") && !(raw < 1)) return fallback;
  return raw;
}

function roundFx(amount, code) {
  if (amount == null || !isFinite(amount)) return null;
  if (WHOLE_UNIT_CODES.has(code)) return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

async function fetchFxRates(signal) {
  const fallback = () => {
    const perCny = { ...FX_FALLBACK_PER_CNY };
    return {
      perCny,
      usdPerCny: perCny.USD,
      eurPerCny: perCny.EUR,
    };
  };
  try {
    const res = await fetch(FX_API, { signal });
    if (!res.ok) return fallback();
    const data = await res.json();
    const rates = data && data.rates;
    const perCny = {};
    for (const code of FX_CODES) {
      perCny[code] = pickRate(rates, code);
    }
    return {
      perCny,
      usdPerCny: perCny.USD,
      eurPerCny: perCny.EUR,
    };
  } catch {
    return fallback();
  }
}

const ENRICH_TOOL = {
  name: "return_item_details",
  description: "Return the translated, categorized product details.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["titleEn", "summary", "category", "variantGroups"],
    properties: {
      titleEn: {
        type: "string",
        description: "Natural English product title. If the original is a bare SKU code, describe the product from the variant names instead.",
      },
      summary: {
        type: "string",
        description: "One crisp sentence describing what this item is and anything notable (material, style, batch).",
      },
      category: {
        type: "string",
        enum: ["shirt", "pants", "shoes", "outerwear", "accessory", "bag", "hat", "other"],
      },
      sizeNotes: {
        type: "string",
        description: "Short note on the size run if the variants are garment sizes (e.g. 'Runs S–XXL in CN sizing — CN sizes run about one size small vs US'). Empty string if variants aren't sizes.",
      },
      variantGroups: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "values"],
          properties: {
            title: { type: "string", description: "English name of the variant axis (e.g. Size, Color, Model)" },
            values: { type: "array", items: { type: "string" }, description: "English names, same order as supplied" },
          },
        },
      },
    },
  },
};

async function enrichWithClaude(apiKey, facts, signal) {
  const groups = Array.isArray(facts.attrGroups) ? facts.attrGroups : [];
  const compact = {
    title: facts.title,
    priceCny: facts.priceCny,
    variantGroups: groups.map((g) => ({
      title: g.title,
      values: (g.values || []).map((v) => v.name),
    })),
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system:
        "You translate Chinese marketplace (Weidian, Taobao, Tmall, 1688) fashion listings into concise English for a personal shopping shelf. Translate faithfully, keep brand and model names recognizable, and categorize the garment. Variant values must be returned in the same order they were given. If the title is already useful English, keep it short and natural.",
      messages: [
        {
          role: "user",
          content: "Listing data:\n" + JSON.stringify(compact),
        },
      ],
      tools: [ENRICH_TOOL],
      tool_choice: { type: "tool", name: "return_item_details" },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const toolUse =
    data &&
    Array.isArray(data.content) &&
    data.content.find((b) => b && b.type === "tool_use" && b.name === "return_item_details");
  if (!toolUse || !toolUse.input) return null;
  return { result: toolUse.input, usage: data && data.usage };
}

async function handle(event) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!event || event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });
  // Part 7f: account (Bearer + plan allowance) or, until REQUIRE_ACCOUNTS
  // flips, the anonymous shared key.
  const gate = await paidGate.authorizePaid(event, process.env, "resolve");
  if (!gate.ok) {
    return response(gate.status, gate.body, gate.retryAfter ? { "retry-after": String(gate.retryAfter) } : undefined);
  }
  if (limit.bodyTooLarge(event, ROUTE)) return response(413, { error: "Body too large" });

  let input;
  try {
    input = JSON.parse(event.body || "");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  const url = input && typeof input.url === "string" ? input.url.trim() : "";
  if (!url || url.length > 2048) return response(400, { error: "url must be a non-empty string" });

  const classified = classifyBuyLink(url);
  const needsRedirect = !classified && taobaoShortHost(url);
  if (!classified && !needsRedirect) {
    return response(422, { error: "Not a resolvable buy link", code: buyLinkFailCode(url) });
  }

  // The site-wide spend ceiling, shared across every Netlify instance. It runs
  // before enter() so a blocked call never takes a concurrency slot.
  const capped = await limit.checkDailyCap(ROUTE, process.env);
  if (capped) {
    return response(capped.status, { error: capped.msg }, { "retry-after": String(capped.retryAfter) });
  }
  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // m.tb.cn / s.click style short links: follow inside the Taobao family and
    // classify the landing URL. Runs behind the rate limiter — it costs an
    // outbound fetch before any id exists.
    const resolved = classified || (await classifyViaRedirect(url, controller.signal));
    // The chase itself failed: the short link is dead or wrong, and no amount
    // of re-pasting THIS link fixes it — a distinct case from never classifying.
    if (!resolved) {
      return response(422, { error: "Not a resolvable buy link", code: "short-link-dead" });
    }
    let facts;
    let canonicalUrl;
    if (resolved.marketplace === "weidian") {
      const [result, fxRates, descBundle, whatsapp] = await Promise.all([
        fetchWeidianItem(resolved.itemId, controller.signal),
        fetchFxRates(controller.signal),
        fetchWeidianDescBundle(resolved.itemId, controller.signal),
        fetchWeidianWhatsApp(resolved.itemId, controller.signal),
      ]);
      facts = extractFacts(result);
      // Description photos the gallery never showed (size charts live here).
      facts.descImages = (descBundle.descImages || []).filter((u) => !(facts.images || []).includes(u));
      // The seller's product shots live in the same feed as the chart. Put them
      // in the gallery; leave the table shapes out of it. descImages keeps the
      // whole feed, so the chart hunt still sees the table.
      facts.images = galleryWithDescPhotos(facts.images, facts.descImages);
      // Bare Yupoo shops from desc notes (chart-empty multi-model listings).
      facts.sellerYupooLinks = descBundle.sellerYupooLinks || [];
      // Overseas customer service WhatsApp when the item page lists one.
      facts.whatsapp = whatsapp || "";
      // stash rate on facts for response builder below
      facts._usdPerCny = fxRates.usdPerCny;
      facts._eurPerCny = fxRates.eurPerCny;
      facts._fxPerCny = fxRates.perCny;
      canonicalUrl = `https://weidian.com/item.html?itemID=${facts.itemId || resolved.itemId}`;
    } else if (resolved.marketplace === "1688") {
      const [aFacts, fxRates] = await Promise.all([
        fetch1688Facts(resolved.itemId, controller.signal),
        fetchFxRates(controller.signal),
      ]);
      facts = aFacts;
      facts._usdPerCny = fxRates.usdPerCny;
      facts._eurPerCny = fxRates.eurPerCny;
      facts._fxPerCny = fxRates.perCny;
      canonicalUrl = `https://detail.1688.com/offer/${resolved.itemId}.html`;
    } else {
      // taobao | tmall — HTML og tags; price often null
      const [tbFacts, fxRates] = await Promise.all([
        fetchTaobaoWorldFacts(resolved.itemId, controller.signal),
        fetchFxRates(controller.signal),
      ]);
      facts = tbFacts;
      facts._usdPerCny = fxRates.usdPerCny;
      facts._eurPerCny = fxRates.eurPerCny;
      facts._fxPerCny = fxRates.perCny;
      canonicalUrl =
        resolved.marketplace === "tmall"
          ? `https://detail.tmall.com/item.htm?id=${resolved.itemId}`
          : `https://item.taobao.com/item.htm?id=${resolved.itemId}`;
    }

    // Translation is an enhancement: the raw facts already make a usable card,
    // so a Claude failure degrades to untranslated output instead of erroring.
    let enriched = null;
    if (apiKey) {
      const out = await enrichWithClaude(apiKey, facts, controller.signal).catch(() => null);
      if (out) {
        enriched = out.result;
        await limit.recordUsageShared(ROUTE, MODEL, out.usage, process.env);
      }
    }

    const variantGroups = (facts.attrGroups || []).map((group, gi) => {
      const originalTitle = group.title || "";
      const claudeTitle =
        (enriched &&
          enriched.variantGroups &&
          enriched.variantGroups[gi] &&
          enriched.variantGroups[gi].title) ||
        "";
      // Keep original size/color axis titles so pickSizeValuesFromVariants
      // still matches after Claude rewrites ("Garment size" vs "尺码").
      const title =
        isSizeAxisTitle(originalTitle) || isColorAxisTitle(originalTitle)
          ? originalTitle
          : claudeTitle || originalTitle;
      return {
        title,
        values: group.values.map((v, vi) => ({
          name:
            (enriched &&
              enriched.variantGroups &&
              enriched.variantGroups[gi] &&
              Array.isArray(enriched.variantGroups[gi].values) &&
              enriched.variantGroups[gi].values[vi]) ||
            v.name,
          img: v.img,
        })),
      };
    });

    const usdPerCny = facts._usdPerCny != null ? facts._usdPerCny : FX_FALLBACK_USD_PER_CNY;
    const eurPerCny = facts._eurPerCny != null ? facts._eurPerCny : FX_FALLBACK_EUR_PER_CNY;
    const fxPerCny = facts._fxPerCny || { ...FX_FALLBACK_PER_CNY, USD: usdPerCny, EUR: eurPerCny };
    // priceFx carries every top-8 conversion from the ONE rates fetch so the
    // client never needs a second network call to paint GBP/JPY/….
    let priceFx = null;
    if (facts.priceCny != null && isFinite(Number(facts.priceCny))) {
      priceFx = {};
      for (const code of FX_CODES) {
        const rate = fxPerCny[code] != null ? fxPerCny[code] : FX_FALLBACK_PER_CNY[code];
        priceFx[code] = roundFx(Number(facts.priceCny) * rate, code);
      }
    }
    await paidGate.recordPaidUsage(gate, "resolve");
    return response(200, {
      source: resolved.marketplace,
      itemId: facts.itemId || resolved.itemId,
      url: canonicalUrl,
      title: (enriched && enriched.titleEn) || facts.title,
      originalTitle: facts.title,
      summary: (enriched && enriched.summary) || "",
      category: (enriched && enriched.category) || "other",
      sizeNotes: (enriched && enriched.sizeNotes) || "",
      seller: facts.sellerName || "",
      priceCny: facts.priceCny,
      priceCnyHigh: facts.priceCnyHigh,
      priceUsd: priceFx ? priceFx.USD : null,
      priceEur: priceFx ? priceFx.EUR : null,
      priceFx,
      usdPerCny,
      eurPerCny,
      stock: facts.stock,
      mainImage: facts.mainImage,
      images: facts.images || [],
      descImages: facts.descImages || [],
      sellerYupooLinks: facts.sellerYupooLinks || [],
      whatsapp: facts.whatsapp || "",
      variantGroups,
      translated: !!enriched,
    });
  } catch (e) {
    if (e && e.name === "AbortError") return response(504, { error: "Timed out" });
    if (e && e.status) return response(e.status, { error: e.msg });
    return response(502, { error: "Resolve failed" });
  } finally {
    clearTimeout(timer);
    limit.leave(ROUTE);
  }
}

// Pure helpers for unit tests (createRequire).
exports._test = {
  weidianItemId,
  taobaoFamilyItemId,
  ali1688ItemId,
  classifyBuyLink,
  buyLinkFailCode,
  unwrapAgentBuyLink,
  taobaoShortHost,
  classifyViaRedirect,
  parseWorldTaobaoHtml,
  parseWorldTaobaoIsland,
  parse1688Html,
  descImageUrls,
  extractYupooLinksFromText,
  urlAspect,
  isChartShaped,
  galleryWithDescPhotos,
};

// Outcome log for every request — status + latency only, never content.
exports.handler = async (event) => {
  const started = Date.now();
  let res;
  try {
    res = await handle(event);
  } catch {
    res = response(500, { error: "Internal error" });
  }
  limit.logOutcome(ROUTE, limit.clientKey(event), res.statusCode, { ms: Date.now() - started });
  return res;
};

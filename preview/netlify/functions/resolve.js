// Buy-link resolver for Credenza (fashion build). Weidian: public SKU API +
// Claude translate. Taobao/Tmall: world.taobao.com HTML og:title/og:image (price
// often missing — photo + title still beat monogram cards). 1688: detail page
// HTML og + JSON-LD Product (same fail-open pattern). Fail open on Claude.
// SSRF via safeFetch for HTML hosts. No dependencies.

const { safeFetch, readCapped } = require("./lib/guard.js");
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
const MAX_DESC_IMAGES = 20;
const FX_API = "https://open.er-api.com/v6/latest/CNY";
const FX_FALLBACK_USD_PER_CNY = 0.14;
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
  const id = u.searchParams.get("itemID") || u.searchParams.get("itemId") || u.searchParams.get("item_id");
  if (id && /^\d{5,}$/.test(id)) return id;
  const pathMatch = u.pathname.match(/\/item\/(\d{5,})/);
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
  // Agent hosts we recognize for inbound unwrap (wider than outbound registry).
  const isAgent = /(^|\.)(superbuy|youshop10|sugargoo|cssbuy|kakobuy|fansbuy|hoobuy|cnfans|mulebuy|acbuy|oopbuy|basetao|wegobuy|pandabuy|allchinabuy|joyabuy|joyagoo|mycnbox|gtbuy|hipobuy)\.[a-z.]{2,}$/i.test(
    host
  );
  if (!isAgent) return null;

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

  // hoobuy / oopbuy: /product/{code}/{id}
  const pathCode = u.pathname.match(/\/product\/([a-z0-9]+)\/(\d{5,})\/?$/i);
  if (pathCode) {
    const p = pathCode[1].toLowerCase();
    const id = pathCode[2];
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

// Seller description photos live in item_detail.desc_content. Two shapes:
//   type 2  — single photo block with .url (most apparel shops)
//   type 13 — album block itemDetailImgAlbum.albumImgList[].thumbnail
//             (common on multi-model shoe shops; was dropped before 2026-07-26)
// Folded boilerplate (type 10000, e.g. 购前说明) stays out.
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
    if (!block || block.type === 10000) continue;
    if (block.type === 2) {
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

async function fetchUsdRate(signal) {
  try {
    const res = await fetch(FX_API, { signal });
    if (!res.ok) return FX_FALLBACK_USD_PER_CNY;
    const data = await res.json();
    const rate = data && data.rates && data.rates.USD;
    return typeof rate === "number" && rate > 0 && rate < 1 ? rate : FX_FALLBACK_USD_PER_CNY;
  } catch {
    return FX_FALLBACK_USD_PER_CNY;
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
  // Part 7f: account (Bearer + per-plan daily cap) or, until REQUIRE_ACCOUNTS
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
  if (!classified) return response(422, { error: "Not a resolvable buy link" });

  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let facts;
    let canonicalUrl;
    if (classified.marketplace === "weidian") {
      const [result, usdPerCny, descBundle] = await Promise.all([
        fetchWeidianItem(classified.itemId, controller.signal),
        fetchUsdRate(controller.signal),
        fetchWeidianDescBundle(classified.itemId, controller.signal),
      ]);
      facts = extractFacts(result);
      // Description photos the gallery never showed (size charts live here).
      facts.descImages = (descBundle.descImages || []).filter((u) => !(facts.images || []).includes(u));
      // Bare Yupoo shops from desc notes (chart-empty multi-model listings).
      facts.sellerYupooLinks = descBundle.sellerYupooLinks || [];
      // stash rate on facts for response builder below
      facts._usdPerCny = usdPerCny;
      canonicalUrl = `https://weidian.com/item.html?itemID=${facts.itemId || classified.itemId}`;
    } else if (classified.marketplace === "1688") {
      const [aFacts, usdPerCny] = await Promise.all([
        fetch1688Facts(classified.itemId, controller.signal),
        fetchUsdRate(controller.signal),
      ]);
      facts = aFacts;
      facts._usdPerCny = usdPerCny;
      canonicalUrl = `https://detail.1688.com/offer/${classified.itemId}.html`;
    } else {
      // taobao | tmall — HTML og tags; price often null
      const [tbFacts, usdPerCny] = await Promise.all([
        fetchTaobaoWorldFacts(classified.itemId, controller.signal),
        fetchUsdRate(controller.signal),
      ]);
      facts = tbFacts;
      facts._usdPerCny = usdPerCny;
      canonicalUrl =
        classified.marketplace === "tmall"
          ? `https://detail.tmall.com/item.htm?id=${classified.itemId}`
          : `https://item.taobao.com/item.htm?id=${classified.itemId}`;
    }

    // Translation is an enhancement: the raw facts already make a usable card,
    // so a Claude failure degrades to untranslated output instead of erroring.
    let enriched = null;
    if (apiKey) {
      const out = await enrichWithClaude(apiKey, facts, controller.signal).catch(() => null);
      if (out) {
        enriched = out.result;
        limit.recordUsage(ROUTE, MODEL, out.usage);
      }
    }

    const variantGroups = (facts.attrGroups || []).map((group, gi) => ({
      title:
        (enriched && enriched.variantGroups && enriched.variantGroups[gi] && enriched.variantGroups[gi].title) ||
        group.title,
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
    }));

    const usdPerCny = facts._usdPerCny != null ? facts._usdPerCny : FX_FALLBACK_USD_PER_CNY;
    await paidGate.recordPaidUsage(gate, "resolve");
    return response(200, {
      source: classified.marketplace,
      itemId: facts.itemId || classified.itemId,
      url: canonicalUrl,
      title: (enriched && enriched.titleEn) || facts.title,
      originalTitle: facts.title,
      summary: (enriched && enriched.summary) || "",
      category: (enriched && enriched.category) || "other",
      sizeNotes: (enriched && enriched.sizeNotes) || "",
      seller: facts.sellerName || "",
      priceCny: facts.priceCny,
      priceCnyHigh: facts.priceCnyHigh,
      priceUsd: facts.priceCny != null ? Math.round(facts.priceCny * usdPerCny * 100) / 100 : null,
      usdPerCny,
      stock: facts.stock,
      mainImage: facts.mainImage,
      images: facts.images || [],
      descImages: facts.descImages || [],
      sellerYupooLinks: facts.sellerYupooLinks || [],
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
  unwrapAgentBuyLink,
  parseWorldTaobaoHtml,
  parseWorldTaobaoIsland,
  parse1688Html,
  descImageUrls,
  extractYupooLinksFromText,
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

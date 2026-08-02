const { safeFetch, readCapped } = require("./lib/guard.js");
const limit = require("./lib/limit.js");

const ROUTE = "yupoo";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const TIMEOUT_MS = 15000;
// Kyle 2026-07-26: "this album has 30 different photos… we could have more
// photos in here easily". 8 was far below what a Mook album holds (38 tiles
// on both reference albums). These are URLs only — the client relays and
// persists a much smaller subset, so a high cap costs nothing here.
const MAX_IMAGES = 40;
const MAX_CHART_IMAGES = 8;
// Below this long edge a Yupoo tile is a banner, a spacer, or a blank —
// never a product photo worth showing. Real photos measure 1000px+.
const MIN_PHOTO_EDGE = 600;
// Wider or taller than this is a strip or a banner, not a garment shot.
const MAX_PHOTO_ASPECT = 3;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const YUPOO_HOST = /(^|\.)yupoo\.com$/;

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function cleanEscapedUrl(value) {
  return decodeHtml(value)
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003D/gi, "=")
    .trim();
}

function parseAlbumUrl(raw) {
  if (!raw || typeof raw !== "string" || raw.length > 2048) return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!/(^|\.)yupoo\.com$/.test(host)) return null;
  const album = url.pathname.match(/\/albums\/(\d+)/i);
  if (!album) return null;
  const accountMatch = host.match(/^([^.]+)(?:\.x)?\.yupoo\.com$/);
  // Yupoo album pages commonly 404 in the browser without ?uid=… — keep the
  // supplied uid when present, otherwise default to 1 so enrichment never
  // rewrites a working paste into a broken open URL.
  const uid = url.searchParams.get("uid") || "1";
  const canonical = new URL(url.origin + url.pathname.replace(/\/+$/, ""));
  canonical.searchParams.set("uid", uid);
  return {
    requestUrl: canonical.href,
    url: canonical.href,
    albumId: album[1],
    sellerAccount: accountMatch ? accountMatch[1] : "",
  };
}

function parseJsonLd(html) {
  const values = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).trim());
      if (Array.isArray(parsed)) values.push(...parsed);
      else if (parsed && Array.isArray(parsed["@graph"])) values.push(...parsed["@graph"]);
      else if (parsed) values.push(parsed);
    } catch {}
  }
  return values;
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtml(match[1]).trim();
  }
  return "";
}

function titleText(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]).replace(/\s+/g, " ").trim() : "";
}

function authorName(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") return String(value.name || value.alternateName || "").trim();
  return "";
}

function productTitle(sourceTitle) {
  return String(sourceTitle || "")
    .split(/\s*\|\s*/)[0]
    .replace(/^[￥¥]\s*\d+(?:\.\d+)?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPrice(...values) {
  for (const value of values) {
    const match = String(value || "").match(/[￥¥]\s*(\d+(?:\.\d+)?)/);
    if (match) return Number(match[1]);
  }
  return null;
}

function extractBatch(title, description) {
  const priceTail = String(title || "").match(/[￥¥]\s*\d+(?:\.\d+)?\s+([^|\s]+(?:-[^|\s]+)*)/);
  if (priceTail && /[a-z]/i.test(priceTail[1]) && /\d/.test(priceTail[1])) return priceTail[1];
  const labelled = String(description || "").match(/(?:batch|style|sku|货号|款号)\s*[:：#-]?\s*([A-Z0-9][A-Z0-9._-]{3,})/i);
  return labelled ? labelled[1] : "";
}

function canonicalBuyUrl(raw) {
  let url;
  try {
    url = new URL(cleanEscapedUrl(raw));
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (/(^|\.)weidian\.(com|cn)$/.test(host)) {
    const itemId =
      url.searchParams.get("itemID") ||
      url.searchParams.get("itemId") ||
      url.searchParams.get("item_id") ||
      (url.pathname.match(/\/item\/(\d{5,})/) || [])[1];
    return itemId && /^\d{5,}$/.test(itemId)
      ? `https://weidian.com/item.html?itemID=${itemId}`
      : null;
  }
  if (/(^|\.)(taobao\.com|tmall\.com)$/.test(host)) return url.href;
  return null;
}

function extractBuyUrl(html, jsonLd) {
  const values = [];
  for (const entry of jsonLd) {
    if (!entry || typeof entry !== "object") continue;
    for (const field of ["url", "sameAs", "description"]) {
      const value = entry[field];
      if (Array.isArray(value)) values.push(...value);
      else if (value) values.push(value);
    }
  }
  const hrefRe = /(?:href|data-url)=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRe.exec(html)) !== null) values.push(match[1]);
  const inlineRe = /https?(?::|\\u003A)(?:\\?\/){2}[^\s"'<>]+/gi;
  while ((match = inlineRe.exec(html)) !== null) values.push(match[0]);
  for (const value of values) {
    const direct = canonicalBuyUrl(value);
    if (direct) return direct;
    const nested = cleanEscapedUrl(value).match(/https?:\/\/[^\s"'<>]+/g) || [];
    for (const candidate of nested) {
      const url = canonicalBuyUrl(candidate.replace(/[),.;]+$/, ""));
      if (url) return url;
    }
  }
  return null;
}

function imageQuality(url) {
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {}
  const file = pathname.split("/").pop() || "";
  if (/^(original|origin|raw)\./.test(file)) return 6;
  if (/^(big|large|large2)\./.test(file)) return 5;
  if (/^medium\./.test(file)) return 4;
  if (/^small\./.test(file)) return 3;
  if (/^(thumb|tiny)\./.test(file)) return 1;
  if (/_(o|b|l)(\.[a-z0-9]+)$/.test(file)) return 5;
  if (/_(m)(\.[a-z0-9]+)$/.test(file)) return 4;
  if (/_(s|t)(\.[a-z0-9]+)$/.test(file)) return 2;
  return 4;
}

function imageIdentity(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (host === "photo.yupoo.com" && parts.length >= 2) return `${parts[0]}/${parts[1]}`.toLowerCase();
    return (host + parsed.pathname)
      .replace(/\/(?:original|origin|raw|big|large2?|medium|small|thumb|tiny)(\.[a-z0-9]+)$/i, "/asset$1")
      .replace(/_(?:o|b|l|m|s|t)(\.[a-z0-9]+)$/i, "$1")
      .toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

// ————— Per-photo tiles —————
// Yupoo album pages wrap each photo in `.showalbum__children.image__main` and
// declare the real pixel size on the <img> (data-width / data-height) plus the
// original file under data-origin-src. Reading tiles instead of scraping loose
// URLs gives three things the flat scrape could not: an honest photo count, a
// size for quality vetting, and a filename for size-chart detection.
function extractPhotoTiles(html, baseUrl) {
  const tiles = [];
  const blockRe = /class="[^"]*\bimage__imagewrap\b[^"]*"[\s\S]{0,1600}?<\/div>/gi;
  const blocks = String(html).match(blockRe) || [];
  for (const block of blocks) {
    const attr = (name) => {
      const m = block.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
      return m ? decodeHtml(m[1]) : "";
    };
    const raw = attr("data-origin-src") || attr("data-src") || attr("src");
    if (!raw) continue;
    let url;
    try {
      url = new URL(cleanEscapedUrl(raw), baseUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:\/\/(?:[^/]*\.)?(?:photo|pic)\.yupoo\.com\//i.test(url) &&
        !/^https?:\/\/photo\.yupoo\.com\//i.test(url)) continue;
    if (!/\.(jpe?g|png|webp|gif)(?:$|\?)/i.test(url)) continue;
    const width = Number(attr("data-width")) || 0;
    const height = Number(attr("data-height")) || 0;
    tiles.push({ url, width, height, alt: attr("alt") });
  }
  // Same identity dedupe the flat scrape uses, keeping the best variant.
  const byIdentity = new Map();
  const ordered = [];
  for (const tile of tiles) {
    const identity = imageIdentity(tile.url);
    const existing = byIdentity.get(identity);
    if (!existing) {
      const record = { ...tile, identity, quality: imageQuality(tile.url) };
      byIdentity.set(identity, record);
      ordered.push(record);
    } else if (imageQuality(tile.url) > existing.quality) {
      existing.url = tile.url;
      existing.quality = imageQuality(tile.url);
    }
  }
  return ordered;
}

/**
 * Is this tile a size chart rather than a product photo?
 * Kyle 2026-07-26: "Don't bring in the sizing chart. Obviously, you want to
 * index the sizing chart… but you don't really care for it if someone is
 * looking through photos."
 * Sellers paste charts as screenshots, so three signals converge: the filename
 * says screenshot or size, the file is a PNG among JPG photos, and the pixel
 * size is far below the album's own photos. Any single strong signal is enough
 * — a wrongly hidden chart still reaches the fit block through chartImages.
 */
function isChartTile(tile, medianEdge) {
  const name = String(tile.alt || tile.url).toLowerCase();
  if (/(size[\s_-]*chart|sizing|measure|尺码|尺寸|规格)/.test(name)) return true;
  const edge = Math.max(tile.width || 0, tile.height || 0);
  if (/screenshot|screen[\s_-]*shot|截图/.test(name)) return true;
  // A pasted table is often much smaller than product photos — any format
  // (JPG charts are common; do not key on PNG-only or aspect ratio).
  if (medianEdge > 0 && edge > 0 && edge < medianEdge * 0.6) return true;
  return false;
}

/**
 * Is this tile good enough to show?
 * Kyle 2026-07-26: "There'll be blank photos… I just think it could look quite
 * sloppy when we don't have good photos in here."
 * Tiles with no declared size pass — an unknown size is not evidence of a bad
 * photo, and dropping them would empty albums that omit the attributes.
 */
function isDecentPhoto(tile) {
  const w = tile.width || 0;
  const h = tile.height || 0;
  if (!w || !h) return true;
  if (Math.max(w, h) < MIN_PHOTO_EDGE) return false;
  const aspect = Math.max(w / h, h / w);
  return aspect <= MAX_PHOTO_ASPECT;
}

function partitionTiles(tiles) {
  const edges = tiles.map((t) => Math.max(t.width || 0, t.height || 0)).filter((n) => n > 0).sort((a, b) => a - b);
  const medianEdge = edges.length ? edges[Math.floor(edges.length / 2)] : 0;
  const gallery = [];
  const charts = [];
  for (const tile of tiles) {
    if (isChartTile(tile, medianEdge)) charts.push(tile);
    else if (isDecentPhoto(tile)) gallery.push(tile);
  }
  return { gallery, charts };
}

function extractImageUrls(html, baseUrl, jsonLd = []) {
  const candidates = [];
  const push = (raw) => {
    if (!raw || typeof raw !== "string") return;
    let absolute;
    try {
      absolute = new URL(cleanEscapedUrl(raw), baseUrl).href;
    } catch {
      return;
    }
    let parsed;
    try {
      parsed = new URL(absolute);
    } catch {
      return;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "s.yupoo.com") return;
    if (!/(^|\.)(photo|pic)\.yupoo\.com$/.test(host) && host !== "photo.yupoo.com") return;
    if (!/\.(jpe?g|png|webp|gif)(?:$|\?)/i.test(absolute)) return;
    candidates.push(absolute);
  };

  for (const entry of jsonLd) {
    if (!entry || typeof entry !== "object") continue;
    const image = entry.image;
    if (Array.isArray(image)) image.forEach((value) => push(typeof value === "string" ? value : value && value.url));
    else push(typeof image === "string" ? image : image && image.url);
  }
  push(metaContent(html, "og:image"));

  const attrRe = /(?:src|data-src|data-url|data-original)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrRe.exec(html)) !== null) push(match[1]);
  const bgRe = /background-image\s*:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgRe.exec(html)) !== null) push(match[1]);
  const inlineRe = /https?(?::|\\u003A)(?:\\?\/){2}[^\s"'<>]+?\.(?:jpe?g|png|webp|gif)(?:\?[^\s"'<>]*)?/gi;
  while ((match = inlineRe.exec(html)) !== null) push(match[0]);

  const ordered = [];
  const byIdentity = new Map();
  for (const url of candidates) {
    const identity = imageIdentity(url);
    const existing = byIdentity.get(identity);
    if (!existing) {
      const record = { identity, url, quality: imageQuality(url) };
      byIdentity.set(identity, record);
      ordered.push(record);
    } else if (imageQuality(url) > existing.quality) {
      existing.url = url;
      existing.quality = imageQuality(url);
    }
  }
  return ordered.slice(0, MAX_IMAGES).map((entry) => entry.url);
}

function extractAlbumMetadata(html, album) {
  const jsonLd = parseJsonLd(html);
  const primary =
    jsonLd.find((entry) => entry && /^(ImageGallery|Product)$/i.test(String(entry["@type"] || ""))) ||
    {};
  const sourceTitle = String(primary.name || metaContent(html, "og:title") || titleText(html)).trim();
  const description = String(
    primary.description || metaContent(html, "description") || metaContent(html, "og:description") || ""
  ).trim();
  const seller =
    authorName(primary.author) ||
    sourceTitle.split(/\s*\|\s*/)[2] ||
    album.sellerAccount;
  const title = productTitle(sourceTitle);
  return {
    url: album.url,
    albumId: album.albumId,
    sourceTitle,
    title,
    seller: String(seller || "").trim(),
    sellerAccount: album.sellerAccount,
    priceCny: extractPrice(sourceTitle, description),
    batch: extractBatch(sourceTitle, description) || (/^[A-Z0-9._-]+$/i.test(title) ? title : ""),
    description,
    buyUrl: extractBuyUrl(html, jsonLd),
    ...albumImages(html, album.requestUrl, jsonLd),
  };
}

/**
 * Split the album into what the gallery shows and what the fit block reads.
 * `images` — vetted product photos, charts removed.
 * `chartImages` — the chart tiles, kept so the size hunt still indexes them.
 * `photoCount` — how many product photos the album actually holds, so the card
 *   can say "30 photos" instead of counting what it managed to store.
 * Falls back to the flat URL scrape when tile parsing finds nothing (older
 * album templates, or markup Yupoo changes later).
 */
function albumImages(html, baseUrl, jsonLd) {
  const tiles = extractPhotoTiles(html, baseUrl);
  if (!tiles.length) {
    const flat = extractImageUrls(html, baseUrl, jsonLd);
    return { images: flat, chartImages: [], photoCount: flat.length };
  }
  const { gallery, charts } = partitionTiles(tiles);
  // Never return an empty gallery because the vetting was too strict.
  // Guard (F 2026-08-01): if every tile is flagged as a chart, keep photo 1
  // as the cover. albumImages falls back to `tiles` when gallery is empty.
  const shown = gallery.length ? gallery : tiles;
  // Tile dims travel with the URLs so the chart hunt can rank small early
  // JPGs without a second album fetch.
  const tileMeta = {};
  for (const t of tiles) {
    if (t && t.url) {
      tileMeta[t.url] = {
        width: t.width || 0,
        height: t.height || 0,
        alt: t.alt || "",
      };
    }
  }
  return {
    images: shown.slice(0, MAX_IMAGES).map((t) => t.url),
    chartImages: charts.slice(0, MAX_CHART_IMAGES).map((t) => t.url),
    tileMeta,
    photoCount: shown.length,
  };
}

async function handle(event) {
  const secret = process.env.CREDENZA_SEARCH_SECRET;
  if (!secret) return response(500, { error: "Server not configured: missing CREDENZA_SEARCH_SECRET" });
  const supplied = event && event.headers && event.headers["x-credenza-key"];
  if (supplied !== secret) return response(401, { error: "Unauthorized" });
  if (!event || event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });
  if (limit.bodyTooLarge(event, ROUTE)) return response(413, { error: "Body too large" });

  let input;
  try {
    input = JSON.parse(event.body || "");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  const album = parseAlbumUrl(input && typeof input.url === "string" ? input.url : "");
  if (!album) return response(422, { error: "Not a Yupoo album URL" });

  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Manual, re-validated redirects + DNS/private-address rejection + a hard
    // size cap — the page fetch used to follow redirects blind and read an
    // unbounded body (Part 3).
    const result = await safeFetch(album.requestUrl, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      hosts: YUPOO_HOST,
    });
    if (!result.ok) throw { status: 502, msg: `Yupoo request failed (${result.status})` };
    const html = (await readCapped(result, MAX_HTML_BYTES)).toString("utf8");
    return response(200, extractAlbumMetadata(html, album));
  } catch (error) {
    if (error && error.name === "AbortError") return response(504, { error: "Timed out" });
    if (error && error.status) return response(error.status, { error: error.msg });
    return response(502, { error: "Fetch failed" });
  } finally {
    clearTimeout(timer);
    limit.leave(ROUTE);
  }
}

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

exports._test = {
  parseAlbumUrl,
  parseJsonLd,
  canonicalBuyUrl,
  extractImageUrls,
  extractAlbumMetadata,
  extractPhotoTiles,
  partitionTiles,
  imageIdentity,
};

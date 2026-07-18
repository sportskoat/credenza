const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const TIMEOUT_MS = 15000;
const MAX_IMAGES = 8;

function response(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
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
  return {
    requestUrl: url.href,
    url: url.origin + url.pathname.replace(/\/+$/, ""),
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
    images: extractImageUrls(html, album.requestUrl, jsonLd),
  };
}

exports.handler = async (event) => {
  const secret = process.env.CREDENZA_SEARCH_SECRET;
  if (!secret) return response(500, { error: "Server not configured: missing CREDENZA_SEARCH_SECRET" });
  const supplied = event && event.headers && event.headers["x-credenza-key"];
  if (supplied !== secret) return response(401, { error: "Unauthorized" });
  if (!event || event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });

  let input;
  try {
    input = JSON.parse(event.body || "");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  const album = parseAlbumUrl(input && typeof input.url === "string" ? input.url : "");
  if (!album) return response(422, { error: "Not a Yupoo album URL" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await fetch(album.requestUrl, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!result.ok) throw { status: 502, msg: `Yupoo request failed (${result.status})` };
    const html = await result.text();
    return response(200, extractAlbumMetadata(html, album));
  } catch (error) {
    if (error && error.name === "AbortError") return response(504, { error: "Timed out" });
    if (error && error.status) return response(error.status, { error: error.msg });
    return response(502, { error: "Fetch failed" });
  } finally {
    clearTimeout(timer);
  }
};

exports._test = {
  parseAlbumUrl,
  parseJsonLd,
  canonicalBuyUrl,
  extractImageUrls,
  extractAlbumMetadata,
  imageIdentity,
};

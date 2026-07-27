// Preview-image relay for Credenza. Given a page URL, fetches it server-side,
// finds the best preview image (og:image and friends), fetches the image with the
// page as Referer (which is what gets past ordinary hotlink protection, e.g.
// Yupoo), and returns the raw bytes. The client downscales and stores them.
// No dependencies — Node's fetch/URL plus the shared guard/limit modules.

const { assertSafeUrl, safeFetch, readCapped } = require("./lib/guard.js");
const limit = require("./lib/limit.js");

const ROUTE = "preview";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 CredenzaPreview/1.0";
const MAX_HTML_BYTES = 1.5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 12000;

// ————— Caching —————
//
// This relay is the single largest Netlify cost driver: one pasted Yupoo album
// used to spend one invocation per image, per customer, every time, because a
// POST is never CDN-cacheable. So the route also answers GET, and a GET hit is
// served by the CDN without waking the function at all.
//
// `durable` puts the response in the shared store, so a hit on ANY edge node
// serves every other node. Popular albums get relayed once for all customers,
// not once per customer.
//
// The cache key is the url + referer pair (Netlify-Vary), NOT the API key
// header. One shared key would make one entry anyway, and leaving it out of
// the key means a hit never has to look at it. The consequence is that a CDN
// hit skips the key check. That is acceptable here and only here: the payload
// is a public product photo from a public album, and the caller must already
// know the exact source URL to name the cache entry.
const IMAGE_CACHE = "public, durable, max-age=604800, stale-while-revalidate=86400";
// A miss that finds nothing is still a full page fetch. Hold the failure
// briefly so a dead image cannot bill us on every retry, but not so long that
// a seller re-uploading a photo stays broken for a week.
const FAILURE_CACHE = "public, durable, max-age=300";
const NO_CACHE = "no-store";
const VARY = "query=url|referer";

function cacheHeaders(cacheControl) {
  if (cacheControl === NO_CACHE) return { "cache-control": NO_CACHE };
  return {
    // Netlify's CDN + the durable store. Browsers ignore this one.
    "netlify-cdn-cache-control": cacheControl,
    // The browser copy. A customer who reopens a haul re-renders from disk.
    "cache-control": "public, max-age=86400",
    "netlify-vary": VARY,
  };
}

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

function imageResponse(buf, mime) {
  return {
    statusCode: 200,
    headers: { "content-type": mime, ...cacheHeaders(IMAGE_CACHE) },
    body: buf.toString("base64"),
    isBase64Encoded: true,
  };
}

// The POST route keeps its original private, short-lived headers. A POST is
// not CDN-cacheable, so promising a week here would only mislead the browser.
function legacyImageResponse(buf, mime) {
  return {
    statusCode: 200,
    headers: { "content-type": mime, "cache-control": "private, max-age=300" },
    body: buf.toString("base64"),
    isBase64Encoded: true,
  };
}

// ————— Image candidate extraction (regex-level; no DOM dependency) —————

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html, nameRe) {
  const tagRe = /<meta\s[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    const key = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    if (!key || !nameRe.test(key[1])) continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i);
    if (content && content[1]) return decodeEntities(content[1]);
  }
  return null;
}

function extractImageCandidates(html, baseUrl) {
  const out = [];
  const push = (v) => {
    if (!v) return;
    try {
      out.push(new URL(decodeEntities(v), baseUrl).href);
    } catch {}
  };
  push(metaContent(html, /^og:image(:url|:secure_url)?$/i));
  push(metaContent(html, /^twitter:image(:src)?$/i));
  const linkImg = html.match(/<link\s[^>]*rel\s*=\s*["']image_src["'][^>]*>/i);
  if (linkImg) {
    const href = linkImg[0].match(/href\s*=\s*["']([^"']+)["']/i);
    if (href) push(href[1]);
  }
  // <img> fallback: prefer ones with big declared dimensions, then the first.
  const imgRe = /<img\s[^>]*>/gi;
  let m;
  let first = null;
  while ((m = imgRe.exec(html)) !== null && out.length < 8) {
    const tag = m[0];
    const src =
      (tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i) ||
        tag.match(/\bdata-original\s*=\s*["']([^"']+)["']/i) ||
        tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) ||
        [])[1];
    if (!src || src.startsWith("data:")) continue;
    if (!first) first = src;
    const w = parseInt((tag.match(/\bwidth\s*=\s*["']?(\d+)/i) || [])[1] || "0", 10);
    const h = parseInt((tag.match(/\bheight\s*=\s*["']?(\d+)/i) || [])[1] || "0", 10);
    if (w >= 300 || h >= 300) push(src);
  }
  if (!out.length && first) push(first);
  return [...new Set(out)];
}

// ————— Image type checks —————

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)/i;

function sniffImageMime(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (buf.slice(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (buf.slice(4, 8).toString("ascii") === "ftyp") return "image/avif";
  return null;
}

async function fetchImage(imgUrl, refererUrl, signal) {
  const res = await safeFetch(imgUrl, {
    headers: {
      "user-agent": UA,
      accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
      referer: refererUrl,
    },
    signal,
  });
  if (!res.ok) throw { status: 502, msg: "Image fetch failed" };
  const buf = await readCapped(res, MAX_IMAGE_BYTES);
  const declared = (res.headers.get("content-type") || "").split(";")[0].trim();
  const mime = IMAGE_TYPES.test(declared) ? declared : sniffImageMime(buf);
  if (!mime || !IMAGE_TYPES.test(mime)) throw { status: 415, msg: "Not a supported image" };
  return { buf, mime };
}

// GET carries the same two fields as the POST body, in the query string, so
// the CDN can key on them. POST stays for compatibility and for anything that
// must bypass the cache.
function readInput(event) {
  const method = (event && event.httpMethod) || "";
  if (method === "GET") {
    const q = (event && event.queryStringParameters) || {};
    return {
      ok: true,
      cacheable: true,
      pageUrl: typeof q.url === "string" ? q.url.trim() : "",
      refererUrl: typeof q.referer === "string" ? q.referer.trim() : "",
    };
  }
  if (method !== "POST") return { ok: false, res: response(405, { error: "Method not allowed" }) };
  if (limit.bodyTooLarge(event, ROUTE)) return { ok: false, res: response(413, { error: "Body too large" }) };
  let input;
  try {
    input = JSON.parse(event.body || "");
  } catch {
    return { ok: false, res: response(400, { error: "Invalid JSON body" }) };
  }
  return {
    ok: true,
    cacheable: false,
    pageUrl: input && typeof input.url === "string" ? input.url.trim() : "",
    refererUrl: input && typeof input.referer === "string" ? input.referer.trim() : "",
  };
}

async function handle(event) {
  const secret = process.env.CREDENZA_SEARCH_SECRET;
  if (!secret) return response(500, { error: "Server not configured: missing CREDENZA_SEARCH_SECRET" });
  const supplied = event && event.headers && event.headers["x-credenza-key"];
  if (supplied !== secret) return response(401, { error: "Unauthorized" });

  const parsed = readInput(event);
  if (!parsed.ok) return parsed.res;
  const { pageUrl, refererUrl, cacheable } = parsed;
  // A failed lookup is only worth caching on the cacheable route.
  const failure = (status, error) =>
    response(status, { error }, cacheable ? cacheHeaders(FAILURE_CACHE) : undefined);
  if (!pageUrl || pageUrl.length > 2048) return response(400, { error: "url must be a non-empty string" });
  if (refererUrl.length > 2048) return response(400, { error: "referer is too long" });

  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Album media can reject hotlinks. An explicit, validated page referer lets
    // Credenza relay a specific gallery image without scraping the page again.
    if (refererUrl) {
      await assertSafeUrl(refererUrl);
      const { buf, mime } = await fetchImage(pageUrl, refererUrl, controller.signal);
      return cacheable ? imageResponse(buf, mime) : legacyImageResponse(buf, mime);
    }

    const pageRes = await safeFetch(pageUrl, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,image/*;q=0.9" },
      signal: controller.signal,
    });
    if (!pageRes.ok) return failure(502, "Page fetch failed (" + pageRes.status + ")");

    const pageType = (pageRes.headers.get("content-type") || "").split(";")[0].trim();

    // The URL itself is an image → relay it directly.
    if (IMAGE_TYPES.test(pageType)) {
      const buf = await readCapped(pageRes, MAX_IMAGE_BYTES);
      return cacheable ? imageResponse(buf, pageType) : legacyImageResponse(buf, pageType);
    }

    const htmlBuf = await readCapped(pageRes, MAX_HTML_BYTES);
    const html = htmlBuf.toString("utf8");
    const candidates = extractImageCandidates(html, pageRes.url || pageUrl);
    if (!candidates.length) return failure(404, "No preview image found");

    let lastErr = null;
    for (const cand of candidates.slice(0, 3)) {
      try {
        const { buf, mime } = await fetchImage(cand, pageUrl, controller.signal);
        return cacheable ? imageResponse(buf, mime) : legacyImageResponse(buf, mime);
      } catch (e) {
        lastErr = e;
      }
    }
    return failure((lastErr && lastErr.status) || 404, (lastErr && lastErr.msg) || "No fetchable preview image");
  } catch (e) {
    // A timeout or a transport failure is about this attempt, not about the
    // URL, so it is never cached — the retry must reach the function.
    if (e && e.name === "AbortError") return response(504, { error: "Timed out" });
    if (e && e.status) return response(e.status, { error: e.msg });
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

// ═══════════════════════════════════════════════════════════════════════════════
// share-image.js — the Open Graph picture for a shared haul at GET /s/:code/img
//
// Why this file exists (LB-39, measured 2026-07-27 against a live album):
//
//   GET https://photo.yupoo.com/huskyreps/00ccbea05a/small.jpg
//     no Referer, browser UA  -> HTTP 567, 7352 bytes of HTML
//     no Referer, Discordbot  -> HTTP 567, 7352 bytes of HTML
//     Referer: the yupoo host -> HTTP 200, 57400 bytes of image/jpeg
//
// share-page.js used to put that raw seller URL straight into <meta og:image>.
// A crawler sends no Referer, so Discord, Slack and Twitter fetched the error
// page instead of the photo and drew a card with no picture. LB-8 calls the
// shared haul "the whole viral loop"; a loop whose card is blank is the loop
// failing quietly, which is the worst way for it to fail.
//
// preview.js already knows how to defeat hotlink protection, but it cannot be
// used here: it demands an x-credenza-key header, and a crawler has no key.
// So this route re-does the one useful part behind a public door, and the door
// is narrow on purpose:
//
//   * The input is a share CODE, not a URL. There is no parameter a caller can
//     point anywhere. That is what keeps this from being an open image proxy.
//   * The code must already exist as a public share. Serving its photo tells a
//     caller nothing that opening /s/<code> would not.
//   * The outbound fetch still goes through safeFetch, so the SSRF guards that
//     cover every other function cover this one too.
//   * A failure is a redirect to the site card, never an error page. A crawler
//     gets one image or the other, and the unfurl is never empty.
// ═══════════════════════════════════════════════════════════════════════════════

const { safeFetch, readCapped } = require("./lib/guard.js");
const limit = require("./lib/limit.js");
const share = require("./lib/share-doc.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");

const ROUTE = "share-image";
const SITE = "https://credenzafashion.com";
const FALLBACK = SITE + "/og.png";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 CredenzaShare/1.0";
const TIMEOUT_MS = 8000;
// Discord refuses to draw a card past about 8 MB and no product photo is close
// to that. The cap is the same one preview.js uses, for the same reason.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// A share never changes once written, so its card picture never changes either.
// `durable` shares the entry across edge nodes: a link dropped into a busy
// Discord costs one origin fetch for every crawler and every visitor, not one
// per node. This is the same bargain PAGE_CACHE makes in share-page.js.
const IMAGE_CACHE = "public, durable, max-age=604800, stale-while-revalidate=86400";
// Hold a failure only briefly. A seller who re-uploads a photo should not stay
// broken for a week, and a deleted share should leave the edge quickly.
const FAILURE_CACHE = "public, durable, max-age=300";

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)/i;

// Bytes, not the declared type. A server that lies about content-type must not
// be able to make us serve HTML as an image.
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

// The last two labels of a host. Crude next to a public-suffix list, and right
// for the only question asked of it: do these two URLs belong to one operator?
// `photo.yupoo.com` and `huskyreps.x.yupoo.com` both answer `yupoo.com`.
function registrable(host) {
  const parts = String(host || "").toLowerCase().split(".");
  return parts.length <= 2 ? parts.join(".") : parts.slice(-2).join(".");
}

// Which Referer gets the photo. Measured against Yupoo: any yupoo.com URL
// passes, and the site's own origin does not — so this cannot be a constant,
// and it cannot be credenzafashion.com.
//
// The seller page the sharer saved is the honest answer, because it is the page
// the photo actually appears on. It only helps when it belongs to the same
// operator as the image, though: a Weidian product link sent as the Referer for
// a Yupoo photo is no better than sending nothing. When they disagree, fall
// back to the image's own origin, which the same measurement shows is enough.
function refererFor(imageUrl, linkUrl) {
  let img;
  try {
    img = new URL(imageUrl);
  } catch {
    return null;
  }
  if (linkUrl) {
    try {
      const link = new URL(linkUrl);
      if (/^https?:$/.test(link.protocol) && registrable(link.hostname) === registrable(img.hostname)) {
        return link.href;
      }
    } catch {
      // A malformed link is not a reason to fail; the origin still works.
    }
  }
  return img.origin + "/";
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim()) && value.trim().length <= 2048;
}

const DATA_URL_RE = /^data:(image\/(?:png|jpeg|jpg|gif|webp|avif));base64,([A-Za-z0-9+/=]+)$/i;

// The picture a crawler should see: the first card that carries one. A data:
// URL counts here, unlike in the old og:image, because this route hands back
// raw bytes and a crawler never sees the URL that produced them. Before this
// existed, a haul built entirely from inline photos fell back to the generic
// site card even though a real photo was sitting in the snapshot.
function pickImage(doc) {
  const items = Array.isArray(doc && doc.items) ? doc.items : [];
  for (const card of items) {
    if (!card || typeof card !== "object") continue;
    const image = typeof card.image === "string" ? card.image.trim() : "";
    if (!image) continue;
    if (DATA_URL_RE.test(image)) return { kind: "data", image };
    if (isHttpUrl(image)) return { kind: "url", image, link: isHttpUrl(card.link) ? card.link.trim() : null };
  }
  return null;
}

function code(event) {
  const q = (event && event.queryStringParameters) || {};
  if (typeof q.code === "string" && q.code) return q.code;
  const path = (event && event.path) || "";
  const m = /\/s\/([^/?#]+)\/img\/?$/.exec(path);
  return m ? decodeURIComponent(m[1]) : "";
}

// Every failure lands here. A 302 to the site card means the crawler still
// draws a picture, so a dead photo costs the share its own image and nothing
// more. Returning 404 would leave the card blank — the exact defect this file
// was written to remove.
function fallback(cache) {
  return {
    statusCode: 302,
    headers: {
      location: FALLBACK,
      "cache-control": "public, max-age=300",
      "netlify-cdn-cache-control": cache,
    },
    body: "",
  };
}

function imageReply(buf, mime) {
  return {
    statusCode: 200,
    headers: {
      "content-type": mime,
      "content-length": String(buf.length),
      "cache-control": "public, max-age=86400",
      "netlify-cdn-cache-control": IMAGE_CACHE,
    },
    body: buf.toString("base64"),
    isBase64Encoded: true,
  };
}

async function handle(event) {
  const env = process.env;
  if (!event || (event.httpMethod !== "GET" && event.httpMethod !== "HEAD")) {
    return { statusCode: 405, headers: { "cache-control": "no-store" }, body: "" };
  }
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[name]) return fallback(FAILURE_CACHE);
  }

  // Shape first, exactly as share-page does it: a walk through random paths
  // must not cost a database query per guess.
  const id = code(event);
  if (!share.isShareCode(id)) return fallback(FAILURE_CACHE);

  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) return fallback(FAILURE_CACHE);

  try {
    const row = await storeFromEnv(env).loadShare(id);
    if (!row) return fallback(FAILURE_CACHE);
    if (share.isExpired(row, Date.now())) return fallback(FAILURE_CACHE);

    // An unlisted share serves the Credenza mark, never an item photo. This
    // route is the one part of a share that answers with no code in the URL
    // path a human ever types — a chat client, a crawler or a link scanner
    // fetches it on its own the moment the link is pasted. Serving the haul's
    // first photo there hands the picture to every one of them. IMAGE_CACHE
    // holds a hit for seven days at the edge, so this is also the one refusal
    // that cannot be taken back later.
    if (row.unlisted) return fallback(IMAGE_CACHE);

    const doc = share.parseShareSnapshot(row.data);
    if (!doc) return fallback(FAILURE_CACHE);

    const picked = pickImage(doc);
    if (!picked) return fallback(IMAGE_CACHE);

    if (picked.kind === "data") {
      const m = DATA_URL_RE.exec(picked.image);
      const buf = Buffer.from(m[2], "base64");
      const mime = sniffImageMime(buf);
      if (!mime) return fallback(FAILURE_CACHE);
      if (buf.length > MAX_IMAGE_BYTES) return fallback(FAILURE_CACHE);
      return imageReply(buf, mime);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await safeFetch(picked.image, {
        headers: {
          "user-agent": UA,
          accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
          referer: refererFor(picked.image, picked.link),
        },
        signal: controller.signal,
      });
      if (!res.ok) return fallback(FAILURE_CACHE);
      const buf = await readCapped(res, MAX_IMAGE_BYTES);
      // The bytes decide, and the declared type is not consulted at all.
      // preview.js prefers the header and sniffs only as a fallback, which is
      // safe there because it answers our own bundle. This route answers
      // Discord, Slack and Twitter, and the thing it fetches is a stranger's
      // server that is actively trying to refuse us. A hotlink block that
      // returns 200 with `content-type: image/jpeg` and a page of HTML would
      // otherwise be published as the card. The sniffer covers every type in
      // IMAGE_TYPES, so nothing real is lost by ignoring the header.
      const mime = sniffImageMime(buf);
      if (!mime || !IMAGE_TYPES.test(mime)) return fallback(FAILURE_CACHE);
      return imageReply(buf, mime);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return fallback(FAILURE_CACHE);
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
    res = fallback(FAILURE_CACHE);
  }
  limit.logOutcome(ROUTE, limit.clientKey(event), res.statusCode, { ms: Date.now() - started });
  return res;
};

// Exported for the tests. Nothing else imports these.
exports._internal = { pickImage, refererFor, registrable, sniffImageMime, code, FALLBACK };

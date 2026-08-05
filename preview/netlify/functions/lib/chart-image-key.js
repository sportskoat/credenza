// Server copy of chartImageKey from components/chart-pipeline.js.
//
// The app module is ESM and this function tree is CommonJS, so the same
// algorithm lives in both places. preview/test/chart-image-key-parity.test.js
// runs BOTH implementations over the same fixture URLs and fails on any
// difference — change one file and that test tells you to change the other.
//
// #40 (Kyle 2026-08-05): the shared chart cache keys on this fingerprint.
// The key is the PHOTO, never the album and never the link: a yupoo album
// holds many items (Kyle: "sometimes Yupoo albums have multiple different
// items of clothing"), and the same chart photo collapses to one key across
// link shapes and CDN size variants.

/**
 * Stable image key used as the content hash for cache reuse.
 * CDN size variants of the same photo collapse to one key. Data URLs hash
 * their payload so two identical customer uploads share one paid read.
 * @param {string} url
 * @returns {string}
 */
function chartImageKey(url) {
  const raw = String(url || "");
  if (!raw) return "";
  if (/^data:image\//i.test(raw)) {
    const comma = raw.indexOf(",");
    const payload = comma >= 0 ? raw.slice(comma + 1) : raw;
    return "data:" + simpleHash(payload);
  }
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    // Yupoo photo CDN: account/album segment is the stable photo identity.
    if (host === "photo.yupoo.com" && parts.length >= 2) {
      return `yupoo:${parts[0]}/${parts[1]}`.toLowerCase();
    }
    const path = (host + parsed.pathname)
      .replace(/\/(?:original|origin|raw|big|large2?|medium|small|thumb|tiny)(\.[a-z0-9]+)$/i, "/asset$1")
      .replace(/_(?:o|b|l|m|s|t)(\.[a-z0-9]+)$/i, "$1")
      .toLowerCase();
    return path;
  } catch {
    return raw.toLowerCase();
  }
}

/** Fast non-crypto hash for data-URL payloads (cache key only, not security). */
function simpleHash(s) {
  let h = 2166136261;
  const str = String(s || "");
  // Sample long payloads so huge base64 frames stay cheap.
  const step = str.length > 8000 ? Math.ceil(str.length / 4000) : 1;
  for (let i = 0; i < str.length; i += step) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16) + ":" + str.length.toString(16);
}

module.exports = { chartImageKey, simpleHash };

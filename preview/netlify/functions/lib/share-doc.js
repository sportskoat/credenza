// ═══════════════════════════════════════════════════════════════════════════════
// share-doc.js — the SERVER side of a share document (LB-8)
//
// `credenza-share.js` at the repo root builds share documents. It is ESM,
// because the browser bundle imports it. Netlify functions are CommonJS
// (netlify/functions/package.json says so), so they cannot require it.
//
// This file is therefore the READER half, restated in CommonJS. It holds no
// build logic — only the checks a public request needs before the page is
// rendered. The two files must agree about the version number, the code
// alphabet, and what counts as a valid document; test/share-parity.test.js
// runs the same fixtures through both and fails when they drift.
// ═══════════════════════════════════════════════════════════════════════════════

// Keep in step with SHARE_DOC_VERSION in credenza-share.js: the NEWEST
// document version. SHARE_DOC_VERSIONS lists every version the reader still
// accepts — v1 shelf shares keep rendering on their frozen copy.
const SHARE_DOC_VERSION = 2;
const SHARE_DOC_VERSIONS = [1, 2];
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SHARE_CODE_LENGTH = 12;
const CODE_RE = new RegExp("^[" + CODE_ALPHABET + "]{" + SHARE_CODE_LENGTH + "}$");

function isShareCode(value) {
  return typeof value === "string" && CODE_RE.test(value);
}

// Returns null for anything we cannot trust. The caller answers 404 rather
// than rendering a half-parsed page: a share written by a newer client than
// this deploy is not a page we know how to draw.
function parseShareSnapshot(raw) {
  let doc = raw;
  if (typeof doc === "string") {
    try {
      doc = JSON.parse(doc);
    } catch {
      return null;
    }
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
  if (!SHARE_DOC_VERSIONS.includes(doc.v)) return null;
  if (!Array.isArray(doc.items)) return null;
  return doc;
}

function isExpired(share, now) {
  if (!share || share.expiresAt == null) return false;
  const at = typeof share.expiresAt === "number" ? share.expiresAt : Date.parse(share.expiresAt);
  if (!Number.isFinite(at)) return false;
  return at <= now;
}

module.exports = {
  SHARE_DOC_VERSION,
  SHARE_DOC_VERSIONS,
  SHARE_CODE_LENGTH,
  CODE_ALPHABET,
  isShareCode,
  parseShareSnapshot,
  isExpired,
};

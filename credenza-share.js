// ═══════════════════════════════════════════════════════════════════════════════
// credenza-share.js — what a shared haul link contains (LB-8)
//
// Pure. No fetch, no DOM, no clock passed in by default that it cannot be
// told about. The snapshot this builds is FROZEN at share time: it is a copy,
// not a live view. Editing the shelf afterwards does not change a link that
// is already in someone's Discord thread, and that is on purpose — a link
// that silently rewrites itself is worse than a stale one.
//
// The single rule that matters here: a field the sharer turned OFF must never
// leave this file. Not hidden by CSS, not sent and ignored — absent from the
// object. The server renders whatever it is given, so if a price reaches the
// snapshot, the price reaches the page.
// ═══════════════════════════════════════════════════════════════════════════════

export const SHARE_DOC_VERSION = 1;

// What the sharer can turn on. Photos and titles are not in this list: they
// are the share. A card with no photo and no title is not worth a link.
export const SHARE_FIELDS = ["prices", "notes", "quality", "sellers", "parcel"];

// Default OFF for everything optional. A person sharing a haul on Reddit is
// showing clothes, not publishing what they paid, who they bought from, or a
// private note. Opting IN to each is a decision; opting out is not something
// we should ask them to remember.
export const DEFAULT_SHARE_FIELDS = Object.freeze({
  prices: false,
  notes: false,
  quality: false,
  sellers: false,
  parcel: false,
});

// A share never carries more than this many cards. A 300-item haul would make
// a page nobody scrolls and a jsonb row nobody should store.
export const SHARE_MAX_ITEMS = 60;

// Hard ceiling on the stored document. Shelf thumbnails are data: URLs, and
// sixty of them would be megabytes. Over the cap, inline images are dropped
// oldest-first — the card stays, it just loses its photo.
export const SHARE_MAX_BYTES = 512 * 1024;

// Unambiguous alphabet: no 0/O, no 1/l/I. A share code gets read aloud and
// typed by hand often enough that the confusable pairs are a real cost.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SHARE_CODE_LENGTH = 12;

// ~60 bits. The code IS the access control — anyone holding it can read the
// page — so it must not be guessable, and it must not come from Math.random.
export function makeShareCode(cryptoImpl = typeof crypto !== "undefined" ? crypto : null) {
  if (!cryptoImpl || typeof cryptoImpl.getRandomValues !== "function") {
    throw new Error("makeShareCode needs a crypto with getRandomValues");
  }
  const bytes = new Uint8Array(SHARE_CODE_LENGTH);
  cryptoImpl.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return out;
}

export function isShareCode(value) {
  return typeof value === "string" && new RegExp("^[" + CODE_ALPHABET + "]{" + SHARE_CODE_LENGTH + "}$").test(value);
}

// Only http(s) survives. A data: image is fine inside our own page but must
// never be treated as a link, and a javascript: URL must never reach an href.
function safeUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.length > 2048 ? null : trimmed;
}

function safeImage(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^data:image\//i.test(trimmed)) return trimmed;
  return safeUrl(trimmed);
}

function text(value, max) {
  if (typeof value !== "string") return "";
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) : clean;
}

// One card, reduced to what the toggles allow. Returns null for a card with
// nothing to show.
function shareItem(item, fields) {
  if (!item || typeof item !== "object") return null;
  const title = text(item.title, 140);
  const image = safeImage(item.image);
  if (!title && !image) return null;

  const card = { title, image };
  const link = safeUrl(item.agentLink) || safeUrl(item.url);
  if (link) card.link = link;
  const size = text(item.size, 24);
  if (size) card.size = size;
  const colorway = text(item.colorway, 40);
  if (colorway) card.colorway = colorway;

  if (fields.prices) {
    const usd = Number(item.priceUsd);
    if (Number.isFinite(usd) && usd > 0) card.priceUsd = Math.round(usd * 100) / 100;
  }
  if (fields.notes) {
    const note = text(item.note, 400);
    if (note) card.note = note;
  }
  if (fields.quality) {
    // The count, never the photos. QC photos are the buyer's own pictures of
    // their own parcel; publishing them by default is not ours to do.
    const count = Array.isArray(item.qcPhotos) ? item.qcPhotos.length : 0;
    if (count) card.qcCount = count;
    const batch = text(item.batch, 60);
    if (batch) card.batch = batch;
  }
  if (fields.sellers) {
    const seller = text(item.seller, 80);
    if (seller) card.seller = seller;
  }
  if (fields.parcel) {
    const grams = Number(item.weightGrams);
    if (Number.isFinite(grams) && grams > 0) card.weightGrams = Math.round(grams);
  }
  return card;
}

function normalizeFields(raw) {
  const fields = { ...DEFAULT_SHARE_FIELDS };
  if (raw && typeof raw === "object") {
    for (const key of SHARE_FIELDS) fields[key] = raw[key] === true;
  }
  return fields;
}

// Drop inline images, oldest last, until the document fits. The card stays —
// losing a photo is a worse page; losing the card is a wrong page.
function fitToBudget(doc, maxBytes) {
  let size = JSON.stringify(doc).length;
  if (size <= maxBytes) return doc;
  const items = doc.items.map((card) => ({ ...card }));
  for (let i = items.length - 1; i >= 0 && size > maxBytes; i--) {
    if (typeof items[i].image === "string" && items[i].image.startsWith("data:image/")) {
      items[i].image = null;
      size = JSON.stringify({ ...doc, items }).length;
    }
  }
  return { ...doc, items };
}

// The frozen document. `now` is injected so a test does not depend on a clock.
export function buildShareSnapshot(items, options = {}) {
  const fields = normalizeFields(options.fields);
  const now = Number(options.now) || 0;
  const list = Array.isArray(items) ? items : [];

  const cards = [];
  for (const item of list) {
    const card = shareItem(item, fields);
    if (card) cards.push(card);
    if (cards.length >= SHARE_MAX_ITEMS) break;
  }

  const doc = {
    v: SHARE_DOC_VERSION,
    title: text(options.title, 80) || "A Credenza haul",
    // The total is a summary of the shared cards, not of the haul. Sending
    // "12 items" on a page showing 6 tells the reader the page is wrong.
    count: cards.length,
    // The cap dropped cards. Say so rather than pretend this is the whole haul.
    truncated: list.length > cards.length,
    fields,
    items: cards,
    createdAt: now,
  };
  if (fields.prices) {
    const total = cards.reduce((sum, card) => sum + (card.priceUsd || 0), 0);
    if (total > 0) doc.totalUsd = Math.round(total * 100) / 100;
  }
  return fitToBudget(doc, Number(options.maxBytes) || SHARE_MAX_BYTES);
}

// Read a stored document back. Returns null for anything we cannot trust —
// the caller answers 404 rather than rendering a half-parsed page.
export function parseShareSnapshot(raw) {
  let doc = raw;
  if (typeof doc === "string") {
    try {
      doc = JSON.parse(doc);
    } catch {
      return null;
    }
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
  if (doc.v !== SHARE_DOC_VERSION) return null;
  if (!Array.isArray(doc.items)) return null;
  return doc;
}

// Has this share run out? A null expiry never expires. Kept here rather than
// in the function so the client can grey out an expired row without asking
// the server.
export function isExpired(share, now) {
  if (!share || share.expiresAt == null) return false;
  const at = typeof share.expiresAt === "number" ? share.expiresAt : Date.parse(share.expiresAt);
  if (!Number.isFinite(at)) return false;
  return at <= now;
}

// The Pro expiry choices, in days. null = never, which is the free behaviour
// and stays available on Pro.
export const SHARE_EXPIRY_DAYS = [1, 7, 30, null];

export function expiryFromDays(days, now) {
  if (days == null) return null;
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return null;
  return now + n * 24 * 60 * 60 * 1000;
}

export function shareUrl(code, origin = "https://credenzafashion.com") {
  return String(origin).replace(/\/+$/, "") + "/s/" + code;
}

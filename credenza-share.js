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

import { fabricSignal } from "./haul-fit-share.js";

export const SHARE_DOC_VERSION = 2;

// Every version the reader still accepts. Version 1 is the shelf share below;
// old links keep their frozen copy and the old renderer (AGENT-NOTES answer
// 4: a layout change needs a new link, the old link never rewrites itself).
export const SHARE_DOC_VERSIONS = Object.freeze([1, 2]);

// The shelf share format is frozen at v1. New haul shares build v2 documents.
const SHELF_DOC_VERSION = 1;

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
    v: SHELF_DOC_VERSION,
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
  if (!SHARE_DOC_VERSIONS.includes(doc.v)) return null;
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

// ═══════════════════════════════════════════════════════════════════════════════
// Haul share documents (v2) — the shared haul page, Review and Receipt.
// Spec: the haul sharing handoff README + AGENT-NOTES.
//
// The same freezing rule as v1, plus the missing-data rule: a stat the old
// haul does not have is ABSENT from the document, never blank, zero, or
// "undefined". The shared page hides every absent cell.
//
// Link routing is money (docs/Monetization.md): storeUrl and albumUrl are the
// RAW store links for the W2C button and the Reddit export; buyUrl is the
// agent link WITH the affiliate code for the Buy button. The two never mix.
// ═══════════════════════════════════════════════════════════════════════════════

// The six include chips on the share sheet, in sheet order.
export const HAUL_SHARE_INCLUDES = ["prices", "w2c", "fit", "sellers", "qc", "weights"];

// Defaults: the first four on, QC photos and weights off (README §4).
export const DEFAULT_HAUL_INCLUDES = Object.freeze({
  prices: true,
  w2c: true,
  fit: true,
  sellers: true,
  qc: false,
  weights: false,
});

export const HAUL_SHARE_LAYOUTS = ["review", "receipt", "both"];

function normalizeIncludes(raw) {
  const includes = { ...DEFAULT_HAUL_INCLUDES };
  if (raw && typeof raw === "object") {
    for (const key of HAUL_SHARE_INCLUDES) includes[key] = raw[key] === true;
  }
  return includes;
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function countWord(n) {
  return n >= 1 && n <= 12 ? NUMBER_WORDS[n] : String(n);
}

// The intro line under the masthead: "Six pieces through Superbuy. Sizes are
// read against my own measurements: 98cm chest, 79cm waist, 178cm." Each
// measurement appears only when the author saved it.
function buildIntro(count, agent, profile) {
  const first = countWord(count) + (count === 1 ? " piece" : " pieces") + (agent ? " through " + agent : "") + ".";
  const parts = [];
  if (profile) {
    const chest = Number(profile.chest);
    const waist = Number(profile.waist);
    const height = Number(profile.height);
    if (Number.isFinite(chest) && chest > 0) parts.push(Math.round(chest) + "cm chest");
    if (Number.isFinite(waist) && waist > 0) parts.push(Math.round(waist) + "cm waist");
    if (Number.isFinite(height) && height > 0) parts.push(Math.round(height) + "cm");
  }
  const sentence = !parts.length ? first : first + " Sizes are read against my own measurements: " + parts.join(", ") + ".";
  // Sentence case: "Six pieces …", "One piece …".
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// One haul item, reduced to what the include chips allow. `review` is the
// author's capture for the item: { note, rebuy, rating, run, photos } — every
// field optional, and unset fields stay ABSENT, never empty strings.
function haulShareItem(item, includes, helpers) {
  if (!item || typeof item !== "object") return null;
  const title = text(item.title, 140);
  // A size chart is not a photo of the item. Keep charts out of the shared
  // page's cover and slideshow (Kyle 2026-08-04: "no images of sizing charts
  // in the slideshow"). share-page.js also filters at render time for docs
  // frozen before this rule.
  const charts = new Set(
    (Array.isArray(item.chartImages) ? item.chartImages : []).map(safeImage).filter(Boolean)
  );
  const listingPhotos = (Array.isArray(item.photos) ? item.photos : [])
    .map(safeImage)
    .filter(Boolean)
    .filter((src) => !charts.has(src))
    .slice(0, 12);
  const cover = safeImage(item.image) || listingPhotos[0] || null;
  if (!title && !cover) return null;

  const card = { title };
  if (cover) card.image = cover;
  if (listingPhotos.length) card.photos = listingPhotos;

  const size = text(item.size, 24);
  if (size) card.size = size;
  const platform = text(item.platform, 24);
  if (platform) card.platform = platform;

  // W2C links: raw store URL + Yupoo album, and the affiliate Buy link.
  if (includes.w2c) {
    const storeUrl = safeUrl(item.url);
    if (storeUrl) card.storeUrl = storeUrl;
    const albumUrl = safeUrl(item.albumUrl);
    if (albumUrl) card.albumUrl = albumUrl;
    const buyUrl = helpers.buyUrlFor ? safeUrl(helpers.buyUrlFor(item)) : null;
    if (buyUrl) card.buyUrl = buyUrl;
  }

  if (includes.prices) {
    const usd = Number(item.priceUsd);
    if (Number.isFinite(usd) && usd > 0) card.priceUsd = round2(usd);
  }
  if (includes.sellers) {
    const seller = text(item.seller, 80);
    if (seller) card.seller = seller;
  }
  if (includes.weights) {
    const grams = Number(item.weightGrams);
    if (Number.isFinite(grams) && grams > 0) {
      card.weightGrams = Math.round(grams);
      const fabric = fabricSignal(grams, helpers.weightKeyFor ? helpers.weightKeyFor(item) : null);
      if (fabric) card.fabric = fabric;
    }
  }
  if (includes.qc) {
    const qcPhotos = (Array.isArray(item.qcPhotos) ? item.qcPhotos : [])
      .map(safeImage)
      .filter(Boolean)
      .slice(0, 8);
    if (qcPhotos.length) card.qcPhotos = qcPhotos;
  }

  // Fit notes: the fit block, the reviewer's note, the rebuy flag, the rating.
  if (includes.fit) {
    const fit = helpers.fitFor ? helpers.fitFor(item) : null;
    if (fit && typeof fit === "object") {
      const clean = {};
      for (const key of ["translation", "short", "roomLine", "advice", "source"]) {
        const value = text(fit[key], 160);
        if (value) clean[key] = value;
      }
      if (Object.keys(clean).length) card.fit = clean;
    }
    const review = item.review && typeof item.review === "object" ? item.review : null;
    if (review) {
      const note = text(review.note, 600);
      if (note) card.note = note;
      if (review.rebuy === true || review.rebuy === false) card.rebuy = review.rebuy;
      const rating = Number(review.rating);
      if (Number.isFinite(rating) && rating >= 1 && rating <= 10) card.rating = Math.round(rating);
      // How the piece ran on the author: "small" | "true" | "large", only
      // when the author answered. Anything else is dropped.
      if (review.run === "small" || review.run === "true" || review.run === "large") {
        card.run = review.run;
      }
      const ownPhotos = (Array.isArray(review.photos) ? review.photos : [])
        .map(safeImage)
        .filter(Boolean)
        .slice(0, 8);
      if (ownPhotos.length) card.ownPhotos = ownPhotos;
    }
  }
  return card;
}

// Over the byte cap, inline (data:) photos go oldest-first, own photos and
// QC photos before listing photos: the listing shots are the share.
function fitHaulToBudget(doc, maxBytes) {
  let size = JSON.stringify(doc).length;
  if (size <= maxBytes) return doc;
  const items = doc.items.map((card) => ({ ...card }));
  const dropInline = (key) => {
    for (let i = items.length - 1; i >= 0 && size > maxBytes; i--) {
      const list = items[i][key];
      if (!Array.isArray(list)) continue;
      const kept = list.filter((url) => typeof url === "string" && !url.startsWith("data:image/"));
      if (kept.length !== list.length) {
        items[i] = { ...items[i], [key]: kept };
        if (!kept.length) delete items[i][key];
        size = JSON.stringify({ ...doc, items }).length;
      }
    }
  };
  dropInline("ownPhotos");
  dropInline("qcPhotos");
  dropInline("photos");
  for (let i = items.length - 1; i >= 0 && size > maxBytes; i--) {
    if (typeof items[i].image === "string" && items[i].image.startsWith("data:image/")) {
      items[i] = { ...items[i], image: null };
      size = JSON.stringify({ ...doc, items }).length;
    }
  }
  return { ...doc, items };
}

/**
 * The frozen v2 document for one fully received haul.
 *
 * @param {Array} items haul item cards; `review` rides each item
 * @param {object} options
 * @param {object} [options.includes] the six chips (defaults: first four on)
 * @param {string} [options.layout] "review" | "receipt" | "both" (default both)
 * @param {string} [options.agent] agent display name, eg "Superbuy"
 * @param {object} [options.ship] { line, costUsd, chargeableG, domesticUsd }
 * @param {string} [options.orderedAt] ISO date the parcel was submitted
 * @param {string} [options.receivedAt] ISO date the parcel arrived
 * @param {object} [options.profile] author measurements in cm
 * @param {function} [options.buyUrlFor] item → agent link with affiliate code
 * @param {function} [options.fitFor] item → buildSharedFit output
 * @param {function} [options.weightKeyFor] item → weight class key, eg "tee"
 */
export function buildHaulShareSnapshot(items, options = {}) {
  const includes = normalizeIncludes(options.includes);
  const now = Number(options.now) || 0;
  const list = Array.isArray(items) ? items : [];
  const layout = HAUL_SHARE_LAYOUTS.includes(options.layout) ? options.layout : "both";
  const agent = text(options.agent, 40);
  const helpers = {
    buyUrlFor: typeof options.buyUrlFor === "function" ? options.buyUrlFor : null,
    fitFor: typeof options.fitFor === "function" ? options.fitFor : null,
    weightKeyFor: typeof options.weightKeyFor === "function" ? options.weightKeyFor : null,
  };

  const cards = [];
  for (const item of list) {
    const card = haulShareItem(item, includes, helpers);
    if (card) cards.push(card);
    if (cards.length >= SHARE_MAX_ITEMS) break;
  }

  const doc = {
    v: SHARE_DOC_VERSION,
    title: text(options.title, 80) || "A Credenza haul",
    count: cards.length,
    truncated: list.length > cards.length,
    layout,
    includes,
    intro: buildIntro(cards.length, agent || null, options.profile || null),
    items: cards,
    createdAt: now,
  };
  if (agent) doc.agent = agent;

  // Haul stats, each present only when the haul actually carries the value.
  const orderedAt = text(options.orderedAt, 40);
  const receivedAt = text(options.receivedAt, 40);
  if (orderedAt) doc.orderedAt = orderedAt;
  if (receivedAt) doc.receivedAt = receivedAt;

  const ship = options.ship && typeof options.ship === "object" ? options.ship : null;
  if (includes.prices) {
    const goodsUsd = cards.reduce((sum, card) => sum + (card.priceUsd || 0), 0);
    if (goodsUsd > 0) doc.goodsUsd = round2(goodsUsd);
    if (ship) {
      const costUsd = Number(ship.costUsd);
      if (Number.isFinite(costUsd) && costUsd > 0) {
        doc.shipUsd = round2(costUsd);
        const line = text(ship.line, 40);
        if (line) doc.shipLine = line;
      }
      const domesticUsd = Number(ship.domesticUsd);
      // Landed only when every part is known. A landed total that silently
      // skips the shipping leg is a wrong number, not a smaller one.
      if (goodsUsd > 0 && Number.isFinite(costUsd) && costUsd > 0) {
        doc.landedUsd = round2(goodsUsd + (Number.isFinite(domesticUsd) ? domesticUsd : 0) + costUsd);
      }
    }
  }
  if (includes.weights && ship) {
    const chargeableG = Number(ship.chargeableG);
    if (Number.isFinite(chargeableG) && chargeableG > 0) doc.chargeableG = Math.round(chargeableG);
  }
  return fitHaulToBudget(doc, Number(options.maxBytes) || SHARE_MAX_BYTES);
}

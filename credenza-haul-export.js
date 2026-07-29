/**
 * credenza-haul-export.js — pure haul → structured JSON (AEO / Pro export kit)
 *
 * No React. No fashion UI imports. Safe to land while other agents edit
 * credenza-fashion.jsx. Wire later via downloadHaulJson(items, prefs).
 *
 * Rules (Monetization.md):
 *  - Export CANONICAL buy / photo URLs only — never agent-wrapped affiliate links.
 *  - This is a personal haul record, not a public W2C catalog.
 *  - Fields are additive; unknown item keys are ignored, never required.
 */

import { normalizeFindStatus } from "./credenza-find-status.js";

/** @typedef {'photos'|'buy'|'alt'|'source'|string} LinkRole */

/**
 * @typedef {object} FashionLink
 * @property {string} url
 * @property {LinkRole} [role]
 */

/**
 * @typedef {object} FashionItem
 * @property {string} [id]
 * @property {string} [title]
 * @property {string} [summary]
 * @property {string} [note]
 * @property {string} [category]
 * @property {string} [batch]
 * @property {string} [seller]
 * @property {string} [sellerUrl]
 * @property {number|null} [price]
 * @property {number|null} [priceUsd]
 * @property {string} [currency]
 * @property {string} [image]
 * @property {string[]} [gallery]
 * @property {FashionLink[]} [links]
 * @property {string} [size]
 * @property {string} [recommendedSize]
 * @property {string} [sizeNotes]
 * @property {string} [findStatus]
 * @property {string} [canonicalKey]
 * @property {number|string} [createdAt]
 * @property {number|string} [updatedAt]
 * @property {boolean} [favorite]
 * @property {string} [sourceUrl]
 */

/**
 * @typedef {object} ExportOptions
 * @property {string} [preferredAgent]
 * @property {string} [measureUnits]
 * @property {number} [maxItems]
 * @property {string} [appVersion]
 * @property {string} [exportedAt] ISO timestamp; default now
 */

/**
 * Pick first link URL matching role (or any buy-ish host if role missing).
 * @param {FashionItem} item
 * @param {LinkRole} role
 * @returns {string|null}
 */
export function linkByRole(item, role) {
  const links = Array.isArray(item.links) ? item.links : [];
  const hit = links.find((l) => l && l.url && l.role === role);
  if (hit) return hit.url;
  return null;
}

/**
 * Canonical marketplace buy URL only — never invent agent wraps.
 * @param {FashionItem} item
 * @returns {string|null}
 */
export function canonicalBuyUrl(item) {
  const buy = linkByRole(item, "buy");
  if (buy) return buy;
  // Some legacy items only have primary in links without role
  const links = Array.isArray(item.links) ? item.links : [];
  for (const l of links) {
    if (!l || !l.url) continue;
    if (/weidian\.com|taobao\.com|tmall\.com|1688\.com/i.test(l.url)) return l.url;
  }
  return null;
}

/**
 * @param {FashionItem} item
 * @returns {string|null}
 */
export function photosUrl(item) {
  return linkByRole(item, "photos");
}

/**
 * Normalize one shelf item into a portable product-like record.
 * @param {FashionItem} item
 * @returns {object}
 */
export function exportItemRecord(item) {
  const buyUrl = canonicalBuyUrl(item);
  const photoAlbum = photosUrl(item);
  const gallery = Array.isArray(item.gallery)
    ? item.gallery.filter((u) => typeof u === "string" && u.length > 0)
    : [];
  const images = [];
  if (item.image) images.push(item.image);
  for (const g of gallery) {
    if (!images.includes(g)) images.push(g);
  }

  const offers =
    item.price != null || item.priceUsd != null
      ? {
          price: item.price != null ? item.price : undefined,
          priceUsd: item.priceUsd != null ? item.priceUsd : undefined,
          currency: item.currency || (item.price != null ? "CNY" : undefined),
          availability: statusToAvailability(item.findStatus),
        }
      : undefined;

  return {
    id: item.id || null,
    name: (item.title || "").trim() || "Untitled",
    description: (item.summary || item.note || "").trim() || null,
    category: item.category || null,
    batch: item.batch || null,
    brandOrSeller: item.seller || null,
    sellerUrl: item.sellerUrl || null,
    canonicalKey: item.canonicalKey || null,
    buyUrl,
    photosUrl: photoAlbum,
    sourceUrl: item.sourceUrl || linkByRole(item, "source"),
    images: images.slice(0, 12),
    size: item.size || null,
    recommendedSize: item.recommendedSize || null,
    sizeNotes: item.sizeNotes ? String(item.sizeNotes).slice(0, 4000) : null,
    status: normalizeFindStatus(item.findStatus),
    favorite: Boolean(item.favorite),
    offers,
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt),
  };
}

/**
 * @param {string|undefined} status
 * @returns {string}
 */
// Order status is bought-or-not since the shelf handoff (2026-07-28). Neither
// answer means the listing went away, so both report InStock. The parameter
// stays for the call site and for the day a real availability signal arrives.
function statusToAvailability(_status) {
  return "https://schema.org/InStock";
}

/**
 * @param {number|string|undefined|null} v
 * @returns {string|null}
 */
function toIso(v) {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Full haul bundle for backup / Pro export / future tool import.
 * @param {FashionItem[]} items
 * @param {ExportOptions} [options]
 * @returns {object}
 */
export function exportHaulBundle(items, options = {}) {
  const list = Array.isArray(items) ? items : [];
  const max = typeof options.maxItems === "number" && options.maxItems > 0
    ? options.maxItems
    : list.length;
  const slice = list.slice(0, max);
  const products = slice.map(exportItemRecord);

  return {
    schema: "https://credenza.app/schema/haul-export-v1",
    schemaVersion: 1,
    generatedBy: "credenza-haul-export",
    appVersion: options.appVersion || null,
    exportedAt: options.exportedAt || new Date().toISOString(),
    context: {
      preferredAgent: options.preferredAgent || null,
      measureUnits: options.measureUnits || null,
      itemCount: products.length,
      truncated: list.length > products.length,
      sourceItemCount: list.length,
    },
    disclaimer:
      "Personal haul export. Canonical marketplace URLs only — not agent affiliate links. Not a public product catalog.",
    products,
  };
}

// ————— CSV (LB-10) ——————————————————————————————————————————————————————————
//
// The JSON bundle above is for a tool. This is for a person opening Numbers,
// Excel or Google Sheets. Three separate hazards, and RFC 4180 only covers the
// first:
//
//  1. Quoting. A field carrying a comma, a quote, a CR or an LF must be
//     wrapped in quotes, and an embedded quote must be doubled.
//  2. Formula injection. A cell starting with = + - @ is EXECUTED by Excel
//     and Sheets, quoted or not. Seller names and titles are scraped text we
//     do not control, so every text field is neutralised first.
//  3. Encoding. Excel reads a BOM-less file as the local codepage, so a CJK
//     seller name arrives as mojibake. CSV_BOM below is prepended at download.

/** Byte-order mark. Excel needs it to read the file as UTF-8. */
export const CSV_BOM = "\uFEFF";

/** RFC 4180 says CRLF between records. */
const CSV_EOL = "\r\n";

/**
 * Column order for the shelf CSV. Header text is what a person reads in the
 * spreadsheet; `key` matches the row objects csvRowForItem builds.
 */
export const CSV_COLUMNS = [
  { key: "title", header: "Title" },
  { key: "haul", header: "Haul" },
  { key: "status", header: "Status" },
  { key: "seller", header: "Seller" },
  { key: "size", header: "Size" },
  { key: "recommendedSize", header: "Recommended size" },
  { key: "price", header: "Price" },
  { key: "currency", header: "Currency" },
  { key: "priceUsd", header: "Price USD" },
  { key: "weightGrams", header: "Weight (g)" },
  { key: "buyUrl", header: "Buy link" },
  { key: "photosUrl", header: "Photos link" },
  { key: "sourceUrl", header: "Source link" },
  { key: "notes", header: "Notes" },
  { key: "addedAt", header: "Added" },
];

// A cell Excel and Sheets treat as a formula rather than as text. The minus is
// in the list, so numbers are checked before this runs — see csvCell.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell: neutralise, then quote if the content needs it.
 * @param {unknown} value
 * @returns {string}
 */
export function csvCell(value) {
  if (value == null) return "";
  let s = typeof value === "string" ? value : String(value);
  if (s === "") return "";
  // A real number is safe and must stay a number, or the spreadsheet cannot
  // total a price column. Everything else that opens like a formula gets a
  // leading apostrophe, which both Excel and Sheets read as "this is text".
  if (FORMULA_START.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * Flatten one shelf item into the CSV row shape.
 *
 * `statusLabels` is passed in rather than copied here on purpose: the labels
 * live in credenza-fashion.jsx (FIND_STATUS_LONG) and a second copy would
 * drift. No map means the raw enum value ships, which is still correct.
 *
 * @param {FashionItem & {project?: string, weightGrams?: number}} item
 * @param {{ statusLabels?: Record<string,string>, weightFor?: (item: object) => number|null }} [options]
 * @returns {Record<string, string|number|null>}
 */
export function csvRowForItem(item, options = {}) {
  const rec = exportItemRecord(item);
  const labels = options.statusLabels || null;
  const status = normalizeFindStatus(item.findStatus);
  // weightFor lets the app hand in its own estimator (weight-estimate.js).
  // Without one, only a manual override is reported — never a guess this
  // module invented.
  const weight =
    typeof options.weightFor === "function"
      ? options.weightFor(item)
      : Number.isFinite(Number(item.weightGrams)) && Number(item.weightGrams) > 0
        ? Math.round(Number(item.weightGrams))
        : null;

  return {
    title: rec.name,
    haul: typeof item.project === "string" ? item.project.trim() : "",
    status: labels && labels[status] ? labels[status] : status,
    seller: rec.brandOrSeller || "",
    size: rec.size || "",
    recommendedSize: rec.recommendedSize || "",
    price: rec.offers && rec.offers.price != null ? rec.offers.price : "",
    currency: rec.offers && rec.offers.currency ? rec.offers.currency : "",
    priceUsd: rec.offers && rec.offers.priceUsd != null ? rec.offers.priceUsd : "",
    weightGrams: Number.isFinite(weight) && weight > 0 ? Math.round(weight) : "",
    buyUrl: rec.buyUrl || "",
    photosUrl: rec.photosUrl || "",
    sourceUrl: rec.sourceUrl || "",
    notes: rec.description || "",
    addedAt: rec.createdAt ? rec.createdAt.slice(0, 10) : "",
  };
}

/**
 * The whole shelf as one RFC 4180 document. No BOM — downloadHaulCsv adds it.
 * @param {FashionItem[]} items
 * @param {{ statusLabels?: Record<string,string>, weightFor?: (item: object) => number|null, maxItems?: number }} [options]
 * @returns {string}
 */
export function haulToCsv(items, options = {}) {
  const list = Array.isArray(items) ? items : [];
  const max =
    typeof options.maxItems === "number" && options.maxItems > 0 ? options.maxItems : list.length;
  const lines = [CSV_COLUMNS.map((c) => csvCell(c.header)).join(",")];
  for (const item of list.slice(0, max)) {
    const row = csvRowForItem(item, options);
    lines.push(CSV_COLUMNS.map((c) => csvCell(row[c.key])).join(","));
  }
  // Trailing EOL: some importers drop the last record without it.
  return lines.join(CSV_EOL) + CSV_EOL;
}

/**
 * Browser helper: trigger a CSV download. Returns the document either way, so
 * a non-DOM caller (a test) gets the same string the browser would save.
 * @param {FashionItem[]} items
 * @param {{ statusLabels?: Record<string,string>, weightFor?: (item: object) => number|null, maxItems?: number, exportedAt?: string }} [options]
 * @param {string} [filename]
 * @returns {string}
 */
export function downloadHaulCsv(items, options = {}, filename) {
  const csv = haulToCsv(items, options);
  const day = (options.exportedAt || new Date().toISOString()).slice(0, 10);
  const name = filename || `credenza-shelf-${day}.csv`;
  if (typeof document === "undefined" || typeof Blob === "undefined") return csv;
  // text/csv, not text/plain: Safari otherwise opens the file in a tab.
  const blob = new Blob([CSV_BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return csv;
}

/**
 * Browser helper: trigger a JSON download. No-op-ish in non-DOM envs.
 * @param {FashionItem[]} items
 * @param {ExportOptions} [options]
 * @param {string} [filename]
 */
export function downloadHaulJson(items, options = {}, filename) {
  const bundle = exportHaulBundle(items, options);
  const name =
    filename ||
    `credenza-haul-${(bundle.exportedAt || "").slice(0, 10) || "export"}.json`;
  if (typeof document === "undefined" || typeof Blob === "undefined") {
    return bundle;
  }
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return bundle;
}

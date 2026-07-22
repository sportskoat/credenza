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
    status: item.findStatus || "want",
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
function statusToAvailability(status) {
  if (status === "returned" || status === "rl") return "https://schema.org/Discontinued";
  if (status === "shipped" || status === "bought" || status === "gl" || status === "qc") {
    return "https://schema.org/InStock";
  }
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

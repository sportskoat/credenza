/**
 * weight-estimate.js — pure ship-weight estimator for haul planning.
 * No DOM. No network. Spec: docs/pure-layer-exhaustiveness-plan.md §5.
 *
 * Mid value priority (first match wins):
 * 1. Manual item.weightGrams override
 * 2. Listing / notes text parse (or item.listingWeightGrams)
 * 3. Title / notes keyword subcategory band
 * 4. Category default band
 * 5. Unknown → null mid (do not invent)
 *
 * Always treat grams as a planning aid. Agent warehouse weight wins later.
 */

import { extractWeightGramsFromText } from "./listing-facts.js";

/** Fixed box mass removed when packNoShoebox is true (research default). */
export const SHOEBOX_GRAMS = 400;

/**
 * Subcategory mid / low / high grams. Always show with ~ in product UI.
 * Keys are stable fixture ids — do not rename without updating fixtures.
 */
export const WEIGHT_BANDS = {
  tee: { mid: 200, low: 150, high: 280 },
  heavy_tee: { mid: 280, low: 220, high: 360 },
  hoodie: { mid: 650, low: 450, high: 900 },
  heavy_hoodie: { mid: 850, low: 650, high: 1100 },
  crewneck: { mid: 450, low: 350, high: 600 },
  shirt_woven: { mid: 250, low: 180, high: 350 },
  denim_jacket: { mid: 900, low: 700, high: 1200 },
  puffer: { mid: 900, low: 600, high: 1400 },
  light_jacket: { mid: 500, low: 350, high: 700 },
  jeans: { mid: 700, low: 550, high: 900 },
  sweatpants: { mid: 500, low: 400, high: 700 },
  shorts: { mid: 300, low: 200, high: 450 },
  low_sneaker: { mid: 900, low: 700, high: 1100 },
  boot: { mid: 1400, low: 1100, high: 1800 },
  slide: { mid: 350, low: 250, high: 500 },
  cap: { mid: 120, low: 80, high: 180 },
  belt: { mid: 200, low: 120, high: 300 },
  backpack: { mid: 900, low: 600, high: 1400 },
  crossbody: { mid: 400, low: 250, high: 600 },
  socks_pair: { mid: 80, low: 50, high: 120 },
  other: { mid: 300, low: 150, high: 600 },
};

/** Map current product category ids → default weight band key. */
export const CATEGORY_TO_WEIGHT_KEY = {
  shirt: "tee",
  outerwear: "light_jacket",
  pants: "jeans",
  shorts: "shorts",
  shoes: "low_sneaker",
  accessory: "belt",
  socks: "socks_pair",
  bag: "backpack",
  hat: "cap",
  other: "other",
};

const SHOE_KEYS = new Set(["low_sneaker", "boot", "slide"]);

/**
 * Parse a ship weight from free text. Reuses listing-facts extract.
 * @param {string} text
 * @returns {{ grams: number, raw: string } | null}
 */
export function parseWeightFromText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return null;
  const grams = extractWeightGramsFromText(raw);
  if (grams == null) return null;
  return { grams, raw: raw.trim().slice(0, 120) };
}

/**
 * Pick a subcategory key from title / notes + optional category.
 * Keyword hits beat the coarse category default.
 * @param {string} text
 * @param {string} [category]
 * @returns {string | null} key in WEIGHT_BANDS or null
 */
export function refineWeightKeyFromText(text, category = "") {
  const src = String(text || "").toLowerCase();
  const cat = String(category || "").toLowerCase();

  // Shoes first (title often wins over a wrong category).
  if (/\b(boot|boots|马丁靴|工装靴)\b/i.test(src) || /靴/.test(src)) return "boot";
  if (/\b(slide|slides|sandal|sandals|flip[\s-]?flop|yeezy\s*slide|拖鞋)\b/i.test(src)) {
    return "slide";
  }
  if (
    /\b(sneaker|sneakers|jordan|dunk|air\s*force|af1|nb\s*\d|new\s*balance|yeezy|鞋)\b/i.test(src) ||
    cat === "shoes"
  ) {
    // Fall through to low_sneaker unless a more specific shoe hit above.
    if (/\b(boot|boots)\b/i.test(src)) return "boot";
    if (cat === "shoes" || /\b(sneaker|sneakers|jordan|dunk|af1|yeezy|鞋)\b/i.test(src)) {
      return "low_sneaker";
    }
  }

  // Outer / tops
  if (/\b(heavy\s*weight|heavyweight|450g|500g\s*hoodie|重磅)\b/i.test(src) && /\b(hoodie|hooded|卫衣)\b/i.test(src)) {
    return "heavy_hoodie";
  }
  if (/\b(hoodie|hooded|zip[\s-]?up|卫衣|帽衫)\b/i.test(src)) return "hoodie";
  if (/\b(crewneck|crew\s*neck|sweatshirt|圆领)\b/i.test(src)) return "crewneck";
  if (/\b(denim\s*jacket|jean\s*jacket|牛仔夹克|truck\s*jacket)\b/i.test(src)) return "denim_jacket";
  if (/\b(puffer|down\s*jacket|羽绒服|pad+ed)\b/i.test(src)) return "puffer";
  if (/\b(windbreaker|shell\s*jacket|light\s*jacket|防风|冲锋衣)\b/i.test(src)) {
    return "light_jacket";
  }
  if (/\b(heavy\s*tee|heavyweight\s*tee|厚\s*tee|重磅\s*t)\b/i.test(src)) return "heavy_tee";
  if (/\b(t[\s-]?shirt|tee\b|短袖)\b/i.test(src)) return "tee";
  if (/\b(button[\s-]?up|oxford|woven|衬衫)\b/i.test(src)) return "shirt_woven";

  // Bottoms
  if (/\b(jean|jeans|denim\s*pant|牛仔裤)\b/i.test(src)) return "jeans";
  if (/\b(sweatpants?|joggers?|fleece\s*pants?|运动裤|卫裤)\b/i.test(src)) return "sweatpants";
  if (/\b(short|shorts|短裤)\b/i.test(src) || cat === "shorts") return "shorts";

  // Accessories / bags
  if (/\b(backpack|书包装|双肩)\b/i.test(src) || cat === "bag") return "backpack";
  if (/\b(crossbody|sling|messenger|胸包|斜挎)\b/i.test(src)) return "crossbody";
  if (/\b(belt|腰带|皮带)\b/i.test(src)) return "belt";
  if (/\b(cap|hat|beanie|棒球帽|帽子)\b/i.test(src) || cat === "hat") return "cap";
  if (/\b(socks?|袜)\b/i.test(src) || cat === "socks") return "socks_pair";

  // Category defaults when no keyword hit.
  if (cat && CATEGORY_TO_WEIGHT_KEY[cat]) return CATEGORY_TO_WEIGHT_KEY[cat];
  return null;
}

function joinItemText(item) {
  return [
    item?.title,
    item?.summary,
    item?.sizeNotes,
    item?.note,
    item?.rawText,
    item?.batch,
  ]
    .filter(Boolean)
    .join(" ");
}

function bandResult(key, source, confidence, reason) {
  const band = WEIGHT_BANDS[key];
  if (!band) {
    return {
      grams: null,
      lowGrams: null,
      highGrams: null,
      source: "unknown",
      confidence: "low",
      reason: "No weight band for this item",
      key: null,
    };
  }
  return {
    grams: band.mid,
    lowGrams: band.low,
    highGrams: band.high,
    source,
    confidence,
    reason,
    key,
  };
}

function applyShoebox(result, packNoShoebox) {
  if (!packNoShoebox) return result;
  if (!result.key || !SHOE_KEYS.has(result.key)) return result;
  if (result.source === "override" || result.source === "listing") return result;
  const cut = SHOEBOX_GRAMS;
  const grams = Math.max(80, (result.grams || 0) - cut);
  const lowGrams = Math.max(50, (result.lowGrams || 0) - cut);
  const highGrams = Math.max(grams, (result.highGrams || 0) - cut);
  return {
    ...result,
    grams,
    lowGrams,
    highGrams,
    reason: `${result.reason}; no shoebox (−${cut} g)`,
  };
}

/**
 * Estimate planning ship weight for one item.
 * @param {object} item
 * @param {{ packNoShoebox?: boolean }} [opts]
 * @returns {{
 *   grams: number|null,
 *   lowGrams: number|null,
 *   highGrams: number|null,
 *   source: "override"|"listing"|"title"|"category"|"unknown",
 *   confidence: "high"|"mid"|"low",
 *   reason: string,
 *   key: string|null
 * }}
 */
export function estimateItemWeight(item, opts = {}) {
  const packNoShoebox =
    opts.packNoShoebox === true || item?.packNoShoebox === true || item?.parcel?.packNoShoebox === true;

  // 1. Manual override
  const override = Number(item?.weightGrams);
  if (Number.isFinite(override) && override > 0) {
    const g = Math.round(override);
    return {
      grams: g,
      lowGrams: g,
      highGrams: g,
      source: "override",
      confidence: "high",
      reason: "Manual weight",
      key: refineWeightKeyFromText(joinItemText(item), item?.category) || null,
    };
  }

  // 2. Explicit listing weight from resolve (future) or text parse
  const listingNum = Number(item?.listingWeightGrams);
  if (Number.isFinite(listingNum) && listingNum > 0 && listingNum <= 20000) {
    const g = Math.round(listingNum);
    const pad = Math.max(20, Math.round(g * 0.1));
    return applyShoebox(
      {
        grams: g,
        lowGrams: Math.max(20, g - pad),
        highGrams: g + pad,
        source: "listing",
        confidence: "high",
        reason: "Listing weight",
        key: refineWeightKeyFromText(joinItemText(item), item?.category) || null,
      },
      packNoShoebox
    );
  }

  const text = joinItemText(item);
  const parsed = parseWeightFromText(text);
  if (parsed) {
    const g = parsed.grams;
    const pad = Math.max(20, Math.round(g * 0.1));
    return applyShoebox(
      {
        grams: g,
        lowGrams: Math.max(20, g - pad),
        highGrams: g + pad,
        source: "listing",
        confidence: "high",
        reason: "Weight found in notes or title",
        key: refineWeightKeyFromText(text, item?.category) || null,
      },
      packNoShoebox
    );
  }

  // 3–4. Keyword refine, then category default
  const key = refineWeightKeyFromText(text, item?.category);
  if (key && WEIGHT_BANDS[key]) {
    const fromTitle = Boolean(text && refineWeightKeyFromText(text, "") === key);
    const source = fromTitle ? "title" : item?.category ? "category" : "title";
    const confidence = fromTitle ? "mid" : "low";
    const reason = fromTitle
      ? `Keyword band: ${key}`
      : `Category band: ${item?.category || key}`;
    return applyShoebox(bandResult(key, source, confidence, reason), packNoShoebox);
  }

  return {
    grams: null,
    lowGrams: null,
    highGrams: null,
    source: "unknown",
    confidence: "low",
    reason: "No weight signal",
    key: null,
  };
}

/**
 * Mid grams for haul sums. Null when unknown.
 * Does not invent a fake category when estimate is unknown.
 * @param {object} item
 * @param {{ packNoShoebox?: boolean }} [opts]
 */
export function estimateItemWeightGrams(item, opts) {
  const est = estimateItemWeight(item, opts);
  return est.grams;
}

/**
 * Sum planning weights for a haul. Skips returned items.
 * @param {object[]} items
 * @param {{ packNoShoebox?: boolean }} [opts]
 */
export function estimateHaulWeightGrams(items, opts) {
  let sum = 0;
  let known = false;
  // Every card on the haul counts. The "returned" skip left with the order
  // pipeline (shelf handoff 2026-07-28): a card is on the shelf, or deleted.
  for (const it of items || []) {
    const w = estimateItemWeightGrams(it, opts);
    if (w != null) {
      sum += w;
      known = true;
    }
  }
  return known ? sum : null;
}

/**
 * Display helper. Always uses ~. Empty when unknown.
 * @param {{ grams?: number|null, lowGrams?: number|null, highGrams?: number|null } | number | null} est
 * @returns {string}
 */
export function formatWeightEstimate(est) {
  if (est == null) return "";
  if (typeof est === "number") {
    if (!Number.isFinite(est) || est <= 0) return "";
    if (est < 1000) return "~" + Math.round(est) + " g";
    return "~" + Math.round(est / 100) / 10 + " kg";
  }
  const mid = Number(est.grams);
  if (!Number.isFinite(mid) || mid <= 0) return "";
  const low = Number(est.lowGrams);
  const high = Number(est.highGrams);
  const fmt = (g) => (g < 1000 ? Math.round(g) + " g" : Math.round(g / 100) / 10 + " kg");
  if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > low && (high - low) / mid > 0.05) {
    return "~" + fmt(mid) + " (" + fmt(low) + "–" + fmt(high) + ")";
  }
  return "~" + fmt(mid);
}

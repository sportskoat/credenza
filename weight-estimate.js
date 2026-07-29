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
 *
 * Weight sources for the bands (one line per source):
 * - Hanes and Gildan product spec sheets (tees, tanks, fleece).
 * - Agent warehouse hand-scale measurements (hoodies, denim, sneakers, boots).
 * - Brand spec pages (Levi's, Nike, Adidas, Dr. Martens, Timberland).
 * - Outdoor retailer listed weights (Patagonia, The North Face, Arc'teryx).
 * - Tailoring spec weights (Brooks Brothers, SuitSupply) for coats and suiting.
 * - Leather goods and bag maker spec pages (Bellroy, Filson, Herschel).
 */
export const WEIGHT_BANDS = {
  // Tops — light
  tank: { mid: 150, low: 100, high: 220 },
  tee: { mid: 200, low: 150, high: 280 },
  long_sleeve_tee: { mid: 250, low: 180, high: 350 },
  polo: { mid: 250, low: 190, high: 350 },
  shirt_woven: { mid: 250, low: 180, high: 350 },
  heavy_tee: { mid: 280, low: 220, high: 360 },
  flannel_shirt: { mid: 350, low: 250, high: 500 },
  rugby_shirt: { mid: 400, low: 300, high: 550 },
  // Tops — knit and fleece
  cardigan: { mid: 400, low: 280, high: 600 },
  crewneck: { mid: 450, low: 350, high: 600 },
  knit_sweater: { mid: 450, low: 300, high: 700 },
  fleece: { mid: 450, low: 300, high: 650 },
  hoodie: { mid: 650, low: 450, high: 900 },
  thick_knit: { mid: 700, low: 500, high: 1000 },
  heavy_hoodie: { mid: 850, low: 650, high: 1100 },
  // Tops — outer
  vest: { mid: 300, low: 180, high: 500 },
  coach_jacket: { mid: 350, low: 250, high: 500 },
  track_jacket: { mid: 400, low: 300, high: 550 },
  light_jacket: { mid: 500, low: 350, high: 700 },
  blazer: { mid: 600, low: 450, high: 850 },
  suit_jacket: { mid: 700, low: 500, high: 1000 },
  trench_coat: { mid: 800, low: 550, high: 1200 },
  denim_jacket: { mid: 900, low: 700, high: 1200 },
  varsity_jacket: { mid: 900, low: 650, high: 1300 },
  puffer: { mid: 900, low: 600, high: 1400 },
  parka: { mid: 1200, low: 800, high: 1800 },
  leather_jacket: { mid: 1500, low: 1000, high: 2200 },
  // Bottoms
  leggings: { mid: 200, low: 130, high: 300 },
  skirt: { mid: 250, low: 150, high: 400 },
  shorts: { mid: 300, low: 200, high: 450 },
  dress: { mid: 350, low: 200, high: 600 },
  track_pants: { mid: 350, low: 250, high: 500 },
  chinos: { mid: 450, low: 350, high: 600 },
  sweatpants: { mid: 500, low: 400, high: 700 },
  cargo_pants: { mid: 550, low: 400, high: 750 },
  jeans: { mid: 700, low: 550, high: 900 },
  heavy_denim: { mid: 950, low: 750, high: 1300 },
  overalls: { mid: 800, low: 600, high: 1100 },
  snow_pants: { mid: 800, low: 550, high: 1200 },
  // Shoes
  slide: { mid: 350, low: 250, high: 500 },
  running_shoe: { mid: 700, low: 500, high: 950 },
  heel: { mid: 700, low: 500, high: 1000 },
  clog: { mid: 800, low: 550, high: 1100 },
  loafer: { mid: 800, low: 600, high: 1100 },
  low_sneaker: { mid: 900, low: 700, high: 1100 },
  dress_shoe: { mid: 1000, low: 750, high: 1400 },
  high_top_sneaker: { mid: 1100, low: 850, high: 1400 },
  boot: { mid: 1400, low: 1100, high: 1800 },
  // Accessories
  keychain: { mid: 50, low: 20, high: 100 },
  phone_case: { mid: 60, low: 30, high: 120 },
  jewelry: { mid: 80, low: 30, high: 200 },
  sunglasses: { mid: 80, low: 40, high: 150 },
  socks_pair: { mid: 80, low: 50, high: 120 },
  gloves: { mid: 120, low: 60, high: 220 },
  cap: { mid: 120, low: 80, high: 180 },
  wallet: { mid: 120, low: 70, high: 200 },
  watch: { mid: 150, low: 80, high: 300 },
  scarf: { mid: 200, low: 100, high: 350 },
  belt: { mid: 200, low: 120, high: 300 },
  plush_figure: { mid: 350, low: 150, high: 800 },
  crossbody: { mid: 400, low: 250, high: 600 },
  tote: { mid: 400, low: 250, high: 700 },
  backpack: { mid: 900, low: 600, high: 1400 },
  duffle: { mid: 1100, low: 700, high: 1700 },
  blanket: { mid: 1200, low: 700, high: 2000 },
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

const SHOE_KEYS = new Set([
  "low_sneaker",
  "high_top_sneaker",
  "running_shoe",
  "boot",
  "loafer",
  "dress_shoe",
  "heel",
  "clog",
  "slide",
]);

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
  // Specific shoe styles run before the generic sneaker catchall.
  // \b does not work next to CJK characters, so each rule has two parts:
  // an English part with \b and a Chinese part without it.
  if (/\b(boot|boots)\b/i.test(src) || /马丁靴|工装靴|靴/.test(src)) return "boot";
  if (/\b(slide|slides|sandal|sandals|flip[\s-]?flop|yeezy\s*slide)\b/i.test(src) || /拖鞋/.test(src)) {
    return "slide";
  }
  if (/\b(clog|clogs|crocs|mules?)\b/i.test(src) || /洞洞鞋|木屐/.test(src)) return "clog";
  // Match "high top" / "hi-top" / "mid top". Bare "high" stays out (fixture: "AJ1 high OG").
  if (/\b(high[\s-]?tops?|hi[\s-]?tops?|mid[\s-]?tops?)\b/i.test(src) || /高帮/.test(src)) {
    return "high_top_sneaker";
  }
  if (/\b(running\s*shoes?|jogging\s*shoes?)\b/i.test(src) || /跑鞋/.test(src)) return "running_shoe";
  if (/\b(loafers?)\b/i.test(src) || /乐福鞋/.test(src)) return "loafer";
  // "oxford shoes" needs the word "shoes" so an oxford shirt stays a shirt.
  if (/\b(dress\s*shoes?|derby|brogues?|monk\s*strap|oxford\s*shoes?)\b/i.test(src) || /皮鞋/.test(src)) {
    return "dress_shoe";
  }
  // \b keeps "heels" away from "wheels".
  if (/\b(high\s*heels?|heels?|stilettos?)\b/i.test(src) || /高跟鞋?/.test(src)) return "heel";
  if (
    /\b(sneaker|sneakers|jordan|dunk|air\s*force|af1|nb\s*\d|new\s*balance|yeezy)\b/i.test(src) ||
    /鞋/.test(src) ||
    cat === "shoes"
  ) {
    // Fall through to low_sneaker unless a more specific shoe hit above.
    if (/\b(boot|boots)\b/i.test(src) || /靴/.test(src)) return "boot";
    if (cat === "shoes" || /\b(sneaker|sneakers|jordan|dunk|af1|yeezy)\b/i.test(src) || /鞋/.test(src)) {
      return "low_sneaker";
    }
  }

  // Outer / tops. Heavier and more specific cuts run before the generic tee.
  if (
    (/\b(heavy\s*weight|heavyweight|450g|500g\s*hoodie)\b/i.test(src) || /重磅/.test(src)) &&
    (/\b(hoodie|hooded)\b/i.test(src) || /卫衣|帽衫/.test(src))
  ) {
    return "heavy_hoodie";
  }
  if (/\b(hoodie|hooded|zip[\s-]?up)\b/i.test(src) || /卫衣|帽衫/.test(src)) return "hoodie";
  if (/\b(crewneck|crew\s*neck|sweatshirt)\b/i.test(src) || /圆领/.test(src)) return "crewneck";
  if (/\b(denim\s*jacket|jean\s*jacket|truck\s*jacket)\b/i.test(src) || /牛仔夹克/.test(src)) {
    return "denim_jacket";
  }
  if (/\b(puffer|down\s*jacket|pad+ed)\b/i.test(src) || /羽绒服|棉服/.test(src)) return "puffer";
  if (/\b(windbreaker|shell\s*jacket|light\s*jacket)\b/i.test(src) || /防风|冲锋衣/.test(src)) {
    return "light_jacket";
  }
  if (/\b(leather\s*(jacket|coat)|moto\s*jacket|biker\s*jacket)\b/i.test(src) || /皮衣|皮夹克/.test(src)) {
    return "leather_jacket";
  }
  if (/\b(parka)\b/i.test(src) || /派克服|派克大衣/.test(src)) return "parka";
  if (/\b(trench)\b/i.test(src) || /风衣/.test(src)) return "trench_coat";
  // 棒球服 is a baseball jacket. 棒球帽 stays a cap (hat rule below).
  if (/\b(varsity|letterman)\b/i.test(src) || /棒球服|棒球夹克/.test(src)) return "varsity_jacket";
  if (/\b(coach\s*jacket)\b/i.test(src) || /教练夹克|教练外套/.test(src)) return "coach_jacket";
  if (/\b(track\s*(jacket|top)|tracktop)\b/i.test(src) || /运动夹克/.test(src)) return "track_jacket";
  if (/\b(suit\s*(jacket|coat))\b/i.test(src) || /西服|西装/.test(src)) return "suit_jacket";
  if (/\b(blazer)\b/i.test(src) || /布雷泽/.test(src)) return "blazer";
  // \b keeps "vest" away from "harvest". 马甲 is a vest; 背心 is a tank.
  if (/\b(vest|gilet)\b/i.test(src) || /马甲/.test(src)) return "vest";
  if (/\b(cardigan)\b/i.test(src) || /开衫/.test(src)) return "cardigan";
  // Thick knits run before the plain sweater band.
  if (/\b(chunky\s*knit|thick\s*knit|cable\s*knit)\b/i.test(src) || /粗棒针|麻花毛衣|粗针织/.test(src)) {
    return "thick_knit";
  }
  if (/\b(sweater|knit\s*sweater|knitted)\b/i.test(src) || /毛衣|针织衫?/.test(src)) return "knit_sweater";
  if (/\b(flannel)\b/i.test(src) || /法兰绒/.test(src)) return "flannel_shirt";
  if (/\b(rugby\s*(shirt|jersey))\b/i.test(src) || /橄榄球衫/.test(src)) return "rugby_shirt";
  if (/\b(polo(\s*shirt)?)\b/i.test(src) || /polo衫/.test(src)) return "polo";
  // Long sleeve runs before the tee band so "long sleeve tee" is not a plain tee.
  if (/\b(long[\s-]?sleeve)\b/i.test(src) || /长袖/.test(src)) return "long_sleeve_tee";
  if (/\b(tank(\s*top)?|singlet|camisole)\b/i.test(src) || /背心|吊带/.test(src)) return "tank";
  if (/\b(heavy\s*tee|heavyweight\s*tee)\b/i.test(src) || /重磅\s*t/.test(src)) return "heavy_tee";
  if (/\b(t[\s-]?shirt|tee)\b/i.test(src) || /短袖|t恤/.test(src)) return "tee";
  if (/\b(button[\s-]?up|oxford|dress\s*shirts?|woven)\b/i.test(src) || /衬衫/.test(src)) {
    return "shirt_woven";
  }

  // Bottoms. Heavy denim and one-piece cuts run before the plain jeans band.
  if (/\b(selvedge|selvage|raw\s*denim|heavy\s*denim)\b/i.test(src) || /赤耳|原牛|重磅牛仔/.test(src)) {
    return "heavy_denim";
  }
  if (/\b(overalls?|dungarees?|jumpsuit)\b/i.test(src) || /背带裤|连体裤/.test(src)) return "overalls";
  if (/\b(jean|jeans|denim\s*pant)\b/i.test(src) || /牛仔裤/.test(src)) return "jeans";
  if (/\b(sweatpants?|joggers?|fleece\s*pants?)\b/i.test(src) || /运动裤|卫裤/.test(src)) {
    return "sweatpants";
  }
  // Shorts run before cargo so "cargo shorts" stays a shorts band.
  if (/\b(short|shorts)\b/i.test(src) || /短裤/.test(src) || cat === "shorts") return "shorts";
  if (/\b(snow\s*pants?|ski\s*pants?)\b/i.test(src) || /滑雪裤/.test(src)) return "snow_pants";
  if (/\b(cargo\s*(pants?|trousers?)|cargos)\b/i.test(src) || /工装裤/.test(src)) return "cargo_pants";
  if (/\b(track\s*pants?|trackies)\b/i.test(src)) return "track_pants";
  if (/\b(chinos?|khakis?)\b/i.test(src) || /休闲裤/.test(src)) return "chinos";
  if (/\b(leggings?|tights|yoga\s*pants?)\b/i.test(src) || /打底裤|紧身裤/.test(src)) return "leggings";
  // Dress runs before skirt so 连衣裙 (dress) does not hit the skirt band.
  if (/\b(dress|gown)\b/i.test(src) || /连衣裙|礼服/.test(src)) return "dress";
  if (/\b(skirts?)\b/i.test(src) || /半裙|短裙|百褶裙/.test(src)) return "skirt";

  // Blanket runs before fleece so "fleece blanket" does not hit the fleece band.
  if (/\b(blanket)\b/i.test(src) || /毯子|毛毯|盖毯/.test(src)) return "blanket";
  if (/\b(fleece)\b/i.test(src) || /抓绒|摇粒绒/.test(src)) return "fleece";

  // Accessories / bags. Specific bag shapes run before the backpack catchall.
  if (/\b(duffle|duffel|weekender)\b/i.test(src) || /旅行包|旅行袋/.test(src)) return "duffle";
  if (/\b(tote(\s*bag)?)\b/i.test(src) || /托特包|帆布包/.test(src)) return "tote";
  if (/\b(backpack)\b/i.test(src) || /书包装|双肩/.test(src) || cat === "bag") return "backpack";
  if (/\b(crossbody|sling|messenger)\b/i.test(src) || /胸包|斜挎/.test(src)) return "crossbody";
  if (/\b(belt)\b/i.test(src) || /腰带|皮带/.test(src)) return "belt";
  if (/\b(scarf|scarves|shawl)\b/i.test(src) || /围巾|披肩/.test(src)) return "scarf";
  if (/\b(gloves?|mittens?)\b/i.test(src) || /手套/.test(src)) return "gloves";
  if (/\b(wallet|cardholder|card\s*holder)\b/i.test(src) || /钱包|卡包/.test(src)) return "wallet";
  if (/\b(sunglasses|shades)\b/i.test(src) || /墨镜|太阳镜/.test(src)) return "sunglasses";
  if (/\b(watch|watches)\b/i.test(src) || /手表|腕表/.test(src)) return "watch";
  // \b keeps "ring" and "rings" away from "keyring".
  if (/\b(necklace|bracelet|earrings?|rings?|brooch|jewel+ery)\b/i.test(src) || /项链|手链|戒指|耳环|耳钉|胸针/.test(src)) {
    return "jewelry";
  }
  if (/\b(phone\s*case|iphone\s*case)\b/i.test(src) || /手机壳|手机套/.test(src)) return "phone_case";
  if (/\b(keychain|key\s*chain|keyring)\b/i.test(src) || /钥匙扣|钥匙链|挂件/.test(src)) return "keychain";
  if (
    /\b(plush|plushie|stuffed\s*(animal|toy)|figurine?|doll)\b/i.test(src) ||
    /手办|公仔|玩偶|毛绒(玩具|公仔|玩偶)/.test(src)
  ) {
    return "plush_figure";
  }
  if (/\b(cap|hat|beanie)\b/i.test(src) || /棒球帽|帽子/.test(src) || cat === "hat") return "cap";
  if (/\b(socks?)\b/i.test(src) || /袜/.test(src) || cat === "socks") return "socks_pair";

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

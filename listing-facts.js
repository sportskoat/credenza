/**
 * listing-facts.js — pure helpers for card title policy, variant display,
 * and listing boilerplate filters. No DOM. No network.
 *
 * Spec: docs/specs/richer-item-facts.md
 */

/** Seller SKU / batch codes that must not beat a human title. */
export function isSkuLikeTitle(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  // Bare codes: L29735-H64, M29855-51E, A1234, SKU-99-X
  if (/^[A-Z0-9][A-Z0-9._-]{2,}$/i.test(t) && !/\s/.test(t)) {
    // Need at least one digit to avoid killing real one-word brands later.
    if (/\d/.test(t)) return true;
  }
  // Pure long digit ids
  if (/^\d{6,}$/.test(t)) return true;
  return false;
}

/**
 * Prefer a human card title over a seller SKU after resolve/enrich.
 * @param {{ currentTitle?: string, resolvedTitle?: string, claudeTitle?: string }} input
 * @returns {string}
 */
export function preferCardTitle({ currentTitle = "", resolvedTitle = "", claudeTitle = "" } = {}) {
  const current = String(currentTitle || "").trim();
  const resolved = String(resolvedTitle || "").trim();
  const claude = String(claudeTitle || "").trim();

  const human = (t) => t && !isSkuLikeTitle(t);
  // Prefer Claude English when it is human.
  if (human(claude)) return claude;
  // Keep a human current title over a SKU resolve.
  if (human(current) && isSkuLikeTitle(resolved)) return current;
  // Bare link: Claude failed → use resolved if human, else current/resolved.
  if (human(resolved)) return resolved;
  if (human(current)) return current;
  return claude || resolved || current || "";
}

const COLOR_AXIS = /^(color|colour|颜色|顏色|カラー|색상)$/i;
const SIZE_AXIS = /^(size|尺码|尺寸|사이즈|サイズ)$/i;

function firstAxis(groups, re) {
  if (!Array.isArray(groups)) return null;
  return groups.find((g) => g && re.test(String(g.title || "").trim())) || null;
}

/** First color value from variant groups, or "". Does not invent a pick. */
export function pickColorwayFromVariants(variantGroups) {
  const axis = firstAxis(variantGroups, COLOR_AXIS);
  if (!axis || !Array.isArray(axis.values) || !axis.values.length) return "";
  const v = String(axis.values[0] || "").trim();
  return v;
}

/**
 * Size run display like "S–XL" or "EU 42–44". Empty when no size axis.
 * Does not set a chosen size.
 */
export function pickSizeRunFromVariants(variantGroups) {
  const axis = firstAxis(variantGroups, SIZE_AXIS);
  if (!axis || !Array.isArray(axis.values) || !axis.values.length) return "";
  const values = axis.values.map((v) => String(v || "").trim()).filter(Boolean);
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  const first = values[0];
  const last = values[values.length - 1];
  // Letter run: S, M, L, XL → S–XL
  if (/^(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/i.test(first) && /^(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/i.test(last)) {
    return `${first.toUpperCase()}–${last.toUpperCase()}`;
  }
  // Shared prefix + trailing numbers: "EU 42"…"EU 44" → "EU 42–44"
  const m1 = first.match(/^(.*?)(\d+)\s*$/);
  const m2 = last.match(/^(.*?)(\d+)\s*$/);
  if (m1 && m2 && m1[1] === m2[1] && m1[1].length) {
    return `${m1[1]}${m1[2]}–${m2[2]}`;
  }
  return `${first}–${last}`;
}

const BOILERPLATE_MARKERS = [
  "购前说明",
  "依法纳税",
  "无理由退货",
  "国家药监局",
  "划线价格",
  "pre-purchase instructions",
  "消费者权益保护法",
];

/** True when text is store legal boilerplate, not product facts. */
export function isListingBoilerplate(text) {
  const t = String(text || "");
  if (!t.trim()) return false;
  const lower = t.toLowerCase();
  return BOILERPLATE_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

/**
 * True when resolve/enrich may overwrite the current card title.
 * Pure mirror of product intent, with SKU + local Weidian/Taobao placeholders
 * treated as replaceable (product `shouldReplaceFashionTitle` still misses those).
 *
 * Keep human Reddit labels. Replace empty, URL, placeholders, and SKU codes.
 */
export function shouldReplaceFashionTitle(title, url) {
  const clean = String(title || "").trim();
  if (!clean || clean === url) return true;
  if (/^(albums?|article|read|untitled|saved link|item)$/i.test(clean)) return true;
  // Yupoo localTitle: "topstoney · 12345678"
  if (/^[a-z0-9-]+\s·\s\d+$/i.test(clean)) return true;
  if (/^album\s+\d+$/i.test(clean)) return true;
  // Weidian / Taobao localTitle placeholders
  if (/^(weidian|taobao|tmall|1688)\s+item\s+\d+$/i.test(clean)) return true;
  // Bare seller SKU — allow a better Claude/API title
  if (isSkuLikeTitle(clean)) return true;
  // Host-only crumbs
  if (/^[a-z0-9.-]+\.(com|cn|net|shop)$/i.test(clean)) return true;
  return false;
}

// --- Chart image hosts (chart-vision allowlist research) -----------------
// Live server today: Yupoo only. Proposed Weidian CDNs for a later product PR.
// Never fetch without SSRF guard + private-IP rejection on the server.

/** Hosts chart-vision may fetch today. */
export const CHART_IMAGE_HOST_YUPOO = /(^|\.)(photo|pic)\.yupoo\.com$/i;

/**
 * Proposed Weidian / Ali image CDNs (NOT live in chart-vision yet).
 * Sources: common Weidian itemMainPic hosts (geilicdn, alicdn).
 * Must pass SSRF tests before product use.
 */
export const CHART_IMAGE_HOST_WEIDIAN_PROPOSED =
  /(^|\.)((si|wd|geili)\.geilicdn\.com|geilicdn\.com|(img|gd\d*|gw|g\.alicdn)\.alicdn\.com|alicdn\.com)$/i;

/**
 * Cheap host check for chart photo URLs.
 * @param {string} rawUrl
 * @param {{ includeWeidianProposed?: boolean }} [opts]
 * @returns {boolean}
 */
export function isAllowedChartImageHost(rawUrl, { includeWeidianProposed = false } = {}) {
  let host;
  try {
    const u = new URL(String(rawUrl || ""));
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return false;
  }
  if (CHART_IMAGE_HOST_YUPOO.test(host)) return true;
  if (includeWeidianProposed && CHART_IMAGE_HOST_WEIDIAN_PROPOSED.test(host)) return true;
  return false;
}

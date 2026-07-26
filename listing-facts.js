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

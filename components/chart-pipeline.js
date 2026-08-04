// Low-cost sizing-chart pipeline (RESEARCH/CREDENZA_LOW_COST_CHART_PIPELINE_2026_07_30.md).
//
// Four rules:
// 1. Every chart result stays on its item key. Never borrow by seller.
// 2. Cache every paid read by the image content key. The same chart image
//    never triggers a second paid read.
// 3. Rank candidates by filename, size, and shape first. Send the AI one
//    candidate, not a window of product photos.
// 4. Validate locally before any size call: two or more sizes, one or more
//    measurement labels, one clear table direction.
//
// No import from credenza-fashion.jsx — callers pass parseSizeChart so this
// module stays free of the app circular load.

/** Session cache: image key → validated chart text from a paid (or free) read. */
const paidChartByImageKey = new Map();

/** Filename / alt strings that almost always mean a size chart. */
const STRONG_CHART_NAME =
  /size[\s_-]*chart|sizing[\s_-]*chart|size[\s_-]*table|尺码|尺碼|尺寸表|规格表|sizeguide|size_guide|kf尺|尺码表|半胸|measurement/i;

/** Weaker chart signals in a path. */
const WEAK_CHART_NAME = /chart|measure|sizing|size|screenshot|screen[\s_-]*shot|截图|规格/i;

/** Reject payment guides, agent ads, and contact cards. */
const REJECT_NAME =
  /superbuy|wegobuy|cssbuy|pandabuy|sugargoo|payment|pay\b|wechat|whatsapp|telegram|agent|tutorial|guide|how[\s_-]*to|logo|contact|qr[\s_-]*code|客服|支付|代购指南/i;

/**
 * True when a candidate's alt/name/url hits REJECT_NAME (score floor).
 * Used by the desc[0] reserved paid slot — a whatsapp-named URL never reserves.
 * @param {ChartCandidate|string|null|undefined} candidateOrName
 * @returns {boolean}
 */
export function isRejectedChartName(candidateOrName) {
  if (candidateOrName == null) return false;
  const name =
    typeof candidateOrName === "string"
      ? candidateOrName
      : String(candidateOrName.alt || candidateOrName.name || candidateOrName.url || "");
  return REJECT_NAME.test(name);
}

/** Advertisement / spam body text that is not a measurement table. */
const AD_TEXT =
  /superbuy|wegobuy|cssbuy|pandabuy|sugargoo|join\s+our\s+(discord|telegram)|scan\s+to\s+(pay|add)|微信|加微信|代购/i;

/**
 * Stable image key used as the content hash for cache reuse.
 * CDN size variants of the same photo collapse to one key. Data URLs hash
 * their payload so two identical customer uploads share one paid read.
 * @param {string} url
 * @returns {string}
 */
export function chartImageKey(url) {
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

/**
 * @typedef {{ url: string, via: string, width?: number, height?: number, alt?: string, name?: string }} ChartCandidate
 */

/**
 * Width/height from candidate fields, or from a Weidian-style CDN path
 * ending in `_WIDTH_HEIGHT` before the extension (e.g. …_1338_1279.jpg).
 * Shape may rank candidates; it must never exclude them from the pool.
 * @param {ChartCandidate|null|undefined} candidate
 * @returns {{ width: number, height: number } | null}
 */
export function dimsFromCandidate(candidate) {
  const fieldW = Number(candidate && candidate.width) || 0;
  const fieldH = Number(candidate && candidate.height) || 0;
  if (fieldW > 0 && fieldH > 0) return { width: fieldW, height: fieldH };

  const raw = String((candidate && candidate.url) || "");
  if (!raw) return null;
  const path = raw.split("?")[0];
  const m = /_(\d{2,5})_(\d{2,5})(?:\.[a-z0-9]+)?$/i.exec(path);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return null;
  return { width: w, height: h };
}

/**
 * Score one candidate without any paid model call.
 * Higher is better. Negative means reject.
 * Shape only ranks — never drops a candidate for being near-square.
 * @param {ChartCandidate} candidate
 * @returns {number}
 */
export function scoreChartCandidate(candidate) {
  if (
    !candidate ||
    typeof candidate.url !== "string" ||
    (!/^https?:\/\//i.test(candidate.url) && !/^data:image\//i.test(candidate.url))
  ) {
    return -100;
  }
  const name = String(candidate.alt || candidate.name || candidate.url || "");
  if (REJECT_NAME.test(name)) return -50;

  let score = 0;
  if (STRONG_CHART_NAME.test(name)) score += 100;
  else if (WEAK_CHART_NAME.test(name)) score += 40;

  // Known chart tiles from the Yupoo reader start ahead of product photos.
  if (candidate.via === "chart-photos") score += 80;
  else if (candidate.via === "desc-photos") score += 25;
  else if (candidate.via === "album-photos") score += 10;
  else if (candidate.via === "gallery-photos") score += 5;

  const dims = dimsFromCandidate(candidate);
  if (dims) {
    const { width: w, height: h } = dims;
    // Use w/h (not max aspect) so exact product squares stay unboosted
    // while mildly landscape padded tables (common seller charts) rise.
    const wh = w / h;

    // Padded-square band: w/h 1.02–1.35. Pin edges so 1.000 / 1.006 product
    // shots never swallow the chart at 1.046 (weidian 7503676779 fixture).
    if (wh >= 1.02 && wh <= 1.35) score += 20;
    // Classic landscape tables — wider than padded-square, not a banner.
    else if (wh > 1.35 && wh <= 2.2) score += 20;
    // Wide banner / contact strip (WhatsApp CS cards often ~2.3+ wide).
    // Demote so they do not burn a paid read slot ahead of real tables.
    if (wh > 2.2) score -= 25;
    // Tall stacked strip: the seller folded the whole lower page — size
    // tables included — into one long PNG (weidian type-10000 blocks). The
    // demote used to be symmetric, so the single best chart carrier on the
    // page scored below zero and left the pool (Kyle 2026-08-04, weidian
    // 7636215363: a 2250x4929 strip holding three size charts). Boost the
    // strip into the paid set instead.
    if (h / w >= 2 && h >= 1800) score += 30;

    const edge = Math.max(w, h);
    // Small edge vs typical product shots (often 1500–2000px) is the main
    // chart signal when the filename is random CDN noise.
    if (edge > 0 && edge < 900) score += 30;
    else if (edge > 0 && edge < 1200) score += 15;
    if (edge > 2000) score -= 5;
  }

  if (/\.png(?:$|\?)/i.test(candidate.url)) score += 8;
  return score;
}

/**
 * Rank candidates. Rejects ads and logos. Best first.
 * @param {ChartCandidate[]} candidates
 * @returns {Array<ChartCandidate & { imageKey: string, score: number }>}
 */
export function rankChartCandidates(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  const seen = new Set();
  const scored = [];
  for (const c of list) {
    if (!c || !c.url) continue;
    const key = chartImageKey(c.url);
    if (!key || seen.has(key)) continue;
    const score = scoreChartCandidate(c);
    if (score < 0) continue;
    seen.add(key);
    scored.push({ candidate: c, score, imageKey: key });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => ({ ...s.candidate, imageKey: s.imageKey, score: s.score }));
}

/**
 * Detect whether sizes sit in rows or in a header column run.
 * @param {string} text
 * @returns {"rows"|"columns"|null}
 */
export function detectTableDirection(text) {
  const src = String(text || "");
  if (!src.trim()) return null;
  const lines = src.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const sizeToken = /\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|[2-4]X|\d{2})\b/gi;
  let rowStarts = 0;
  let headerLineSizes = 0;
  for (const line of lines) {
    const startsWithSize = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|[2-4]X|\d{2})\b/i.test(line);
    if (startsWithSize) rowStarts += 1;
    const tokens = line.match(sizeToken) || [];
    if (tokens.length >= 3) headerLineSizes = Math.max(headerLineSizes, tokens.length);
  }
  if (headerLineSizes >= 3 && rowStarts < 2) return "columns";
  if (rowStarts >= 2) return "rows";
  if (headerLineSizes >= 2) return "columns";
  if (rowStarts === 1 && headerLineSizes < 2) return "rows";
  return null;
}

/**
 * Local chart validation before any size recommendation.
 * Failed check → no size call.
 * @param {string} text
 * @param {(t: string) => { rows: object[] } | null} parseSizeChart
 * @returns {{ ok: true, chart: object, direction: "rows"|"columns" } | { ok: false, reason: string }}
 */
export function validateChartResult(text, parseSizeChart) {
  const src = String(text || "").trim();
  if (!src) return { ok: false, reason: "empty" };
  if (typeof parseSizeChart !== "function") return { ok: false, reason: "no-parser" };
  if (AD_TEXT.test(src) && !/chest|bust|腰|胸|hip|waist|length|衣长|肩/i.test(src)) {
    return { ok: false, reason: "advertisement" };
  }

  const chart = parseSizeChart(src);
  if (!chart || !Array.isArray(chart.rows) || chart.rows.length < 2) {
    return { ok: false, reason: "need-two-sizes" };
  }

  const measureKeys = new Set();
  for (const row of chart.rows) {
    if (!row || typeof row !== "object") continue;
    for (const k of Object.keys(row)) {
      if (k !== "size" && row[k] != null && isFinite(row[k])) measureKeys.add(k);
    }
  }
  if (measureKeys.size < 1) return { ok: false, reason: "need-measure-label" };

  // parseSizeChart always emits size rows. When the source text is compact
  // (one line of labeled sizes), still accept it as a row table.
  const direction = detectTableDirection(src) || "rows";
  if (!direction) return { ok: false, reason: "no-table-direction" };

  for (const row of chart.rows) {
    for (const k of measureKeys) {
      const v = row[k];
      if (v == null) continue;
      if (v < 15 || v > 250) return { ok: false, reason: "impossible-value" };
    }
  }

  return { ok: true, chart, direction };
}

/**
 * Remember a validated chart under its image key (session reuse).
 * @param {string} imageKey
 * @param {string} text
 * @param {(t: string) => object | null} parseSizeChart
 */
export function rememberChartImage(imageKey, text, parseSizeChart) {
  const key = String(imageKey || "");
  const body = String(text || "").trim();
  if (!key || !body) return;
  if (!validateChartResult(body, parseSizeChart).ok) return;
  paidChartByImageKey.set(key, { text: body, at: new Date().toISOString() });
}

/**
 * @param {string} imageKey
 * @returns {string|null}
 */
export function recallChartImage(imageKey) {
  const key = String(imageKey || "");
  if (!key) return null;
  const hit = paidChartByImageKey.get(key);
  return hit && hit.text ? hit.text : null;
}

/** Test helper — clear the session image cache. */
export function clearChartImageCache() {
  paidChartByImageKey.clear();
}

/**
 * Reuse a chart only when the current item's candidates include the exact
 * image key of a prior successful read. Never matches by seller name.
 * @param {object[]|null} shelfItems
 * @param {string[]} candidateKeys
 * @param {(t: string) => object | null} parseSizeChart
 * @returns {{ text: string, imageKey: string, via: string } | null}
 */
export function chartCacheForImageKeys(shelfItems, candidateKeys, parseSizeChart) {
  const keys = new Set((candidateKeys || []).filter(Boolean));
  if (!keys.size) return null;

  for (const key of keys) {
    const text = recallChartImage(key);
    if (text && validateChartResult(text, parseSizeChart).ok) {
      return { text, imageKey: key, via: "image-cache" };
    }
  }

  const list = Array.isArray(shelfItems) ? shelfItems : [];
  let best = null;
  for (const other of list) {
    if (!other) continue;
    const src = other.sizeChartSource;
    if (!src || typeof src !== "object") continue;
    const imageKey = typeof src.imageHash === "string" ? src.imageHash : "";
    if (!imageKey || !keys.has(imageKey)) continue;
    const text =
      (typeof other.sizeChartText === "string" && other.sizeChartText) ||
      (typeof other.sizeNotes === "string" && other.sizeNotes) ||
      "";
    if (!text || !validateChartResult(text, parseSizeChart).ok) continue;
    if (other.sizeChartNeedsClear) continue;
    if (!best || String(src.at || "") > String(best.at || "")) {
      best = { text, imageKey, via: "image-cache", at: src.at || "" };
    }
  }
  return best ? { text: best.text, imageKey: best.imageKey, via: best.via } : null;
}

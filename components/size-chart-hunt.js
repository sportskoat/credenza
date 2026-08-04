// Silent chart hunt for the live FitBlock.
// Low-cost pipeline (2026-07-30): rank candidates without AI, reuse exact
// image keys, send one photo per paid read, validate before accepting.
//
// Returns { text, source } — text that validateChartResult accepts, plus a
// provenance tag — or null. Callers throttle (one hunt per item per session)
// and persist the text into sizeChartText and the tag into sizeChartSource.
//
// Lives in its own module (not credenza-fashion.jsx) so tests can stub the
// hunt without mocking the circular app module.
import {
  fetchChartFromPhotos,
  fetchDescImages,
  fetchYupooImages,
  isChartAuthRequired,
  isChartCapReached,
  isChartUnavailable,
  parseSizeChart,
  yupooAlbumUrl,
} from "../credenza-fashion.jsx";
import {
  chartCacheForImageKeys,
  chartImageKey,
  isRejectedChartName,
  rankChartCandidates,
  rememberChartImage,
  validateChartResult,
} from "./chart-pipeline.js";

/** Max single-photo paid reads per hunt. Ranking should hit on the first. */
export const MAX_PAID_CANDIDATES = 3;
/** Cap how many gallery/desc photos enter the ranking pool. */
const MAX_POOL = 24;

/**
 * Paid read order for one hunt (Fix B/C reserved desc[0], 2026-08-03).
 *
 * Shape scores stay exactly as Fix 2a. Diversify the paid set instead:
 * if the original Product-Details image (desc[0]) is not already in the
 * top MAX_PAID by rank, insert it at paid position 2. Read order becomes
 * best-by-score, then desc[0], then next-by-score. Total paid stays <= 3 —
 * the reservation displaces the third score pick, never adds a fourth call.
 *
 * Name-rejected desc[0] (REJECT_NAME) never reserves — ranked already
 * dropped it, and the pin forbids falling through to desc[1].
 *
 * @param {Array<import("./chart-pipeline.js").ChartCandidate & { imageKey?: string, score?: number }>} ranked
 * @param {import("./chart-pipeline.js").ChartCandidate & { imageKey?: string, score?: number } | null} reserved
 * @param {number} [maxPaid]
 * @returns {Array<import("./chart-pipeline.js").ChartCandidate & { imageKey?: string, score?: number }>}
 */
export function paidHuntCandidates(ranked, reserved, maxPaid = MAX_PAID_CANDIDATES) {
  const list = Array.isArray(ranked) ? ranked : [];
  if (!list.length) return [];
  if (!reserved || !reserved.url) return list.slice(0, maxPaid);
  if (isRejectedChartName(reserved)) return list.slice(0, maxPaid);

  const top = list.slice(0, maxPaid);
  if (top.some((c) => c.url === reserved.url)) return top;

  // Slot 0 = best-by-score, slot 1 = reserved desc[0], then fill by score.
  /** @type {typeof list} */
  const out = [];
  if (list[0]) out.push(list[0]);
  out.push(reserved);
  for (const c of list) {
    if (out.length >= maxPaid) break;
    if (c.url === reserved.url) continue;
    if (out.some((x) => x.url === c.url)) continue;
    out.push(c);
  }
  return out.slice(0, maxPaid);
}

/**
 * Original desc[0] as a ranked candidate, or null when missing / name-rejected.
 * @param {string[]} descUrls - original Product-Details order
 * @param {Array<import("./chart-pipeline.js").ChartCandidate & { imageKey?: string, score?: number }>} rankedAll
 * @returns {(import("./chart-pipeline.js").ChartCandidate & { imageKey?: string, score?: number }) | null}
 */
export function pickReservedDescCandidate(descUrls, rankedAll) {
  const url = Array.isArray(descUrls) ? descUrls[0] : null;
  if (!url || typeof url !== "string") return null;
  // Pin: name-rejected desc[0] gets NO reservation (do not walk to desc[1]).
  if (isRejectedChartName(url)) return null;
  const hit = (rankedAll || []).find((c) => c && c.url === url);
  return hit || null;
}

/**
 * @param {string[]} urls
 * @param {string} via
 * @param {Record<string, { width?: number, height?: number, alt?: string }>|null} [metaByUrl]
 * @returns {import("./chart-pipeline.js").ChartCandidate[]}
 */
function asCandidates(urls, via, metaByUrl = null) {
  return (urls || [])
    .filter((src) => typeof src === "string" && (/^https?:\/\//i.test(src) || /^data:image\//i.test(src)))
    .map((url) => {
      const meta = metaByUrl && metaByUrl[url] ? metaByUrl[url] : null;
      return {
        url,
        via,
        name: (meta && meta.alt) || url,
        width: meta && meta.width ? meta.width : undefined,
        height: meta && meta.height ? meta.height : undefined,
        alt: meta && meta.alt ? meta.alt : undefined,
      };
    });
}

/**
 * Accept free album text only when local validation passes.
 * @param {string} text
 * @returns {{ text: string, source: object } | null}
 */
function acceptText(text, source) {
  const body = String(text || "").trim();
  if (!body) return null;
  const check = validateChartResult(body, parseSizeChart);
  if (!check.ok) return null;
  return {
    text: body,
    source: {
      ...source,
      photos: source.photos || 0,
      direction: check.direction,
    },
  };
}

/**
 * Try one candidate: image-key cache first, then one paid vision read.
 * @returns {Promise<{ text: string, source: object } | null>}
 */
async function tryCandidate(candidate, { signal, referer, shelfItems }) {
  if (!candidate || !candidate.url) return null;
  const imageKey = candidate.imageKey || chartImageKey(candidate.url);
  if (!imageKey) return null;

  // Exact image reuse — free, no seller match.
  const cached = chartCacheForImageKeys(shelfItems, [imageKey], parseSizeChart);
  if (cached) {
    return {
      text: cached.text,
      source: {
        via: cached.via,
        photos: 0,
        imageHash: cached.imageKey,
      },
    };
  }

  if (signal && signal.aborted) return null;
  const chartText = await fetchChartFromPhotos([candidate.url], { signal, referer });
  if (signal && signal.aborted) return null;
  // FIX 0: stop the hunt on auth — more candidates will not help.
  if (isChartAuthRequired(chartText)) return { authRequired: true };
  // FIX 2b: stop on daily cap — more candidates still burn nothing but the
  // UI must not claim "no chart" for a spent allowance.
  if (isChartCapReached(chartText)) return { capReached: true };
  // FIX 2c: the reader was not reachable. More candidates will hit the same
  // wall, and the UI must not claim "no size chart" for a server that is down.
  if (isChartUnavailable(chartText)) return { unavailable: true };
  const check = validateChartResult(chartText, parseSizeChart);
  if (!check.ok) return null;

  rememberChartImage(imageKey, chartText, parseSizeChart);
  return {
    text: chartText,
    source: {
      via: candidate.via || "gallery-photos",
      photos: 1,
      imageHash: imageKey,
      direction: check.direction,
    },
  };
}

/**
 * Hunt a size chart for one item.
 * @param {object} item
 * @param {{ signal?: AbortSignal, shelfItems?: object[] }} [opts]
 */
export async function huntSizeChart(item, { signal, shelfItems } = {}) {
  const album = yupooAlbumUrl(item);
  const referer = album || item.url || undefined;
  const localPhotos = [item.image, ...(item.gallery || [])].filter(
    (src) => typeof src === "string" && /^https?:\/\//i.test(src)
  );
  const knownCharts = (item.chartImages || []).filter(
    (src) => typeof src === "string" && /^https?:\/\//i.test(src)
  );

  /** @type {import("./chart-pipeline.js").ChartCandidate[]} */
  let pool = [...asCandidates(knownCharts, "chart-photos")];

  if (album) {
    const data = await fetchYupooImages(album, { signal });
    if (signal && signal.aborted) return null;
    const text = [data && data.description, data && data.sizeNotes].filter(Boolean).join("\n");
    const free = acceptText(text, { via: "album-text", photos: 0 });
    if (free) return free;

    const tileMeta = (data && data.tileMeta) || null;
    const freshCharts = ((data && data.chartImages) || []).filter((src) => !knownCharts.includes(src));
    pool = pool.concat(asCandidates(freshCharts, "chart-photos", tileMeta));
    const albumPhotos = (data && data.images) || [];
    // Head first when dims are known: small early JPGs are often the chart.
    // Still include the tail — many albums still put charts at the end.
    const head = albumPhotos.slice(0, 8);
    const tail = albumPhotos.slice(8);
    pool = pool.concat(
      asCandidates(head, "album-photos", tileMeta),
      asCandidates(tail, "album-photos", tileMeta)
    );
  }

  // Original Product-Details order — reserved-read uses desc[0] only.
  let descPhotos = (item.descImages || []).filter(
    (src) => typeof src === "string" && /^https?:\/\//i.test(src)
  );
  pool = pool.concat(asCandidates(descPhotos, "desc-photos"));
  pool = pool.concat(asCandidates(localPhotos, "gallery-photos"));

  // Last resort: fetch Product Details when the card never stored them.
  if (!descPhotos.length && fetchDescImages) {
    const fetched = await fetchDescImages(item, { signal });
    if (signal && signal.aborted) return null;
    const fresh = (fetched || []).filter(
      (src) => typeof src === "string" && /^https?:\/\//i.test(src) && !localPhotos.includes(src)
    );
    descPhotos = fresh;
    pool = pool.concat(asCandidates(fresh, "desc-photos"));
  }

  const rankedAll = rankChartCandidates(pool);
  const ranked = rankedAll.slice(0, MAX_POOL);
  if (!ranked.length) return null;

  // Whole-pool image cache check before any paid call.
  const keys = rankedAll.map((c) => c.imageKey).filter(Boolean);
  const bulkHit = chartCacheForImageKeys(shelfItems, keys, parseSizeChart);
  if (bulkHit) {
    return {
      text: bulkHit.text,
      source: {
        via: bulkHit.via,
        photos: 0,
        imageHash: bulkHit.imageKey,
      },
    };
  }

  // Fix B/C: diversify paid set with original desc[0] at slot 2 when needed.
  // Scores/bands unchanged (Fix 2a). Reservation never raises cost above 3.
  const reserved = pickReservedDescCandidate(descPhotos, rankedAll);
  const paidList = paidHuntCandidates(ranked, reserved, MAX_PAID_CANDIDATES);

  // One photo per paid read. Stop on the first validated chart.
  for (const candidate of paidList) {
    if (signal && signal.aborted) return null;
    const hit = await tryCandidate(candidate, { signal, referer, shelfItems });
    if (hit && hit.authRequired) return { authRequired: true };
    if (hit && hit.capReached) return { capReached: true };
    if (hit && hit.unavailable) return { unavailable: true };
    if (hit) return hit;
  }
  return null;
}

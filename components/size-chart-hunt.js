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
  parseSizeChart,
  yupooAlbumUrl,
} from "../credenza-fashion.jsx";
import {
  chartCacheForImageKeys,
  chartImageKey,
  rankChartCandidates,
  rememberChartImage,
  validateChartResult,
} from "./chart-pipeline.js";

/** Max single-photo paid reads per hunt. Ranking should hit on the first. */
const MAX_PAID_CANDIDATES = 3;
/** Cap how many gallery/desc photos enter the ranking pool. */
const MAX_POOL = 24;

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

  const descPhotos = (item.descImages || []).filter(
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
    pool = pool.concat(asCandidates(fresh, "desc-photos"));
  }

  const ranked = rankChartCandidates(pool).slice(0, MAX_POOL);
  if (!ranked.length) return null;

  // Whole-pool image cache check before any paid call.
  const keys = ranked.map((c) => c.imageKey).filter(Boolean);
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

  // One photo per paid read. Stop on the first validated chart.
  let paid = 0;
  for (const candidate of ranked) {
    if (signal && signal.aborted) return null;
    if (paid >= MAX_PAID_CANDIDATES) break;
    paid += 1;
    const hit = await tryCandidate(candidate, { signal, referer, shelfItems });
    if (hit && hit.authRequired) return { authRequired: true };
    if (hit && hit.capReached) return { capReached: true };
    if (hit) return hit;
  }
  return null;
}

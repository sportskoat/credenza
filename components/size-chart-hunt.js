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
  isChartRateLimited,
  isChartReaderOff,
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
// Below this score nothing in the pool looks like a chart. The stored desc
// list may predate a resolve improvement (the folded-tail read landed
// 2026-08-04), so a weak pool earns one re-resolve before the paid reads.
const WEAK_POOL_SCORE = 50;

// Kyle 2026-08-04: "we can't charge for repopulating the chart!" A finished
// hunt that found nothing left no trace, so every page reload ran it again —
// up to MAX_PAID_CANDIDATES paid reads per reload for every chart-less item.
// The caller now stamps the item with sizeChartHunt { at, fp, v } and skips the
// hunt while this fingerprint matches. The print covers every pool the hunt
// reads (cover, gallery, known charts, Product Details, album), so a new
// photo changes it and earns exactly one fresh hunt.
//
// The version moves when the PIPELINE gets smarter with the same photos:
// v1 stamped misses whose folded-tail strips the pool could not see yet
// (typed-10000 desc blocks, tall-strip scoring, the busy retry — all landed
// 2026-08-04). A v1 stamp on a chart-carrying item would hide the chart
// forever, so a stale version earns one fresh hunt too.
// v2 stamps could be written by a hunt that never saw the album: a failed
// yupoo fetch used to degrade the pool and still stamp a miss (#38, Kyle
// 2026-08-05 — an album item stamped "no chart" while its chart photo sat in
// chartImages the whole time). The hunt now refuses to stamp without the
// album, and every v2 stamp earns one fresh hunt.
export const CHART_HUNT_VERSION = 3;
export function chartHuntFingerprint(item) {
  if (!item || typeof item !== "object") return "";
  const http = (list) =>
    (Array.isArray(list) ? list : []).filter(
      (src) => typeof src === "string" && /^https?:\/\//i.test(src)
    );
  const cover =
    typeof item.image === "string" && /^https?:\/\//i.test(item.image) ? item.image : "";
  return [
    cover,
    ...http(item.gallery),
    ...http(item.chartImages),
    ...http(item.descImages),
    yupooAlbumUrl(item) || "",
  ].join("\n");
}

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

// Abort-aware pause for the busy retry.
function wait(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      if (signal) signal.removeEventListener("abort", done);
      clearTimeout(timer);
      resolve();
    }
    if (signal) signal.addEventListener("abort", done, { once: true });
  });
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
  // Kyle 2026-08-04 #31: the traffic guards are their own outcomes. Neither
  // says anything about the plan, and neither earns another candidate — the
  // next read hits the same window.
  if (isChartRateLimited(chartText)) return { rateLimited: true };
  if (isChartReaderOff(chartText)) return { readerOff: true };
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
    // #38 (Kyle 2026-08-05): the album is the best chart source — its
    // chartImages never reach the gallery ("charts hidden", 2026-07-26), so a
    // hunt without the album pool can stamp a miss over an unread chart. A
    // failed fetch proves nothing about the item. Say the reader could not be
    // reached and stamp nothing; the next open earns a fresh try.
    if (!data) return { unavailable: true };
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
  let descFetched = false;
  if (!descPhotos.length && fetchDescImages) {
    const fetched = await fetchDescImages(item, { signal });
    if (signal && signal.aborted) return null;
    descFetched = true;
    const fresh = (fetched || []).filter(
      (src) => typeof src === "string" && /^https?:\/\//i.test(src) && !localPhotos.includes(src)
    );
    descPhotos = fresh;
    pool = pool.concat(asCandidates(fresh, "desc-photos"));
  }

  let rankedAll = rankChartCandidates(pool);
  // Weak pool: nothing scored like a chart. The stored desc list can predate
  // a resolve improvement — resolve learned the folded-tail strips (type
  // 10000) on 2026-08-04, and cards saved before that hold the page without
  // its chart carrier. One re-resolve per hunt puts the real strip into the
  // pool; the no-find stamp keeps the whole thing once per item
  // (Kyle 2026-08-04: "WHY IS THIS SO INCONSISTENT").
  if (!descFetched && fetchDescImages && rankedAll.length && (rankedAll[0].score || 0) < WEAK_POOL_SCORE) {
    const fetched = await fetchDescImages(item, { signal });
    if (signal && signal.aborted) return null;
    const inPool = new Set(pool.map((c) => c.url));
    const fresh = (fetched || []).filter(
      (src) => typeof src === "string" && /^https?:\/\//i.test(src) && !inPool.has(src)
    );
    if (fresh.length) {
      // Append, never prepend: the reserved read keys on the ORIGINAL desc[0].
      descPhotos = descPhotos.concat(fresh);
      pool = pool.concat(asCandidates(fresh, "desc-photos"));
      rankedAll = rankChartCandidates(pool);
    }
  }

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
  let busyRetried = false;
  for (const candidate of paidList) {
    if (signal && signal.aborted) return null;
    let hit = await tryCandidate(candidate, { signal, referer, shelfItems });
    // A transient unavailable (the concurrency limiter's Busy, a 502, a
    // timeout) ended hunts that were one moment away from a chart — Kyle
    // 2026-08-04: "WHY IS THIS SO INCONSISTENT." Retry once per hunt. The
    // retry costs nothing: a refused request never reaches the meter.
    if (hit && hit.unavailable && !busyRetried) {
      busyRetried = true;
      await wait(2000, signal);
      if (signal && signal.aborted) return null;
      hit = await tryCandidate(candidate, { signal, referer, shelfItems });
    }
    if (hit && hit.authRequired) return { authRequired: true };
    if (hit && hit.capReached) return { capReached: true };
    if (hit && hit.rateLimited) return { rateLimited: true };
    if (hit && hit.readerOff) return { readerOff: true };
    if (hit && hit.unavailable) return { unavailable: true };
    if (hit) return hit;
  }
  return null;
}

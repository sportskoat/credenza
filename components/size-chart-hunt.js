// Silent chart hunt for the live FitBlock (2026-07-25; Kyle: "WHAT IS GOING
// ON WITH THE SIZING CHARTS"). The old hunt lived in SizeRecommendation —
// that panel lost its last caller when every back unified on DetailBody, so
// charts stopped arriving and every card read "No size chart on this
// listing". Yupoo album text first, then a vision scan of album photos,
// then the seller's Product Details photos (resolve descImages — chart
// tables often live there), then the gallery photos (charts also appear
// early in the product gallery — Kyle 2026-07-25 Mook tee, slide 2/9).
// Returns { text, source } — text parseable by parseSizeChart plus a
// provenance tag for the breakdown footer (handoff turn 3 §5) — or null.
// Callers throttle (one hunt per item per session) and persist the text
// into sizeNotes and the tag into sizeChartSource.
//
// Lives in its own module (not credenza-fashion.jsx) so tests can stub the
// hunt without mocking the circular app module.
import {
  fetchChartFromPhotos,
  fetchYupooImages,
  parseSizeChart,
  yupooAlbumUrl,
} from "../credenza-fashion.jsx";

/** Vision caps at 10 images per call. Cap gallery/desc windows to control cost. */
const VISION_WINDOW = 10;
/** Max gallery photos to scan (2 windows). Charts are usually early. */
const MAX_GALLERY_SCAN = 20;

/**
 * Scan photo lists in forward windows of 10.
 * @returns {Promise<{ text: string, photos: number } | null>}
 */
async function visionWindows(photos, { signal, referer, maxPhotos } = {}) {
  const list = (photos || []).filter((src) => typeof src === "string" && /^https?:\/\//i.test(src));
  const capped = typeof maxPhotos === "number" ? list.slice(0, maxPhotos) : list;
  for (let i = 0; i < capped.length; i += VISION_WINDOW) {
    if (signal && signal.aborted) return null;
    const window = capped.slice(i, i + VISION_WINDOW);
    const chartText = await fetchChartFromPhotos(window, { signal, referer });
    if (signal && signal.aborted) return null;
    if (chartText && parseSizeChart(chartText)) {
      return { text: chartText, photos: window.length };
    }
  }
  return null;
}

export async function huntSizeChart(item, { signal } = {}) {
  const album = yupooAlbumUrl(item);
  const localPhotos = [item.image, ...(item.gallery || [])].filter(
    (src) => typeof src === "string" && /^https?:\/\//i.test(src)
  );
  // Chart tiles the album parser held out of the gallery (2026-07-26). These
  // ARE the chart, so scan them before anything else — one vision call instead
  // of walking the whole album. Kyle: "you want to index the sizing chart
  // because you need to understand how it's going to fit somebody, but you
  // don't really care for it if someone is looking through photos."
  const knownCharts = (item.chartImages || []).filter(
    (src) => typeof src === "string" && /^https?:\/\//i.test(src)
  );
  if (knownCharts.length) {
    const chartText = await fetchChartFromPhotos(knownCharts.slice(0, VISION_WINDOW), {
      signal,
      referer: album || item.url || undefined,
    });
    if (signal && signal.aborted) return null;
    if (chartText && parseSizeChart(chartText)) {
      return { text: chartText, source: { via: "chart-photos", photos: knownCharts.length } };
    }
  }
  if (album) {
    const data = await fetchYupooImages(album, { signal });
    if (signal && signal.aborted) return null;
    const text = [data && data.description, data && data.sizeNotes].filter(Boolean).join("\n");
    if (text.trim() && parseSizeChart(text)) {
      return { text: text.trim(), source: { via: "album-text", photos: 0 } };
    }
    // Charts the parser separated on THIS fetch, if the item did not carry
    // them yet (enriched before chartImages existed).
    const freshCharts = ((data && data.chartImages) || []).filter(
      (src) => !knownCharts.includes(src)
    );
    if (freshCharts.length) {
      const chartText = await fetchChartFromPhotos(freshCharts.slice(0, VISION_WINDOW), {
        signal,
        referer: album,
      });
      if (signal && signal.aborted) return null;
      if (chartText && parseSizeChart(chartText)) {
        return { text: chartText, source: { via: "chart-photos", photos: freshCharts.length } };
      }
    }
    const albumPhotos = (data && data.images) || [];
    if (albumPhotos.length) {
      // Yupoo charts often sit at the end of the album — try the tail first.
      const tail = albumPhotos.slice(-VISION_WINDOW);
      const chartText = await fetchChartFromPhotos(tail, { signal, referer: album });
      if (signal && signal.aborted) return null;
      if (chartText && parseSizeChart(chartText)) {
        return { text: chartText, source: { via: "album-photos", photos: tail.length } };
      }
      // Then walk the front of long albums if the tail missed.
      if (albumPhotos.length > VISION_WINDOW) {
        const headHit = await visionWindows(albumPhotos.slice(0, -VISION_WINDOW), {
          signal,
          referer: album,
          maxPhotos: MAX_GALLERY_SCAN,
        });
        if (headHit) {
          return { text: headHit.text, source: { via: "album-photos", photos: headHit.photos } };
        }
      }
    }
  }
  // Weidian Product Details path: the description feed often carries the chart
  // table images (Kyle 2026-07-25, item 7718340223). Charts sit near the top,
  // so scan forward windows of 10.
  const descPhotos = (item.descImages || []).filter(
    (src) => typeof src === "string" && /^https?:\/\//i.test(src)
  );
  if (descPhotos.length) {
    const hit = await visionWindows(descPhotos, {
      signal,
      referer: item.url || undefined,
    });
    if (hit) {
      return { text: hit.text, source: { via: "desc-photos", photos: hit.photos } };
    }
  }
  // Gallery path: charts also appear early in the product carousel (Kyle
  // 2026-07-25 Mook Palace tee — size chart is photo 2/9). Never only the
  // last 10 — that dropped early charts when the gallery was long.
  if (localPhotos.length) {
    const hit = await visionWindows(localPhotos, {
      signal,
      referer: item.url || undefined,
      maxPhotos: MAX_GALLERY_SCAN,
    });
    if (hit) {
      return { text: hit.text, source: { via: "gallery-photos", photos: hit.photos } };
    }
  }
  return null;
}

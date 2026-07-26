// Silent chart hunt for the live FitBlock (2026-07-25; Kyle: "WHAT IS GOING
// ON WITH THE SIZING CHARTS"). The old hunt lived in SizeRecommendation —
// that panel lost its last caller when every back unified on DetailBody, so
// charts stopped arriving and every card read "No size chart on this
// listing". Yupoo album text first, then a vision scan of album photos,
// then the seller's Product Details photos (resolve descImages — chart
// tables live there, never in the top gallery), then the gallery photos.
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

export async function huntSizeChart(item, { signal } = {}) {
  const album = yupooAlbumUrl(item);
  const localPhotos = [item.image, ...(item.gallery || [])].filter(
    (src) => typeof src === "string" && /^https?:\/\//i.test(src)
  );
  if (album) {
    const data = await fetchYupooImages(album, { signal });
    if (signal && signal.aborted) return null;
    const text = [data && data.description, data && data.sizeNotes].filter(Boolean).join("\n");
    if (text.trim() && parseSizeChart(text)) {
      return { text: text.trim(), source: { via: "album-text", photos: 0 } };
    }
    const albumPhotos = (data && data.images) || [];
    if (albumPhotos.length) {
      const window = albumPhotos.slice(-10);
      const chartText = await fetchChartFromPhotos(window, { signal, referer: album });
      if (chartText && parseSizeChart(chartText)) {
        return { text: chartText, source: { via: "album-photos", photos: window.length } };
      }
    }
  }
  // Weidian Product Details path: the description feed carries the chart
  // table images (Kyle 2026-07-25, item 7718340223). Charts sit near the
  // top, so scan forward windows of 10 (vision caps at 10 per call).
  const descPhotos = (item.descImages || []).filter(
    (src) => typeof src === "string" && /^https?:\/\//i.test(src)
  );
  for (let i = 0; i < descPhotos.length; i += 10) {
    const window = descPhotos.slice(i, i + 10);
    const chartText = await fetchChartFromPhotos(window, {
      signal,
      referer: item.url || undefined,
    });
    if (signal && signal.aborted) return null;
    if (chartText && parseSizeChart(chartText)) {
      return { text: chartText, source: { via: "desc-photos", photos: window.length } };
    }
  }
  // Gallery fallback: resolve already filled it with CDN URLs.
  if (localPhotos.length) {
    const window = localPhotos.slice(-10);
    const chartText = await fetchChartFromPhotos(window, {
      signal,
      referer: item.url || undefined,
    });
    if (chartText && parseSizeChart(chartText)) {
      return { text: chartText, source: { via: "gallery-photos", photos: window.length } };
    }
  }
  return null;
}

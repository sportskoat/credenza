// Silent chart hunt for the live FitBlock (2026-07-25; Kyle: "WHAT IS GOING
// ON WITH THE SIZING CHARTS"). The old hunt lived in SizeRecommendation —
// that panel lost its last caller when every back unified on DetailBody, so
// charts stopped arriving and every card read "No size chart on this
// listing". Yupoo album text first, then a vision scan of album photos,
// then a vision scan of resolved Weidian/Taobao CDN gallery photos. Returns
// chart text parseable by parseSizeChart, or null. Callers throttle (one
// hunt per item per session) and persist the text into sizeNotes.
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
    if (text.trim() && parseSizeChart(text)) return text.trim();
    const albumPhotos = (data && data.images) || [];
    if (albumPhotos.length) {
      const chartText = await fetchChartFromPhotos(albumPhotos.slice(-10), { signal, referer: album });
      if (chartText && parseSizeChart(chartText)) return chartText;
    }
  }
  // Weidian / Taobao path: resolve already filled the gallery with CDN URLs.
  if (localPhotos.length) {
    const chartText = await fetchChartFromPhotos(localPhotos.slice(-10), {
      signal,
      referer: item.url || undefined,
    });
    if (chartText && parseSizeChart(chartText)) return chartText;
  }
  return null;
}

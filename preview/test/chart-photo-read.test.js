// Handoff turn 9 §3 client side: the customer sends the chart photo themselves.
//
// The album path (fetchChartFromPhotos) posts CDN URLs the server fetches
// through its allowlist. A camera frame has no URL, so §3 posts the frame
// INLINE instead. Both wrappers must reach the same endpoint and return the
// same chart text, because §3 says "one ingest path, image or text".
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchChartFromPhotos, readChartFromPhotoFiles } from "../../credenza-fashion.jsx";

const CHART = "M 胸围112 衣长70\nL 胸围116 衣长72";
const DATA_URL =
  "data:image/webp;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

function okChart(text = CHART) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ found: true, chartText: text, scanned: 1 }),
  };
}

describe("chart photo read (handoff turn 9 §3)", () => {
  let calls;
  const realFetch = global.fetch;

  beforeEach(() => {
    calls = [];
    global.fetch = vi.fn(async (url, opts) => {
      calls.push({ url: String(url), body: JSON.parse((opts && opts.body) || "{}") });
      return okChart();
    });
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts a data: URL inline, and never as an image URL", async () => {
    const text = await readChartFromPhotoFiles([DATA_URL]);
    expect(text).toBe(CHART);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("chart-vision");
    expect(calls[0].body.photos).toEqual([DATA_URL]);
    // `images` is the allowlisted-fetch door. A data: URL down that door would
    // be rejected by the server, and rightly so.
    expect(calls[0].body.images).toBeUndefined();
  });

  it("accepts one photo without an array wrapper", async () => {
    await readChartFromPhotoFiles(DATA_URL);
    expect(calls[0].body.photos).toEqual([DATA_URL]);
  });

  it("caps a burst of frames at three", async () => {
    await readChartFromPhotoFiles([DATA_URL, DATA_URL, DATA_URL, DATA_URL, DATA_URL]);
    // Three covers a chart split over two frames plus a retake. The server
    // enforces the same number; this cap keeps the request small on the phone.
    expect(calls[0].body.photos).toHaveLength(3);
  });

  it("sends nothing when no frame is usable", async () => {
    // A remote URL is not a frame — it belongs to the album path.
    expect(await readChartFromPhotoFiles(["https://img.example.com/a.jpg"])).toBeNull();
    expect(await readChartFromPhotoFiles([])).toBeNull();
    expect(await readChartFromPhotoFiles(null)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("passes the referer so the server can label the read", async () => {
    await readChartFromPhotoFiles([DATA_URL], { referer: "https://weidian.com/item.html?itemID=1" });
    expect(calls[0].body.referer).toBe("https://weidian.com/item.html?itemID=1");
  });

  it("returns null on a miss instead of an empty chart", async () => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ found: false }) }));
    expect(await readChartFromPhotoFiles([DATA_URL])).toBeNull();
  });

  it("returns null when the function fails, and does not throw", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    await expect(readChartFromPhotoFiles([DATA_URL])).resolves.toBeNull();
    global.fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    // A bad frame or a dropped connection is a normal outcome here. The caller
    // shows a retry, so this must never reject.
    await expect(readChartFromPhotoFiles([DATA_URL])).resolves.toBeNull();
  });

  it("still posts album URLs down the images door", async () => {
    const text = await fetchChartFromPhotos(["https://img.geilicdn.com/a.jpg"], {
      referer: "https://weidian.com/item.html?itemID=1",
    });
    expect(text).toBe(CHART);
    expect(calls[0].body.images).toEqual(["https://img.geilicdn.com/a.jpg"]);
    expect(calls[0].body.photos).toBeUndefined();
  });

  it("skips the call when there is no album URL to send", async () => {
    expect(await fetchChartFromPhotos([])).toBeNull();
    expect(await fetchChartFromPhotos(null)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

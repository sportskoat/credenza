// Handoff turn 9 §3 client side: the customer sends the chart photo themselves.
//
// The album path (fetchChartFromPhotos) posts CDN URLs the server fetches
// through its allowlist. A camera frame has no URL, so §3 posts the frame
// INLINE instead. Both wrappers must reach the same endpoint and return the
// same chart text, because §3 says "one ingest path, image or text".
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchChartFromPhotos,
  readChartFromPhotoFiles,
  isChartAuthRequired,
  isChartCapReached,
  isChartRateLimited,
  isChartReaderOff,
  CHART_AUTH_REQUIRED,
  CHART_AUTH_COPY,
  CHART_CAP_REACHED,
  CHART_HUNT_UNAVAILABLE_COPY,
  CHART_RATE_LIMITED,
  CHART_READER_OFF,
  CHART_UNAVAILABLE,
  isChartOffline,
  isChartUnavailable,
  chartCapCopy,
} from "../../credenza-fashion.jsx";

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

  // FIX 2c (Kyle 2026-08-03): this used to expect null, and null made the UI
  // print "I could not read that photo." A 502 and a dropped connection are
  // both the server, not the photo, so they answer with the unavailable
  // sentinel now. The rule that matters is unchanged: never reject.
  it("returns the unavailable sentinel when the function fails, and does not throw", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    await expect(readChartFromPhotoFiles([DATA_URL])).resolves.toBe(CHART_UNAVAILABLE);
    global.fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    // A bad frame or a dropped connection is a normal outcome here. The caller
    // shows a retry, so this must never reject.
    await expect(readChartFromPhotoFiles([DATA_URL])).resolves.toBe(CHART_UNAVAILABLE);
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

  // FIX 0 (2026-08-02): chart-vision 401/403 must not look like a bad photo.
  it("maps 401 from chart-vision to CHART_AUTH_REQUIRED (not null)", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    }));
    const result = await readChartFromPhotoFiles([DATA_URL]);
    expect(isChartAuthRequired(result)).toBe(true);
    expect(result).toBe(CHART_AUTH_REQUIRED);
    // Plain miss path stays null — the UI branches on the sentinel only.
    expect(result).not.toBeNull();
  });

  it("maps 403 from chart-vision to CHART_AUTH_REQUIRED", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    }));
    const result = await fetchChartFromPhotos(["https://img.geilicdn.com/a.jpg"]);
    expect(isChartAuthRequired(result)).toBe(true);
  });

  // FIX 2c: a 502 is its own wall. It is not the auth wall, not the cap wall,
  // and not a bad photo. Each of the three stays distinct.
  it("treats 502 as the server, not as auth and not as a bad photo", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    const result = await readChartFromPhotoFiles([DATA_URL]);
    expect(isChartAuthRequired(result)).toBe(false);
    expect(isChartCapReached(result)).toBe(false);
    expect(isChartUnavailable(result)).toBe(true);
    // Offline is a narrower case, and this is not it.
    expect(isChartOffline(result)).toBe(false);
    expect(result).not.toBeNull();
  });

  // FIX 2b (2026-08-03): server daily cap is not a bad photo.
  it("maps 429 from chart-vision to CHART_CAP_REACHED (not null)", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Daily limit reached" }),
    }));
    const result = await readChartFromPhotoFiles([DATA_URL]);
    expect(isChartCapReached(result)).toBe(true);
    expect(result).toBe(CHART_CAP_REACHED);
    expect(isChartAuthRequired(result)).toBe(false);
    expect(result).not.toBeNull();
  });

  it("maps 429 on the album path to CHART_CAP_REACHED", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Daily limit reached" }),
    }));
    const result = await fetchChartFromPhotos(["https://img.geilicdn.com/a.jpg"]);
    expect(isChartCapReached(result)).toBe(true);
  });

  // Kyle 2026-08-04: "WHY IS THIS SO INCONSISTENT." The concurrency limiter's
  // 429 is a Busy, not a spent allowance. The body carries busy: true so the
  // client retries for free instead of telling the customer the cap is gone.
  it("maps a 429 with busy:true to CHART_UNAVAILABLE, never the cap", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Busy. Try again in a moment", busy: true }),
    }));
    const result = await fetchChartFromPhotos(["https://img.geilicdn.com/a.jpg"]);
    expect(result).toBe(CHART_UNAVAILABLE);
    expect(isChartUnavailable(result)).toBe(true);
    expect(isChartCapReached(result)).toBe(false);
  });

  it("maps a 429 with busy:true on the inline path to CHART_UNAVAILABLE", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Busy. Try again in a moment", busy: true }),
    }));
    const result = await readChartFromPhotoFiles([DATA_URL]);
    expect(result).toBe(CHART_UNAVAILABLE);
    expect(isChartCapReached(result)).toBe(false);
  });

  // #31 (Kyle 2026-08-04): the limiter's other 429s carry `code`, and each
  // maps to its own sentinel — never the plan-cap reading that told the owner
  // "You used your 8 free chart reads" on his unlimited account.
  it("maps a 429 with code rate_limited to CHART_RATE_LIMITED, never the cap", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many requests. Slow down", code: "rate_limited" }),
    }));
    const result = await fetchChartFromPhotos(["https://img.geilicdn.com/a.jpg"]);
    expect(result).toBe(CHART_RATE_LIMITED);
    expect(isChartRateLimited(result)).toBe(true);
    expect(isChartCapReached(result)).toBe(false);
    expect(isChartReaderOff(result)).toBe(false);
  });

  it("maps a 429 with code daily_ceiling to CHART_READER_OFF, never the cap", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Daily cost ceiling reached. Try again tomorrow", code: "daily_ceiling" }),
    }));
    const result = await fetchChartFromPhotos(["https://img.geilicdn.com/a.jpg"]);
    expect(result).toBe(CHART_READER_OFF);
    expect(isChartReaderOff(result)).toBe(true);
    expect(isChartCapReached(result)).toBe(false);
    expect(isChartRateLimited(result)).toBe(false);
  });

  it("maps a 429 with code plan_cap to CHART_CAP_REACHED", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Free chartVision allowance used. Upgrade to Pro for more.", code: "plan_cap" }),
    }));
    const result = await fetchChartFromPhotos(["https://img.geilicdn.com/a.jpg"]);
    expect(result).toBe(CHART_CAP_REACHED);
    expect(isChartRateLimited(result)).toBe(false);
    expect(isChartReaderOff(result)).toBe(false);
  });

  it("pins the signed-out customer copy", () => {
    expect(CHART_AUTH_COPY).toBe("You are signed out. Sign in to read charts.");
  });

  // FIX 2b: cap copy names the real N and never reuses the bad-photo line.
  // The free allowance is lifetime, so the copy never says "today".
  it("pins the allowance-cap customer copy", () => {
    expect(chartCapCopy(null)).toMatch(/You used your \d+ free chart reads/);
    expect(chartCapCopy(null)).toMatch(/Sign in for more/);
    expect(chartCapCopy({ state: "free", lim: { chartVisionTotal: 8 } })).toBe(
      "You used your 8 free chart reads. Upgrade for more."
    );
    expect(chartCapCopy(null)).not.toMatch(/today/i);
    expect(chartCapCopy(null)).not.toMatch(/could not read/i);
    expect(chartCapCopy(null)).not.toMatch(/No chart for this one yet/i);
    expect(isChartCapReached(CHART_CAP_REACHED)).toBe(true);
    expect(isChartCapReached(null)).toBe(false);
    expect(isChartCapReached(CHART_AUTH_REQUIRED)).toBe(false);
  });

  // #31 (Kyle 2026-08-04): the old fallback told EVERY non-free plan to
  // "Sign in for more" — the owner read that on his unlimited account.
  // A paying customer gets the monthly sentence; the owner gets the honest
  // "not answering" sentence (the server never caps him, so this wall is a
  // leftover, never a plan claim).
  it("never tells a signed-in non-free plan to sign in", () => {
    expect(chartCapCopy({ state: "pro", lim: {} })).toBe(
      "You used your monthly chart reads. More arrive next month."
    );
    expect(chartCapCopy({ state: "grace", lim: {} })).toBe(
      "You used your monthly chart reads. More arrive next month."
    );
    const ownerCopy = chartCapCopy({ state: "owner", lim: {} });
    expect(ownerCopy).not.toMatch(/sign in/i);
    expect(ownerCopy).not.toMatch(/free chart reads/i);
    expect(ownerCopy).toBe(CHART_HUNT_UNAVAILABLE_COPY);
  });
});

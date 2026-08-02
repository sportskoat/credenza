// Low-cost chart hunt: one ranked candidate per paid read, image-key cache,
// local validation. Full stub of the app module (no importOriginal).
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { clearChartImageCache, rememberChartImage } from "../../components/chart-pipeline.js";

const { visionMock, yupooMock, descMock } = vi.hoisted(() => ({
  visionMock: vi.fn(),
  yupooMock: vi.fn(),
  descMock: vi.fn(),
}));

vi.mock("../../credenza-fashion.jsx", () => ({
  fetchChartFromPhotos: visionMock,
  fetchYupooImages: yupooMock,
  fetchDescImages: descMock,
  // FIX 0: real helper so auth sentinel from visionMock is recognized.
  isChartAuthRequired: (result) =>
    !!(result && typeof result === "object" && result.authRequired === true),
  parseSizeChart: (text) => {
    if (!text || typeof text !== "string" || !/chest/i.test(text)) return null;
    const rows = [];
    for (const m of String(text).matchAll(/\b(XXS|XS|S|M|L|XL|XXL)\b/gi)) {
      const size = m[1].toUpperCase();
      if (!rows.some((r) => r.size === size)) rows.push({ size, chest: 100 + rows.length * 4 });
    }
    return rows.length >= 2 ? { rows } : null;
  },
  yupooAlbumUrl: () => null,
}));

const { huntSizeChart } = await import("../../components/size-chart-hunt.js");

const CHART = "M: chest 116, length 70\nL: chest 120, length 72";

function item(extra = {}) {
  return {
    id: "hunt-desc",
    url: "https://weidian.com/item.html?itemID=7718340223",
    image: "https://si.geilicdn.com/gallery-1.jpg",
    gallery: ["https://si.geilicdn.com/gallery-2.jpg"],
    links: [],
    ...extra,
  };
}

beforeEach(() => {
  visionMock.mockReset();
  yupooMock.mockReset();
  descMock.mockReset();
  descMock.mockResolvedValue([]);
  clearChartImageCache();
});

afterEach(() => {
  clearChartImageCache();
});

describe("huntSizeChart single-candidate ranking", () => {
  it("sends one chart-named photo, not a window of product photos", async () => {
    visionMock.mockResolvedValue(CHART);
    const found = await huntSizeChart(
      item({
        descImages: [
          "https://si.geilicdn.com/product-1.jpg",
          "https://si.geilicdn.com/size_chart_table.jpg",
          "https://si.geilicdn.com/product-2.jpg",
        ],
      })
    );
    expect(found.text).toBe(CHART);
    expect(found.source.photos).toBe(1);
    expect(found.source.imageHash).toBeTruthy();
    expect(visionMock).toHaveBeenCalledTimes(1);
    expect(visionMock.mock.calls[0][0]).toEqual(["https://si.geilicdn.com/size_chart_table.jpg"]);
  });

  it("prefers known chartImages over the gallery", async () => {
    visionMock.mockResolvedValue(CHART);
    const found = await huntSizeChart(
      item({
        chartImages: ["https://si.geilicdn.com/尺码表.jpg"],
        descImages: ["https://si.geilicdn.com/detail-1.jpg"],
      })
    );
    expect(found.source.via).toBe("chart-photos");
    expect(visionMock.mock.calls[0][0]).toEqual(["https://si.geilicdn.com/尺码表.jpg"]);
  });

  it("tries the next ranked candidate when the first fails validation", async () => {
    visionMock
      .mockResolvedValueOnce("not a chart at all")
      .mockResolvedValueOnce(CHART);
    const found = await huntSizeChart(
      item({
        descImages: [
          "https://si.geilicdn.com/size-maybe.jpg",
          "https://si.geilicdn.com/size_chart.jpg",
        ],
      })
    );
    expect(found.text).toBe(CHART);
    expect(visionMock).toHaveBeenCalledTimes(2);
    // Each call is a single photo.
    expect(visionMock.mock.calls[0][0]).toHaveLength(1);
    expect(visionMock.mock.calls[1][0]).toHaveLength(1);
  });

  it("never pays twice for the same image key in one session", async () => {
    visionMock.mockResolvedValue(CHART);
    const url = "https://si.geilicdn.com/size_chart_shared.jpg";
    const first = await huntSizeChart(item({ id: "one", descImages: [url], gallery: [], image: null }));
    expect(first.source.imageHash).toBeTruthy();
    expect(visionMock).toHaveBeenCalledTimes(1);

    const second = await huntSizeChart(item({ id: "two", descImages: [url], gallery: [], image: null }));
    expect(second.text).toBe(CHART);
    expect(second.source.via).toBe("image-cache");
    expect(visionMock).toHaveBeenCalledTimes(1);
  });

  it("reuses a shelf sibling only when the imageHash matches a candidate", async () => {
    const url = "https://si.geilicdn.com/factory-chart.jpg";
    const { chartImageKey } = await import("../../components/chart-pipeline.js");
    const key = chartImageKey(url);
    const donor = {
      id: "donor",
      seller: "Mook",
      sizeChartText: CHART,
      sizeChartSource: { via: "desc-photos", photos: 1, imageHash: key, at: "2026-07-30T10:00:00.000Z" },
    };
    visionMock.mockResolvedValue(CHART);
    const found = await huntSizeChart(
      item({ id: "target", seller: "Mook", descImages: [url], gallery: [], image: null }),
      { shelfItems: [donor] }
    );
    expect(found.source.via).toBe("image-cache");
    expect(visionMock).not.toHaveBeenCalled();
  });

  it("does not borrow a sibling chart by seller when the image differs", async () => {
    const donor = {
      id: "donor",
      seller: "Mook",
      sizeChartText: CHART,
      sizeChartSource: {
        via: "desc-photos",
        photos: 1,
        imageHash: "yupoo:other/chart",
        at: "2026-07-30T10:00:00.000Z",
      },
    };
    visionMock.mockResolvedValue(null);
    const found = await huntSizeChart(
      item({
        id: "target",
        seller: "Mook",
        descImages: ["https://si.geilicdn.com/different-product.jpg"],
        gallery: [],
        image: null,
      }),
      { shelfItems: [donor] }
    );
    expect(found).toBe(null);
  });
});

describe("huntSizeChart description re-fetch", () => {
  it("fetches Product Details when descImages is empty and everything else missed", async () => {
    visionMock.mockResolvedValue(null);
    descMock.mockResolvedValue(["https://si.geilicdn.com/size_chart_fetched.jpg"]);
    visionMock.mockImplementation(async (urls) =>
      (urls || []).includes("https://si.geilicdn.com/size_chart_fetched.jpg") ? CHART : null
    );
    const found = await huntSizeChart(item({ descImages: [], gallery: [], image: null }));
    expect(found.text).toBe(CHART);
    expect(found.source.via).toBe("desc-photos");
    expect(descMock).toHaveBeenCalledTimes(1);
    expect(visionMock.mock.calls.every((c) => c[0].length === 1)).toBe(true);
  });

  it("never re-fetches when the card already carries description photos", async () => {
    visionMock.mockResolvedValue(null);
    await huntSizeChart(item({ descImages: ["https://si.geilicdn.com/d-0.jpg"], gallery: [], image: null }));
    expect(descMock).not.toHaveBeenCalled();
  });

  it("stays null when the fetch returns nothing", async () => {
    visionMock.mockResolvedValue(null);
    descMock.mockResolvedValue([]);
    const found = await huntSizeChart(item({ descImages: [], gallery: [], image: null }));
    expect(found).toBe(null);
  });
});

describe("huntSizeChart rejects low-confidence model text", () => {
  it("returns null when the model text fails local validation", async () => {
    visionMock.mockResolvedValue("Superbuy payment guide only");
    const found = await huntSizeChart(
      item({ descImages: ["https://si.geilicdn.com/size_chart.jpg"], gallery: [], image: null })
    );
    expect(found).toBe(null);
  });
});

// FIX 0 (2026-08-02): hunt must surface auth, not "No size chart found."
describe("huntSizeChart auth wall (FIX 0)", () => {
  it("returns { authRequired: true } on first 401/403 and stops further paid reads", async () => {
    visionMock.mockResolvedValue({ authRequired: true });
    const found = await huntSizeChart(
      item({
        descImages: [
          "https://si.geilicdn.com/size_chart_a.jpg",
          "https://si.geilicdn.com/size_chart_b.jpg",
          "https://si.geilicdn.com/size_chart_c.jpg",
        ],
        gallery: [],
        image: null,
      })
    );
    expect(found).toEqual({ authRequired: true });
    // One paid attempt then stop — more candidates cannot fix a signed-out wall.
    expect(visionMock).toHaveBeenCalledTimes(1);
  });
});

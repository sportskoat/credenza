// The silent chart hunt prefers the seller's Product Details photos
// (resolve descImages) over the top gallery when both exist (Weidian
// 7718340223: chart was desc photo #1). Gallery still matters: charts also
// land early in the product carousel (Kyle 2026-07-25 Mook tee, slide 2/9).
// Full stub of the app module: no importOriginal (circular-module mocks
// with importOriginal do not apply reliably here).
import { describe, expect, it, vi, beforeEach } from "vitest";

const { visionMock, yupooMock, descMock } = vi.hoisted(() => ({
  visionMock: vi.fn(),
  yupooMock: vi.fn(),
  descMock: vi.fn(),
}));

vi.mock("../../credenza-fashion.jsx", () => ({
  fetchChartFromPhotos: visionMock,
  fetchYupooImages: yupooMock,
  fetchDescImages: descMock,
  parseSizeChart: (text) => (/chest/i.test(text) ? { rows: [{ size: "M" }, { size: "L" }] } : null),
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
});

describe("huntSizeChart description-photo priority", () => {
  it("scans the Product Details photos before the gallery", async () => {
    visionMock.mockResolvedValue(CHART);
    const found = await huntSizeChart(
      item({ descImages: ["https://si.geilicdn.com/chart_467_207.jpg", "https://si.geilicdn.com/detail-2.jpg"] })
    );
    expect(found).toEqual({ text: CHART, source: { via: "desc-photos", photos: 2 } });
    // One vision call, and it was the description photos — not the gallery.
    expect(visionMock).toHaveBeenCalledTimes(1);
    expect(visionMock.mock.calls[0][0]).toEqual([
      "https://si.geilicdn.com/chart_467_207.jpg",
      "https://si.geilicdn.com/detail-2.jpg",
    ]);
  });

  it("walks forward windows of 10 across a long description", async () => {
    visionMock.mockResolvedValueOnce(null).mockResolvedValueOnce(CHART);
    const descImages = Array.from({ length: 12 }, (_, i) => `https://si.geilicdn.com/d-${i}.jpg`);
    const found = await huntSizeChart(item({ descImages }));
    expect(found).toEqual({ text: CHART, source: { via: "desc-photos", photos: 2 } });
    expect(visionMock).toHaveBeenCalledTimes(2);
    expect(visionMock.mock.calls[0][0]).toHaveLength(10);
    expect(visionMock.mock.calls[1][0]).toEqual(descImages.slice(10));
  });

  it("falls back to the gallery when the description has no chart", async () => {
    visionMock.mockResolvedValueOnce(null).mockResolvedValueOnce(CHART);
    const found = await huntSizeChart(item({ descImages: ["https://si.geilicdn.com/d-0.jpg"] }));
    expect(found).toEqual({ text: CHART, source: { via: "gallery-photos", photos: 2 } });
    expect(visionMock.mock.calls[1][0]).toEqual([
      "https://si.geilicdn.com/gallery-1.jpg",
      "https://si.geilicdn.com/gallery-2.jpg",
    ]);
  });

  it("scans gallery from the start so early chart slides are not dropped", async () => {
    // Kyle 2026-07-25: Mook tee chart is photo 2/9. Old code used slice(-10)
    // and skipped the front of longer galleries.
    visionMock.mockResolvedValue(CHART);
    const gallery = Array.from({ length: 14 }, (_, i) => `https://si.geilicdn.com/g-${i}.jpg`);
    // Put the "chart" at index 1 (second slide) — must be in the first window.
    const found = await huntSizeChart(
      item({
        image: "https://si.geilicdn.com/main.jpg",
        gallery,
        descImages: [],
      })
    );
    expect(found).toEqual({ text: CHART, source: { via: "gallery-photos", photos: 10 } });
    const firstWindow = visionMock.mock.calls[0][0];
    expect(firstWindow[0]).toBe("https://si.geilicdn.com/main.jpg");
    expect(firstWindow).toContain("https://si.geilicdn.com/g-0.jpg");
    expect(firstWindow).toContain("https://si.geilicdn.com/g-1.jpg");
  });
});

// Kyle 2026-07-26: "the sizing charts are not picking up this 'by the way'
// link… it's got that size chart right there in the product details of the
// advertisement, but for whatever reason it doesn't want to pick it up."
// On Weidian the chart usually lives ONLY in the description feed. A card
// saved before descImages shipped (b794602), or one whose resolve was
// skipped/capped/failed, holds an empty list — so the hunt never saw the one
// place the chart was, and reported "No size chart on this listing".
describe("huntSizeChart re-fetches missing description photos", () => {
  it("fetches Product Details when descImages is empty and everything else missed", async () => {
    visionMock.mockResolvedValue(null); // gallery has no chart
    descMock.mockResolvedValue([
      "https://si.geilicdn.com/fetched-chart.jpg",
      "https://si.geilicdn.com/fetched-2.jpg",
    ]);
    // The refetched window IS the chart.
    visionMock.mockImplementation(async (urls) =>
      (urls || []).includes("https://si.geilicdn.com/fetched-chart.jpg") ? CHART : null
    );
    const found = await huntSizeChart(item({ descImages: [] }));
    expect(found).toEqual({ text: CHART, source: { via: "desc-photos", photos: 2 } });
    expect(descMock).toHaveBeenCalledTimes(1);
  });

  it("never re-fetches when the card already carries description photos", async () => {
    visionMock.mockResolvedValue(null);
    await huntSizeChart(item({ descImages: ["https://si.geilicdn.com/d-0.jpg"] }));
    expect(descMock).not.toHaveBeenCalled();
  });

  it("stays null when the fetch returns nothing", async () => {
    visionMock.mockResolvedValue(null);
    descMock.mockResolvedValue([]);
    const found = await huntSizeChart(item({ descImages: [] }));
    expect(found).toBe(null);
  });
});

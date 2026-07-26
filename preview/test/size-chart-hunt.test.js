// The silent chart hunt prefers the seller's Product Details photos
// (resolve descImages) over the top gallery — chart tables live in the
// description feed, never in the gallery (Kyle 2026-07-25, Weidian item
// 7718340223: chart was desc photo #1, gallery scan found nothing).
// Full stub of the app module: no importOriginal (circular-module mocks
// with importOriginal do not apply reliably here).
import { describe, expect, it, vi, beforeEach } from "vitest";

const { visionMock, yupooMock } = vi.hoisted(() => ({ visionMock: vi.fn(), yupooMock: vi.fn() }));

vi.mock("../../credenza-fashion.jsx", () => ({
  fetchChartFromPhotos: visionMock,
  fetchYupooImages: yupooMock,
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
});

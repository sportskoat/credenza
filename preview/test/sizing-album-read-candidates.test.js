// Fix 1 (2026-08-02): manual album-read candidates put chartImages first.
import { describe, expect, it } from "vitest";
import { sizingAlbumReadCandidates } from "../../credenza-fashion.jsx";

describe("sizingAlbumReadCandidates", () => {
  it("puts chartImages first when present", () => {
    const chart = "https://photo.yupoo.com/s/c1/big.jpg";
    const cover = "https://si.geilicdn.com/cover.jpg";
    const gal = "https://si.geilicdn.com/g.jpg";
    const out = sizingAlbumReadCandidates(
      { image: cover, gallery: [gal], chartImages: [chart] },
      24
    );
    expect(out[0]).toBe(chart);
    expect(out).toEqual([chart, cover, gal]);
  });

  it("dedupes a chart URL that also appears in the gallery", () => {
    const chart = "https://photo.yupoo.com/s/c1/big.jpg";
    const out = sizingAlbumReadCandidates(
      { image: chart, gallery: [], chartImages: [chart] },
      24
    );
    expect(out).toEqual([chart]);
  });

  it("drops non-http sources and respects the cap", () => {
    const out = sizingAlbumReadCandidates(
      {
        image: "data:image/jpeg;base64,xx",
        gallery: ["https://a.test/1.jpg", "https://a.test/2.jpg", "https://a.test/3.jpg"],
        chartImages: ["https://photo.yupoo.com/s/c1/big.jpg", "not-a-url"],
      },
      2
    );
    expect(out).toEqual([
      "https://photo.yupoo.com/s/c1/big.jpg",
      "https://a.test/1.jpg",
    ]);
  });

  it("returns product photos alone when there are no chartImages", () => {
    const out = sizingAlbumReadCandidates(
      { image: "https://a.test/c.jpg", gallery: ["https://a.test/g.jpg"] },
      24
    );
    expect(out).toEqual(["https://a.test/c.jpg", "https://a.test/g.jpg"]);
  });
});

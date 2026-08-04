// Kyle 2026-08-03, Weidian item 7796666481: the size chart was in plain sight
// on the listing, and the read still failed. On Weidian the chart lives in the
// Product Details feed, so it reaches the card as descImages. The paid read
// must look there first. sizingAlbumReadCandidates never did.
import { describe, expect, it } from "vitest";
import { sizingChartReadCandidates } from "../../credenza-fashion.jsx";

const DESC_CHART =
  "https://si.geilicdn.com/open1760451331-1234478995-08990000019f0e5b24860a23b491_1080_776.jpg";
const DESC_SHOT = "https://si.geilicdn.com/open-1234478995-aa11_1900_1200.jpg";
const DESC_TALL = "https://si.geilicdn.com/open-1234478995-bb22_800_1200.jpg";

describe("sizingChartReadCandidates", () => {
  it("reads the product-details photos before the album photos", () => {
    const out = sizingChartReadCandidates(
      {
        image: "https://si.geilicdn.com/cover.jpg",
        gallery: ["https://si.geilicdn.com/g.jpg"],
        descImages: [DESC_TALL, DESC_CHART],
      },
      24
    );
    expect(out[0]).toBe(DESC_CHART);
    expect(out).toEqual([
      DESC_CHART,
      DESC_TALL,
      "https://si.geilicdn.com/cover.jpg",
      "https://si.geilicdn.com/g.jpg",
    ]);
  });

  it("puts a table-shaped product-details photo ahead of a portrait one", () => {
    const out = sizingChartReadCandidates(
      { descImages: [DESC_TALL, DESC_SHOT, DESC_CHART] },
      24
    );
    // _1900_1200 is 1.58 wide, _1080_776 is 1.39 wide, _800_1200 is portrait.
    expect(out).toEqual([DESC_SHOT, DESC_CHART, DESC_TALL]);
  });

  it("still puts a known chart tile first", () => {
    const chart = "https://photo.yupoo.com/s/c1/big.jpg";
    const out = sizingChartReadCandidates(
      { chartImages: [chart], descImages: [DESC_CHART], image: "https://a.test/c.jpg" },
      24
    );
    expect(out).toEqual([chart, DESC_CHART, "https://a.test/c.jpg"]);
  });

  it("dedupes a photo that is in both lists", () => {
    const out = sizingChartReadCandidates(
      { descImages: [DESC_CHART], chartImages: [DESC_CHART], image: DESC_CHART },
      24
    );
    expect(out).toEqual([DESC_CHART]);
  });

  it("drops non-http sources and respects the cap", () => {
    const out = sizingChartReadCandidates(
      {
        descImages: [DESC_CHART, "data:image/jpeg;base64,xx", DESC_TALL],
        image: "https://a.test/c.jpg",
      },
      2
    );
    expect(out).toEqual([DESC_CHART, DESC_TALL]);
  });

  it("falls back to the album photos when there are no product-details photos", () => {
    const out = sizingChartReadCandidates(
      { image: "https://a.test/c.jpg", gallery: ["https://a.test/g.jpg"] },
      24
    );
    expect(out).toEqual(["https://a.test/c.jpg", "https://a.test/g.jpg"]);
  });
});

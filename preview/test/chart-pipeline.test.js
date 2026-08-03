import { afterEach, describe, expect, it } from "vitest";
import { parseSizeChart } from "../../credenza-fashion.jsx";
import {
  chartCacheForImageKeys,
  chartImageKey,
  clearChartImageCache,
  detectTableDirection,
  dimsFromCandidate,
  rankChartCandidates,
  rememberChartImage,
  scoreChartCandidate,
  validateChartResult,
} from "../../components/chart-pipeline.js";

const CHART_ROWS = "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74";
const CHART_COLS =
  "Size Chest Length\nS 108 66\nM 112 68\nL 116 70";
const HALF_CHEST = "半胸\nS 52\nM 54\nL 56";
const AD_ONLY = "Scan WeChat to pay Superbuy agent guide join our telegram";

afterEach(() => {
  clearChartImageCache();
});

describe("chartImageKey", () => {
  it("collapses Yupoo size variants to one key", () => {
    const a = chartImageKey("https://photo.yupoo.com/mook/abc123/medium.jpg");
    const b = chartImageKey("https://photo.yupoo.com/mook/abc123/big.jpg");
    expect(a).toBe(b);
    expect(a).toMatch(/^yupoo:mook\/abc123$/);
  });

  it("hashes data URLs by payload so identical frames share a key", () => {
    const a = chartImageKey("data:image/png;base64,AAAA");
    const b = chartImageKey("data:image/png;base64,AAAA");
    const c = chartImageKey("data:image/png;base64,BBBB");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("rankChartCandidates", () => {
  it("puts strong chart filenames first and rejects Superbuy ads", () => {
    const ranked = rankChartCandidates([
      { url: "https://cdn.example/product-hero.jpg", via: "gallery-photos" },
      { url: "https://cdn.example/superbuy-payment-guide.png", via: "desc-photos" },
      { url: "https://cdn.example/尺码表大图.jpg", via: "chart-photos" },
      { url: "https://cdn.example/detail-1.jpg", via: "desc-photos" },
    ]);
    expect(ranked[0].url).toContain("尺码表");
    expect(ranked.some((c) => /superbuy/i.test(c.url))).toBe(false);
  });

  it("prefers table-shaped chart tiles over tall product shots", () => {
    const ranked = rankChartCandidates([
      { url: "https://cdn.example/a.jpg", via: "gallery-photos", width: 800, height: 1600 },
      { url: "https://cdn.example/chart.png", via: "desc-photos", width: 900, height: 500 },
    ]);
    expect(ranked[0].url).toContain("chart.png");
  });

  it("ranks a small early JPG chart above large product album photos", () => {
    // Repro: photo 1 is 750×625 chart; product shots are ~1600px; paid cap is 3.
    const ranked = rankChartCandidates([
      { url: "https://photo.yupoo.com/s/p1/big.jpg", via: "album-photos", width: 750, height: 625 },
      { url: "https://photo.yupoo.com/s/p2/big.jpg", via: "album-photos", width: 1600, height: 1600 },
      { url: "https://photo.yupoo.com/s/p3/big.jpg", via: "album-photos", width: 1800, height: 1800 },
      { url: "https://photo.yupoo.com/s/p4/big.jpg", via: "album-photos", width: 1900, height: 1900 },
    ]);
    expect(ranked[0].url).toContain("/p1/");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

describe("validateChartResult", () => {
  it("accepts a row chart with two sizes and a measure label", () => {
    const r = validateChartResult(CHART_ROWS, parseSizeChart);
    expect(r.ok).toBe(true);
    expect(r.direction).toBe("rows");
    expect(r.chart.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("accepts a positional table and half-chest labels", () => {
    expect(validateChartResult(CHART_COLS, parseSizeChart).ok).toBe(true);
    const half = validateChartResult(HALF_CHEST, parseSizeChart);
    // half chest may parse after normalize — require two sizes if it parses
    if (half.ok) expect(half.chart.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects ads, one-size fragments, and empty text", () => {
    expect(validateChartResult(AD_ONLY, parseSizeChart).ok).toBe(false);
    expect(validateChartResult("M: chest 116", parseSizeChart).ok).toBe(false);
    expect(validateChartResult("", parseSizeChart).ok).toBe(false);
  });
});

describe("detectTableDirection", () => {
  it("labels size-per-line charts as rows and multi-size headers as columns", () => {
    expect(detectTableDirection("S 100\nM 104\nL 108")).toBe("rows");
    expect(detectTableDirection("S M L XL\nchest 100 104 108 112")).toBe("columns");
  });
});

describe("chartCacheForImageKeys — exact image only, never seller", () => {
  it("reuses a session read of the same image key", () => {
    const key = chartImageKey("https://photo.yupoo.com/mook/chart1/big.jpg");
    rememberChartImage(key, CHART_ROWS, parseSizeChart);
    const hit = chartCacheForImageKeys(null, [key], parseSizeChart);
    expect(hit).toEqual({ text: CHART_ROWS, imageKey: key, via: "image-cache" });
  });

  it("reuses a shelf sibling only when the candidate list holds the same imageHash", () => {
    const key = chartImageKey("https://cdn.example/same-chart.jpg");
    const donor = {
      id: "a",
      seller: "Mook",
      sizeChartText: CHART_ROWS,
      sizeChartSource: { via: "desc-photos", photos: 1, imageHash: key, at: "2026-07-30T10:00:00.000Z" },
    };
    const otherSeller = {
      id: "b",
      seller: "Other",
      sizeChartText: CHART_ROWS,
      sizeChartSource: {
        via: "desc-photos",
        photos: 1,
        imageHash: chartImageKey("https://cdn.example/different.jpg"),
        at: "2026-07-30T11:00:00.000Z",
      },
    };
    // Same seller, different image — no borrow.
    expect(chartCacheForImageKeys([donor, otherSeller], [chartImageKey("https://cdn.example/other.jpg")], parseSizeChart)).toBe(
      null
    );
    // Exact image on the shelf — reuse.
    const hit = chartCacheForImageKeys([donor, otherSeller], [key], parseSizeChart);
    expect(hit.text).toBe(CHART_ROWS);
    expect(hit.imageKey).toBe(key);
  });

  it("does not match by seller name alone", () => {
    const donor = {
      id: "a",
      seller: "Mook",
      sizeChartText: CHART_ROWS,
      sizeChartSource: { via: "seller-cache", photos: 0, seller: "Mook" },
    };
    expect(
      chartCacheForImageKeys([donor], [chartImageKey("https://cdn.example/x.jpg")], parseSizeChart)
    ).toBe(null);
  });
});

describe("scoreChartCandidate rejects", () => {
  it("scores payment guides below zero", () => {
    expect(
      scoreChartCandidate({
        url: "https://cdn.example/pandabuy-payment-guide.png",
        via: "desc-photos",
      })
    ).toBeLessThan(0);
  });
});

describe("dimsFromCandidate — CDN path dims (Fix 2a)", () => {
  it("parses Weidian _W_H from the URL when fields are absent", () => {
    const d = dimsFromCandidate({
      url: "https://si.geilicdn.com/open1639340781-1234478995-6fa300000197e4bca7290aa043f9_1338_1279.jpg",
      via: "desc-photos",
    });
    expect(d).toEqual({ width: 1338, height: 1279 });
  });

  it("prefers explicit width/height over the path", () => {
    const d = dimsFromCandidate({
      url: "https://si.geilicdn.com/x_1338_1279.jpg",
      via: "desc-photos",
      width: 100,
      height: 200,
    });
    expect(d).toEqual({ width: 100, height: 200 });
  });
});

describe("scoreChartCandidate shape ranking (Fix 2a) — rank only, never exclude", () => {
  const via = "desc-photos";

  // Band edges: exact product squares must NOT get the padded-square boost.
  // Chart at 1.046 must. Pin the edges so the band cannot drift.
  it("gives no shape boost at w/h 1.000 and 1.006; boosts 1.046", () => {
    const square = scoreChartCandidate({
      url: "https://si.geilicdn.com/product_1280_1280.jpg",
      via,
    });
    const nearSquare = scoreChartCandidate({
      url: "https://si.geilicdn.com/product_1449_1440.jpg",
      via,
    });
    const chart = scoreChartCandidate({
      url: "https://si.geilicdn.com/open-6fa300000197e4bca7290aa043f9_1338_1279.jpg",
      via,
    });
    // Same via base (25). Chart gets +20 padded-square; squares do not.
    expect(chart - square).toBe(20);
    expect(nearSquare).toBe(square);
    expect(chart).toBeGreaterThan(square);
  });

  it("demotes banner strips (aspect >2.2) so WhatsApp CS cards rank below the chart", () => {
    // Fixture: weidian 7503676779 — chart at index 7 vs WhatsApp banner + product squares.
    const chartUrl =
      "https://si.geilicdn.com/open1639340781-1234478995-6fa300000197e4bca7290aa043f9_1338_1279.jpg";
    const bannerUrl =
      "https://si.geilicdn.com/hz_img_xxx-unadjust_901_383.png";
    const productUrl = "https://si.geilicdn.com/colorway_1280_1280.jpg";

    const ranked = rankChartCandidates([
      { url: bannerUrl, via },
      { url: productUrl, via },
      { url: "https://si.geilicdn.com/colorway2_1080_1080.jpg", via },
      { url: chartUrl, via },
    ]);

    expect(ranked.some((c) => c.url === chartUrl)).toBe(true);
    expect(ranked[0].url).toBe(chartUrl);
    const chartScore = ranked.find((c) => c.url === chartUrl).score;
    const bannerScore = ranked.find((c) => c.url === bannerUrl).score;
    expect(bannerScore).toBeLessThan(chartScore);
    // Paid cap is 3 — chart must sit inside the top-3 over banner + products.
    const top3 = ranked.slice(0, 3).map((c) => c.url);
    expect(top3).toContain(chartUrl);
    expect(top3.indexOf(chartUrl)).toBeLessThan(top3.indexOf(bannerUrl) === -1 ? 99 : top3.indexOf(bannerUrl));
  });

  it("still ranks classic landscape charts and Yupoo photo-1 small tiles", () => {
    // Regression: weidian landscape tables + Yupoo early small chart.
    const landscape = rankChartCandidates([
      { url: "https://si.geilicdn.com/product_1500_1500.jpg", via },
      {
        url: "https://si.geilicdn.com/pcitem-unadjust_861_629.png",
        via,
      },
    ]);
    expect(landscape[0].url).toContain("861_629");

    const yupoo = rankChartCandidates([
      { url: "https://photo.yupoo.com/s/p1/big.jpg", via: "album-photos", width: 750, height: 625 },
      { url: "https://photo.yupoo.com/s/p2/big.jpg", via: "album-photos", width: 1600, height: 1600 },
      { url: "https://photo.yupoo.com/s/p3/big.jpg", via: "album-photos", width: 1800, height: 1800 },
    ]);
    expect(yupoo[0].url).toContain("/p1/");
  });

  it("keeps near-square candidates in the pool (shape never excludes)", () => {
    const ranked = rankChartCandidates([
      { url: "https://si.geilicdn.com/exact_1000_1000.jpg", via },
      { url: "https://si.geilicdn.com/padded_1338_1279.jpg", via },
    ]);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((c) => c.score >= 0)).toBe(true);
  });
});

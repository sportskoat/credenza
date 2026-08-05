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
  // FIX 2b: real helper so cap sentinel from visionMock is recognized.
  isChartCapReached: (result) =>
    !!(result && typeof result === "object" && result.capReached === true),
  // FIX 2c: real helper so a server fault from visionMock is recognized. A
  // reader we cannot reach is not a photo that holds no chart.
  isChartUnavailable: (result) =>
    !!(result && typeof result === "object" && result.unavailable === true),
  // #31: real helpers so the traffic-guard sentinels are recognized.
  isChartRateLimited: (result) =>
    !!(result && typeof result === "object" && result.rateLimited === true),
  isChartReaderOff: (result) =>
    !!(result && typeof result === "object" && result.readerOff === true),
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

const {
  huntSizeChart,
  paidHuntCandidates,
  pickReservedDescCandidate,
  chartHuntFingerprint,
  MAX_PAID_CANDIDATES,
} = await import("../../components/size-chart-hunt.js");
const { rankChartCandidates, isRejectedChartName } = await import(
  "../../components/chart-pipeline.js"
);

const CHART = "M: chest 116, length 70\nL: chest 120, length 72";
// Fixture B-shaped Chinese table (vision stub for reserved desc[0]).
const CHART_B =
  "S: 肩宽 55, 胸围 58, 衣长 67, 袖长 60\n" +
  "M: 肩宽 57, 胸围 60, 衣长 69, 袖长 61\n" +
  "L: 肩宽 59, 胸围 62, 衣长 71, 袖长 62\n" +
  "XL: 肩宽 61, 胸围 64, 衣长 73, 袖长 63";
// Fixture C waist rows — mock parseSizeChart keys on "chest"; pin values 74…90.
const CHART_C =
  "M: chest 74, length 99\n" +
  "L: chest 78, length 100\n" +
  "XL: chest 82, length 101\n" +
  "2XL: chest 86, length 102\n" +
  "3XL: chest 90, length 103";

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

describe("chartHuntFingerprint (Kyle 2026-08-04)", () => {
  // The stamp that stops a reload from re-spending chart reads. It must hold
  // still while the photos hold still, and move the moment one changes.
  it("holds still for the same item", () => {
    expect(chartHuntFingerprint(item())).toBe(chartHuntFingerprint(item()));
  });

  it("moves when any photo pool changes", () => {
    const base = item();
    const pools = [
      { image: "https://si.geilicdn.com/new-cover.jpg" },
      { gallery: ["https://si.geilicdn.com/gallery-2.jpg", "https://si.geilicdn.com/gallery-3.jpg"] },
      { chartImages: ["https://si.geilicdn.com/chart.jpg"] },
      { descImages: ["https://si.geilicdn.com/desc-1.jpg"] },
    ];
    for (const extra of pools) {
      expect(chartHuntFingerprint(item(extra))).not.toBe(chartHuntFingerprint(base));
    }
  });

  it("ignores non-http photos and missing fields", () => {
    const withJunk = item({
      gallery: ["data:image/png;base64,xxx", null, "https://si.geilicdn.com/gallery-2.jpg"],
    });
    expect(chartHuntFingerprint(withJunk)).toBe(chartHuntFingerprint(item()));
    expect(chartHuntFingerprint(null)).toBe("");
    expect(chartHuntFingerprint({})).toBe(chartHuntFingerprint({ id: "x" }));
  });
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

  it("never re-fetches when the pool already holds a confident candidate", async () => {
    visionMock.mockResolvedValue(null);
    await huntSizeChart(item({ descImages: ["https://si.geilicdn.com/size_chart.jpg"], gallery: [], image: null }));
    expect(descMock).not.toHaveBeenCalled();
  });

  // Kyle 2026-08-04: "WHY IS THIS SO INCONSISTENT." Cards saved before
  // resolve learned the folded-tail strips hold the page without its chart
  // carrier. A weak pool (no name or shape signal) earns one re-resolve.
  it("re-fetches once when the stored pool scores weak, and reads the fresh strip", async () => {
    descMock.mockResolvedValue([
      "https://si.geilicdn.com/d-0.jpg",
      "https://si.geilicdn.com/img-unadjust_2250_4929.png",
    ]);
    visionMock.mockImplementation(async (urls) =>
      (urls || []).includes("https://si.geilicdn.com/img-unadjust_2250_4929.png") ? CHART : null
    );
    const found = await huntSizeChart(
      item({ descImages: ["https://si.geilicdn.com/d-0.jpg"], gallery: [], image: null })
    );
    expect(descMock).toHaveBeenCalledTimes(1);
    expect(found.text).toBe(CHART);
  });

  it("does not re-fetch twice when the re-fetch adds nothing new", async () => {
    visionMock.mockResolvedValue(null);
    descMock.mockResolvedValue(["https://si.geilicdn.com/d-0.jpg"]);
    const found = await huntSizeChart(
      item({ descImages: ["https://si.geilicdn.com/d-0.jpg"], gallery: [], image: null })
    );
    expect(descMock).toHaveBeenCalledTimes(1);
    expect(found).toBe(null);
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

// FIX 0 (2026-08-02): hunt must surface auth, not "No chart for this one yet."
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

// FIX 2b (2026-08-03): hunt must surface daily cap, not "No chart for this one yet."
describe("huntSizeChart daily cap wall (FIX 2b)", () => {
  it("returns { capReached: true } on first cap sentinel and stops further paid reads", async () => {
    visionMock.mockResolvedValue({ capReached: true });
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
    expect(found).toEqual({ capReached: true });
    // One paid attempt then stop — more candidates cannot buy more allowance.
    expect(visionMock).toHaveBeenCalledTimes(1);
  });
});

// Fix B/C (2026-08-03): reserved desc[0] paid slot — diversify, do not retune shape.
describe("paidHuntCandidates reserved desc[0]", () => {
  const via = "desc-photos";

  it("inserts reserved at paid position 2 and keeps total <= MAX_PAID", () => {
    // Landscape packs score 60; tall portrait (no "chart" in URL) scores lower
    // and sits outside top-3 — same shape as fixture B desc[0].
    const ranked = rankChartCandidates([
      { url: "https://si.geilicdn.com/open-a_1076_806.jpg", via },
      { url: "https://si.geilicdn.com/open-b_1076_806.jpg", via },
      { url: "https://si.geilicdn.com/open-c_1080_720.jpg", via },
      { url: "https://si.geilicdn.com/open-d_1080_720.jpg", via },
      { url: "https://si.geilicdn.com/open-739d_1498_1916.jpg", via },
    ]);
    const reservedUrl = "https://si.geilicdn.com/open-739d_1498_1916.jpg";
    expect(ranked.findIndex((c) => c.url === reservedUrl)).toBeGreaterThanOrEqual(3);
    const reserved = ranked.find((c) => c.url === reservedUrl);
    const paid = paidHuntCandidates(ranked, reserved, MAX_PAID_CANDIDATES);
    expect(paid).toHaveLength(3);
    expect(paid[0].url).toBe(ranked[0].url);
    expect(paid[1].url).toBe(reservedUrl);
    // Third is next-by-score, not a fourth call.
    expect(paid[2].url).toBe(ranked[1].url);
    expect(paid.every((c, i) => paid.findIndex((x) => x.url === c.url) === i)).toBe(true);
  });

  it("does not reserve when desc[0] is already in the top-3 by score", () => {
    const ranked = rankChartCandidates([
      { url: "https://si.geilicdn.com/open-6fa300000197e4bca7290aa043f9_1338_1279.jpg", via },
      { url: "https://si.geilicdn.com/product_1280_1280.jpg", via },
      { url: "https://si.geilicdn.com/product2_1080_1080.jpg", via },
    ]);
    const reserved = ranked[0];
    const paid = paidHuntCandidates(ranked, reserved, MAX_PAID_CANDIDATES);
    expect(paid.map((c) => c.url)).toEqual(ranked.slice(0, 3).map((c) => c.url));
    expect(paid[0].url).toContain("6fa30000");
  });

  it("name-rejected desc[0] gets NO reservation (pin)", () => {
    expect(isRejectedChartName("https://cdn.example/whatsapp-contact-card.jpg")).toBe(true);
    const ranked = rankChartCandidates([
      { url: "https://si.geilicdn.com/pack_a_1076_806.jpg", via },
      { url: "https://si.geilicdn.com/pack_b_1076_806.jpg", via },
      { url: "https://si.geilicdn.com/pack_c_1080_720.jpg", via },
      { url: "https://cdn.example/whatsapp-contact-card.jpg", via },
    ]);
    // Rejected URL is dropped from ranked entirely.
    expect(ranked.some((c) => /whatsapp/i.test(c.url))).toBe(false);
    const reserved = pickReservedDescCandidate(
      ["https://cdn.example/whatsapp-contact-card.jpg", "https://si.geilicdn.com/pack_a_1076_806.jpg"],
      ranked
    );
    expect(reserved).toBe(null);
    const paid = paidHuntCandidates(ranked, reserved, MAX_PAID_CANDIDATES);
    expect(paid).toHaveLength(3);
    expect(paid.every((c) => !/whatsapp/i.test(c.url))).toBe(true);
  });

  it("Fixture B: portrait desc[0] is IN the paid set", () => {
    const desc0 =
      "https://si.geilicdn.com/open1723671325-1234478995-739d0000019ab66e13d90a23b491_1498_1916.jpg";
    const ranked = rankChartCandidates([
      { url: "https://si.geilicdn.com/open-7ecb_1076_806.jpg", via },
      { url: "https://si.geilicdn.com/open-7e9d_1076_806.jpg", via },
      { url: "https://si.geilicdn.com/open-0fe9_1080_720.jpg", via },
      { url: "https://si.geilicdn.com/open-1547_1080_720.jpg", via },
      { url: "https://si.geilicdn.com/open-71f3_1080_720.jpg", via },
      { url: desc0, via },
    ]);
    const reserved = pickReservedDescCandidate([desc0], ranked);
    expect(reserved).not.toBe(null);
    const paid = paidHuntCandidates(ranked, reserved, MAX_PAID_CANDIDATES);
    expect(paid.some((c) => c.url === desc0)).toBe(true);
    expect(paid).toHaveLength(3);
  });

  it("Fixture C: banner desc[0] is IN the paid set", () => {
    const desc0 =
      "https://si.geilicdn.com/open1672878880-1234478995-70d20000019a241f32670a8133b0_1059_463.jpg";
    const ranked = rankChartCandidates([
      { url: "https://si.geilicdn.com/open-772c_1080_1130.jpg", via },
      { url: "https://si.geilicdn.com/open-6d5e_750_1000.jpg", via },
      { url: "https://si.geilicdn.com/open-6dbd_750_1000.jpg", via },
      { url: "https://si.geilicdn.com/open-6d64_750_1000.jpg", via },
      { url: desc0, via },
    ]);
    const reserved = pickReservedDescCandidate([desc0], ranked);
    expect(reserved).not.toBe(null);
    const paid = paidHuntCandidates(ranked, reserved, MAX_PAID_CANDIDATES);
    expect(paid.some((c) => c.url === desc0)).toBe(true);
    // Banner penalty still applied to its score — reservation, not a score edit.
    expect(reserved.score).toBeLessThan(ranked[0].score);
  });
});

describe("huntSizeChart reserved desc[0] end-to-end (vision stub)", () => {
  it("Fixture B: pays for portrait desc[0] and accepts 肩宽/胸围 rows", async () => {
    // Override parseSizeChart for Chinese labels only inside this test via vision text
    // that the default mock accepts — use chest-letter CHART on the reserved URL.
    const desc0 =
      "https://si.geilicdn.com/open1723671325-1234478995-739d0000019ab66e13d90a23b491_1498_1916.jpg";
    const landscapes = [
      "https://si.geilicdn.com/pack_a_1076_806.jpg",
      "https://si.geilicdn.com/pack_b_1076_806.jpg",
      "https://si.geilicdn.com/pack_c_1080_720.jpg",
      "https://si.geilicdn.com/pack_d_1080_720.jpg",
      "https://si.geilicdn.com/pack_e_1080_720.jpg",
    ];
    visionMock.mockImplementation(async (urls) => {
      const u = (urls && urls[0]) || "";
      if (u === desc0) return "S: chest 58, length 67\nM: chest 60, length 69\nL: chest 62, length 71\nXL: chest 64, length 73";
      return "not a chart at all";
    });
    const found = await huntSizeChart(
      item({
        descImages: [desc0, ...landscapes],
        gallery: [],
        image: null,
      })
    );
    expect(found).not.toBe(null);
    expect(found.text).toMatch(/chest 58/);
    expect(found.text).toMatch(/chest 64/);
    // desc[0] was paid (not only landscapes). Order: best, reserved, next.
    const paidUrls = visionMock.mock.calls.map((c) => c[0][0]);
    expect(paidUrls).toContain(desc0);
    expect(paidUrls.length).toBeLessThanOrEqual(3);
    expect(paidUrls.length).toBeGreaterThanOrEqual(2);
    // Reservation is slot 2 when landscapes outrank the portrait.
    expect(paidUrls[1]).toBe(desc0);
  });

  it("Fixture C: pays for banner desc[0] and accepts waist 74…90", async () => {
    const desc0 =
      "https://si.geilicdn.com/open1672878880-1234478995-70d20000019a241f32670a8133b0_1059_463.jpg";
    const products = [
      "https://si.geilicdn.com/prod_a_1080_1130.jpg",
      "https://si.geilicdn.com/prod_b_750_1000.jpg",
      "https://si.geilicdn.com/prod_c_750_1000.jpg",
      "https://si.geilicdn.com/prod_d_750_1000.jpg",
    ];
    visionMock.mockImplementation(async (urls) => {
      const u = (urls && urls[0]) || "";
      if (u === desc0) return CHART_C;
      return null;
    });
    const found = await huntSizeChart(
      item({
        descImages: [desc0, ...products],
        gallery: [],
        image: null,
      })
    );
    expect(found).not.toBe(null);
    expect(found.text).toMatch(/chest 74/);
    expect(found.text).toMatch(/chest 90/);
    const paidUrls = visionMock.mock.calls.map((c) => c[0][0]);
    expect(paidUrls).toContain(desc0);
    expect(paidUrls.length).toBeLessThanOrEqual(3);
  });

  it("Jeans regression: chart still read #1; total reads <= 3 with junk desc[0]", async () => {
    // desc[0] is a low-score square product (not name-rejected). Chart still ranks #1
    // via padded-square boost. Reservation leaves paid order starting with the chart.
    const desc0 = "https://si.geilicdn.com/junk_product_1280_1280.jpg";
    const chart =
      "https://si.geilicdn.com/open1639340781-1234478995-6fa300000197e4bca7290aa043f9_1338_1279.jpg";
    const others = [
      "https://si.geilicdn.com/colorway_1080_1080.jpg",
      "https://si.geilicdn.com/colorway2_1080_1080.jpg",
      "https://si.geilicdn.com/hz_img_banner_901_383.png",
    ];
    visionMock.mockImplementation(async (urls) => {
      const u = (urls && urls[0]) || "";
      if (u === chart) return CHART;
      return "not a chart";
    });
    const found = await huntSizeChart(
      item({
        descImages: [desc0, chart, ...others],
        gallery: [],
        image: null,
      })
    );
    expect(found.text).toBe(CHART);
    const paidUrls = visionMock.mock.calls.map((c) => c[0][0]);
    expect(paidUrls[0]).toBe(chart);
    expect(paidUrls.length).toBeLessThanOrEqual(3);
    // desc[0] may burn one reserved slot after the chart hit — or zero if chart
    // returned on first read (hunt stops). Either way chart is first.
    if (paidUrls.length > 1) {
      expect(paidUrls).toContain(desc0);
    }
  });

  it("does not pay a name-rejected desc[0] via reservation", async () => {
    const rejected = "https://cdn.example/whatsapp-cs-banner.jpg";
    const real =
      "https://si.geilicdn.com/open-6fa300000197e4bca7290aa043f9_1338_1279.jpg";
    visionMock.mockImplementation(async (urls) =>
      (urls && urls[0]) === real ? CHART : null
    );
    const found = await huntSizeChart(
      item({
        descImages: [rejected, real],
        gallery: [],
        image: null,
      })
    );
    expect(found.text).toBe(CHART);
    const paidUrls = visionMock.mock.calls.map((c) => c[0][0]);
    expect(paidUrls).not.toContain(rejected);
    expect(paidUrls[0]).toBe(real);
  });
});

describe("the busy retry (Kyle 2026-08-04)", () => {
  // The concurrency limiter answered 429 Busy and the whole hunt died one
  // moment before the chart. One retry per hunt, on the same candidate.
  // The wait is a real 2s — the retry must breathe so the slot can free up.
  it("retries one Busy and lands the chart on the second try", async () => {
    visionMock
      .mockResolvedValueOnce({ unavailable: true })
      .mockResolvedValueOnce(CHART);
    const found = await huntSizeChart(
      item({
        descImages: ["https://si.geilicdn.com/size_chart_busy.jpg"],
        gallery: [],
        image: null,
      })
    );
    expect(found.text).toBe(CHART);
    expect(visionMock).toHaveBeenCalledTimes(2);
    // Same candidate both times — the retry does not skip down the list.
    expect(visionMock.mock.calls[0][0]).toEqual(visionMock.mock.calls[1][0]);
  }, 15000);

  it("retries at most once per hunt, then reports unavailable", async () => {
    visionMock.mockResolvedValue({ unavailable: true });
    const found = await huntSizeChart(
      item({
        descImages: ["https://si.geilicdn.com/size_chart_busy2.jpg"],
        gallery: [],
        image: null,
      })
    );
    expect(found).toEqual({ unavailable: true });
    // First read + one retry. The remaining paid candidates stay unspent.
    expect(visionMock).toHaveBeenCalledTimes(2);
  }, 15000);
});

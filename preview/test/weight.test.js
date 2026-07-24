import { describe, it, expect } from "vitest";
import {
  CATEGORY_WEIGHT_GRAMS,
  itemWeightGrams,
  formatWeightGrams,
} from "../../credenza-fashion.jsx";

describe("itemWeightGrams (A6)", () => {
  it("uses the manual override when one is set", () => {
    expect(itemWeightGrams({ category: "shirt", weightGrams: 420 })).toBe(420);
    // Override wins even when it differs wildly from the category default.
    expect(itemWeightGrams({ category: "shoes", weightGrams: 400 })).toBe(400);
  });

  it("falls back to the category default", () => {
    expect(itemWeightGrams({ category: "shirt" })).toBe(CATEGORY_WEIGHT_GRAMS.shirt);
    expect(itemWeightGrams({ category: "shoes" })).toBe(CATEGORY_WEIGHT_GRAMS.shoes);
  });

  it("rejects garbage overrides and falls back", () => {
    expect(itemWeightGrams({ category: "pants", weightGrams: 0 })).toBe(CATEGORY_WEIGHT_GRAMS.pants);
    expect(itemWeightGrams({ category: "pants", weightGrams: -50 })).toBe(CATEGORY_WEIGHT_GRAMS.pants);
    expect(itemWeightGrams({ category: "pants", weightGrams: "abc" })).toBe(CATEGORY_WEIGHT_GRAMS.pants);
    expect(itemWeightGrams({ category: "pants", weightGrams: null })).toBe(CATEGORY_WEIGHT_GRAMS.pants);
  });

  it("returns null when neither override nor category is known", () => {
    expect(itemWeightGrams({})).toBe(null);
    expect(itemWeightGrams({ category: "" })).toBe(null);
    expect(itemWeightGrams({ category: "not-a-category" })).toBe(null);
  });

  it("rounds fractional overrides", () => {
    expect(itemWeightGrams({ weightGrams: 123.7 })).toBe(124);
  });
});

describe("formatWeightGrams (A6)", () => {
  it("renders grams under 1 kg with the ~ prefix", () => {
    expect(formatWeightGrams(350)).toBe("~350 g");
    expect(formatWeightGrams(999)).toBe("~999 g");
  });

  it("renders kg at one decimal with the ~ prefix", () => {
    expect(formatWeightGrams(1000)).toBe("~1 kg");
    expect(formatWeightGrams(1250)).toBe("~1.3 kg");
    expect(formatWeightGrams(2400)).toBe("~2.4 kg");
  });

  it("renders nothing for unknown weights", () => {
    expect(formatWeightGrams(null)).toBe("");
    expect(formatWeightGrams(0)).toBe("");
    expect(formatWeightGrams(NaN)).toBe("");
  });
});

import {
  haulWeightGrams,
  volumetricWeightGrams,
  chargeableWeightGrams,
  PACKAGING_OPTIONS,
} from "../../credenza-fashion.jsx";

describe("haulWeightGrams (Part 5 task 8)", () => {
  it("sums item weights across the haul", () => {
    const sum = haulWeightGrams([
      { category: "shirt" }, // default
      { category: "shoes", weightGrams: 800 },
    ]);
    expect(sum).toBe(CATEGORY_WEIGHT_GRAMS.shirt + 800);
  });

  it("never counts returned items toward the ship weight", () => {
    const sum = haulWeightGrams([
      { category: "shirt", weightGrams: 300 },
      { category: "shoes", weightGrams: 800, findStatus: "returned" },
    ]);
    expect(sum).toBe(300);
  });

  it("returns null when no item has a known weight", () => {
    expect(haulWeightGrams([{ category: "" }])).toBe(null);
    expect(haulWeightGrams([])).toBe(null);
  });

  it("returns null when every item is returned", () => {
    expect(haulWeightGrams([{ category: "shirt", findStatus: "returned" }])).toBe(null);
  });
});

describe("volumetricWeightGrams (Part 5 task 9)", () => {
  it("uses the 5000 cm3/kg divisor", () => {
    // 40 x 30 x 20 = 24000 cm3 -> 4.8 kg -> 4800 g
    expect(volumetricWeightGrams({ l: 40, w: 30, h: 20 })).toBe(4800);
  });

  it("returns null unless all three dims are positive numbers", () => {
    expect(volumetricWeightGrams({ l: 40, w: 30 })).toBe(null);
    expect(volumetricWeightGrams({ l: 40, w: 30, h: 0 })).toBe(null);
    expect(volumetricWeightGrams({ l: -1, w: 30, h: 20 })).toBe(null);
    expect(volumetricWeightGrams(null)).toBe(null);
    expect(volumetricWeightGrams({ l: "a", w: 30, h: 20 })).toBe(null);
  });
});

describe("chargeableWeightGrams (Part 5 task 9)", () => {
  it("charges the larger of actual (with packaging) and volumetric", () => {
    // Actual 2000 g, volumetric 4800 g -> volumetric wins.
    expect(
      chargeableWeightGrams({ actualGrams: 2000, dims: { l: 40, w: 30, h: 20 }, packaging: "none" })
    ).toBe(4800);
    // Actual 6000 g, volumetric 4800 g -> actual wins.
    expect(
      chargeableWeightGrams({ actualGrams: 6000, dims: { l: 40, w: 30, h: 20 }, packaging: "none" })
    ).toBe(6000);
  });

  it("applies the packaging factor to the actual side only", () => {
    // 2000 g x 1.2 = 2400 g, still under the 4800 g volumetric.
    expect(
      chargeableWeightGrams({ actualGrams: 2000, dims: { l: 40, w: 30, h: 20 }, packaging: "reinforced" })
    ).toBe(4800);
    // 5000 g x 1.1 = 5500 g, over the 4800 g volumetric.
    expect(
      chargeableWeightGrams({ actualGrams: 5000, dims: { l: 40, w: 30, h: 20 }, packaging: "standard" })
    ).toBe(5500);
  });

  it("works with only one side known", () => {
    expect(chargeableWeightGrams({ actualGrams: 1500, packaging: "none" })).toBe(1500);
    expect(chargeableWeightGrams({ dims: { l: 40, w: 30, h: 20 } })).toBe(4800);
  });

  it("returns null when nothing usable is given", () => {
    expect(chargeableWeightGrams({})).toBe(null);
    expect(chargeableWeightGrams({ actualGrams: 0 })).toBe(null);
    expect(chargeableWeightGrams({ actualGrams: "abc" })).toBe(null);
  });

  it("falls back to the none factor for unknown packaging ids", () => {
    expect(PACKAGING_OPTIONS[0].id).toBe("none");
    expect(chargeableWeightGrams({ actualGrams: 1000, packaging: "bogus" })).toBe(1000);
  });
});

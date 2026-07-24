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

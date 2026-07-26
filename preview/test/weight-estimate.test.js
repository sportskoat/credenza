/**
 * Pure fixture tests for weight-estimate.js.
 * Spec: docs/pure-layer-exhaustiveness-plan.md §5.
 * Does not load credenza-fashion.jsx (K3-safe).
 */
import { describe, expect, it } from "vitest";
import cases from "./fixtures/weight-estimate-cases.json";
import {
  CATEGORY_TO_WEIGHT_KEY,
  SHOEBOX_GRAMS,
  WEIGHT_BANDS,
  estimateHaulWeightGrams,
  estimateItemWeight,
  parseWeightFromText,
  refineWeightKeyFromText,
} from "../../weight-estimate.js";

describe("weight-estimate constants", () => {
  it("locks shoebox default to the fixture", () => {
    expect(SHOEBOX_GRAMS).toBe(cases.shoeboxGrams);
  });

  it("maps every product category to a known band", () => {
    for (const [cat, key] of Object.entries(CATEGORY_TO_WEIGHT_KEY)) {
      expect(WEIGHT_BANDS[key], `${cat} → ${key}`).toBeTruthy();
    }
  });
});

describe("parseWeightFromText", () => {
  for (const row of cases.parseWeightFromText) {
    it(row.id, () => {
      const got = parseWeightFromText(row.text);
      if (row.expectGrams == null) {
        expect(got).toBe(null);
      } else {
        expect(got).not.toBe(null);
        expect(got.grams).toBe(row.expectGrams);
      }
    });
  }
});

describe("refineWeightKeyFromText", () => {
  for (const row of cases.refineWeightKeyFromText) {
    it(row.id, () => {
      expect(refineWeightKeyFromText(row.text, row.category)).toBe(row.expectKey);
    });
  }
});

describe("estimateItemWeight", () => {
  for (const row of cases.estimateItemWeight) {
    it(row.id, () => {
      const got = estimateItemWeight(row.item);
      for (const [k, v] of Object.entries(row.expect)) {
        expect(got[k], k).toBe(v);
      }
    });
  }

  it("rounds fractional overrides", () => {
    const got = estimateItemWeight({ weightGrams: 123.7 });
    expect(got.grams).toBe(124);
    expect(got.source).toBe("override");
  });
});

describe("estimateHaulWeightGrams", () => {
  for (const row of cases.estimateHaulWeightGrams) {
    it(row.id, () => {
      expect(estimateHaulWeightGrams(row.items)).toBe(row.expect);
    });
  }
});

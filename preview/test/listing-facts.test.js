/**
 * Pure fixture-driven tests for listing-facts helpers + size-chart tables.
 * Spec: docs/specs/richer-item-facts.md
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  extractWeightGramsFromText,
  isAllowedChartImageHost,
  isListingBoilerplate,
  isSkuLikeTitle,
  pickColorwayFromVariants,
  pickSizeRunFromVariants,
  preferCardTitle,
  shouldReplaceFashionTitle,
} from "../../listing-facts.js";
import { parseSizeChart } from "../../credenza-fashion.jsx";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function load(name) {
  return JSON.parse(readFileSync(join(FIX, name), "utf8"));
}

describe("isSkuLikeTitle", () => {
  const fx = load("title-policy.json");
  it("flags bare seller SKUs", () => {
    for (const s of fx.skuLike) {
      expect(isSkuLikeTitle(s), s).toBe(true);
    }
  });
  it("keeps human product labels", () => {
    for (const s of fx.humanLike) {
      expect(isSkuLikeTitle(s), s).toBe(false);
    }
  });
});

describe("preferCardTitle (title-policy fixture)", () => {
  const fx = load("title-policy.json");
  for (const c of fx.cases) {
    it(c.id, () => {
      const got = preferCardTitle({
        currentTitle: c.currentTitle,
        resolvedTitle: c.resolvedTitle,
        claudeTitle: c.claudeTitle,
      });
      expect(got).toBe(c.expectKeep);
    });
  }
});

describe("shouldReplaceFashionTitle (title-policy fixture)", () => {
  const fx = load("title-policy.json");
  for (const c of fx.shouldReplace) {
    it(c.id, () => {
      expect(shouldReplaceFashionTitle(c.title, c.url)).toBe(c.expectReplace);
    });
  }
});

describe("isAllowedChartImageHost (chart-image-hosts fixture)", () => {
  const fx = load("chart-image-hosts.json");
  const all = [...fx.liveToday, ...fx.weidianProposed, ...fx.mustReject];
  for (const c of all) {
    it(c.id, () => {
      expect(isAllowedChartImageHost(c.url, { includeWeidianProposed: false })).toBe(c.expectLive);
      expect(isAllowedChartImageHost(c.url, { includeWeidianProposed: true })).toBe(c.expectProposed);
    });
  }
});

describe("variant display (variant-display fixture)", () => {
  const fx = load("variant-display.json");
  for (const c of fx.cases) {
    it(c.id, () => {
      expect(pickColorwayFromVariants(c.variantGroups)).toBe(c.expectColorway);
      expect(pickSizeRunFromVariants(c.variantGroups)).toBe(c.expectSizeRun);
      // Chosen size is never invented by these helpers.
      expect(c.expectChosenSize).toBe("");
    });
  }
});

describe("isListingBoilerplate (boilerplate-filter fixture)", () => {
  const fx = load("boilerplate-filter.json");
  for (const c of fx.cases) {
    it(c.id, () => {
      expect(isListingBoilerplate(c.text)).toBe(c.expectDrop);
    });
  }
  it("flags each configured marker alone", () => {
    for (const m of fx.dropIfContains) {
      expect(isListingBoilerplate(`prefix ${m} suffix`), m).toBe(true);
    }
  });
});

describe("parseSizeChart (size-chart-tables fixture — Kyle Weidian photo)", () => {
  const fx = load("size-chart-tables.json");
  for (const c of fx.cases) {
    it(c.id, () => {
      const chart = parseSizeChart(c.text);
      expect(chart, "chart should parse").not.toBeNull();
      expect(chart.rows.map((r) => r.size)).toEqual(c.expectSizes);
      const m = chart.rows.find((r) => r.size === "M");
      expect(m).toBeTruthy();
      if (c.expectM.shoulder != null) expect(m.shoulder).toBe(c.expectM.shoulder);
      if (c.expectM.chest != null) expect(m.chest).toBe(c.expectM.chest);
      if (c.expectM.length != null) expect(m.length).toBe(c.expectM.length);
    });
  }
});

describe("extractWeightGramsFromText (weight-from-text fixture)", () => {
  const fx = load("weight-from-text.json");
  for (const c of fx.cases) {
    it(c.id, () => {
      expect(extractWeightGramsFromText(c.text)).toBe(c.expect);
    });
  }
});

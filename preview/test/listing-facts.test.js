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
  extractYupooLinksFromText,
  isSpamVariantValue,
  isAllowedChartImageHost,
  isListingBoilerplate,
  isSkuLikeTitle,
  pickColorwayFromVariants,
  pickSizeRunFromVariants,
  pickSizeValuesFromVariants,
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
  const all = [...fx.liveToday, ...fx.mustReject];
  for (const c of all) {
    it(c.id, () => {
      expect(isAllowedChartImageHost(c.url, { includeWeidian: false })).toBe(c.expectYupooOnly);
      expect(isAllowedChartImageHost(c.url, { includeWeidian: true })).toBe(c.expectWithWeidian);
      // Default matches live chart-vision (Weidian on).
      expect(isAllowedChartImageHost(c.url)).toBe(c.expectWithWeidian);
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
      // Values list matches the Size axis; empty groups stay empty.
      const values = pickSizeValuesFromVariants(c.variantGroups);
      if (c.expectSizeRun) expect(values.length).toBeGreaterThan(0);
      else expect(values).toEqual([]);
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

describe("extractYupooLinksFromText", () => {
  it("reads full URLs and bare shop hosts", () => {
    const urls = extractYupooLinksFromText(
      "Bulk orders!\nYupoo1 :ruok66.x.yupoo.com\nYUPOO: https://wwfake100.x.yupoo.com/search/album?uid=1&q=GX"
    );
    expect(urls).toEqual([
      "https://ruok66.x.yupoo.com",
      "https://wwfake100.x.yupoo.com/search/album?uid=1&q=GX",
    ]);
  });

  it("returns empty for noise", () => {
    expect(extractYupooLinksFromText("SEE MY YUPOO")).toEqual([]);
    expect(extractYupooLinksFromText("")).toEqual([]);
  });
});

describe("isSpamVariantValue", () => {
  it("flags WeChat / return spam and keeps real sizes", () => {
    expect(isSpamVariantValue("S")).toBe(false);
    expect(isSpamVariantValue("42")).toBe(false);
    expect(isSpamVariantValue("包退换【钱我出】请放心购")).toBe(true);
    expect(isSpamVariantValue("下单后务必添加发财微信")).toBe(true);
  });
});

/**
 * Pure tests for link-context.js (offline L0).
 * Spec: docs/pure-layer-exhaustiveness-plan.md §6.
 */
import { describe, expect, it } from "vitest";
import corpus from "./fixtures/link-context-corpus.json";
import {
  canonicalKeyFromUrl,
  extractHeightWeightPairs,
  extractSizesSeen,
  indexCorpus,
  lookupLinkContext,
} from "../../link-context.js";

describe("canonicalKeyFromUrl", () => {
  for (const row of corpus.canonicalKeys) {
    it(row.id, () => {
      expect(canonicalKeyFromUrl(row.url)).toBe(row.expect);
    });
  }
});

describe("indexCorpus + lookupLinkContext", () => {
  const index = indexCorpus(corpus.posts);

  it("is deterministic for the same posts", () => {
    expect(indexCorpus(corpus.posts)).toEqual(index);
  });

  it("never indexes agent signup URLs", () => {
    const keys = Object.keys(index);
    expect(keys.some((k) => k.includes("superbuy") || k.includes("register"))).toBe(false);
  });

  for (const row of corpus.lookups) {
    it(row.id, () => {
      const got = lookupLinkContext(row.url, index);
      expect(got.key).toBe(row.expectKey);
      expect(got.count).toBe(row.expectCount);
      expect(got.mentions.length).toBe(row.expectCount);
      if (row.expectLabelsInclude) {
        const labels = got.mentions.map((m) => m.label);
        for (const lab of row.expectLabelsInclude) {
          expect(labels).toContain(lab);
        }
      }
    });
  }

  it("surfaces sizes and height/weight from gats notes", () => {
    const got = lookupLinkContext("https://weidian.com/item.html?itemID=7785888265", index);
    expect(got.count).toBe(2);
    expect(got.sizesSeen.length).toBeGreaterThan(0);
    expect(got.heightWeightPairs.length).toBeGreaterThan(0);
  });

  it("lookup by canonical key string works", () => {
    const got = lookupLinkContext("weidian:7594655800", index);
    expect(got.count).toBe(1);
    expect(got.mentions[0].label).toBe("Supreme jacket");
  });
});

describe("extractHeightWeightPairs", () => {
  it("parses 80kg, 182cm", () => {
    const pairs = extractHeightWeightPairs("My stats: 80kg, 182cm");
    expect(pairs.length).toBe(1);
    expect(pairs[0].heightCm).toBe(182);
    expect(pairs[0].weightKg).toBe(80);
  });

  it("parses 182 cm / 80 kg", () => {
    const pairs = extractHeightWeightPairs("182 cm / 80 kg · size M");
    expect(pairs[0].heightCm).toBe(182);
    expect(pairs[0].weightKg).toBe(80);
  });
});

describe("extractSizesSeen", () => {
  it("finds took size M", () => {
    expect(extractSizesSeen("I took size M and the fit is good")).toContain("M");
  });

  it("finds EU 43", () => {
    expect(extractSizesSeen("size 43 EU fits me")).toEqual(expect.arrayContaining(["43"]));
  });
});

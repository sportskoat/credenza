/**
 * Pure tests for link-context.js (offline L0).
 * Spec: docs/pure-layer-exhaustiveness-plan.md §6.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import corpus from "./fixtures/link-context-corpus.json";
import {
  canonicalKeyFromUrl,
  extractHeightWeightPairs,
  extractSizesSeen,
  indexCorpus,
  lookupLinkContext,
} from "../../link-context.js";
import { parseRedditHaul } from "../../reddit-haul.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

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

describe("frozen FashionReps corpus (22 posts)", () => {
  const posts = JSON.parse(
    readFileSync(join(ROOT, "preview/scripts/corpus-fashionreps.json"), "utf8")
  );

  it("indexes at least 50 marketplace keys via parseRedditHaul", () => {
    const index = indexCorpus(posts, {
      parseHaul: (text, opts) => parseRedditHaul(text, opts),
    });
    const keys = Object.keys(index);
    expect(posts.length).toBe(22);
    expect(keys.length).toBeGreaterThanOrEqual(50);
    // Known haul items from the frozen set
    expect(index["weidian:7785888265"]?.length).toBeGreaterThanOrEqual(1);
    expect(index["weidian:7734454224"]?.length).toBeGreaterThanOrEqual(1);
  });

  it("keys at least 80% of parsed shoppable item URLs", () => {
    let urls = 0;
    let withKey = 0;
    for (const p of posts) {
      const text = [p.title, p.selftext || ""].filter(Boolean).join("\n");
      const haul = parseRedditHaul(text, { title: p.title });
      for (const it of haul?.items || []) {
        if (!it?.url) continue;
        urls += 1;
        if (canonicalKeyFromUrl(it.url)) withKey += 1;
      }
    }
    expect(urls).toBeGreaterThan(40);
    expect(withKey / urls).toBeGreaterThanOrEqual(0.8);
  });

  it("lookup returns a human label for Gats QC", () => {
    const index = indexCorpus(posts, {
      parseHaul: (text, opts) => parseRedditHaul(text, opts),
    });
    const got = lookupLinkContext("https://weidian.com/item.html?itemID=7785888265", index);
    expect(got.count).toBeGreaterThanOrEqual(1);
    expect(got.mentions[0].label.toLowerCase()).toMatch(/gats|margiela|maison/);
  });
});

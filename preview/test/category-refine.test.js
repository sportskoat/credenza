// Fix 3 (2026-08-03): client-side category refine when resolve leaves
// empty/"other". Size-token pants inference + titleEn/originalTitle re-guess.
// No resolve.js / enrich-prompt changes this round.
import { describe, expect, it } from "vitest";
import {
  collectVariantNames,
  guessFashionCategory,
  inferPantsFromSizeTokens,
  refineItemCategory,
  PANTS_SIZE_TOKEN,
} from "../../credenza-fashion.jsx";

const JEANS_VARIANTS = [
  {
    title: "Size",
    values: ["S-28", "M-30", "L-32", "XL-34", "XXL-36"],
  },
];

// Fixture 7503676779-shaped: letter-dash-waist tokens, Chinese jeans title.
const FIXTURE_7503676779 = {
  category: "other",
  originalTitle: "十字架皮标水洗牛仔裤男美式高街直筒宽松休闲长裤",
  titleEn: "Cross leather-tag washed jeans",
  variants: JEANS_VARIANTS,
};

describe("PANTS_SIZE_TOKEN", () => {
  it("matches letter-dash-waist tokens", () => {
    expect(PANTS_SIZE_TOKEN.test("S-28")).toBe(true);
    expect(PANTS_SIZE_TOKEN.test("XXL-36")).toBe(true);
    expect(PANTS_SIZE_TOKEN.test("M30")).toBe(true);
    expect(PANTS_SIZE_TOKEN.test("S")).toBe(false);
    expect(PANTS_SIZE_TOKEN.test("Blue")).toBe(false);
    expect(PANTS_SIZE_TOKEN.test("2XL-36")).toBe(false);
  });
});

describe("inferPantsFromSizeTokens", () => {
  it("fires on >=2 letter-dash-waist variants", () => {
    expect(inferPantsFromSizeTokens(JEANS_VARIANTS)).toBe(true);
  });

  it("does not fire on a single token or color axes (no-false-pants)", () => {
    expect(inferPantsFromSizeTokens([{ title: "Size", values: ["S-28"] }])).toBe(false);
    expect(
      inferPantsFromSizeTokens([{ title: "Color", values: ["Black", "Navy", "Grey"] }])
    ).toBe(false);
    expect(inferPantsFromSizeTokens([{ title: "Size", values: ["S", "M", "L", "XL"] }])).toBe(
      false
    );
  });
});

describe("guessFashionCategory Chinese jeans cue", () => {
  it("lands pants from full original title with 牛仔裤", () => {
    expect(guessFashionCategory(FIXTURE_7503676779.originalTitle)).toBe("pants");
  });

  it("lands pants from 裤 alone", () => {
    expect(guessFashionCategory("美式高街直筒宽松休闲长裤")).toBe("pants");
  });
});

describe("refineItemCategory (Fix 3)", () => {
  it("7503676779-shaped fixture lands pants from size tokens when server said other", () => {
    expect(
      refineItemCategory({
        category: "other",
        variants: JEANS_VARIANTS,
        titleEn: "Something vague",
      })
    ).toBe("pants");
  });

  it("7503676779-shaped fixture lands pants from originalTitle when tokens absent", () => {
    expect(
      refineItemCategory({
        category: "other",
        originalTitle: FIXTURE_7503676779.originalTitle,
        titleEn: FIXTURE_7503676779.titleEn,
        variants: [{ title: "Color", values: ["Black", "Blue"] }],
      })
    ).toBe("pants");
  });

  it("re-runs guess over titleEn + variant names", () => {
    expect(
      refineItemCategory({
        category: "other",
        titleEn: "Relaxed cargo pants",
        variants: [{ title: "Size", values: ["S", "M", "L"] }],
      })
    ).toBe("pants");
  });

  it("keeps existing non-other categories unchanged", () => {
    expect(
      refineItemCategory({
        category: "shirt",
        variants: JEANS_VARIANTS,
        originalTitle: FIXTURE_7503676779.originalTitle,
      })
    ).toBe("shirt");
    expect(
      refineItemCategory({
        category: "outerwear",
        titleEn: "jeans somehow",
      })
    ).toBe("outerwear");
  });

  it("honors categoryManual over tokens and title", () => {
    expect(
      refineItemCategory({
        category: "shirt",
        categoryManual: true,
        variants: JEANS_VARIANTS,
        originalTitle: FIXTURE_7503676779.originalTitle,
      })
    ).toBe("shirt");
  });

  it("other + non-size variants stays other (no-false-pants pin)", () => {
    expect(
      refineItemCategory({
        category: "other",
        titleEn: "Mystery drop",
        variants: [{ title: "Color", values: ["Red", "Blue", "Green"] }],
      })
    ).toBe("other");
  });

  it("empty category can still become pants from tokens", () => {
    expect(
      refineItemCategory({
        category: "",
        variants: JEANS_VARIANTS,
      })
    ).toBe("pants");
  });

  it("collectVariantNames flattens groups", () => {
    expect(collectVariantNames(JEANS_VARIANTS)).toEqual([
      "S-28",
      "M-30",
      "L-32",
      "XL-34",
      "XXL-36",
    ]);
  });
});

// Source pin: resolve merge calls refineItemCategory (client-only Fix 3).
describe("resolveBuyDetails category merge (source pin)", () => {
  it("wires refineItemCategory into the resolve category assignment", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const src = readFileSync(join(root, "credenza-fashion.jsx"), "utf8");
    expect(src).toMatch(/category:\s*refineItemCategory\s*\(/);
    expect(src).toMatch(/originalTitle:\s*data\.originalTitle/);
    // Must not reopen the server enrich path this round.
    expect(src).not.toMatch(/Do NOT touch the enrich prompt/);
  });
});

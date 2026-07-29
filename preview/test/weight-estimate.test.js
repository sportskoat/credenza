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
  formatWeightEstimate,
  isBulkyItem,
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

describe("formatWeightEstimate", () => {
  it("renders mid with band when spread is material", () => {
    const s = formatWeightEstimate({ grams: 650, lowGrams: 450, highGrams: 900 });
    expect(s).toMatch(/^~/);
    expect(s).toContain("650");
    expect(s).toContain("450");
    expect(s).toContain("900");
  });

  it("renders override as a single ~ value", () => {
    expect(formatWeightEstimate({ grams: 420, lowGrams: 420, highGrams: 420 })).toBe("~420 g");
  });

  it("returns empty for unknown", () => {
    expect(formatWeightEstimate(null)).toBe("");
    expect(formatWeightEstimate({ grams: null })).toBe("");
  });
});

describe("expanded weight bands", () => {
  it("has at least 60 bands, each with a sane low ≤ mid ≤ high spread", () => {
    const entries = Object.entries(WEIGHT_BANDS);
    expect(entries.length).toBeGreaterThanOrEqual(60);
    for (const [key, band] of entries) {
      expect(band.low, `${key}.low`).toBeGreaterThan(0);
      expect(band.low, `${key}.low`).toBeLessThanOrEqual(band.mid);
      expect(band.mid, `${key}.mid`).toBeLessThanOrEqual(band.high);
    }
  });

  it.each([
    ["ribbed tank top white", "tank"],
    ["heavy cotton long sleeve tee", "long_sleeve_tee"],
    ["pique polo shirt navy", "polo"],
    ["striped rugby shirt", "rugby_shirt"],
    ["brushed flannel shirt", "flannel_shirt"],
    ["wool knit sweater", "knit_sweater"],
    ["chunky cable knit sweater", "thick_knit"],
    ["button front cardigan", "cardigan"],
    ["full zip fleece jacket", "fleece"],
    ["quilted vest", "vest"],
    ["retro track jacket", "track_jacket"],
    ["nylon coach jacket", "coach_jacket"],
    ["wool varsity jacket", "varsity_jacket"],
    ["leather jacket moto", "leather_jacket"],
    ["down parka", "parka"],
    ["beige trench coat", "trench_coat"],
    ["navy wool blazer", "blazer"],
    ["slim fit suit jacket", "suit_jacket"],
  ])("tops: %s → %s", (title, key) => {
    expect(refineWeightKeyFromText(title, "")).toBe(key);
  });

  it.each([
    ["selvedge raw denim jeans", "heavy_denim"],
    ["ripstop cargo pants", "cargo_pants"],
    ["side stripe track pants", "track_pants"],
    ["yoga leggings black", "leggings"],
    ["pleated skirt", "skirt"],
    ["floral summer dress", "dress"],
    ["denim overalls", "overalls"],
    ["insulated snow pants", "snow_pants"],
    ["slim chinos", "chinos"],
  ])("bottoms: %s → %s", (title, key) => {
    expect(refineWeightKeyFromText(title, "")).toBe(key);
  });

  it.each([
    ["nike high top sneakers", "high_top_sneaker"],
    ["breathable running shoes", "running_shoe"],
    ["penny loafers leather", "loafer"],
    ["leather dress shoes", "dress_shoe"],
    ["patent high heels", "heel"],
    ["crocs clogs", "clog"],
  ])("shoes: %s → %s", (title, key) => {
    expect(refineWeightKeyFromText(title, "")).toBe(key);
  });

  it.each([
    ["soft wool scarf", "scarf"],
    ["leather gloves", "gloves"],
    ["bifold wallet", "wallet"],
    ["polarized sunglasses", "sunglasses"],
    ["gold necklace", "jewelry"],
    ["steel automatic watch", "watch"],
    ["canvas tote bag", "tote"],
    ["travel duffle bag", "duffle"],
    ["clear iphone phone case", "phone_case"],
    ["cute keychain charm", "keychain"],
    ["plush doll 30cm", "plush_figure"],
    ["fleece throw blanket", "blanket"],
  ])("accessories: %s → %s", (title, key) => {
    expect(refineWeightKeyFromText(title, "")).toBe(key);
  });

  it.each([
    ["重磅卫衣 加绒", "heavy_hoodie"],
    ["长袖T恤 纯棉", "long_sleeve_tee"],
    ["针织毛衣 宽松", "knit_sweater"],
    ["工装马甲", "vest"],
    ["棒球服 情侣款", "varsity_jacket"],
    ["西装外套 修身", "suit_jacket"],
    ["风衣 中长款", "trench_coat"],
    ["牛仔裤 直筒", "jeans"],
    ["复古背带裤", "overalls"],
    ["碎花连衣裙", "dress"],
    ["高帮帆布鞋", "high_top_sneaker"],
    ["轻便跑鞋", "running_shoe"],
    ["真皮乐福鞋", "loafer"],
    ["细跟高跟鞋", "heel"],
    ["洞洞鞋", "clog"],
    ["羊毛围巾", "scarf"],
    ["保暖手套", "gloves"],
    ["短款钱包", "wallet"],
    ["透明手机壳", "phone_case"],
    ["钥匙扣 挂件", "keychain"],
    ["加厚毛毯", "blanket"],
  ])("chinese: %s → %s", (title, key) => {
    expect(refineWeightKeyFromText(title, "")).toBe(key);
  });

  it.each([
    // "harvest" must not hit the vest band (word boundary).
    ["harvest moon print", null],
    ["harvest flannel shirt", "flannel_shirt"],
    // "wheels" must not hit the heel band.
    ["hot wheels toy car", null],
    // "cargo shorts" stays shorts, not cargo pants.
    ["cargo shorts", "shorts"],
    // "fleece pants" stays sweatpants, not the fleece band.
    ["fleece pants", "sweatpants"],
    // "fleece blanket" stays blanket, not the fleece band.
    ["fleece blanket", "blanket"],
    // An oxford shirt stays a shirt, not a dress shoe.
    ["oxford shirt white", "shirt_woven"],
    // A dress shirt stays a shirt, not a dress.
    ["slim dress shirt", "shirt_woven"],
    // "keyring" hits keychain, not the jewelry "ring" keyword.
    ["leather keyring", "keychain"],
    // Bare "high" is not a high top; the sneaker catchall still applies.
    ["white sneakers high", "low_sneaker"],
  ])("no false match: %s → %s", (title, key) => {
    expect(refineWeightKeyFromText(title, "")).toBe(key);
  });

  it("estimates a leather jacket from the title band", () => {
    const got = estimateItemWeight({ category: "outerwear", title: "vintage leather jacket" });
    expect(got.key).toBe("leather_jacket");
    expect(got.grams).toBe(WEIGHT_BANDS.leather_jacket.mid);
    expect(got.source).toBe("title");
  });

  it("subtracts the shoebox from new shoe bands too", () => {
    const got = estimateItemWeight({ title: "leather dress shoes", packNoShoebox: true });
    expect(got.key).toBe("dress_shoe");
    expect(got.grams).toBe(WEIGHT_BANDS.dress_shoe.mid - SHOEBOX_GRAMS);
  });
});

// Bulky flag (PLANS/BULKY_ITEM_WARNING_PLAN.md, Kyle approved 2026-07-29):
// items that bill by box size, not scale weight. The flag is a hint only —
// chargeableWeightGrams does the real math once a box size exists.
describe("isBulkyItem", () => {
  it.each([
    // Plan cases.
    [{ title: "Down puffer jacket" }, true],
    [{ title: "羽绒服" }, true], // down jacket, Chinese
    [{ title: "Vintage band tee" }, false],
    // Heavy is not bulky.
    [{ title: "Leather boots" }, false],
    // A flagged band with no bulk word in the title (category default).
    [{ title: "", category: "bag" }, true],
    // Flagged bands reached by ordinary title words.
    [{ title: "Patagonia parka" }, true],
    [{ title: "fleece blanket" }, true],
    [{ title: "plush doll" }, true],
    [{ title: "毛绒公仔" }, true], // plush toy, Chinese
    // Bare "down" must not fire: a button-down shirt is not a down item.
    [{ title: "button-down oxford shirt" }, false],
    // Unflagged bands stay false.
    [{ title: "slim jeans" }, false],
    [{ title: "leather jacket" }, false],
    [{}, false],
  ])("item %j → %s", (item, expected) => {
    expect(isBulkyItem(item)).toBe(expected);
  });
});

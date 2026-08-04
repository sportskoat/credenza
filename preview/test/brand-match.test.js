// Phase 2 Match import — F ruling bd106459.
// Pin: Nike S "88.9-95.3" → body 92.1 → profile chest 99.6.
import { describe, expect, it } from "vitest";
import { CHEST_EASE_BANDS } from "../../credenza-fashion.jsx";
import {
  BRAND_MATCH_EASE_BAND,
  BRAND_MATCH_EASE_MID,
  MATCH_OTHER,
  bodyChestMidpoint,
  brandMatchConfirmHeadline,
  brandMatchFitCaveat,
  brandSizeRow,
  coveredBrandKeys,
  loadCoveredBrandRows,
  matchBrandChips,
  matchSizesForBrand,
  profileChestFromBodyMid,
  profilePatchFromBrandMatch,
  resolveBrandMatch,
} from "../../components/brand-match.js";

describe("ease domain · one with #81", () => {
  it("uses the live regular knit band mid (+7.5)", () => {
    expect(BRAND_MATCH_EASE_BAND).toEqual(CHEST_EASE_BANDS.knit);
    expect(BRAND_MATCH_EASE_BAND).toEqual([5, 10]);
    expect(BRAND_MATCH_EASE_MID).toBe(7.5);
  });
});

describe("body_chest_cm range → midpoint", () => {
  it("splits a hyphen range", () => {
    expect(bodyChestMidpoint("88.9-95.3")).toBe(92.1);
    expect(bodyChestMidpoint("95.3-104.1")).toBe(99.7);
  });

  it("accepts a bare number", () => {
    expect(bodyChestMidpoint("101.6")).toBe(101.6);
    expect(bodyChestMidpoint(101.6)).toBe(101.6);
  });

  it("rejects empty and non-numeric (NOT-COVERED markers)", () => {
    expect(bodyChestMidpoint(null)).toBeNull();
    expect(bodyChestMidpoint("")).toBeNull();
    expect(bodyChestMidpoint("ALL")).toBeNull();
  });
});

describe("F pin · Nike S end-to-end (92.1 → 99.6)", () => {
  // F wrote "Nike M" with the S range numbers; the table puts 88.9-95.3 on S.
  // Pin the arithmetic F published against the real row that holds that range.
  it("maps Nike S body range to profile chest 99.6", () => {
    const row = brandSizeRow("Nike", "S");
    expect(row).not.toBeNull();
    expect(row.body_chest_cm).toBe("88.9-95.3");
    const bodyMid = bodyChestMidpoint(row.body_chest_cm);
    expect(bodyMid).toBe(92.1);
    expect(profileChestFromBodyMid(bodyMid)).toBe(99.6);

    const resolved = resolveBrandMatch("Nike", "S");
    expect(resolved.error).toBeUndefined();
    expect(resolved.bodyMid).toBe(92.1);
    expect(resolved.profileChest).toBe(99.6);
  });
});

describe("import filter · covered only", () => {
  it("drops H&M and Carhartt WIP markers", () => {
    const rows = loadCoveredBrandRows();
    expect(rows.every((r) => bodyChestMidpoint(r.body_chest_cm) != null)).toBe(true);
    expect(rows.some((r) => r.brand === "H&M")).toBe(false);
    expect(rows.some((r) => r.brand === "Carhartt WIP")).toBe(false);
  });

  it("lists F's covered brands and never shows unnumberable ones", () => {
    const keys = coveredBrandKeys();
    expect(keys).toContain("Nike");
    expect(keys).toContain("Adidas");
    expect(keys).toContain("Uniqlo");
    expect(keys).toContain("Zara");
    expect(keys).toContain("Champion");
    expect(keys).toContain("Carhartt (mainline)");
    expect(keys).toContain("The North Face");
    expect(keys).toContain("New Balance");
    expect(keys).toContain("Patagonia");
    expect(keys).toContain("Levi's");
    expect(keys).not.toContain("H&M");
    expect(keys).not.toContain("Carhartt WIP");
  });

  it("ends the chip row with Something else", () => {
    const chips = matchBrandChips();
    expect(chips[chips.length - 1]).toEqual(MATCH_OTHER);
    expect(chips.some((c) => c.key === "H&M")).toBe(false);
  });

  it("Levi's only exposes the sizes the table actually numbers", () => {
    expect(matchSizesForBrand("Levi's")).toEqual(["M", "XL"]);
  });
});

describe("profile patch + confirm copy", () => {
  it("saves brand-match source and the profile chest", () => {
    const resolved = resolveBrandMatch("Nike", "S");
    const patch = profilePatchFromBrandMatch(resolved);
    expect(patch).toEqual(
      expect.objectContaining({
        chest: 99.6,
        firstSizeSource: "brand-match",
        brandMatchBrand: "Nike",
        brandMatchSize: "S",
        chestFromUsual: false,
      })
    );
  });

  it("honours an edited confirm number", () => {
    const resolved = resolveBrandMatch("Nike", "S");
    const patch = profilePatchFromBrandMatch(resolved, 102);
    expect(patch.chest).toBe(102);
    expect(patch.firstSizeSource).toBe("brand-match");
  });

  it("writes the honest estimate headline", () => {
    const resolved = resolveBrandMatch("Nike", "S");
    // 99.6 rounds to 100 for the spoken number.
    expect(brandMatchConfirmHeadline(resolved)).toBe(
      "A Nike S fits about a 100 cm chest tee, from Nike's own size guide."
    );
  });

  it("surfaces a cut caveat when the fit_note names one", () => {
    const resolved = resolveBrandMatch("Nike", "S");
    const caveat = brandMatchFitCaveat(resolved);
    expect(caveat.toLowerCase()).toMatch(/sb|dri-fit|large|snug/);
  });

  it("Something else is not a brand row", () => {
    expect(resolveBrandMatch(MATCH_OTHER.key, "M")).toEqual({ error: "other" });
  });
});

// The fit lines frozen into a shared haul snapshot (haul sharing handoff,
// README §Derivations + AGENT-NOTES answer 3). Pins the exact strings the
// design prints, the band boundaries, and the tops/bottoms-only translation
// rule.
import { describe, expect, it } from "vitest";
import { nearestUsSize, US_SIZES } from "../../us-size-reference.js";
import {
  adviceLine,
  buildSharedFit,
  chartRowForSize,
  fabricSignal,
  fitBand,
  judgedAxis,
  roomLine,
  translationLines,
} from "../../haul-fit-share.js";

describe("nearestUsSize", () => {
  it("places a chest measurement on the letter table", () => {
    expect(nearestUsSize(100, "chest")).toBe("M");
    expect(nearestUsSize(116, "chest")).toBe("XL");
    expect(nearestUsSize(90, "chest")).toBe("S");
  });

  it("places a waist measurement on the letter table", () => {
    expect(nearestUsSize(85, "waist")).toBe("M");
    expect(nearestUsSize(100, "waist")).toBe("XL");
  });

  it("returns null for measurements the table cannot support", () => {
    expect(nearestUsSize(200, "chest")).toBe(null);
    expect(nearestUsSize(30, "chest")).toBe(null);
    expect(nearestUsSize(NaN, "chest")).toBe(null);
    expect(nearestUsSize(0, "chest")).toBe(null);
  });

  it("keeps the table in centimetres with no overlapping ranges", () => {
    for (const row of US_SIZES) {
      expect(row.chestCm[0]).toBeLessThan(row.chestCm[1]);
      expect(row.waistCm[0]).toBeLessThan(row.waistCm[1]);
    }
  });
});

describe("judgedAxis", () => {
  it("judges tops on chest and bottoms on waist", () => {
    expect(judgedAxis("shirt")).toBe("chest");
    expect(judgedAxis("pants")).toBe("waist");
    expect(judgedAxis("shorts")).toBe("waist");
  });

  it("judges outerwear on chest but gives footwear no axis", () => {
    expect(judgedAxis("outerwear")).toBe("chest");
    expect(judgedAxis("shoes")).toBe(null);
    expect(judgedAxis("hat")).toBe(null);
  });
});

describe("fitBand", () => {
  it("follows the handoff boundaries", () => {
    expect(fitBand(7.9)).toBe("slim");
    expect(fitBand(8)).toBe("regular");
    expect(fitBand(16)).toBe("regular");
    expect(fitBand(17)).toBe("boxy");
    expect(fitBand(26)).toBe("boxy");
    expect(fitBand(27)).toBe("oversized");
  });

  it("returns null for a non-number", () => {
    expect(fitBand(NaN)).toBe(null);
  });
});

describe("roomLine", () => {
  it("prints the room and the band word like the design", () => {
    expect(roomLine(14, 98)).toBe("14cm of room on my 98cm. Regular fit.");
    expect(roomLine(6, 98)).toBe("6cm of room on my 98cm. Slim fit.");
    expect(roomLine(3, 79)).toBe("3cm of room on my 79cm. True to size.");
    expect(roomLine(8, 98)).toBe("8cm of room on my 98cm. Regular, on the slim edge.");
    expect(roomLine(20, 98)).toBe("20cm of room on my 98cm. Boxy fit.");
    expect(roomLine(30, 98)).toBe("30cm of room on my 98cm. Oversized fit.");
  });

  it("reads a negative room as tight, never as a negative of room", () => {
    expect(roomLine(-2, 79)).toBe("Sits 2cm under my 79cm. Tight fit.");
  });

  it("returns null without both measurements", () => {
    expect(roomLine(NaN, 98)).toBe(null);
    expect(roomLine(10, NaN)).toBe(null);
  });
});

describe("translationLines", () => {
  it("translates a top to the nearest US letter size", () => {
    expect(translationLines("XL", 100, "chest")).toEqual({
      translation: "Their XL fits like a US M.",
      short: "XL = US M",
    });
  });

  it("translates a bottom to a US waist in inches", () => {
    expect(translationLines("L", 79, "waist")).toEqual({
      translation: "Their L fits like a US 30–31 waist.",
      short: "L = US 30–31",
    });
  });

  it("returns null without a size, a measure, or a known axis", () => {
    expect(translationLines("", 100, "chest")).toBe(null);
    expect(translationLines("XL", NaN, "chest")).toBe(null);
    expect(translationLines("XL", 100, null)).toBe(null);
  });
});

describe("adviceLine", () => {
  it("names the wearer measurement and the pick", () => {
    expect(adviceLine("XL", 98, "chest")).toBe("Around a 98cm chest? Take the XL.");
    expect(adviceLine("L", 79.4, "waist")).toBe("Around a 79cm waist? Take the L.");
  });

  it("returns null without a pick or a measurement", () => {
    expect(adviceLine("", 98, "chest")).toBe(null);
    expect(adviceLine("XL", NaN, "chest")).toBe(null);
  });
});

describe("fabricSignal", () => {
  it("bands tee classes by grams", () => {
    expect(fabricSignal(150, "tee")).toBe("thin");
    expect(fabricSignal(180, "tee")).toBe("midweight");
    expect(fabricSignal(220, "tee")).toBe("midweight");
    expect(fabricSignal(221, "tee")).toBe("heavyweight");
    expect(fabricSignal(250, "heavy_tee")).toBe("heavyweight");
    expect(fabricSignal(190, "long_sleeve_tee")).toBe("midweight");
  });

  it("stays silent for other classes and missing weights", () => {
    expect(fabricSignal(400, "hoodie")).toBe(null);
    expect(fabricSignal(0, "tee")).toBe(null);
    expect(fabricSignal(NaN, "tee")).toBe(null);
  });
});

describe("buildSharedFit", () => {
  const chart = {
    rows: [
      { size: "L", chest: 108, waist: 79 },
      { size: "XL", chest: 112, waist: 82 },
    ],
  };
  const profile = { chest: 98, waist: 79 };

  it("builds all four lines for a top with a chart", () => {
    const fit = buildSharedFit({
      category: "shirt",
      sizeBought: "XL",
      chart,
      profile,
      recommendedSize: "XL",
    });
    expect(fit.translation).toBe("Their XL fits like a US XL.");
    expect(fit.short).toBe("XL = US XL");
    expect(fit.roomLine).toBe("14cm of room on my 98cm. Regular fit.");
    expect(fit.advice).toBe("Around a 98cm chest? Take the XL.");
    expect(fit.source).toBe("Read from the seller's chart");
  });

  it("translates bottoms on the waist axis", () => {
    const fit = buildSharedFit({
      category: "pants",
      sizeBought: "XL",
      chart,
      profile,
      recommendedSize: "XL",
    });
    expect(fit.translation).toBe("Their XL fits like a US 31–32 waist.");
    expect(fit.roomLine).toBe("3cm of room on my 79cm. True to size.");
  });

  it("shows room and band but no translation for outerwear", () => {
    const fit = buildSharedFit({
      category: "outerwear",
      sizeBought: "XL",
      chart,
      profile,
      recommendedSize: "XL",
    });
    expect(fit.translation).toBeUndefined();
    expect(fit.roomLine).toBe("14cm of room on my 98cm. Regular fit.");
  });

  it("says when there was no chart", () => {
    const fit = buildSharedFit({
      category: "shirt",
      sizeBought: "XL",
      chart: null,
      profile,
      recommendedSize: null,
    });
    // No chart and no lines means no block at all.
    expect(fit).toBe(null);
  });

  it("omits the advice line when the app has no pick", () => {
    const fit = buildSharedFit({
      category: "shirt",
      sizeBought: "XL",
      chart,
      profile,
      recommendedSize: null,
    });
    expect(fit.advice).toBeUndefined();
    expect(fit.translation).toBeTruthy();
  });

  it("omits the room line when the author saved no measurement", () => {
    const fit = buildSharedFit({
      category: "shirt",
      sizeBought: "XL",
      chart,
      profile: {},
      recommendedSize: "XL",
    });
    expect(fit.roomLine).toBeUndefined();
    expect(fit.advice).toBeUndefined();
  });

  it("returns null when the size bought is not on the chart", () => {
    const fit = buildSharedFit({
      category: "shirt",
      sizeBought: "XXL",
      chart,
      profile,
      recommendedSize: null,
    });
    expect(fit).toBe(null);
  });

  it("writes no em dash in any line", () => {
    const fit = buildSharedFit({
      category: "pants",
      sizeBought: "L",
      chart,
      profile,
      recommendedSize: "L",
    });
    for (const value of Object.values(fit)) {
      expect(value).not.toContain("—");
    }
  });
});

describe("chartRowForSize", () => {
  it("matches the bought size case-insensitively", () => {
    const chart = { rows: [{ size: "XL", chest: 112 }] };
    expect(chartRowForSize(chart, "xl")).toEqual({ size: "XL", chest: 112 });
    expect(chartRowForSize(chart, "M")).toBe(null);
    expect(chartRowForSize(null, "XL")).toBe(null);
  });
});

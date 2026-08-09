import { describe, expect, it } from "vitest";

// Simpler fit card (Kyle's mockup, 2026-08-09). Pins the two pure helpers:
// sizeCellReads grades every chart size against the pick's band, fitRowWord
// gives each bar row one plain word. No UI in here — the words are the
// contract the chips and bars render.

const { CHEST_EASE_BANDS, fitRowWord, sizeCellReads, parseSizeChart } = await import(
  "../../credenza-fashion.jsx"
);

const chartOf = (text) => parseSizeChart(text);

describe("sizeCellReads grades every size against the band", () => {
  // Knit band [5,10], body chest 100, soft delta 4.
  const chart = chartOf(
    "S: chest 104, length 68\n" +
      "M: chest 107, length 70\n" +
      "L: chest 113, length 72\n" +
      "XL: chest 116, length 74\n" +
      "XXL: chest 120, length 76"
  );
  const rec = { primaryKey: "chest", easeBand: CHEST_EASE_BANDS.knit, size: "M" };
  const reads = sizeCellReads(chart, rec, { chest: 100 });

  it("names each fit from the raw ease", () => {
    expect(reads.map((r) => [r.size, r.ease, r.word])).toEqual([
      ["S", 4, "TIGHT"], // 1cm under the band
      ["M", 7, "FITS"],
      ["L", 13, "LOOSE"], // 3cm past the band, inside one soft delta
      ["XL", 16, "BIG"], // 6cm past, inside two soft deltas
      ["XXL", 20, "TOO BIG"], // 10cm past, beyond two
    ]);
  });

  it("flags the pick so the UI can say YOUR FIT", () => {
    expect(reads.find((r) => r.size === "M").isPick).toBe(true);
    expect(reads.find((r) => r.size === "L").isPick).toBe(false);
  });

  it("says TOO SMALL when the ease is more than a soft delta under the band", () => {
    const tiny = chartOf("S: chest 94, length 66\nM: chest 107, length 70");
    const out = sizeCellReads(tiny, rec, { chest: 100 });
    expect(out[0].word).toBe("TOO SMALL"); // ease -6, eleven under the band
    expect(out[1].word).toBe("FITS");
  });

  it("reads bottoms against the waist target when there is no band", () => {
    // Waist target [ideal 2, span 3] → band [-1, 5], soft delta 4.
    const pants = chartOf("30: waist 78, hip 100\n32: waist 82, hip 104\n34: waist 90, hip 110");
    const waistRec = { primaryKey: "waist", easeBand: null, size: "32" };
    const out = sizeCellReads(pants, waistRec, { waist: 80 });
    expect(out.map((r) => [r.size, r.ease, r.word])).toEqual([
      ["30", -2, "TIGHT"],
      ["32", 2, "FITS"],
      ["34", 10, "BIG"], // 5cm past the band top, inside two soft deltas
    ]);
  });

  it("stays silent without a body number or a primary key", () => {
    expect(sizeCellReads(chart, rec, {})).toEqual([]);
    expect(sizeCellReads(chart, { easeBand: CHEST_EASE_BANDS.knit }, { chest: 100 })).toEqual([]);
    expect(sizeCellReads(null, rec, { chest: 100 })).toEqual([]);
  });
});

describe("fitRowWord gives each bar row one plain word", () => {
  const row = (over) => ({ key: "chest", ease: 8, warn: false, soft: false, dashed: false, ...over });

  it("flavors an in-band chest by the cut's band", () => {
    expect(fitRowWord(row({ ease: 12 }), { easeBand: CHEST_EASE_BANDS.knitRelaxed })).toBe("oversized");
    expect(fitRowWord(row({ ease: 2 }), { easeBand: CHEST_EASE_BANDS.knitSlim })).toBe("slim");
    expect(fitRowWord(row({ ease: 7 }), { easeBand: CHEST_EASE_BANDS.knit })).toBe("fine");
  });

  it("owns up to the soft zone and the red zone, in the right direction", () => {
    const knit = { easeBand: CHEST_EASE_BANDS.knit }; // [5,10]
    expect(fitRowWord(row({ ease: 12, soft: true }), knit)).toBe("a touch loose");
    expect(fitRowWord(row({ ease: 3, soft: true }), knit)).toBe("a touch tight");
    expect(fitRowWord(row({ ease: 20, warn: true }), knit)).toBe("too loose");
    expect(fitRowWord(row({ ease: -2, warn: true }), knit)).toBe("too tight");
  });

  it("reads non-chest rows against their own targets", () => {
    // Shoulder target [ideal 2, span 3] → [-1, 5].
    expect(fitRowWord(row({ key: "shoulder", ease: -1 }), null)).toBe("fine");
    expect(fitRowWord(row({ key: "sleeve", ease: 0 }), null)).toBe("fine");
    expect(fitRowWord(row({ key: "length", ease: 2 }), null)).toBe("fine");
  });

  it("stays silent on rows that carry no verdict", () => {
    expect(fitRowWord(row({ dashed: true }), { easeBand: CHEST_EASE_BANDS.knit })).toBeNull();
    expect(fitRowWord(row({ ease: null }), { easeBand: CHEST_EASE_BANDS.knit })).toBeNull();
    expect(fitRowWord(null, null)).toBeNull();
  });
});

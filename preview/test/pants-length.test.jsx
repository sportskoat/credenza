// The trouser/shorts length a customer saves, now used on pants and shorts
// (F's spec, 2026-08-01, approved by Kyle in #build):
//
//   1. Pants and shorts only. Shirts keep their own, separate length pass.
//   2. Length only breaks a tie between sizes that already fit the waist
//      (or hip) equally. It never overrides a clear waist winner.
//   3. Both sides are the seller's own full outside-leg number (裤长) —
//      no inseam column, no estimate.
//   4. A run-long/run-short flag appears on lengthCheck once the picked
//      size's leg length differs from the saved one by 5cm or more.
import { describe, expect, it } from "vitest";

const { parseSizeChart, recommendSize } = await import("../../credenza-fashion.jsx");

// Waist target is p.waist + 2cm ease. M sits on the target (score 0); L sits
// 5cm off it but still inside the ±6cm tolerance that makes a row eligible
// for the length pass. Their leg lengths are 8cm apart.
const TIE_TEXT =
  "M: waist 80, hip 104, pants length 100\nL: waist 85, hip 108, pants length 108";
// L's waist is 15cm off target — outside the ±6cm tolerance — so it can
// never enter the length pass, no matter how well its leg matches.
const WIDE_TEXT =
  "M: waist 78, hip 104, pants length 100\nL: waist 95, hip 120, pants length 108";
const NO_LENGTH_COLUMN_TEXT = "M: waist 80, hip 106\nL: waist 85, hip 111";

const chartOf = (text) => parseSizeChart(text);

describe("the trouser/shorts length tie-break", () => {
  it("breaks a tie on pants: the same waist, two sizes, the closer leg wins", () => {
    const chart = chartOf(TIE_TEXT);
    // With no saved leg length, waist alone picks the M (dead on target).
    const base = { waist: 78 };
    expect(recommendSize(chart, base, "pants").size).toBe("M");
    // Saved leg length 106 → the L's 108 is closer than the M's 100.
    const withLeg = recommendSize(chart, { waist: 78, pantsLength: 106 }, "pants");
    expect(withLeg.size).toBe("L");
    expect(withLeg.legLengthWin).toMatchObject({ fromSize: "M", legLength: 108, legLengthTarget: 106 });
  });

  it("breaks a tie on shorts using the saved shorts length, on the same pantsLength chart column", () => {
    const chart = chartOf(TIE_TEXT);
    const withLeg = recommendSize(chart, { waist: 78, shortsLength: 106 }, "shorts");
    expect(withLeg.size).toBe("L");
    expect(withLeg.legLengthWin).toMatchObject({ fromSize: "M" });
  });

  it("does not override a clear waist winner", () => {
    const chart = chartOf(WIDE_TEXT);
    // Waist 78 clearly wants the M; the L sits 15cm off target, outside the
    // tolerance that would let it into the length pass — even though its
    // leg length (108) matches the saved number exactly.
    const rec = recommendSize(chart, { waist: 78, pantsLength: 108 }, "pants");
    expect(rec.size).toBe("M");
    expect(rec.legLengthWin, "the leg length overruled a clear waist winner").toBeNull();
  });

  it("skips the tie-break when the chart has no length column", () => {
    const chart = chartOf(NO_LENGTH_COLUMN_TEXT);
    const rec = recommendSize(chart, { waist: 78, pantsLength: 106 }, "pants");
    expect(rec.size).toBe("M");
    expect(rec.legLengthWin).toBeNull();
  });

  it("does nothing without a saved trouser length", () => {
    const chart = chartOf(TIE_TEXT);
    const rec = recommendSize(chart, { waist: 78 }, "pants");
    expect(rec.size).toBe("M");
    expect(rec.legLengthWin).toBeNull();
  });

  it("leaves shirts alone", () => {
    // A chest chart is read on the chest. A saved trouser length must not
    // touch it — that is the shirt length pass's job, not this one.
    const chart = chartOf("M: chest 100, length 68\nL: chest 106, length 74");
    const rec = recommendSize(chart, { chest: 100, pantsLength: 106 }, "shirt");
    expect(rec.legLengthWin).toBeNull();
  });
});

describe("the run-long / run-short warning", () => {
  // Every chart below carries a second, far-off row (L) purely so the chart
  // has the two rows recommendSize requires — it never wins the pick.
  const FAR_ROW = "L: waist 95, hip 120, pants length 130";

  it("flags a picked size that runs long by 5cm or more", () => {
    const chart = chartOf(`M: waist 78, hip 104, pants length 106\n${FAR_ROW}`);
    const rec = recommendSize(chart, { waist: 78, pantsLength: 100 }, "pants");
    expect(rec.size).toBe("M");
    expect(rec.lengthCheck).toMatchObject({ garment: 106, body: 100, warn: "long" });
  });

  it("flags a picked size that runs short by 5cm or more", () => {
    const chart = chartOf(`M: waist 78, hip 104, pants length 94\n${FAR_ROW}`);
    const rec = recommendSize(chart, { waist: 78, pantsLength: 100 }, "pants");
    expect(rec.size).toBe("M");
    expect(rec.lengthCheck).toMatchObject({ garment: 94, body: 100, warn: "short" });
  });

  it("stays quiet under the 5cm threshold", () => {
    const chart = chartOf(`M: waist 78, hip 104, pants length 103\n${FAR_ROW}`);
    const rec = recommendSize(chart, { waist: 78, pantsLength: 100 }, "pants");
    expect(rec.lengthCheck).toMatchObject({ garment: 103, body: 100, warn: null });
  });

  it("shows nothing with no saved leg length", () => {
    const chart = chartOf(`M: waist 78, hip 104, pants length 106\n${FAR_ROW}`);
    const rec = recommendSize(chart, { waist: 78 }, "pants");
    expect(rec.lengthCheck).toBeNull();
  });
});

// The trouser/shorts length a customer saves, now used on pants and shorts
// (F's spec, 2026-08-01, tightened by C's engine audit + F's spec, 2026-08-02):
//
//   1. Pants and shorts only. Shirts keep their own, separate length pass.
//   2. Length only breaks a GENUINE tie: candidates within TIE_EPSILON of the
//      primary (waist/hip) winner's score, after the hard waist floor runs.
//      It never overrides a clear waist winner. The original ±6cm
//      primaryFits window was wide enough to let a size 5cm+ off the true
//      winner's score still compete on length alone — that is how a
//      too-small Large beat a correct X-Large on Kyle's shorts card
//      (2026-08-02). TIE_EPSILON (0.5) is the same threshold that already
//      decides "ties go to the bigger size" for the primary pick itself, so
//      the length pass can only ever move the pick DOWN, from that
//      tie-winner to a smaller row that is just as genuinely tied.
//   3. Both sides are the seller's own full outside-leg number (裤长) —
//      no inseam column, no estimate.
//   4. A run-long/run-short flag appears on lengthCheck once the picked
//      size's leg length differs from the saved one by 5cm or more.
import { describe, expect, it } from "vitest";

const { parseSizeChart, recommendSize } = await import("../../credenza-fashion.jsx");

// Waist target is p.waist + 2cm ease = 80. Both rows sit inside TIE_EPSILON
// (0.5) of that target, so they are a genuine tie: the plain tie rule
// ("ties go to the bigger size") already picks the L with no leg length
// saved. Their leg lengths are 8cm apart.
const TIE_TEXT =
  "M: waist 79.8, hip 104, pants length 100\nL: waist 80.3, hip 104, pants length 108";
// L's waist is 15cm off target — nowhere near TIE_EPSILON of the M's score —
// so it can never enter the length pass, no matter how well its leg matches.
const WIDE_TEXT =
  "M: waist 78, hip 104, pants length 100\nL: waist 95, hip 120, pants length 108";
const NO_LENGTH_COLUMN_TEXT = "M: waist 80, hip 106\nL: waist 85, hip 111";

const chartOf = (text) => parseSizeChart(text);

describe("the trouser/shorts length tie-break", () => {
  it("breaks a genuine tie on pants: two sizes tied on waist, the closer leg wins", () => {
    const chart = chartOf(TIE_TEXT);
    // With no saved leg length, the plain tie rule already picks the bigger
    // of the two tied rows, the L.
    const base = { waist: 78 };
    expect(recommendSize(chart, base, "pants").size).toBe("L");
    // Saved leg length 99 sits far closer to the M's 100 than the L's 108.
    // Because M is genuinely tied with L on waist, the length pass can move
    // the pick back down to it.
    const withLeg = recommendSize(chart, { waist: 78, pantsLength: 99 }, "pants");
    expect(withLeg.size).toBe("M");
    expect(withLeg.legLengthWin).toMatchObject({ fromSize: "L", legLength: 100, legLengthTarget: 99 });
  });

  it("breaks a genuine tie on shorts using the saved shorts length, on the same pantsLength chart column", () => {
    const chart = chartOf(TIE_TEXT);
    const withLeg = recommendSize(chart, { waist: 78, shortsLength: 99 }, "shorts");
    expect(withLeg.size).toBe("M");
    expect(withLeg.legLengthWin).toMatchObject({ fromSize: "L" });
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
    // No leg length saved: the plain tie rule alone decides, and picks the
    // bigger of the two tied rows.
    expect(rec.size).toBe("L");
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

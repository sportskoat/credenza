// The shirt length a customer saves, and the Cropped / Regular / Long rows
// (Kyle 2026-07-30, #design thread b236ed8a: "let's do this").
//
// Before this, the seller's 衣长 had nothing to compare against: the Body
// length row printed two numbers and no verdict, and the length taste rows
// changed nothing at all. Four rules are under test here, and each one is a
// promise made to Kyle:
//
//   1. The saved number beats the estimate from height.
//   2. The app never grades a guess — an estimated length gets no mark.
//   3. Cropped asks for 4cm less, Long asks for 4cm more.
//   4. When the length moves the pick, the app names what the chest paid.
import { describe, expect, it } from "vitest";

const {
  BODY_PROFILE_FIELDS,
  fitReadRows,
  lengthCostSentence,
  lengthNudgeCm,
  parseSizeChart,
  recommendSize,
} = await import("../../credenza-fashion.jsx");

// Two sizes sit within a centimetre of the same chest ease, and their body
// lengths are 6cm apart. That is the shape where the length decides.
const TIE_TEXT =
  "M: chest 106, shoulder 46, length 68\nL: chest 108, shoulder 47, length 74";
// Here the chest gap is wide: 12cm between the rows. The length must not win.
const WIDE_TEXT =
  "M: chest 100, shoulder 45, length 68\nL: chest 124, shoulder 50, length 74";

const chartOf = (text) => parseSizeChart(text);

describe("the shirt length the customer saves", () => {
  it("offers one box for it, in the upper-body group", () => {
    const row = BODY_PROFILE_FIELDS.find(([key]) => key === "length");
    expect(row, "there is no shirt-length field").toBeTruthy();
    expect(row[1]).toBe("Shirt length");
    expect(row[2]).toBe("length");
    expect(row[5], "the box is not grouped with the other upper-body ones").toBe("top");
  });

  it("prints the saved number, not the estimate from height", () => {
    const chart = chartOf(TIE_TEXT);
    const profile = { chest: 94, height: 180, length: 66 };
    const rec = recommendSize(chart, profile, "shirt");
    const row = fitReadRows(chart, rec, profile, "shirt").find((r) => r.key === "length");
    expect(row.yours, "the estimate overwrote the saved length").toBe(66);
    expect(row.estimated).toBe(false);
  });

  it("grades a saved length, and never grades a guess", () => {
    const chart = chartOf(TIE_TEXT);
    // Saved: the row earns a mark, an ease and a verdict.
    const saved = { chest: 94, length: 68 };
    const savedRec = recommendSize(chart, saved, "shirt");
    const savedRow = fitReadRows(chart, savedRec, saved, "shirt").find((r) => r.key === "length");
    expect(savedRow.ease, "a saved length has no ease").not.toBeNull();
    expect(savedRow.mark, "a saved length has no mark").not.toBeNull();

    // Estimated: the number shows, and nothing else does.
    const guessed = { chest: 94, height: 180 };
    const guessRec = recommendSize(chart, guessed, "shirt");
    const guessRow = fitReadRows(chart, guessRec, guessed, "shirt").find((r) => r.key === "length");
    expect(guessRow.estimated).toBe(true);
    expect(guessRow.yours, "the estimate stopped printing").not.toBeNull();
    expect(guessRow.ease, "the app graded a guess").toBeNull();
    expect(guessRow.mark, "the app marked a guess").toBeNull();
    expect(guessRow.warn, "the app warned on a guess").toBe(false);
  });
});

describe("the Cropped / Regular / Long rows", () => {
  it("moves the target length by four centimetres, each way", () => {
    expect(lengthNudgeCm({ length: "cropped" })).toBe(-4);
    expect(lengthNudgeCm({ length: "long" })).toBe(4);
    expect(lengthNudgeCm({ length: "regular" })).toBe(0);
    expect(lengthNudgeCm(null)).toBe(0);
    expect(lengthNudgeCm({ length: "long", dismissed: true }), "a dismissed ask still acted").toBe(0);
  });

  it("breaks a tie: the same body, two length choices, two sizes", () => {
    const chart = chartOf(TIE_TEXT);
    // Body length 68 with no taste → the M matches it exactly.
    const base = { chest: 94, length: 68 };
    expect(recommendSize(chart, base, "shirt").size).toBe("M");
    // Long asks for 72 → the L's 74 is closer than the M's 68.
    const long = recommendSize(chart, base, "shirt", { length: "long" });
    expect(long.size).toBe("L");
    // Cropped asks for 64 → back to the M.
    const cropped = recommendSize(chart, base, "shirt", { length: "cropped" });
    expect(cropped.size).toBe("M");
  });

  it("leaves the size alone when the chest gap is wide", () => {
    const chart = chartOf(WIDE_TEXT);
    // The chest wants the M (100 against 94 + 12 = 106 target beats 124).
    // The length wants the L. The chest must still win.
    const rec = recommendSize(chart, { chest: 94, length: 74 }, "shirt", { length: "long" });
    expect(rec.size).toBe("M");
    expect(rec.lengthWin, "the length overruled a 24cm chest gap").toBeNull();
  });

  it("does nothing without a saved length", () => {
    const chart = chartOf(TIE_TEXT);
    const rec = recommendSize(chart, { chest: 94 }, "shirt", { length: "long" });
    expect(rec.size).toBe("M");
    expect(rec.lengthTargetUsed).toBeNull();
    expect(rec.prefReason, "the app claimed to act with no number").toMatch(
      /Save your shirt length/
    );
  });

  it("leaves bottoms alone", () => {
    // A pants chart is read on the waist, and its Length is an outside-leg
    // number. A saved shirt length must not touch it.
    const chart = chartOf("M: waist 78, hip 104, pants length 100\nL: waist 82, hip 108, pants length 108");
    const rec = recommendSize(chart, { waist: 80, length: 74 }, "pants", { length: "long" });
    expect(rec.lengthWin).toBeNull();
    expect(rec.lengthTargetUsed).toBeNull();
  });
});

describe("the app never sizes up in silence", () => {
  it("names the size it left and what the chest paid", () => {
    const chart = chartOf(TIE_TEXT);
    const rec = recommendSize(chart, { chest: 94, length: 68 }, "shirt", { length: "long" });
    expect(rec.size).toBe("L");
    expect(rec.lengthWin).toMatchObject({ fromSize: "M", chestEase: 14, chestEaseBefore: 12 });
    const line = lengthCostSentence(rec, { units: "cm" });
    expect(line).toContain("Sized up for length");
    expect(line).toContain("M");
    expect(line, "the sentence hides the new chest number").toContain("+14cm");
    expect(line, "the sentence hides the old chest number").toContain("+12cm");
  });

  it("says nothing when the length agrees with the chest", () => {
    const chart = chartOf(TIE_TEXT);
    const rec = recommendSize(chart, { chest: 94, length: 68 }, "shirt", { length: "regular" });
    expect(rec.size).toBe("M");
    expect(lengthCostSentence(rec, { units: "cm" })).toBe("");
    expect(rec.prefReason).toMatch(/matches this size/);
  });

  it("stays quiet on a hand pick — the customer chose, the app did not", () => {
    const chart = chartOf(TIE_TEXT);
    const forced = recommendSize(chart, { chest: 94, length: 68 }, "shirt", { length: "long" }, "L");
    expect(forced.size).toBe("L");
    expect(forced.lengthWin, "a tap was reported as the app sizing up").toBeNull();
    expect(lengthCostSentence(forced, { units: "cm" })).toBe("");
  });
});

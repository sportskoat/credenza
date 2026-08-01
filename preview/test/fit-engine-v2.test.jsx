// Fit engine v2 — Kyle, #design thread 8f960358, 2026-07-30: "a jacket, it's
// supposed to be a little bit bigger on you than, say, a fitted T shirt or a
// dry fit... How can we be more accurate on the size?"
//
// Before this the engine had ONE room number per category: 16cm for outerwear
// and 12cm for every other top. A blazer and a parka shared 16cm; a dry-fit
// shared 12cm with a hoodie. Every promise under test here comes from C's
// review, RESEARCH/GARMENT_FIT_INTELLIGENCE_REVIEW_2026_07_30.md:
//
//   1. A tailored jacket and a coat are different products (7.5–12.5 vs
//      12.5–20cm), so the same chart gives them different sizes.
//   2. The shoulder is a strong score, not a universal veto.
//   3. A drop-shoulder cut is named from the title first; a wide shoulder is
//      supporting evidence only.
//   4. Raglan is a third construction, with no comparable shoulder seam.
//   5. A garment the engine cannot name keeps the pre-v2 numbers exactly.
import { describe, expect, it } from "vitest";

const {
  CHEST_EASE_BANDS,
  chestEaseBand,
  declaredFit,
  fitReadRows,
  garmentReasonLine,
  garmentTypeWord,
  garmentType,
  parseSizeChart,
  recommendSize,
  shortsLengthNote,
  topCut,
} = await import("../../credenza-fashion.jsx");

const chartOf = (text) => parseSizeChart(text);

describe("naming the garment", () => {
  const chart = chartOf("M: chest 110, shoulder 46, length 70\nL: chest 116, shoulder 48, length 72");

  it("reads the garment out of an English title", () => {
    expect(garmentType("Heavyweight boxy tee", chart, "shirt")).toBe("knit");
    expect(garmentType("Nike dry-fit training top", chart, "shirt")).toBe("compression");
    expect(garmentType("Oxford button-down", chart, "shirt")).toBe("woven");
    expect(garmentType("Wool blazer", chart, "outerwear")).toBe("blazer");
    expect(garmentType("Down puffer jacket", chart, "outerwear")).toBe("coat");
  });

  it("reads the garment out of a Chinese title", () => {
    expect(garmentType("纯棉短袖", chart, "shirt")).toBe("knit");
    expect(garmentType("速干T恤", chart, "shirt")).toBe("compression");
    expect(garmentType("条纹衬衫", chart, "shirt")).toBe("woven");
    expect(garmentType("休闲西装", chart, "outerwear")).toBe("blazer");
    expect(garmentType("羽绒服", chart, "outerwear")).toBe("coat");
  });

  it("lets the narrower word win when a title carries two", () => {
    // A suit jacket is a blazer, not a coat, even though "coat" is in there.
    expect(garmentType("Sport coat / suit jacket", chart, "outerwear")).toBe("blazer");
    // A dry-fit tee is a dry-fit. The room it needs is nothing like a tee's.
    expect(garmentType("Dri-FIT tee", chart, "shirt")).toBe("compression");
  });

  it("falls back to the category when the title says nothing", () => {
    expect(garmentType("Palace x Nike jersey", chart, "shirt")).toBe("knit");
    expect(garmentType("", chart, "outerwear")).toBe("coat");
    expect(garmentType("", chart, "pants")).toBe("pants");
  });

  it("says unknown rather than guessing", () => {
    expect(garmentType("Palace x Nike jersey", chart, "other")).toBe("unknown");
    expect(garmentType(null, chart, null)).toBe("unknown");
  });
});

describe("naming the cut", () => {
  // Shoulders 46/48 against a 45cm body: 1–3cm over, a normal set-in range.
  const normal = chartOf("M: chest 110, shoulder 46, length 70\nL: chest 116, shoulder 48, length 72");
  // Shoulders 52/54: 7–9cm over the same body, well past the 5cm mark.
  const wide = chartOf("M: chest 110, shoulder 52, length 70\nL: chest 116, shoulder 54, length 72");
  const body = { chest: 100, shoulder: 45 };

  it("takes the title's word first", () => {
    expect(topCut("Oversized drop shoulder hoodie", normal, body)).toBe("drop");
    expect(topCut("落肩卫衣", normal, body)).toBe("drop");
    expect(topCut("Raglan sleeve crewneck", normal, body)).toBe("raglan");
    expect(topCut("插肩袖", normal, body)).toBe("raglan");
    expect(topCut("Slim fit shirt", wide, body)).toBe("set-in");
  });

  it("uses a wide shoulder as supporting evidence only", () => {
    // No title word, but every row hangs 5cm or more past the body.
    expect(topCut("", wide, body)).toBe("drop");
    // One wide row is a big SIZE, not a cut. All of them wide is a cut.
    const mixed = chartOf("M: chest 110, shoulder 46, length 70\nL: chest 116, shoulder 54, length 72");
    expect(topCut("", mixed, body)).toBe("unknown");
  });

  it("says unknown when it cannot tell", () => {
    expect(topCut("", normal, body)).toBe("unknown");
    // No saved shoulder means the evidence test cannot run at all.
    expect(topCut("", wide, { chest: 100 })).toBe("unknown");
  });
});

describe("the room each garment gets", () => {
  it("keeps C's bands, decimals and all", () => {
    expect(CHEST_EASE_BANDS.blazer).toEqual([7.5, 12.5]);
    expect(CHEST_EASE_BANDS.coat).toEqual([12.5, 20]);
    expect(CHEST_EASE_BANDS.compression).toEqual([-2.5, 2.5]);
  });

  it("separates a tailored jacket from a coat", () => {
    expect(chestEaseBand("blazer", "set-in", null)).toEqual([7.5, 12.5]);
    expect(chestEaseBand("coat", "set-in", null)).toEqual([12.5, 20]);
  });

  it("stands the seller's declared fit in when the customer saved no taste", () => {
    // C: a woven shirt's band is "adjusted by the declared fit". The same
    // words help on a knit. A saved taste always beats the seller's word.
    expect(declaredFit("Slim fit oxford")).toBe("slim");
    expect(declaredFit("修身衬衫")).toBe("slim");
    expect(declaredFit("Oversized boxy tee")).toBe("oversized");
    expect(declaredFit("Cotton tee")).toBeNull();
  });

  it("lets the customer's taste choose the band on a knit", () => {
    expect(chestEaseBand("knit", "set-in", null)).toEqual([5, 10]);
    expect(chestEaseBand("knit", "set-in", "slim")).toEqual([0, 5]);
    expect(chestEaseBand("knit", "set-in", "oversized")).toEqual([15, 25]);
  });

  it("treats a drop-shoulder knit as relaxed even with no taste saved", () => {
    // The extra width is the design. Correcting it would fight the garment.
    expect(chestEaseBand("knit", "drop", null)).toEqual([10, 15]);
  });

  it("hands back nothing for a garment it cannot name", () => {
    expect(chestEaseBand("unknown", "set-in", null)).toBeNull();
    expect(chestEaseBand("pants", null, null)).toBeNull();
  });
});

describe("a blazer and a coat are not the same size", () => {
  // One chart, one body, two titles. This is the whole point of v2.
  const chart = chartOf(
    "S: chest 104, shoulder 44, length 68\nM: chest 110, shoulder 46, length 70\nL: chest 118, shoulder 48, length 72\nXL: chest 126, shoulder 50, length 74"
  );
  const body = { chest: 100 };

  it("sizes a blazer to close over a shirt", () => {
    // Band 7.5–12.5cm → wants 107.5–112.5cm → the M (110).
    const rec = recommendSize(chart, body, "outerwear", null, null, "Wool blazer");
    expect(rec.garmentKind).toBe("blazer");
    expect(rec.easeBand).toEqual([7.5, 12.5]);
    expect(rec.size).toBe("M");
  });

  it("sizes a coat to layer over a tee and a jumper", () => {
    // Band 12.5–20cm → wants 112.5–120cm → the L (118).
    const rec = recommendSize(chart, body, "outerwear", null, null, "Down puffer jacket");
    expect(rec.garmentKind).toBe("coat");
    expect(rec.easeBand).toEqual([12.5, 20]);
    expect(rec.size).toBe("L");
  });

  it("sizes a dry-fit close to the body", () => {
    // Band -2.5–2.5cm → wants 97.5–102.5cm → the S (104) is nearest.
    const rec = recommendSize(chart, body, "shirt", null, null, "Dri-FIT training top");
    expect(rec.garmentKind).toBe("compression");
    expect(rec.size).toBe("S");
  });

  it("names the garment in one line, and never guesses out loud", () => {
    const blazer = recommendSize(chart, body, "outerwear", null, null, "Wool blazer");
    expect(garmentReasonLine(blazer)).toBe("Blazer: sized to close over a shirt, not over a jumper.");
    // No band, no claim.
    expect(garmentReasonLine({ garmentKind: "unknown", easeBand: null })).toBe("");
    expect(garmentReasonLine(null)).toBe("");
  });

  it("describes the room the pick actually used, not just the garment", () => {
    // A tee sized on the oversized band must not say "everyday room" — the
    // line would argue with the centimetres printed under it.
    const over = recommendSize(chart, body, "shirt", null, null, "Oversized boxy tee");
    expect(over.easeBand).toEqual([15, 25]);
    expect(garmentReasonLine(over)).toBe("Oversized tee: sized to hang loose, which is the cut.");
    const slim = recommendSize(chart, body, "shirt", { looseness: "slim" }, null, "Cotton tee");
    expect(garmentReasonLine(slim)).toBe("Tee: sized close to the body, the way you like them.");
    const plain = recommendSize(chart, body, "shirt", null, null, "Cotton tee");
    expect(garmentReasonLine(plain)).toBe("Tee: sized for everyday room, not tight and not loose.");
  });

  // Kyle 2026-07-30: "only show the type in the chart photo". The card prints
  // this word instead of the sentence above, so it has to be one word, and it
  // has to be empty whenever the engine did not name a garment.
  it("gives the card one word for the garment, or nothing", () => {
    const blazer = recommendSize(chart, body, "outerwear", null, null, "Wool blazer");
    expect(garmentTypeWord(blazer)).toBe("Blazer");
    const tee = recommendSize(chart, body, "shirt", null, null, "Oversized boxy tee");
    // One word for every tee, however it was sized. The band is not the type.
    expect(garmentTypeWord(tee)).toBe("Tee");
    expect(garmentTypeWord({ garmentKind: "unknown" })).toBe("");
    expect(garmentTypeWord({})).toBe("");
    expect(garmentTypeWord(null)).toBe("");
  });
});

describe("the shoulder is a score, not a veto", () => {
  const body = { chest: 100, shoulder: 45 };

  it("stops grading the shoulder on a drop-shoulder cut", () => {
    // Shoulders 52/54 hang 7–9cm past the body. On a set-in that is a bad
    // fit. On a drop shoulder it is the design, so the row states the number
    // and passes no verdict — the same deal a short sleeve already gets.
    const chart = chartOf("M: chest 110, shoulder 52, length 70\nL: chest 116, shoulder 54, length 72");
    const rec = recommendSize(chart, body, "shirt", null, null, "Oversized drop shoulder tee");
    expect(rec.cut).toBe("drop");
    // The title declares an oversized fit, so the band is 15–25cm and a 100cm
    // chest takes the L (116). The shoulder row then describes the L.
    expect(rec.size).toBe("L");
    const shoulder = fitReadRows(chart, rec, body, "shirt", "Oversized drop shoulder tee").find(
      (r) => r.key === "shoulder"
    );
    expect(shoulder.theirs, "the number itself must still show").toBe(54);
    expect(shoulder.yours, "a seam that hangs on purpose cannot be compared").toBeNull();
    expect(shoulder.ease).toBeNull();
    expect(shoulder.mark).toBeNull();
    expect(shoulder.warn, "the app warned about a shoulder it cannot judge").toBe(false);
  });

  it("stops grading the shoulder on a raglan, which has no shoulder seam", () => {
    const chart = chartOf("M: chest 110, shoulder 52, length 70\nL: chest 116, shoulder 54, length 72");
    const rec = recommendSize(chart, body, "shirt", null, null, "Raglan crewneck");
    expect(rec.cut).toBe("raglan");
    const shoulder = fitReadRows(chart, rec, body, "shirt", "Raglan crewneck").find(
      (r) => r.key === "shoulder"
    );
    expect(shoulder.warn).toBe(false);
    expect(shoulder.mark).toBeNull();
  });

  it("still grades the shoulder on a confirmed set-in cut", () => {
    const chart = chartOf("M: chest 110, shoulder 46, length 70\nL: chest 116, shoulder 48, length 72");
    const rec = recommendSize(chart, body, "shirt", null, null, "Slim fit shirt");
    expect(rec.cut).toBe("set-in");
    const shoulder = fitReadRows(chart, rec, body, "shirt", "Slim fit shirt").find(
      (r) => r.key === "shoulder"
    );
    expect(shoulder.ease, "a set-in shoulder must still be measured").not.toBeNull();
    expect(shoulder.mark).not.toBeNull();
  });

  it("costs a confirmed set-in size its place when the shoulder is far out", () => {
    // The chest says take the L: band 0–5cm on a slim fit wants 100–105, and
    // the L's 104 is inside it while the M's 98 is 2cm under. But the L's
    // 54cm shoulder is 9cm past the body, and a shoulder cannot be altered.
    const chart = chartOf("M: chest 98, shoulder 46, length 70\nL: chest 104, shoulder 54, length 72");
    const rec = recommendSize(chart, body, "shirt", null, null, "Slim fit shirt");
    expect(rec.cut).toBe("set-in");
    expect(rec.size, "a shoulder 9cm out still won the size").toBe("M");
  });

  it("never rejects on an uncertain cut", () => {
    // Same numbers, no title word, one wide row — the cut is unknown, so the
    // shoulder scores but cannot disqualify. The chest keeps the L.
    const chart = chartOf("M: chest 98, shoulder 46, length 70\nL: chest 104, shoulder 54, length 72");
    const rec = recommendSize(chart, body, "shirt", null, null, "");
    expect(rec.cut).toBe("unknown");
    expect(rec.size).toBe("L");
  });
});

describe("shorts leg length", () => {
  // Kyle 2026-07-30: "the values should be the values of the seller charts."
  // The saved Shorts length is now waistband to hem, the same as the chart's
  // 裤长, so the line compares two numbers of the same kind.
  const chart = chartOf("M: waist 78, hip 100, pants length 44\nL: waist 82, hip 104, pants length 48");

  it("compares waist-to-hem against waist-to-hem, with no estimate", () => {
    const profile = { waist: 80, shortsLength: 46 };
    const rec = recommendSize(chart, profile, "shorts");
    const note = shortsLengthNote(rec, profile, "shorts", { units: "cm" });
    expect(note).toContain("waist to hem");
    expect(note).toContain("You like");
    expect(note, "an estimate crept back in").not.toMatch(/estimate|about|inside leg|~/i);
  });

  it("names the length the customer asked for when the size matches", () => {
    const profile = { waist: 80, shortsLength: 47 };
    const rec = recommendSize(chart, profile, "shorts");
    // The pick is the L at 48cm — 1cm from the 47cm asked for.
    expect(shortsLengthNote(rec, profile, "shorts", { units: "cm" })).toContain(
      "the length you want"
    );
  });

  it("names the gap when the size runs longer or shorter", () => {
    const profile = { waist: 80, shortsLength: 38 };
    const rec = recommendSize(chart, profile, "shorts");
    const note = shortsLengthNote(rec, profile, "shorts", { units: "cm" });
    expect(note).toMatch(/longer than you like/);
  });

  it("says nothing without the saved number, and nothing on other garments", () => {
    const profile = { waist: 80 };
    const rec = recommendSize(chart, profile, "shorts");
    expect(shortsLengthNote(rec, profile, "shorts", { units: "cm" })).toBe("");
    const withPref = { waist: 80, shortsLength: 46 };
    expect(shortsLengthNote(rec, withPref, "pants", { units: "cm" })).toBe("");
  });
});

describe("a garment the engine cannot name is left exactly as it was", () => {
  it("keeps the pre-v2 numbers", () => {
    const chart = chartOf(
      "S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70\nXL: 胸围120 衣长72"
    );
    // Category "other" and a title with no garment word: nothing to read.
    const rec = recommendSize(chart, { chest: 100 }, "other", null, null, "Palace x Nike jersey");
    expect(rec.garmentKind).toBe("unknown");
    expect(rec.easeBand).toBeNull();
    // The old flat 12cm target: 100 + 12 = 112 → the M, exactly as before.
    expect(rec.size).toBe("M");
  });
});

describe("oversized widens the band on a compression top, a blazer, and a coat", () => {
  it("gives a compression top the everyday knit band when the customer likes loose", () => {
    expect(chestEaseBand("compression", null, "oversized")).toEqual(CHEST_EASE_BANDS.knit);
    expect(chestEaseBand("compression", null, "baggy")).toEqual(CHEST_EASE_BANDS.knit);
    expect(chestEaseBand("compression", null, null)).toEqual(CHEST_EASE_BANDS.compression);
  });

  it("gives a blazer the coat band when the customer likes loose", () => {
    expect(chestEaseBand("blazer", null, "oversized")).toEqual(CHEST_EASE_BANDS.coat);
    expect(chestEaseBand("blazer", null, null)).toEqual(CHEST_EASE_BANDS.blazer);
  });

  it("gives a coat the oversized knit band when the customer likes loose", () => {
    expect(chestEaseBand("coat", null, "oversized")).toEqual(CHEST_EASE_BANDS.knitOver);
    expect(chestEaseBand("coat", null, null)).toEqual(CHEST_EASE_BANDS.coat);
  });

  it("moves a coat up a size in practice when the customer likes oversized", () => {
    // Chest 100. Normal coat band 12.5–20cm: the M (113) sits inside, the L
    // (123) misses by 3cm, so the M wins. Oversized band 15–25cm: the M
    // misses by 2cm, the L sits inside, so the L wins.
    const chart = chartOf("M: chest 113, length 72\nL: chest 123, length 74");
    const body = { chest: 100 };
    const plain = recommendSize(chart, body, "outerwear", null, null, "Wool Overcoat");
    expect(plain.garmentKind).toBe("coat");
    expect(plain.size).toBe("M");
    const loose = recommendSize(chart, body, "outerwear", { looseness: "oversized" }, null, "Wool Overcoat");
    expect(loose.size).toBe("L");
  });
});

describe("a near-tie between two sizes goes to the larger one", () => {
  const body = { chest: 100 };

  it("picks the larger size when two rows score within half a point", () => {
    // Knit band 5–10cm, midpoint 7.5. The M (107) scores 0.025, the L (109)
    // scores 0.075 — a gap of 0.05, far inside the tie margin. The L wins.
    const chart = chartOf("M: chest 107, length 70\nL: chest 109, length 72");
    const rec = recommendSize(chart, body, "shirt", null, null, "Cotton tee");
    expect(rec.size).toBe("L");
  });

  it("still picks the smaller size when it is clearly the better fit", () => {
    // The M (107) scores 0.025, the L (113) misses the band by 3cm — a gap
    // near 3 points, no tie. The M wins, exactly as before the change.
    const chart = chartOf("M: chest 107, length 70\nL: chest 113, length 72");
    const rec = recommendSize(chart, body, "shirt", null, null, "Cotton tee");
    expect(rec.size).toBe("M");
  });
});

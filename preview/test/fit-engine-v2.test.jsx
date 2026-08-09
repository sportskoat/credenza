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
  computeOutcomeMaps,
  declaredFit,
  fitReadRows,
  garmentReasonLine,
  garmentTypeWord,
  garmentType,
  outcomeShiftFor,
  parseSizeChart,
  recommendSize,
  shortsLengthNote,
  sizeCellReads,
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
    // Debate 2026-08-08: the top widened 20 to 25. Roomy outerwear is the
    // cut, not a warning — Kyle's +24.4cm jacket drew red under 20.
    expect(CHEST_EASE_BANDS.coat).toEqual([12.5, 25]);
    expect(CHEST_EASE_BANDS.compression).toEqual([-2.5, 2.5]);
  });

  it("separates a tailored jacket from a coat", () => {
    expect(chestEaseBand("blazer", "set-in", null)).toEqual([7.5, 12.5]);
    expect(chestEaseBand("coat", "set-in", null)).toEqual([12.5, 25]);
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

  it("splits a woven shirt into slim, regular, and roomy bands", () => {
    // Debate 2026-08-08, stage 3: one broad 5–15 band made every shirt read
    // the same. Three bands now: slim 5–10, regular 10–15, roomy 15–22.
    expect(CHEST_EASE_BANDS.wovenSlim).toEqual([5, 10]);
    expect(CHEST_EASE_BANDS.woven).toEqual([10, 15]);
    expect(CHEST_EASE_BANDS.wovenRoomy).toEqual([15, 22]);
    expect(chestEaseBand("woven", "set-in", null)).toEqual([10, 15]);
    expect(chestEaseBand("woven", "set-in", "slim")).toEqual([5, 10]);
    expect(chestEaseBand("woven", null, "oversized")).toEqual([15, 22]);
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
    // Band 12.5–25cm → wants 112.5–125cm → the L (118).
    const rec = recommendSize(chart, body, "outerwear", null, null, "Down puffer jacket");
    expect(rec.garmentKind).toBe("coat");
    expect(rec.easeBand).toEqual([12.5, 25]);
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

  it("lets the shoulder lead on a tailored jacket (debate stage 4)", () => {
    // Debate 2026-08-08: a jacket shoulder miss costs a full point per
    // centimetre (other tops keep 0.4). Body chest 100, shoulder 45 → wants
    // shoulder 47. The M sits inside the chest band but its shoulder is 3cm
    // out; the L is 2.5cm outside the chest band but its shoulder is exact.
    // At 1.0/cm the M pays 3 and the L pays 2.5, so the L wins. At the old
    // 0.4 the M paid 1.2 and won — a jacket that fit the chest and not the
    // shoulder, which cannot be altered.
    const chart = chartOf("M: chest 110, shoulder 50, length 70\nL: chest 115, shoulder 47, length 72");
    const rec = recommendSize(chart, body, "outerwear", null, null, "Wool blazer");
    expect(rec.garmentKind).toBe("blazer");
    expect(rec.size).toBe("L");
  });
});

describe("a taped loved jacket grades coats and blazers (debate stage 5)", () => {
  // The loved jacket's chest is taped flat, armpit to armpit, so the engine
  // doubles it against the chart's full chest. 56.5cm flat → 113cm full.
  it("picks the size that matches the loved jacket, not the band favourite", () => {
    const chart = chartOf("M: chest 113, length 72\nL: chest 124, length 74");
    const body = { chest: 100 };
    // No loved jacket: both rows sit inside the coat band (12.5–25), the tie
    // goes to the bigger row, so the L wins.
    expect(recommendSize(chart, body, "outerwear", null, null, "Wool overcoat").size).toBe("L");
    // Loved jacket taped at 113cm full: the M matches it exactly.
    const loved = recommendSize(
      chart,
      { chest: 100, lovedJacket: { chest: 56.5 } },
      "outerwear",
      null,
      null,
      "Wool overcoat"
    );
    expect(loved.size).toBe("M");
    expect(loved.lovedJacket).toBe(true);
  });

  it("lets the loved jacket's shoulder break a chest tie", () => {
    // Loved chest 113cm full sits exactly between the two rows (111 and 115),
    // so the chest alone ties and the bigger row would win. The loved
    // shoulder (48) matches the M's seam, and a jacket shoulder costs 1/cm.
    const chart = chartOf("M: chest 111, shoulder 48, length 72\nL: chest 115, shoulder 52, length 74");
    const args = ["outerwear", null, null, "Wool overcoat"];
    expect(
      recommendSize(chart, { chest: 100, lovedJacket: { chest: 56.5 } }, ...args).size
    ).toBe("L");
    expect(
      recommendSize(chart, { chest: 100, lovedJacket: { chest: 56.5, shoulder: 48 } }, ...args).size
    ).toBe("M");
  });

  it("never grades a shirt against the loved jacket", () => {
    // The reference is for coats and blazers only. A tee still reads its own
    // band against the body, loved jacket or no loved jacket.
    const chart = chartOf("M: chest 108, length 70\nL: chest 112, length 72");
    const rec = recommendSize(
      chart,
      { chest: 100, lovedJacket: { chest: 56.5 } },
      "shirt",
      null,
      null,
      "Cotton tee"
    );
    expect(rec.garmentKind).toBe("knit");
    expect(rec.lovedJacket).toBeNull();
    expect(rec.size).toBe("M");
  });

  it("says the pick leaned on the loved jacket", () => {
    const chart = chartOf("M: chest 113, length 72\nL: chest 124, length 74");
    const rec = recommendSize(
      chart,
      { chest: 100, lovedJacket: { chest: 56.5 } },
      "outerwear",
      null,
      null,
      "Wool overcoat"
    );
    expect(garmentReasonLine(rec)).toContain("the jacket you love");
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

  it("gives a coat the oversized coat band when the customer likes loose", () => {
    // Debate 2026-08-08 widened the regular coat band to 12.5–25, so the
    // oversized taste gets its own band above it. Otherwise the taste would
    // be a no-op on coats.
    expect(chestEaseBand("coat", null, "oversized")).toEqual(CHEST_EASE_BANDS.coatOver);
    expect(chestEaseBand("coat", null, null)).toEqual(CHEST_EASE_BANDS.coat);
  });

  it("moves a coat up a size in practice when the customer likes oversized", () => {
    // Chest 100. Regular coat band 12.5–25cm: the M (113) sits inside, the L
    // (127) misses by 2cm, so the M wins. Oversized band 15–30cm: the M
    // misses by 2cm, the L sits inside, so the L wins.
    const chart = chartOf("M: chest 113, length 72\nL: chest 127, length 74");
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

  it("still goes to the bigger size when the chart lists the larger row first", () => {
    // F, 2026-08-01: the chart parser keeps the seller's own row order and
    // never sorts it. A row's position in the chart text must never decide
    // the tie — only the actual chest measurement can. Same two rows as
    // above, written L-then-M instead of M-then-L. L must still win.
    const chart = chartOf("L: chest 109, length 72\nM: chest 107, length 70");
    const rec = recommendSize(chart, body, "shirt", null, null, "Cotton tee");
    expect(rec.size).toBe("L");
  });

  it("never drifts more than one size up through a chain of near-ties", () => {
    // F, 2026-08-01: three rows each ~0.4 apart on shoulder (S ties M, M ties
    // L, S does NOT tie L) must not let the winner drift two sizes from the
    // true best score. The best score belongs to S; only M is within
    // TIE_EPSILON of it, so M wins — never L. Chest is nudged by a hundredth
    // of a centimetre per row (real charts always carry distinct
    // measurements) purely so the tie-break has a real number to compare —
    // at this scale it barely moves the band score, so the shoulder penalty
    // still drives the 0.4-point spacing between rows.
    const chart = chartOf(
      "S: chest 107.00, shoulder 40, length 70\n" +
      "M: chest 107.01, shoulder 41, length 70\n" +
      "L: chest 107.02, shoulder 42, length 70"
    );
    const rec = recommendSize({ ...chart }, { chest: 100, shoulder: 38 }, "shirt", null, null, "Cotton tee");
    expect(rec.size).toBe("M");
  });
});

describe("delivery taps and seller run memory (debate stage 6)", () => {
  const tee = (run, seller) => ({
    title: "Cotton tee",
    category: "shirt",
    seller,
    review: run ? { run } : undefined,
  });

  it("sums small and large taps into a kind shift, capped at ±3cm", () => {
    // Four "ran small" tees would add +4, but the cap holds it at +3.
    const capped = computeOutcomeMaps([tee("small"), tee("small"), tee("small"), tee("small")]);
    expect(capped.kindShift.knit).toBe(3);
    // +1 −1 −1 nets to −1.
    const mixed = computeOutcomeMaps([tee("small"), tee("large"), tee("large")]);
    expect(mixed.kindShift.knit).toBe(-1);
  });

  it("lets 'true' answers leave the kind shift alone", () => {
    const maps = computeOutcomeMaps([tee("true"), tee("true")]);
    expect(maps.kindShift.knit).toBeUndefined();
  });

  it("remembers how a seller runs, and the latest answer wins", () => {
    const maps = computeOutcomeMaps([tee("small", "Shop A"), tee("large", "Shop A")]);
    expect(maps.sellerRun["shop a"]).toBe("large");
  });

  it("clears the seller flag when the latest answer is 'true'", () => {
    const maps = computeOutcomeMaps([tee("small", "Shop A"), tee("true", "Shop A")]);
    expect(maps.sellerRun["shop a"]).toBeUndefined();
  });

  it("stacks the kind shift and the seller flag for one item", () => {
    const maps = computeOutcomeMaps([tee("small"), tee("small", "Shop B")]);
    // A new tee from Shop B: knit +2, seller +1 → +3.
    expect(outcomeShiftFor({ title: "Cotton tee", category: "shirt", seller: "Shop B" }, maps)).toBe(3);
    // A coat from Shop B: no coat taps yet, seller +1 → +1.
    expect(outcomeShiftFor({ title: "Wool coat", category: "outerwear", seller: "Shop B" }, maps)).toBe(1);
    // No maps, no shift.
    expect(outcomeShiftFor({ title: "Cotton tee", category: "shirt" }, null)).toBe(0);
  });

  it("never moves a kind that has no band (pants keep the seller flag only)", () => {
    const maps = computeOutcomeMaps([
      { title: "Cargo pants", category: "pants", seller: "Shop C", review: { run: "small" } },
    ]);
    expect(maps.kindShift.pants).toBeUndefined();
    expect(maps.sellerRun["shop c"]).toBe("small");
    expect(outcomeShiftFor({ title: "Cargo pants", category: "pants", seller: "Shop C" }, maps)).toBe(1);
  });

  it("moves the pick one size up when the customer's taps say this kind runs small", () => {
    // Knit band 5–10, body 100. The M (ease 6) sits inside the band and beats
    // the L (ease 11, 1cm outside). With +3cm of learned shift the M reads as
    // ease 3 (2cm short) and the L reads as ease 8 (dead centre) — the L wins.
    const chart = chartOf("M: chest 106, length 70\nL: chest 111, length 72");
    const body = { chest: 100 };
    const plain = recommendSize(chart, body, "shirt", null, null, "Cotton tee");
    expect(plain.size).toBe("M");
    expect(plain.outcomeShift).toBeNull();
    const shifted = recommendSize(chart, body, "shirt", null, null, "Cotton tee", null, 3);
    expect(shifted.size).toBe("L");
    expect(shifted.outcomeShift).toBe(3);
  });

  it("aims smaller when the taps say this kind runs large", () => {
    // Same chart, −3cm: the M reads as ease 9 (inside), the L as ease 14
    // (4cm past the band) — the M keeps the pick and records the shift.
    const chart = chartOf("M: chest 106, length 70\nL: chest 111, length 72");
    const rec = recommendSize(chart, { chest: 100 }, "shirt", null, null, "Cotton tee", null, -3);
    expect(rec.size).toBe("M");
    expect(rec.outcomeShift).toBe(-3);
  });
});

// ── The honesty clamp (Kyle 2026-08-09) ──────────────────────────────────────
// Kyle, on a real Weidian tee: "this says take the small but even the small
// says tight, this should be take the medium????" He was right. The score
// subtracts the run hint, the size chips do not, and the app named a size its
// own chip called TIGHT. Three review lanes returned the same ruling: clamp
// the letter, never shift the chip. The chip word is what the shopper trusts.
describe("the app never names a size its own chip calls bad", () => {
  // Kyle's tee, in centimetres, with his saved chest 106.7 and shoulder 48.3.
  const TEE = [
    "S: chest 110.0, shoulder 45.0, length 72.9, sleeve 21.3",
    "M: chest 114.0, shoulder 47.0, length 72.9, sleeve 21.3",
    "L: chest 117.9, shoulder 49.0, length 72.9, sleeve 21.3",
    "XL: chest 121.9, shoulder 51.1, length 72.9, sleeve 21.3",
  ].join("\n");
  const TITLE = "Relaxed Fit Double-Layer Jersey Short Tee";
  const body = { chest: 106.7, shoulder: 48.3, length: 68.6 };
  const pref = { length: null, looseness: "regular", dismissed: false };

  it("moves the pick off a TIGHT size when a runs-large listing aimed it there", () => {
    const chart = chartOf(TEE + "\nThis style runs large.");
    const rec = recommendSize(chart, body, "shirt", pref, null, TITLE);
    const reads = sizeCellReads(chart, rec, body);
    const wordOf = (size) => reads.find((r) => r.size === size).word;
    expect(wordOf("S"), "the S chip must keep its raw verdict").toBe("TIGHT");
    expect(wordOf("M")).toBe("FITS");
    expect(rec.size, "the app must not name a size its chip calls TIGHT").toBe("M");
    expect(reads.find((r) => r.isPick).word).toBe("FITS");
  });

  it("leaves a hand pick alone, even onto a size the chip calls TIGHT", () => {
    const chart = chartOf(TEE + "\nThis style runs large.");
    expect(recommendSize(chart, body, "shirt", pref, "S", TITLE).size).toBe("S");
  });

  it("still returns a size when no size on the chart fits", () => {
    // Every row is far too small. The clamp has nothing honest to move to, so
    // the scored winner stands and the chips say so.
    const chart = chartOf("S: chest 90, shoulder 40\nM: chest 94, shoulder 42");
    const rec = recommendSize(chart, body, "shirt", pref, null, TITLE);
    expect(rec.size).toBe("M");
    expect(sizeCellReads(chart, rec, body).every((r) => r.word === "TOO SMALL")).toBe(true);
  });

  it("lets a roomy size win, because LOOSE is not a complaint", () => {
    // Knit band 5-10 on a body of 100. The L reads +11: one centimetre past
    // the band, so the chip says LOOSE. That is a normal answer, and a learned
    // "runs small" shift is allowed to choose it. Only TIGHT, TOO SMALL, BIG
    // and TOO BIG trigger the clamp.
    const chart = chartOf("M: chest 106, length 70\nL: chest 111, length 72");
    const rec = recommendSize(chart, { chest: 100 }, "shirt", null, null, "Cotton tee", null, 3);
    expect(rec.size).toBe("L");
    expect(sizeCellReads(chart, rec, { chest: 100 }).find((r) => r.size === "L").word).toBe("LOOSE");
  });
});

// ── The tank top (Kyle 2026-08-09) ───────────────────────────────────────────
// Kyle: "the aloe tank top or the on cloud tank top was never an extra large,
// it was a larger medium... It's a tank top. The extra large, there's so much
// room of chest. Too much body length. The shoulder, too big."
//
// The engine had no tank. Every tank fell through to the T-shirt band [5,10]
// and was graded on shoulder and sleeve like a T-shirt. A tank's chart
// "shoulder" column is a strap span, and a tank has no sleeve at all.
describe("a tank top is not a T-shirt", () => {
  // Kyle's real chart, as the seller wrote it. 胸围 is a half measure, so the
  // parser doubles it: S 102 / M 106 / L 110 / XL 114 / 2XL 118 cm.
  const TANK = "尺码 衣长 胸围 肩宽\nS 67 51 50\nM 69 53 52\nL 71 55 54\nXL 73 57 56\n2XL 75 59 58";
  // Kyle: 42in chest, 19in shoulder, 27in body length.
  const body = { chest: 106.7, shoulder: 48.3, length: 68.6 };

  it("names a tank from the title, in English and in Chinese", () => {
    const chart = chartOf(TANK);
    for (const title of [
      "Alo Yoga Tank Top",
      "On Cloud Running Tank",
      "Sleeveless training top",
      "Ribbed singlet",
      "男士背心无袖",
      "吊带上衣",
    ]) {
      expect(garmentType(title, chart, "shirt"), title).toBe("tank");
    }
    // A real T-shirt on the same chart must be untouched.
    expect(garmentType("Cotton crewneck tee", chart, "shirt")).toBe("knit");
  });

  it("picks the Medium on Kyle's own tank chart, not the X-Large", () => {
    const chart = chartOf(TANK);
    // Before: the tee band [5,10] made the XL (+7.3cm) the only in-band row.
    const asTee = recommendSize(chart, body, "shirt", null, null, "Cotton tee");
    expect(asTee.size, "a tee on this chart still takes the XL").toBe("XL");
    // After: a tank reads [-2.5,5], so the M (-0.7cm) and the L (+3.3cm) fit.
    const rec = recommendSize(chart, body, "shirt", null, null, "Alo Yoga Tank Top");
    expect(rec.garmentKind).toBe("tank");
    expect(rec.easeBand).toEqual([-2.5, 5]);
    expect(rec.size).toBe("M");
    const words = Object.fromEntries(
      sizeCellReads(chart, rec, body).map((r) => [r.size, r.word])
    );
    expect(words.M).toBe("FITS");
    expect(words.L).toBe("FITS");
    expect(words.XL, "Kyle: the XL has too much room").toBe("LOOSE");
  });

  it("never grades a tank strap against a saved shoulder", () => {
    const chart = chartOf(TANK);
    const rec = recommendSize(chart, body, "shirt", null, null, "Alo Yoga Tank Top");
    const rows = fitReadRows(chart, rec, body, "shirt", "Alo Yoga Tank Top");
    const shoulder = rows.find((r) => r.key === "shoulder");
    expect(shoulder, "the shoulder row still shows its number").toBeTruthy();
    expect(shoulder.ease, "a strap span is not a shoulder seam").toBeNull();
    expect(shoulder.warn).toBe(false);
    expect(shoulder.note).toMatch(/strap/i);
    // The chest carries the whole pick, so the chest row still grades.
    expect(rows.find((r) => r.key === "chest").ease).not.toBeNull();
  });

  it("lets a saved taste move the tank band", () => {
    const chart = chartOf(TANK);
    const slim = recommendSize(
      chart, body, "shirt", { length: null, looseness: "slim" }, null, "Alo Yoga Tank Top"
    );
    expect(slim.easeBand).toEqual([-2.5, 2.5]);
    // Asking for oversized is a real request for room, so it reads tee room.
    const over = recommendSize(
      chart, body, "shirt", { length: null, looseness: "oversized" }, null, "Alo Yoga Tank Top"
    );
    expect(over.easeBand).toEqual([5, 10]);
    expect(over.size).toBe("XL");
  });
});

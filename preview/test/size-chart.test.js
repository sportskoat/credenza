import { describe, expect, it } from "vitest";
import { applyFitPreference, effectiveBodyProfile, fitSummarySentence, formatMeasure, loosenessNudge, measureFromStorage, measureToStorage, parseSizeChart, prescriptionSentence, recommendSize, sizeChartTextFor } from "../../credenza-fashion.jsx";

describe("sizeChartTextFor", () => {
  // Kyle 2026-07-22: chart pasted into Notes gave "no values, no recommended
  // size" — Notes was excluded from chart discovery. It's included now.
  it("finds charts the user pasted into Notes", () => {
    const item = {
      note: "S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70",
      summary: "Great hoodie from a Weidian seller",
    };
    const chart = parseSizeChart(sizeChartTextFor(item));
    expect(chart).not.toBeNull();
    expect(chart.rows).toHaveLength(3);
    const rec = recommendSize(chart, { chest: 96 }, "shirt");
    expect(rec.size).toBe("S");
  });

  it("combines sizeNotes, summary, rawText, and note in priority order", () => {
    const text = sizeChartTextFor({
      sizeNotes: "a",
      summary: "b",
      rawText: "c",
      note: "d",
    });
    expect(text).toBe("a\nb\nc\nd");
  });

  it("tolerates missing fields", () => {
    expect(sizeChartTextFor({})).toBe("");
    expect(sizeChartTextFor({ note: "x" })).toBe("x");
  });
});

describe("parseSizeChart", () => {
  it("parses CJK labeled rows (胸围/衣长/肩宽/袖长)", () => {
    const chart = parseSizeChart(
      "尺码表\nS: 胸围108 衣长66 肩宽46 袖长58\nM: 胸围112 衣长68 肩宽48 袖长60\nL: 胸围116 衣长70 肩宽50 袖长62"
    );
    expect(chart).not.toBeNull();
    expect(chart.rows).toHaveLength(3);
    expect(chart.rows[1]).toMatchObject({ size: "M", chest: 112, length: 68, shoulder: 48, sleeve: 60 });
  });

  it("parses English labeled rows (chest/length/shoulder)", () => {
    const chart = parseSizeChart(
      "S: chest 108cm, length 66cm\nM: chest 112cm, length 68cm\nL: chest 116cm, length 70cm"
    );
    expect(chart).not.toBeNull();
    expect(chart.rows.map((r) => r.size)).toEqual(["S", "M", "L"]);
    expect(chart.rows[2].chest).toBe(116);
  });

  it("parses pants charts with waist/hip/裤长", () => {
    const chart = parseSizeChart(
      "30: 腰围76 臀围102 裤长104\n32: 腰围81 臀围107 裤长106\n34: 腰围86 臀围112 裤长108"
    );
    expect(chart).not.toBeNull();
    expect(chart.rows[1]).toMatchObject({ size: "32", waist: 81, hip: 107, pantsLength: 106 });
  });

  it("parses positional tables with a header line", () => {
    const chart = parseSizeChart(
      "Size  Chest  Length  Shoulder\nS     108    66      46\nM     112    68      48\nL     116    70      50"
    );
    expect(chart).not.toBeNull();
    expect(chart.rows.map((r) => r.size)).toEqual(["S", "M", "L"]);
    expect(chart.rows[0]).toMatchObject({ chest: 108, length: 66, shoulder: 46 });
  });

  // Kyle 2026-07-22: Yupoo size sheets often only list hip (臀围) — single column.
  it("parses hip-only single-column charts", () => {
    const chart = parseSizeChart(
      "尺码表/Size Reference\n臀围 /hip circumference\nS 100\nM 104\nL 108\nXL 112\nMeasurement of 1-3cm is considered a"
    );
    expect(chart).not.toBeNull();
    expect(chart.rows.map((r) => r.size)).toEqual(["S", "M", "L", "XL"]);
    expect(chart.rows[0]).toMatchObject({ size: "S", hip: 100 });
    expect(chart.rows[3]).toMatchObject({ size: "XL", hip: 112 });
  });

  it("detects runs-big / runs-small hints in English and CJK", () => {
    expect(parseSizeChart("S: 胸围108 衣长66\nM: 胸围112 衣长68\n版型偏大").runHint).toBe("big");
    expect(parseSizeChart("S: chest 108 length 66\nM: chest 112 length 68\nruns small").runHint).toBe("small");
    expect(parseSizeChart("S: chest 108 length 66\nM: chest 112 length 68\ntrue to size").runHint).toBe("true");
    expect(parseSizeChart("S: chest 108 length 66\nM: chest 112 length 68").runHint).toBeNull();
  });

  it("returns null for text with no chart (and ignores stray size-like words)", () => {
    expect(parseSizeChart("")).toBeNull();
    expect(parseSizeChart("Brand new M65 jacket, 300g fill, ships in 30 days")).toBeNull();
    expect(parseSizeChart("M: 胸围112")).toBeNull(); // single row is not a chart
  });

  it("ignores implausible measurements", () => {
    const chart = parseSizeChart("S: 胸围8 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70");
    expect(chart.rows[0].chest).toBeUndefined();
    expect(chart.rows[0].length).toBe(66);
  });
});

describe("recommendSize", () => {
  const shirtChart = parseSizeChart(
    "S: 胸围108 衣长66 肩宽46 袖长58\nM: 胸围112 衣长68 肩宽48 袖长60\nL: 胸围116 衣长70 肩宽50 袖长62\nXL: 胸围120 衣长72 肩宽52 袖长64"
  );
  const pantsChart = parseSizeChart(
    "30: 腰围76 臀围102 裤长104\n32: 腰围81 臀围107 裤长106\n34: 腰围86 臀围112 裤长108"
  );

  it("picks the size whose garment chest ≈ body chest + shirt ease", () => {
    // body 96 + 12 ease = 108 target → S (108)
    const rec = recommendSize(shirtChart, { chest: 96 }, "shirt");
    expect(rec.size).toBe("S");
    expect(rec.reason).toContain("108");
    expect(rec.reason).toContain("96");
  });

  it("offers the runner-up size as a fit-preference alternative", () => {
    // target 108 → S exact (score 0), M (112) runner-up → roomier
    const rec = recommendSize(shirtChart, { chest: 96 }, "shirt");
    expect(rec.alt).toMatchObject({ size: "M", garment: 112, diff: 16, fit: "roomier" });
    // body 98 + 12 = 110 → tie S(108)/M(112); both surface, alt is snugger/roomier
    const tie = recommendSize(shirtChart, { chest: 98 }, "shirt");
    expect(tie.alt).not.toBeNull();
    expect(tie.alt.size).not.toBe(tie.size);
  });

  it("labels a smaller runner-up as snugger", () => {
    // body 104 + 12 = 116 → L exact; M (112) runner-up → snugger
    const rec = recommendSize(shirtChart, { chest: 104 }, "shirt");
    expect(rec.size).toBe("L");
    expect(rec.alt).toMatchObject({ size: "M", fit: "snugger" });
  });

  it("uses wider ease for outerwear", () => {
    // body 96 + 16 ease = 112 target → M (112)
    const rec = recommendSize(shirtChart, { chest: 96 }, "outerwear");
    expect(rec.size).toBe("M");
  });

  it("sizes down when the chart says 版型偏大 (runs big)", () => {
    const bigChart = parseSizeChart(
      "S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70\n版型偏大"
    );
    // body 100 + 12 - 4 = 108 → S, not M
    const rec = recommendSize(bigChart, { chest: 100 }, "shirt");
    expect(rec.size).toBe("S");
    expect(rec.fitNote).toContain("runs big");
  });

  it("sizes up when the chart says runs small", () => {
    const smallChart = parseSizeChart(
      "S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70\nruns small"
    );
    // body 100 + 12 + 4 = 116 → L exactly
    const rec = recommendSize(smallChart, { chest: 100 }, "shirt");
    expect(rec.size).toBe("L");
    expect(rec.fitNote).toContain("runs small");
  });

  it("keys on waist for pants", () => {
    // body 80 + 2 = 82 → 32 (81)
    const rec = recommendSize(pantsChart, { waist: 80 }, "pants");
    expect(rec.size).toBe("32");
    expect(rec.reason).toContain("Waist");
  });

  it("detects pants charts from shape alone (waist-only rows)", () => {
    const rec = recommendSize(pantsChart, { waist: 85 }, "");
    expect(rec.size).toBe("34");
  });

  it("falls back to hip when the chart only lists 臀围", () => {
    const hipChart = parseSizeChart(
      "臀围 /hip circumference\nS 100\nM 104\nL 108\nXL 112"
    );
    // body hip 102 + 2 ease = 104 → M
    const rec = recommendSize(hipChart, { hip: 102 }, "shorts");
    expect(rec.size).toBe("M");
    expect(rec.primaryKey).toBe("hip");
    expect(rec.reason).toContain("Hip");
  });

  it("reports missing hip (not waist) when chart is hip-only", () => {
    const hipChart = parseSizeChart(
      "臀围 /hip circumference\nS 100\nM 104\nL 108\nXL 112"
    );
    expect(recommendSize(hipChart, { chest: 96 }, "shorts")).toEqual({ missing: "hip" });
  });

  it("reports the missing measurement instead of guessing", () => {
    expect(recommendSize(shirtChart, { height: 180 }, "shirt")).toEqual({ missing: "chest" });
    expect(recommendSize(pantsChart, { chest: 96 }, "pants")).toEqual({ missing: "waist" });
  });

  it("returns null without a usable chart", () => {
    expect(recommendSize(null, { chest: 96 }, "shirt")).toBeNull();
    expect(recommendSize({ rows: [{ size: "M", chest: 112 }] }, { chest: 96 }, "shirt")).toBeNull();
  });

  it("prefers the size whose sleeves cover the arm when chest is a wash", () => {
    const chart = parseSizeChart(
      "M: 胸围112 衣长68 袖长58\nL: 胸围113 衣长70 袖长63"
    );
    // arm 62: M's 58 sleeve is 4cm short, L's 63 covers → L despite similar chest
    const rec = recommendSize(chart, { chest: 100, sleeve: 62 }, "shirt");
    expect(rec.size).toBe("L");
  });

  it("exposes structured reason parts for unit-aware display", () => {
    const rec = recommendSize(shirtChart, { chest: 96 }, "shirt");
    expect(rec.primaryKey).toBe("chest");
    expect(rec.garment).toBe(108);
    expect(rec.body).toBe(96);
    expect(rec.diff).toBe(12);
  });
});

describe("measure units (in/cm conversion at the edges)", () => {
  it("formats cm natively and converts to inches", () => {
    expect(formatMeasure(100, "cm")).toBe("100cm");
    expect(formatMeasure(100, "in")).toBe("39.4″");
    expect(formatMeasure(12, "in")).toBe("4.7″");
    expect(formatMeasure(null, "in")).toBe("");
  });

  it("converts inch input to cm storage", () => {
    expect(measureToStorage("38", "in", "length")).toBe(96.5);
    expect(measureToStorage("70", "in", "length")).toBe(177.8);
    expect(measureToStorage("154", "in", "weight")).toBeCloseTo(69.9, 0);
  });

  it("passes cm input through unchanged", () => {
    expect(measureToStorage("96", "cm", "length")).toBe(96);
    expect(measureToStorage("70", "cm", "weight")).toBe(70);
  });

  it("round-trips storage → display → storage without drift", () => {
    const stored = 96;
    const shown = measureFromStorage(stored, "in", "length"); // 37.8
    expect(shown).toBe("37.8");
    expect(measureToStorage(shown, "in", "length")).toBeCloseTo(stored, 0);
  });

  it("rejects empty and non-numeric input", () => {
    expect(measureToStorage("", "in", "length")).toBeNull();
    expect(measureToStorage("abc", "in", "length")).toBeNull();
    expect(measureToStorage("-5", "in", "length")).toBeNull();
    expect(measureFromStorage(null, "in", "length")).toBe("");
  });
});

describe("fitSummarySentence (design handoff PR4)", () => {
  const shirtChart = parseSizeChart(
    "S: 胸围108 衣长66 肩宽46 袖长58\nM: 胸围112 衣长68 肩宽48 袖长60\nL: 胸围116 衣长70 肩宽50 袖长62\nXL: 胸围120 衣长72 肩宽52 袖长64"
  );

  it("concise is the first clause only — no em-dash tail", () => {
    // body 96 + 12 ease = 108 → S, diff 12 → relaxed
    const rec = recommendSize(shirtChart, { chest: 96 }, "shirt");
    const sentence = fitSummarySentence(rec, { runHint: shirtChart.runHint, units: "cm", detail: "concise" });
    expect(sentence).toBe("The S gives about 12cm of chest room, so it wears relaxed.");
  });

  it("detailed adds the run-hint and alternate-size tail", () => {
    const bigChart = parseSizeChart(
      "S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70\n版型偏大"
    );
    // body 100 + 12 - 4 = 108 → S, diff 8 → regular
    const rec = recommendSize(bigChart, { chest: 100 }, "shirt");
    const sentence = fitSummarySentence(rec, { runHint: bigChart.runHint, units: "cm", detail: "detailed" });
    expect(sentence).toContain("The S gives about 8cm of chest room, so it wears regular — ");
    expect(sentence).toContain("the chart runs big, so the pick already sized down");
    expect(sentence).toContain("M also works if you want it roomier");
  });

  it("renders the room in inches when the user measures in inches", () => {
    const rec = recommendSize(shirtChart, { chest: 96 }, "shirt");
    const sentence = fitSummarySentence(rec, { units: "in" });
    expect(sentence).toContain("4.7″ of chest room");
  });

  it("keys the wording on waist for pants", () => {
    const pantsChart = parseSizeChart(
      "30: 腰围76 臀围102 裤长104\n32: 腰围81 臀围107 裤长106\n34: 腰围86 臀围112 裤长108"
    );
    // body 80 + 2 = 82 → 32 (81), diff 1 → close
    const rec = recommendSize(pantsChart, { waist: 80 }, "pants");
    const sentence = fitSummarySentence(rec, { units: "cm" });
    expect(sentence).toBe("The 32 gives about 1cm of waist room, so it wears close.");
  });

  it("returns an empty string without a recommendation", () => {
    expect(fitSummarySentence(null)).toBe("");
    expect(fitSummarySentence({ missing: "chest" })).toBe("");
  });
});

describe("prescriptionSentence (handoff turn 3 §5)", () => {
  const shirtChart = parseSizeChart(
    "S: 胸围104 衣长66\nM: 胸围112 衣长68\nL: 胸围120 衣长70\nXL: 胸围128 衣长72"
  );

  it("names the deciding measurement and the next size down", () => {
    // body 100 + 12 ease = 112 → M, diff 12 → "meant to sit"
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt");
    const s = prescriptionSentence(shirtChart, rec, { units: "cm", category: "shirt" });
    expect(s).toBe(
      "Take the Medium — its 112cm chest gives you 12cm of room over your 100cm, which is where this shirt is meant to sit. The Small's 104cm would pull across the chest."
    );
  });

  it("drops the 'meant to sit' clause when the ease is off target", () => {
    // body 85 + 12 = 97 → S (104), diff 19 — well past the 12cm target.
    const rec = recommendSize(shirtChart, { chest: 85 }, "shirt");
    expect(rec.size).toBe("S");
    const s = prescriptionSentence(shirtChart, rec, { units: "cm", category: "shirt" });
    expect(s).toContain("gives you 19cm of room over your 85cm.");
    expect(s).not.toContain("meant to sit");
  });

  it("skips the second sentence when no smaller size exists", () => {
    const twoChart = parseSizeChart("M: 胸围112 衣长68\nL: 胸围120 衣长70");
    const rec = recommendSize(twoChart, { chest: 100 }, "shirt");
    expect(rec.size).toBe("M");
    const s = prescriptionSentence(twoChart, rec, { units: "cm", category: "shirt" });
    expect(s).not.toContain("would");
  });

  it("uses waist wording for pants", () => {
    const pantsChart = parseSizeChart(
      "30: 腰围76 臀围102\n32: 腰围81 臀围107\n34: 腰围86 臀围112"
    );
    const rec = recommendSize(pantsChart, { waist: 79 }, "pants");
    expect(rec.size).toBe("32");
    const s = prescriptionSentence(pantsChart, rec, { units: "cm", category: "pants" });
    expect(s).toContain("waist");
    expect(s).toContain("The 30's 76cm would dig in at the waist.");
  });

  it("returns an empty string without a usable recommendation", () => {
    expect(prescriptionSentence(shirtChart, null)).toBe("");
    expect(prescriptionSentence(null, { size: "M" })).toBe("");
    expect(prescriptionSentence(shirtChart, { missing: "chest" })).toBe("");
  });
});


describe("fit preferences (design turn 5)", () => {
  // Use chest that clearly lands on M (target chest+ease 12 ≈ mid of M 112).
  const shirtChart = parseSizeChart(`S 胸围104
M 胸围112
L 胸围120
XL 胸围128`);
  const base = () => recommendSize(shirtChart, { chest: 100 }, "shirt");

  it("loosenessNudge maps slim/baggy/oversized", () => {
    expect(loosenessNudge("slim")).toBe(-1);
    expect(loosenessNudge("baggy")).toBe(1);
    expect(loosenessNudge("oversized")).toBe(1);
    expect(loosenessNudge("regular")).toBe(0);
    expect(loosenessNudge(null)).toBe(0);
  });

  it("baggy / oversized nudges one size up", () => {
    expect(base().size).toBe("M");
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt", {
      looseness: "oversized",
    });
    expect(rec.baseSize).toBe("M");
    expect(rec.size).toBe("L");
    expect(rec.prefShift).toBe("up");
    expect(rec.prefReason).toMatch(/oversized|bumped/i);
  });

  it("slim nudges one size down", () => {
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt", {
      looseness: "slim",
    });
    expect(rec.baseSize).toBe("M");
    expect(rec.size).toBe("S");
    expect(rec.prefShift).toBe("down");
  });

  it("length-only preference does not shift size", () => {
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt", {
      length: "long",
    });
    expect(rec.size).toBe("M");
    expect(rec.prefShift).toBeNull();
    expect(rec.fitPref.length).toBe("long");
  });

  it("dismissed preference is ignored", () => {
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt", {
      looseness: "baggy",
      dismissed: true,
    });
    expect(rec.size).toBe("M");
    expect(rec.prefShift).toBeNull();
  });

  it("applyFitPreference is a safe no-op without pref", () => {
    const b = base();
    const next = applyFitPreference(b, shirtChart, null, "shirt");
    expect(next.size).toBe(b.size);
  });
});

// 2026-07-25 (Kyle): he set height/weight + usual sizes + length/looseness
// and got no recommendation anywhere — recommendSize only read the
// tape-measure fields nobody knows. effectiveBodyProfile estimates
// chest/waist/hip from height+weight and flags the result so no surface
// calls the pick "precise".
describe("effectiveBodyProfile estimates", () => {
  it("fills chest, waist, and hip from height and weight", () => {
    const p = effectiveBodyProfile({ height: 178, weight: 70 });
    expect(p.chest).toBeGreaterThan(85);
    expect(p.chest).toBeLessThan(105);
    expect(p.waist).toBeGreaterThan(70);
    expect(p.waist).toBeLessThan(92);
    expect(p.hip).toBeGreaterThan(p.waist);
    expect(p.estimated).toBe(true);
  });

  it("scales up with weight and down without it", () => {
    const slim = effectiveBodyProfile({ height: 178, weight: 60 });
    const heavy = effectiveBodyProfile({ height: 178, weight: 100 });
    expect(heavy.waist).toBeGreaterThan(slim.waist);
    expect(heavy.chest).toBeGreaterThan(slim.chest);
  });

  it("never overwrites a measured field", () => {
    const p = effectiveBodyProfile({ height: 178, weight: 70, chest: 101 });
    expect(p.chest).toBe(101);
    expect(p.estimated).toBe(true); // waist/hip still estimated
  });

  it("passes the profile through untouched without height and weight", () => {
    const p = effectiveBodyProfile({ chest: 96 });
    expect(p).toEqual({ chest: 96 });
    expect(p.estimated).toBeUndefined();
    expect(effectiveBodyProfile(null)).toBeNull();
  });

  it("drives a recommendation from height and weight alone", () => {
    const chart = parseSizeChart("S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70\nXL: 胸围120 衣长72");
    const rec = recommendSize(chart, effectiveBodyProfile({ height: 178, weight: 70 }), "tops");
    expect(rec).not.toBeNull();
    expect(["S", "M"]).toContain(rec.size);
  });
});

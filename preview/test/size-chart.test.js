import { describe, expect, it } from "vitest";
import { applyFitPreference, easeRoomClause, effectiveBodyProfile, fitSummarySentence, formatMeasure, loosenessNudge, meantToSitClause, measureFromStorage, measureToStorage, migrateSleeveMeasurements, normalizeHalfChestRows, parseSizeChart, prescriptionSentence, recommendSize, resolveDisplaySize, serializeSizeChart, sizeChartTextFor, sleeveStyle, usualSizeForItem } from "../../credenza-fashion.jsx";

describe("usualSizeForItem + resolveDisplaySize without a chart", () => {
  it("maps tops / bottoms / shoes slots", () => {
    const profile = { usualTops: "L", usualBottoms: "33", usualShoes: "10" };
    expect(usualSizeForItem({ category: "shirt" }, profile)).toBe("L");
    expect(usualSizeForItem({ category: "outerwear" }, profile)).toBe("L");
    expect(usualSizeForItem({ category: "pants" }, profile)).toBe("33");
    expect(usualSizeForItem({ category: "shoes" }, profile)).toBe("10");
  });

  it("does not invent AI size from body prefs alone", () => {
    const item = { category: "outerwear", title: "Arc jacket" };
    const profile = {
      height: 183,
      weight: 75,
      chest: 99,
      waist: 84,
      hip: 99,
      usualTops: "L",
    };
    expect(recommendSize(null, profile, "outerwear")).toBe(null);
    const display = resolveDisplaySize(item, profile);
    expect(display.kind).toBe("usual");
    expect(display.label).toBe("YOUR USUAL");
    expect(display.size).toBe("L");
  });

  it("does not label AI size from a stale recommendedSize without a chart", () => {
    const item = {
      category: "shirt",
      title: "No chart tee",
      recommendedSize: "L",
    };
    const profile = { usualTops: "L", chest: 100 };
    const display = resolveDisplaySize(item, profile);
    expect(display.kind).toBe("usual");
    expect(display.label).toBe("YOUR USUAL");
    expect(display.isRec).toBe(false);
  });
});

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

  it("uses the item machine chart without mixing other text", () => {
    expect(
      sizeChartTextFor({
        sizeChartText: "M: chest 116",
        sizeNotes: "Runs oversized.",
        summary: "A shirt",
      })
    ).toBe("M: chest 116");
  });

  it("hides a legacy borrowed chart until the customer clears it", () => {
    expect(
      sizeChartTextFor({
        sizeChartNeedsClear: true,
        sizeNotes: "M: chest 999",
      })
    ).toBe("");
  });

  it("preserves ignored customer notes without parsing them as a chart", () => {
    expect(
      sizeChartTextFor({
        sizeChartIgnoreNotes: true,
        sizeNotes: "Runs small.\nM: chest 999",
        summary: "A shirt",
        rawText: "Mook listing",
        note: "Keep this note",
      })
    ).toBe("A shirt\nMook listing\nKeep this note");
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

  // Weidian / vision charts often print pit-to-pit half chest (~43–49). Body
  // profile is full circumference; without *2, XL reads as 19.3″ on a 39″ chest.
  it("doubles half-chest columns into full circumference", () => {
    const chart = parseSizeChart(
      "S: chest 43 shoulder 49 sleeve 21 length 67\n" +
        "M: chest 45 shoulder 51 sleeve 22 length 69\n" +
        "L: chest 47 shoulder 53 sleeve 23 length 71\n" +
        "XL: chest 49 shoulder 55 sleeve 24 length 73"
    );
    expect(chart.rows.map((r) => r.chest)).toEqual([86, 90, 94, 98]);
    expect(chart.rows[0].shoulder).toBe(49); // not doubled
    const rec = recommendSize(chart, { chest: 99 }, "shirt");
    expect(rec.garment).toBeGreaterThan(80);
    expect(rec.diff).toBeLessThan(20);
  });

  it("doubles when the source says 半胸 even if numbers are ambiguous", () => {
    const chart = parseSizeChart(
      "半胸 size chart\nS: 胸围50 衣长66\nM: 胸围52 衣长68\nL: 胸围54 衣长70"
    );
    expect(chart.rows.map((r) => r.chest)).toEqual([100, 104, 108]);
  });

  it("reads 半胸 as the chest column and doubles it", () => {
    const chart = parseSizeChart(
      "S: 半胸43 肩宽49 袖长21 衣长67\n" +
        "M: 半胸45 肩宽51 袖长22 衣长69\n" +
        "L: 半胸47 肩宽53 袖长23 衣长71\n" +
        "XL: 半胸49 肩宽55 袖长24 衣长73"
    );
    expect(chart.rows.map((r) => r.chest)).toEqual([86, 90, 94, 98]);
  });

  it("does not double real full-chest charts", () => {
    const chart = parseSizeChart(
      "S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70"
    );
    expect(chart.rows.map((r) => r.chest)).toEqual([108, 112, 116]);
  });

  it("normalizeHalfChestRows is pure and skips non-chest rows", () => {
    const out = normalizeHalfChestRows(
      [
        { size: "S", chest: 44 },
        { size: "M", chest: 46 },
      ],
      ""
    );
    expect(out.map((r) => r.chest)).toEqual([88, 92]);
  });
});

// Kyle 2026-07-29, from a real Weidian tee (itemID 7812124117). The seller
// chart gives the Large a 24.5cm sleeve. The app showed 9.4 inches, because
// every number was read as a whole cm — 24, not 24.5. Half-centimetres are
// normal on these charts, so the parser reads one or two decimals now.
describe("parseSizeChart reads half-centimetres", () => {
  it("keeps the decimal in a positional table", () => {
    const chart = parseSizeChart(
      "Size  Shoulder  Chest  Length  Sleeve\nM  43  106  65  23.5\nL  45  110  67  24.5\nXL  47  114  69  25.5"
    );
    expect(chart.rows.map((r) => r.sleeve)).toEqual([23.5, 24.5, 25.5]);
    // The number Kyle expected to see beside the Large sleeve.
    expect((24.5 / 2.54).toFixed(1)).toBe("9.6");
  });

  it("keeps the decimal in a labelled chart", () => {
    const chart = parseSizeChart(
      "L: shoulder 45, chest 110, length 67, sleeve 24.5\nM: shoulder 43, chest 106, length 65, sleeve 23.5"
    );
    expect(chart.rows.find((r) => r.size === "L").sleeve).toBe(24.5);
  });

  // The worse half of the same fault: "104.25" split into 104 and 25, and the
  // stray 25 landed in the NEXT column. One decimal corrupted every
  // measurement after it — here the M length read 25cm instead of 65cm.
  it("does not let a two-decimal value shift the columns after it", () => {
    const chart = parseSizeChart("Size  Chest  Length\nM  104.25  65\nL  108.5  67");
    expect(chart.rows).toEqual([
      { size: "M", chest: 104.25, length: 65 },
      { size: "L", chest: 108.5, length: 67 },
    ]);
  });

  // A comma still separates a list, never decimals — strategy 1 reads segments
  // like "chest 110, length 67" all day.
  it("reads a comma as a separator, not a decimal point", () => {
    const chart = parseSizeChart("L: chest 110, length 67\nM: chest 106, length 65");
    expect(chart.rows).toEqual([
      { size: "L", chest: 110, length: 67 },
      { size: "M", chest: 106, length: 65 },
    ]);
  });

  it("survives the round trip through serializeSizeChart", () => {
    const first = parseSizeChart("L: chest 110, sleeve 24.5\nM: chest 106, sleeve 23.5");
    const again = parseSizeChart(serializeSizeChart(first));
    expect(again.rows).toEqual(first.rows);
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
    // Fit engine v2: an unnamed shirt reads as a regular knit, band 5–10cm,
    // so body 104 wants a 109–114cm garment. M (112) is inside it. S (108,
    // +4) misses the band by 1cm and L (116, +12) misses by 2, so S is the
    // runner-up and it is the smaller one.
    const rec = recommendSize(shirtChart, { chest: 104 }, "shirt");
    expect(rec.size).toBe("M");
    expect(rec.alt).toMatchObject({ size: "S", fit: "snugger" });
  });

  it("uses wider ease for outerwear", () => {
    // Unnamed outerwear reads as a coat, band 12.5-20cm. Body 96: M (chest
    // 112, ease 16) and L (chest 116, ease 20) both sit inside the band, so
    // both fit. Kyle's rule: when the size sits between two rows that both
    // fit, the app picks the bigger one.
    const rec = recommendSize(shirtChart, { chest: 96 }, "outerwear");
    expect(rec.size).toBe("L");
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
    // The point of the test is the SHIFT, so assert it against the same chart
    // without the hint. Regular knit band 5–10cm: body 100 wants 105–110, and
    // S (108) is inside it. "Runs small" moves the whole band up 4cm to
    // 109–114, and M (112) is inside that instead.
    const plainChart = parseSizeChart("S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70");
    expect(recommendSize(plainChart, { chest: 100 }, "shirt").size).toBe("S");
    const rec = recommendSize(smallChart, { chest: 100 }, "shirt");
    expect(rec.size).toBe("M");
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

// Sleeve fix 2026-07-29 (PLANS/SLEEVE_FIT_FIX_PLAN.md): a short-sleeve chart
// lists 20–25 cm sleeves, so the old compare against the ~62 cm arm always
// failed with a false "does not fit". sleeveStyle decides short/long/unknown
// — long title words first, short title words next, then the number rule
// (every chart sleeve under 40 cm). Unknown keeps the warning.
describe("sleeveStyle", () => {
  const teeChart = parseSizeChart(
    "M: 胸围112 衣长68 袖长22\nL: 胸围120 衣长72 袖长23"
  );
  const longChart = parseSizeChart(
    "M: 胸围112 衣长68 袖长58\nL: 胸围120 衣长72 袖长60"
  );

  it("calls short-sleeve title words short", () => {
    expect(sleeveStyle("Vintage band tee", longChart)).toBe("short");
    expect(sleeveStyle("Heavyweight T-shirt", longChart)).toBe("short");
    expect(sleeveStyle("短袖T恤", longChart)).toBe("short");
  });

  it("lets long-sleeve title words win over a short word in the same title", () => {
    expect(sleeveStyle("Heavyweight long sleeve thermal", teeChart)).toBe("long");
    expect(sleeveStyle("Long sleeve tee", teeChart)).toBe("long");
    expect(sleeveStyle("长袖T恤", teeChart)).toBe("long");
    expect(sleeveStyle("长袖衬衫", teeChart)).toBe("long");
  });

  it("does not treat polo or a bare shirt as a style word", () => {
    expect(sleeveStyle("Polo", longChart)).toBe("unknown");
    expect(sleeveStyle("Oxford shirt", longChart)).toBe("unknown");
  });

  it("calls every chart sleeve under 40 cm short, even without a title word", () => {
    expect(sleeveStyle("Polo", teeChart)).toBe("short");
    expect(sleeveStyle("Oxford shirt", teeChart)).toBe("short");
    expect(sleeveStyle("", teeChart)).toBe("short");
  });

  it("blocks the number rule when one chart sleeve is 40 cm or more", () => {
    const mixed = parseSizeChart(
      "M: 胸围112 衣长68 袖长24\nL: 胸围120 衣长72 袖长60"
    );
    expect(sleeveStyle("Polo", mixed)).toBe("unknown");
    expect(sleeveStyle("Polo", longChart)).toBe("unknown");
  });

  it("does not match tee inside another word", () => {
    expect(sleeveStyle("Guaranteed softest flannel", longChart)).toBe("unknown");
  });
});

describe("recommendSize sleeve penalty (short-sleeve fix)", () => {
  // Chest is a wash (target 112): M exact, L 1 cm off. Sleeves decide it.
  const washChart = parseSizeChart(
    "M: 胸围112 衣长68 袖长58\nL: 胸围113 衣长70 袖长63"
  );
  const shortChart = parseSizeChart(
    "M: 胸围112 衣长68 袖长22\nL: 胸围113 衣长70 袖长23"
  );
  const profile = { chest: 100, sleeve: 62 };

  it("does not move the pick up a size for a short-sleeve tee", () => {
    // Unknown style: the penalty drags the pick to L (its sleeve covers).
    expect(recommendSize(washChart, profile, "shirt", null, null, "Oxford shirt").size).toBe("L");
    // Confirmed short sleeve: no penalty, the chest pick M stands.
    expect(recommendSize(washChart, profile, "shirt", null, null, "Vintage band tee").size).toBe("M");
  });

  it("skips the penalty through the number rule with no title word", () => {
    expect(recommendSize(shortChart, profile, "shirt", null, null, "Polo").size).toBe("M");
  });

  it("keeps the penalty on a long-sleeve title", () => {
    expect(recommendSize(washChart, profile, "shirt", null, null, "Long sleeve tee").size).toBe("L");
  });

  it("keeps old calls working with no title argument", () => {
    expect(recommendSize(washChart, profile, "shirt").size).toBe("L");
  });

  it("uses the short-sleeve value for a short-sleeve listing", () => {
    const profileWithBoth = { chest: 100, shortSleeve: 23, longSleeve: 62 };
    expect(
      recommendSize(shortChart, profileWithBoth, "shirt", null, null, "Vintage band tee").size
    ).toBe("L");
  });

  it("uses the long-sleeve value for a long-sleeve listing", () => {
    const profileWithBoth = { chest: 100, shortSleeve: 22, longSleeve: 62 };
    expect(
      recommendSize(washChart, profileWithBoth, "shirt", null, null, "Long sleeve tee").size
    ).toBe("L");
  });

  it("ignores sleeve values when the chart has no sleeve column", () => {
    const noSleeveChart = parseSizeChart("M: chest 112, length 68\nL: chest 113, length 70");
    const profileWithBoth = { chest: 100, shortSleeve: 80, longSleeve: 80 };
    expect(
      recommendSize(noSleeveChart, profileWithBoth, "shirt", null, null, "Long sleeve tee").size
    ).toBe("M");
  });
});

describe("legacy sleeve migration", () => {
  it("moves a body sleeve to long sleeve and a garment sleeve to short sleeve", () => {
    expect(
      migrateSleeveMeasurements({ sleeve: 62, garment: { sleeve: 24 }, chest: 100 })
    ).toEqual({ longSleeve: 62, garment: { shortSleeve: 24 }, chest: 100 });
  });

  it("keeps new sleeve values when legacy values also exist", () => {
    expect(
      migrateSleeveMeasurements({
        sleeve: 61,
        longSleeve: 64,
        garment: { sleeve: 23, shortSleeve: 25 },
      })
    ).toEqual({ longSleeve: 64, garment: { shortSleeve: 25 } });
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
    // Fit engine v2: regular knit band 5–10cm, so body 104 wants 109–114cm
    // and M (112) sits inside it. The sentence reads against the SAME band the
    // pick used — 8cm of room is on target now, where the old flat 12cm target
    // would have called it snug.
    const rec = recommendSize(shirtChart, { chest: 104 }, "shirt");
    const s = prescriptionSentence(shirtChart, rec, { units: "cm", category: "shirt" });
    expect(s).toBe(
      "Take the Medium — its 112cm chest gives you 8cm of room over your 104cm, which is where this shirt is meant to sit. The Small's 104cm would pull across the chest."
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

  // Kyle 2026-08-02: Large shorts waist 80cm vs body 83.8cm → negative ease.
  // Sentence must say "smaller", never "room".
  it("says smaller (not room) when ease is negative", () => {
    const shortsChart = parseSizeChart(
      "M: waist 76, hip 104, pants length 48\nL: waist 80, hip 108, pants length 49\nXL: waist 84, hip 112, pants length 50"
    );
    const body = { waist: 83.8, hip: 99, shortsLength: 40 };
    const rec = recommendSize(shortsChart, body, "shorts");
    // Force the Large row Kyle was looking at, whatever the engine picks.
    const large = recommendSize(shortsChart, body, "shorts", null, "L");
    expect(large.diff).toBeLessThan(-0.5);
    const s = prescriptionSentence(shortsChart, large, {
      units: "in",
      category: "shorts",
      recommended: rec,
    });
    const roomIn = formatMeasure(Math.abs(large.diff), "in");
    expect(s).toContain(roomIn + " smaller than your");
    expect(s).toContain("fit tighter than your body");
    expect(s).not.toContain("of room over");
    expect(s).not.toMatch(/smaller than your[\s\S]*meant to sit/);
  });

  it("says sits right at the body when ease is near zero", () => {
    const rec = {
      size: "L",
      primaryKey: "waist",
      garment: 80,
      body: 80.2,
      diff: -0.2,
      easeBand: null,
    };
    const s = prescriptionSentence(shirtChart, rec, { units: "cm", category: "pants" });
    expect(s).toContain("sits right at your 80.2cm");
    expect(s).not.toContain("of room over");
    expect(s).not.toContain("smaller than your");
  });
});

describe("easeRoomClause / meantToSitClause (negative-ease wording)", () => {
  it("keeps the positive form byte-identical", () => {
    expect(easeRoomClause(8, "104cm", "8cm")).toBe(
      "gives you 8cm of room over your 104cm"
    );
  });

  it("pins Kyle's negative shorts case in inches", () => {
    // 80 − 83.8 = −3.8cm ≈ 1.5″
    expect(easeRoomClause(-3.8, "33″", "1.5″")).toBe(
      "is 1.5″ smaller than your 33″ — it will fit tighter than your body"
    );
  });

  it("never appends meant-to-sit after negative ease", () => {
    expect(meantToSitClause("shorts", true, -3.8)).toBe("");
    expect(meantToSitClause("shirt", true, 8)).toBe(
      ", which is where this shirt is meant to sit"
    );
    expect(meantToSitClause("shorts", true, 2)).toBe(
      ", which is where these shorts are meant to sit"
    );
    expect(meantToSitClause("pants", true, 0)).toBe(
      ", which is where these pants are meant to sit"
    );
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

  // Fit engine v2 (C's review, 2026-07-30). Looseness no longer moves the pick
  // one chart row. It chooses the room band the pick aims for, so the taste and
  // the garment argue in the same currency — centimetres of room — instead of
  // one overruling the other after the fact. Doing both would charge the
  // customer for the same preference twice, so `prefShift` stays null on a top.
  // Body 100 against S 104 / M 112 / L 120 / XL 128:
  //   slim      0–5cm  → wants 100–105 → S (104)
  //   regular   5–10cm → wants 105–110 → S (104, out by 1) beats M (112, out by 2)
  //   oversized 15cm+  → wants 115–125 → L (120)
  it("oversized asks for a roomier chest, not a bumped row", () => {
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt", {
      looseness: "oversized",
    });
    expect(rec.size).toBe("L");
    expect(rec.easeBand).toEqual([15, 25]);
    // The band moved the pick, not a row nudge — but the customer still sees
    // the size taste took it from, and which way.
    expect(rec.baseSize).toBe("S");
    expect(rec.prefShift).toBe("up");
    expect(rec.prefReason).toMatch(/oversized/i);
    // The line names the room, so the change is visible and not implied.
    expect(rec.prefReason).toMatch(/15–25cm/);
  });

  it("slim asks for a closer chest", () => {
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt", {
      looseness: "slim",
    });
    expect(rec.size).toBe("S");
    expect(rec.easeBand).toEqual([0, 5]);
    // Regular already lands on S here, so slim changed nothing and the panel
    // must claim nothing. The shift only appears when the taste moved the pick.
    expect(rec.prefShift).toBeNull();
  });

  it("length-only preference does not shift size", () => {
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt", {
      length: "long",
    });
    expect(rec.size).toBe(base().size);
    expect(rec.prefShift).toBeNull();
    expect(rec.fitPref.length).toBe("long");
  });

  it("dismissed preference is ignored", () => {
    const rec = recommendSize(shirtChart, { chest: 100 }, "shirt", {
      looseness: "baggy",
      dismissed: true,
    });
    expect(rec.size).toBe(base().size);
    expect(rec.easeBand).toEqual([5, 10]);
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

// ── serializeSizeChart (handoff turn 9 §3, "Fix a number") ──
//
// A corrected cell has to become text the parser reads back identically. The
// chart is derived, `sizeNotes` is stored, and every render re-parses — so a
// serialization that does not round-trip loses the correction on the next paint.
describe("serializeSizeChart", () => {
  const TEXT = "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74";

  it("round-trips a parsed chart through the parser unchanged", () => {
    const chart = parseSizeChart(TEXT);
    const again = parseSizeChart(serializeSizeChart(chart));
    expect(again.rows).toEqual(chart.rows);
  });

  it("emits the parser's own labelled form", () => {
    expect(serializeSizeChart(parseSizeChart(TEXT))).toBe(
      "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74"
    );
  });

  it("carries no half-chest wording, so the doubling rule stays out", () => {
    // A half-chest chart is doubled ONCE, at parse. Emitting 半胸 or
    // "pit to pit" would double the already-doubled numbers on the way back in.
    const half = parseSizeChart("半胸\nM 半胸 52\nL 半胸 55\nXL 半胸 58");
    expect(half.rows[0].chest).toBe(104);
    const text = serializeSizeChart(half);
    expect(text).not.toMatch(/半胸|pit|half/i);
    expect(parseSizeChart(text).rows[0].chest).toBe(104);
  });

  it("keeps every measurement column the parser names", () => {
    const chart = parseSizeChart(
      "M: chest 100, waist 80, hip 96, shoulder 44, sleeve 60, length 70\n" +
        "L: chest 104, waist 84, hip 100, shoulder 46, sleeve 62, length 72"
    );
    const text = serializeSizeChart(chart);
    for (const label of ["chest", "waist", "hip", "shoulder", "sleeve", "length"]) {
      expect(text, label).toContain(label);
    }
    expect(parseSizeChart(text).rows).toEqual(chart.rows);
  });

  it("drops a value outside the parser's own cm band", () => {
    // 5cm and 900cm are not measurements. Emitting them would produce text the
    // parser then refuses, so the correction would silently vanish.
    expect(serializeSizeChart({ rows: [{ size: "M", chest: 5 }, { size: "L", chest: 900 }] })).toBe("");
  });

  // 2026-07-29: half-centimetres now survive. Writing whole cm here rounded a
  // corrected 24.5 back to 24 as soon as the customer edited any other number.
  it("keeps one decimal and rounds the rest away", () => {
    expect(serializeSizeChart({ rows: [{ size: "M", sleeve: 24.5 }] })).toBe("M: sleeve 24.5");
    expect(serializeSizeChart({ rows: [{ size: "M", chest: 115.64 }] })).toBe("M: chest 115.6");
    expect(serializeSizeChart({ rows: [{ size: "M", chest: 116 }] })).toBe("M: chest 116");
  });

  it("skips a row with no measurement left in it", () => {
    expect(
      serializeSizeChart({ rows: [{ size: "M", chest: 116 }, { size: "L" }] })
    ).toBe("M: chest 116");
  });

  it("returns an empty string for junk", () => {
    expect(serializeSizeChart(null)).toBe("");
    expect(serializeSizeChart({})).toBe("");
    expect(serializeSizeChart({ rows: [] })).toBe("");
    expect(serializeSizeChart({ rows: [{ chest: 116 }] })).toBe("");
  });
});

// Kyle 2026-07-30, #design: "half-chest and half-waist: can't those be easily
// calculated? we should only use what the charts are using, right?" Two live
// defects sat behind that question, both proven against the thethunder shorts
// chart on credenzafashion.com.
describe("half-waist and half-hip shorts charts", () => {
  const LABELED = [
    "S: 1/2Waist 36, 1/2Hip 48, length 44",
    "M: 1/2Waist 38, 1/2Hip 50, length 46",
    "L: 1/2Waist 40, 1/2Hip 52, length 48",
  ].join("\n");
  const TABLE = "Size 1/2Waist 1/2Hip Length\nS 36 48 44\nM 38 50 46\nL 40 52 48";

  it("doubles a labeled half-waist and half-hip", () => {
    const rows = parseSizeChart(LABELED).rows;
    expect(rows.map((r) => r.size)).toEqual(["S", "M", "L"]);
    expect(rows[1].waist).toBe(76);
    expect(rows[1].hip).toBe(100);
    // The length column is not a circumference and never doubles.
    expect(rows[1].length).toBe(46);
  });

  it("doubles a half-waist header on a positional table too", () => {
    const rows = parseSizeChart(TABLE).rows;
    expect(rows[2].waist).toBe(80);
    expect(rows[2].hip).toBe(104);
  });

  it("keeps the letter size names when a measurement value looks like a size", () => {
    // "1/2Waist 38" made 38 the SIZE NAME on the live site, and the waist
    // column vanished with it.
    const rows = parseSizeChart(LABELED).rows;
    expect(rows.every((r) => r.waist != null)).toBe(true);
    expect(rows.some((r) => r.size === "38")).toBe(false);
  });

  it("leaves a numeric-size waist chart alone", () => {
    const rows = parseSizeChart("28: waist 71, hip 92\n30: waist 76, hip 97\n32: waist 81, hip 102").rows;
    expect(rows.map((r) => r.size)).toEqual(["28", "30", "32"]);
    expect(rows[1].waist).toBe(76);
  });

  it("never doubles a waist the seller did not call half", () => {
    // A numeric waist run can be a real waist in inches. Without the label
    // there is no evidence, so the number stands as printed.
    const rows = parseSizeChart("S: waist 36, hip 48\nM: waist 38, hip 50\nL: waist 40, hip 52").rows;
    expect(rows[1].waist).toBe(38);
    expect(rows[1].hip).toBe(50);
  });

  it("still reads a half-chest label as a chest", () => {
    const rows = parseSizeChart("S: 1/2 chest 52\nM: 1/2 chest 54\nL: 1/2 chest 56").rows;
    expect(rows[1].chest).toBe(108);
  });
});

describe("a guessed measurement is never graded", () => {
  it("names the fields it invented from height and weight", () => {
    const out = effectiveBodyProfile({ height: 180, weight: 78, waist: 82 });
    expect(out.estimated).toBe(true);
    expect(out.estimatedFields).toContain("hip");
    expect(out.estimatedFields).toContain("chest");
    expect(out.estimatedFields).not.toContain("waist");
  });

  it("names nothing when every field is measured", () => {
    const out = effectiveBodyProfile({ height: 180, weight: 78, chest: 100, waist: 82, hip: 98 });
    expect(out.estimated).toBeUndefined();
    expect(out.estimatedFields).toBeUndefined();
  });
});

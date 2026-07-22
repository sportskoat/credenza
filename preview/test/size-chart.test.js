import { describe, expect, it } from "vitest";
import { parseSizeChart, recommendSize } from "../../credenza-fashion.jsx";

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
});

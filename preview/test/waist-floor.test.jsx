// The hard waist floor (C's engine audit + F's spec, 2026-08-02):
//
//   1. A non-stretch waistband cannot fit a body bigger than its own
//      measurement, so garment waist must be >= body waist BEFORE scoring —
//      a filter, not a score penalty. Kyle's shorts card recommended a
//      Large whose 31.5" waist could not fit his 33" body; the old ±6cm
//      primaryFits band let that negative-ease row compete and the leg
//      length pass then let it win outright.
//   2. Elastic/drawstring waistbands print the RELAXED number, so a stated
//      waist smaller than the body is normal there — evidence in the title
//      or saved chart/notes text raises the floor to a bounded −4cm.
//   3. When every row fails the floor, never return no pick: keep the
//      largest waist on the chart (Kyle's favor-up instinct, 2026-08-01).
//   4. Shirts never see this — the floor only applies to a bottoms chart
//      scored on waist.
import { describe, expect, it } from "vitest";

const { parseSizeChart, recommendSize } = await import("../../credenza-fashion.jsx");

const chartOf = (text) => parseSizeChart(text);

describe("the hard waist floor", () => {
  it("Kyle's exact shorts card: Large is ineligible, X-Large is the pick, with a length warning", () => {
    // M 29.9/40.9/18.9in, L 31.5/42.5/19.3in, XL 33.1/44.1/19.7in — in cm,
    // waist/hip/length. Body: waist 33in/83.82cm, hip 39in/99.06cm, saved
    // shorts length 15.5in/39.37cm.
    const chart = chartOf(
      "M: waist 75.946, hip 103.886, pants length 48.006\n" +
        "L: waist 80.01, hip 107.95, pants length 49.022\n" +
        "XL: waist 84.074, hip 112.014, pants length 50.038"
    );
    const profile = { waist: 83.82, hip: 99.06, shortsLength: 39.37 };
    const rec = recommendSize(chart, profile, "shorts");
    // M's waist ease is -7.874cm (fails even the elastic floor); L's is
    // -3.81cm (fails the plain floor, no elastic evidence on this chart);
    // only XL's +0.254cm passes, so it is the only eligible row.
    expect(rec.size).toBe("XL");
    expect(rec.diff).toBeCloseTo(0.254, 2);
    expect(rec.legLengthWin, "only one row passed the floor — there is nothing to tie-break against").toBeNull();
    // XL runs 10.7cm longer than the saved shorts length — well past the
    // 5cm run-long threshold.
    expect(rec.lengthCheck).toMatchObject({ warn: "long" });
  });

  it("a hand tap can still reach the ineligible Large — the floor only gates the automatic pick", () => {
    const chart = chartOf(
      "M: waist 75.946, hip 103.886, pants length 48.006\n" +
        "L: waist 80.01, hip 107.95, pants length 49.022\n" +
        "XL: waist 84.074, hip 112.014, pants length 50.038"
    );
    const profile = { waist: 83.82, hip: 99.06, shortsLength: 39.37 };
    const forced = recommendSize(chart, profile, "shorts", null, "L");
    expect(forced.size).toBe("L");
  });

  it("an elastic waistband raises the floor to -4cm, so a smaller-reading row can still win on score", () => {
    // Body waist 80, target ease 82. S reads 2cm smaller than the body
    // (ease -2, inside the elastic floor's -4cm bound) but is the closer
    // score; M reads 6cm over.
    const chart = chartOf("S: waist 78, hip 100, pants length 60\nM: waist 88, hip 110, pants length 64");
    const profile = { waist: 80 };
    const plain = recommendSize(chart, profile, "pants");
    expect(plain.size, "no elastic evidence — the -2cm row must fail the plain floor").toBe("M");
    const withTitle = recommendSize(chart, profile, "pants", null, null, "Elastic waistband cargo pants");
    expect(withTitle.size, "elastic evidence in the title admits the closer-scoring S").toBe("S");
    const withNotes = recommendSize(chart, profile, "pants", null, null, null, "松紧腰 drawstring waist, see photos");
    expect(withNotes.size, "elastic evidence also reads from the saved chart/notes text").toBe("S");
  });

  it("never returns no pick: every row fails the floor, so the largest waist wins and reads tight", () => {
    // Body waist 90. M is 10cm under, L is 6cm under — both fail the plain
    // floor with no elastic evidence anywhere.
    const chart = chartOf("M: waist 80, hip 100, pants length 100\nL: waist 84, hip 104, pants length 104");
    const profile = { waist: 90 };
    const rec = recommendSize(chart, profile, "pants");
    expect(rec.size).toBe("L");
    expect(rec.diff, "the pick is still smaller than the body — it must read as tight, never as room").toBe(-6);
  });

  it("leaves shirt paths byte-unchanged: a chest chart never sees the waist floor, even with elastic wording", () => {
    // Body chest 94, default top ease 12 → target 106. M sits dead on
    // target; the floor (a bottoms-only, waist-only check) must not touch
    // this pick even though the title carries elastic wording.
    const chart = chartOf("M: chest 106, length 68\nL: chest 112, length 72");
    const profile = { chest: 94 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "Elastic waistband hoodie");
    expect(rec.size).toBe("M");
    expect(rec.primaryKey).toBe("chest");
  });
});

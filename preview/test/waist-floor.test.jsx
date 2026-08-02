// The hard waist floor (C's engine audit + F's spec, 2026-08-02; round 2
// corrections from C's hold on PR #76, same day):
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
//   5. The floor is a PHYSICAL check: raw garment − body only. A run-hint
//      shift (runShift) is a scoring adjustment, not a fact about the
//      fabric, and must never enter this comparison — C caught it folded
//      in, which let a runs-big chart pass a waist genuinely 4cm too small.
//   6. A looseness taste (Slim) can only nudge among rows that already
//      passed the floor — C caught the nudge ladder built from the full
//      chart, which could step a safe pick back onto a floor-rejected row.
import { describe, expect, it } from "vitest";

const { parseSizeChart, recommendSize, elasticEvidenceTextFor, sizeChartTextFor } = await import(
  "../../credenza-fashion.jsx"
);

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

describe("the waist floor is a physical check, not a scored one (C's hold, round 2)", () => {
  it("a 'runs big' chart cannot pass a waist genuinely too small by exactly the run-shift amount", () => {
    // Body waist 80. S is 4cm under (raw ease -4) — the exact amount the old
    // code let a runs-big -4cm runShift cancel out (76-80-(-4)=0, wrongly
    // eligible). The physical floor must reject it regardless of the hint.
    const chart = chartOf("S: waist 76, hip 100, pants length 60\nM: waist 90, hip 110, pants length 64\nRuns big");
    const rec = recommendSize(chart, { waist: 80 }, "pants");
    expect(rec.size, "S must fail the floor on its raw ease, run hint or not").toBe("M");
  });

  it("a 'runs small' chart must not wrongly reject a waist that is not actually too small", () => {
    // Body waist 80. S sits exactly on the body's own waist (raw ease 0,
    // physically fine) and is also the better score. The old code's
    // runShift subtraction (+4 for "small") would have read this as ease -4
    // and floored S out, forcing the worse-scoring M to win instead.
    const chart = chartOf("S: waist 80, hip 100, pants length 60\nM: waist 95, hip 110, pants length 64\nRuns small");
    const rec = recommendSize(chart, { waist: 80 }, "pants");
    expect(rec.size, "S is physically fine and the better score — it must win").toBe("S");
  });
});

describe("a looseness taste cannot nudge past the waist floor (C's hold, round 2)", () => {
  it("Kyle's exact shorts card stays X-Large under a Slim preference", () => {
    const chart = chartOf(
      "M: waist 75.946, hip 103.886, pants length 48.006\n" +
        "L: waist 80.01, hip 107.95, pants length 49.022\n" +
        "XL: waist 84.074, hip 112.014, pants length 50.038"
    );
    const profile = { waist: 83.82, hip: 99.06, shortsLength: 39.37 };
    const rec = recommendSize(chart, profile, "shorts", { looseness: "slim" });
    // A full-chart ladder would let Slim step from XL down onto the
    // floor-rejected L. The ladder must be confined to floorCandidates,
    // which here is XL alone, so there is nowhere to nudge.
    expect(rec.size).toBe("XL");
  });

  it("the all-rows-fail fallback cannot be nudged down to an even smaller row", () => {
    const chart = chartOf("M: waist 80, hip 100, pants length 100\nL: waist 84, hip 104, pants length 104");
    const profile = { waist: 90 };
    const rec = recommendSize(chart, profile, "pants", { looseness: "slim" });
    // The fallback already picked the largest available (L). A Slim nudge
    // over a full-chart ladder would have stepped down to M, which fits the
    // body even worse than L does.
    expect(rec.size).toBe("L");
  });
});

describe("elasticEvidenceTextFor reads every free-text field, unlike sizeChartTextFor", () => {
  it("keeps elastic wording visible even when a numeric chart has already parsed", () => {
    const item = {
      sizeChartText: "M: waist 76, hip 100\nL: waist 84, hip 108",
      summary: "Elastic waistband cargo shorts, one size fits most",
    };
    // Chart PARSING still prefers the machine field alone — unchanged.
    expect(sizeChartTextFor(item)).not.toMatch(/elastic/i);
    // Elastic EVIDENCE must not be starved by that same precedence.
    expect(elasticEvidenceTextFor(item)).toMatch(/elastic/i);
  });

  it("reads elastic wording from sizeNotes when the title is generic and no sizeChartText is set", () => {
    const item = { title: "Cargo shorts", sizeNotes: "松紧腰 relaxed fit, see size chart photo" };
    expect(elasticEvidenceTextFor(item)).toMatch(/松紧腰/);
  });

  it("feeds a real recommendSize pick: numeric sizeChartText hides elastic evidence sizeChartTextFor would have missed", () => {
    // Body waist 80, target ease 82. S reads 2cm smaller than the body but
    // scores closer; M reads 6cm over. Only elastic evidence (bounded to
    // -4cm) admits S.
    const item = {
      sizeChartText: "S: waist 78, hip 100, pants length 60\nM: waist 88, hip 110, pants length 64",
      title: "Cargo shorts",
      summary: "松紧 elastic drawstring waist",
    };
    const chart = parseSizeChart(sizeChartTextFor(item));
    const profile = { waist: 80 };
    const withOldHelper = recommendSize(chart, profile, "pants", null, null, item.title, sizeChartTextFor(item));
    expect(withOldHelper.size, "sizeChartTextFor alone hides the elastic evidence in summary").toBe("M");
    const withEvidenceHelper = recommendSize(
      chart,
      profile,
      "pants",
      null,
      null,
      item.title,
      elasticEvidenceTextFor(item)
    );
    expect(withEvidenceHelper.size, "elasticEvidenceTextFor surfaces it, so S can win on score").toBe("S");
  });
});

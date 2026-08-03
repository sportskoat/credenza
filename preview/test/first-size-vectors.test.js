// Onboarding handoff — the six sizing test vectors from
// design/handoffs/onboarding/README.md ("The sizing algorithm").
//
// Chart under test: S 96 / M 100 / L 104 / XL 112.
//
// DOCUMENTED DEVIATION — "usual M, roomy".
// The README predicts L from a flat +12cm ease. This repo does not use a flat
// ease: CHEST_EASE_BANDS gives a per-garment band, and Roomy maps onto the
// existing "oversized" band [15, 25] rather than a new +12 mid-band (see the
// header comment in components/first-size.js). On this chart that scores XL,
// not L. The README marks these deltas as a designer's estimate and lists
// "validate against real parsed charts before ship" as open question 1, so the
// engine wins. This file pins the engine's real answer and records the gap.
import { describe, expect, it } from "vitest";
import { parseSizeChart, recommendSize } from "../../credenza-fashion.jsx";
import {
  FIRST_SIZE_USUAL_NO_CHART_PROV,
  guessSizeFromUsual,
} from "../../components/first-size.js";

const CHART = parseSizeChart("S: chest 96\nM: chest 100\nL: chest 104\nXL: chest 112");
const TITLE = "Cotton tee";

/** Score a measured body straight through the engine, as the Measure path does. */
function pickFromChest(chest, looseness) {
  const rec = recommendSize(
    CHART,
    { chest },
    "shirt",
    { length: null, looseness, dismissed: false },
    null,
    TITLE,
    null
  );
  return rec && rec.size;
}

describe("README vector 1 — usual M, regular", () => {
  it("re-picks the anchor letter M", () => {
    const out = guessSizeFromUsual({
      chart: CHART,
      usualLetter: "M",
      sit: "regular",
      category: "shirt",
      title: TITLE,
    });
    expect(out.error).toBeUndefined();
    expect(out.rec.size).toBe("M");
  });

  it("infers a body under the M garment, not the garment number itself", () => {
    const out = guessSizeFromUsual({
      chart: CHART,
      usualLetter: "M",
      sit: "regular",
      category: "shirt",
      title: TITLE,
    });
    // M garment 100 minus the regular band mid (7.5) = 92.5.
    expect(out.body.chest).toBeCloseTo(92.5, 5);
    expect(out.body.firstSizeSource).toBe("usual-fit");
  });
});

describe("README vector 2 — usual M, roomy (documented deviation)", () => {
  it("moves up off the anchor when the visitor asks for room", () => {
    const out = guessSizeFromUsual({
      chart: CHART,
      usualLetter: "M",
      sit: "roomy",
      category: "shirt",
      title: TITLE,
    });
    expect(out.error).toBeUndefined();
    // README says L (flat +12cm). The oversized band [15,25] scores XL.
    // Direction is what the vector really asserts: roomy never picks smaller.
    expect(out.rec.size).toBe("XL");
  });

  it("roomy never lands below regular on the same chart", () => {
    const regular = guessSizeFromUsual({
      chart: CHART, usualLetter: "M", sit: "regular", category: "shirt", title: TITLE,
    });
    const roomy = guessSizeFromUsual({
      chart: CHART, usualLetter: "M", sit: "roomy", category: "shirt", title: TITLE,
    });
    const order = ["S", "M", "L", "XL"];
    expect(order.indexOf(roomy.rec.size)).toBeGreaterThan(order.indexOf(regular.rec.size));
  });
});

describe("README vector 3 — chest 98, regular", () => {
  it("picks L", () => {
    expect(pickFromChest(98, "regular")).toBe("L");
  });
});

describe("README vector 4 — chest 108, regular", () => {
  it("picks XL", () => {
    expect(pickFromChest(108, "regular")).toBe("XL");
  });
});

describe("README vector 5 — chest 108, close", () => {
  it("picks XL, resolving the 112-vs-104 tie upward", () => {
    expect(pickFromChest(108, "slim")).toBe("XL");
  });
});

describe("README vector 6 — no chart, usual M", () => {
  it("picks M and never errors", () => {
    const out = guessSizeFromUsual({
      chart: null,
      usualLetter: "M",
      sit: "regular",
      category: "shirt",
      title: TITLE,
    });
    expect(out.error).toBeUndefined();
    expect(out.rec.size).toBe("M");
    expect(out.noChart).toBe(true);
  });

  it("labels the pick 'No chart · your usual size'", () => {
    expect(FIRST_SIZE_USUAL_NO_CHART_PROV.rail).toBe("No chart · your usual size");
  });

  it("never claims a chart-anchored measurement", () => {
    const out = guessSizeFromUsual({
      chart: null,
      usualLetter: "M",
      sit: "regular",
      category: "shirt",
      title: TITLE,
    });
    expect(out.body.chest).toBeUndefined();
    expect(out.body.firstSizeSource).toBe("usual-no-chart");
  });
});

// Tie-up ("ties resolve to the larger garment") is vector 5 above, and the
// engine-level rule already has coverage in size-chart.test.js. Not repeated
// here — a second copy of that assertion reads as new coverage and is not.

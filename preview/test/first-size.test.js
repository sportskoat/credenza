// Phase 1 first-size chooser pure helpers (F 2026-08-02).
import { describe, expect, it } from "vitest";
import { parseSizeChart } from "../../credenza-fashion.jsx";
import { CHEST_EASE_BANDS } from "../../credenza-fashion.jsx";
import {
  FIRST_SIZE_SIT_OPTIONS,
  FIRST_SIZE_USUAL_FIT_PROV,
  FIRST_SIZE_USUAL_NO_CHART_PROV,
  bodyFromUsualChartSize,
  circumferenceFromPitToPit,
  guessSizeFromUsual,
  profileNeedsFirstSize,
  profilePatchFromGuess,
  profilePatchFromMeasure,
  sitToLooseness,
} from "../../components/first-size.js";

const TOP_CHART = parseSizeChart(
  "S: chest 100\nM: chest 104\nL: chest 110\nXL: chest 116"
);

describe("sitToLooseness maps onto existing fit machinery", () => {
  it("maps Close / Regular / Roomy to slim / regular / oversized for tops", () => {
    expect(sitToLooseness("close", "shirt")).toBe("slim");
    expect(sitToLooseness("regular", "shirt")).toBe("regular");
    expect(sitToLooseness("roomy", "shirt")).toBe("oversized");
  });

  it("maps Roomy to baggy on bottoms (existing bottoms vocabulary)", () => {
    expect(sitToLooseness("roomy", "pants")).toBe("baggy");
    expect(sitToLooseness("roomy", "shorts")).toBe("baggy");
  });

  // F HOLD #81: sit hints must show the TRUE band ranges, never the design
  // 2a +2/+6/+12 sketches that disagree with the engine.
  it("pins sit hints to CHEST_EASE_BANDS (cannot drift from the mapping)", () => {
    const byValue = Object.fromEntries(FIRST_SIZE_SIT_OPTIONS.map((o) => [o.value, o]));
    expect(byValue.close.hint).toBe(
      "+" + CHEST_EASE_BANDS.knitSlim[0] + "–" + CHEST_EASE_BANDS.knitSlim[1] + " cm"
    );
    expect(byValue.regular.hint).toBe(
      "+" + CHEST_EASE_BANDS.knit[0] + "–" + CHEST_EASE_BANDS.knit[1] + " cm"
    );
    expect(byValue.roomy.hint).toBe(
      "+" + CHEST_EASE_BANDS.knitOver[0] + "–" + CHEST_EASE_BANDS.knitOver[1] + " cm"
    );
    // Explicit true ranges so a future band rename still fails the pin.
    expect(byValue.close.hint).toBe("+0–5 cm");
    expect(byValue.regular.hint).toBe("+5–10 cm");
    expect(byValue.roomy.hint).toBe("+15–25 cm");
    // Old false sketches must never return.
    expect(FIRST_SIZE_SIT_OPTIONS.map((o) => o.hint).join(" ")).not.toMatch(/\+12\s*cm/);
    expect(FIRST_SIZE_SIT_OPTIONS.map((o) => o.hint).join(" ")).not.toMatch(/\+2\s*cm/);
    expect(FIRST_SIZE_SIT_OPTIONS.map((o) => o.hint).join(" ")).not.toMatch(/\+6\s*cm/);
  });
});

describe("profileNeedsFirstSize", () => {
  it("is true for null / empty profiles", () => {
    expect(profileNeedsFirstSize(null)).toBe(true);
    expect(profileNeedsFirstSize({})).toBe(true);
  });

  it("is false once a measure or usual size is saved", () => {
    expect(profileNeedsFirstSize({ chest: 108 })).toBe(false);
    expect(profileNeedsFirstSize({ usualSize: "M" })).toBe(false);
    expect(profileNeedsFirstSize({ usualTops: "L" })).toBe(false);
  });
});

describe("usual-fit provenance pin", () => {
  it("locks the new kicker / rail / body copy", () => {
    expect(FIRST_SIZE_USUAL_FIT_PROV.kicker).toBe("AI size");
    expect(FIRST_SIZE_USUAL_FIT_PROV.rail).toBe("Chart pick · usual size + fit");
    expect(FIRST_SIZE_USUAL_FIT_PROV.body).toBe(
      "Started from a size you told us, not a measurement."
    );
    expect(FIRST_SIZE_USUAL_FIT_PROV.upgrade).toBe("Add your chest");
  });
});

describe("no-chart usual provenance pin", () => {
  it("locks the YOUR USUAL fallback copy (not chart-anchored usual-fit)", () => {
    expect(FIRST_SIZE_USUAL_NO_CHART_PROV.kicker).toBe("Your usual size");
    // README confidence ladder: the no-chart rail must say so out loud.
    expect(FIRST_SIZE_USUAL_NO_CHART_PROV.rail).toBe("No chart · your usual size");
    expect(FIRST_SIZE_USUAL_NO_CHART_PROV.body).toBe(
      "This listing has no chart. The pick is your usual size."
    );
  });
});

describe("bodyFromUsualChartSize", () => {
  it("anchors the usual letter to the seller chart and infers a body chest", () => {
    // M chest 104, regular band mid 7.5 → body ≈ 96.5
    const body = bodyFromUsualChartSize(TOP_CHART, "M", "shirt", "Heavyweight boxy tee");
    expect(body).toBeTruthy();
    expect(body.chest).toBeCloseTo(104 - 7.5, 5);
    expect(body.firstSizeSource).toBe("usual-fit");
    expect(body.chestFromUsual).toBe(true);
  });

  it("returns null when the letter is not on the chart", () => {
    expect(bodyFromUsualChartSize(TOP_CHART, "XXS", "shirt", "tee")).toBe(null);
  });
});

describe("guessSizeFromUsual", () => {
  it("scores a chart-anchored pick from usual letter + sit (2 taps)", () => {
    const out = guessSizeFromUsual({
      chart: TOP_CHART,
      usualLetter: "M",
      sit: "regular",
      category: "shirt",
      title: "Heavyweight boxy tee",
    });
    expect(out.error).toBeUndefined();
    expect(out.rec.size).toBeTruthy();
    expect(out.fitPref.looseness).toBe("regular");
    expect(out.body.firstSizeSource).toBe("usual-fit");
  });

  it("maps Close to slim on the fit pref", () => {
    const out = guessSizeFromUsual({
      chart: TOP_CHART,
      usualLetter: "L",
      sit: "close",
      category: "shirt",
      title: "Heavyweight boxy tee",
    });
    expect(out.error).toBeUndefined();
    expect(out.fitPref.looseness).toBe("slim");
  });

  it("maps Roomy to oversized on the fit pref", () => {
    const out = guessSizeFromUsual({
      chart: TOP_CHART,
      usualLetter: "M",
      sit: "roomy",
      category: "shirt",
      title: "Heavyweight boxy tee",
    });
    expect(out.error).toBeUndefined();
    expect(out.fitPref.looseness).toBe("oversized");
  });

  // F Fix 1 (Kyle live 2026-08-02): no-chart is never a dead end.
  it("no-chart: saves usual + sit and picks the usual letter (no error)", () => {
    const out = guessSizeFromUsual({
      chart: null,
      usualLetter: "L",
      sit: "regular",
      category: "shirt",
      title: "Bare listing",
    });
    expect(out.error).toBeUndefined();
    expect(out.noChart).toBe(true);
    expect(out.rec.size).toBe("L");
    expect(out.fitPref.looseness).toBe("regular");
    expect(out.body.firstSizeSource).toBe("usual-no-chart");
    // Must not claim a chart-anchored measure.
    expect(out.body.chest).toBeUndefined();
    expect(out.body.chestFromUsual).toBe(false);
  });

  it("no-chart empty rows: same fallback, not an error", () => {
    const out = guessSizeFromUsual({
      chart: { rows: [] },
      usualLetter: "M",
      sit: "close",
      category: "shirt",
    });
    expect(out.error).toBeUndefined();
    expect(out.noChart).toBe(true);
    expect(out.rec.size).toBe("M");
    expect(out.fitPref.looseness).toBe("slim");
  });

  it("chart present: usual letter not on chart is still an honest error", () => {
    const out = guessSizeFromUsual({
      chart: TOP_CHART,
      usualLetter: "XXS",
      sit: "regular",
      category: "shirt",
    });
    expect(out.error).toBe("usual-not-on-chart");
  });
});

describe("profilePatchFromGuess", () => {
  it("writes usual size slots for tops", () => {
    const patch = profilePatchFromGuess({
      usualLetter: "M",
      body: { chest: 96.5, firstSizeSource: "usual-fit", chestFromUsual: true },
      category: "shirt",
    });
    expect(patch.usualSize).toBe("M");
    expect(patch.usualTops).toBe("M");
    expect(patch.chest).toBe(96.5);
  });
});

describe("unit toggle + pit-to-pit doubling", () => {
  it("doubles pit-to-pit cm into full chest circumference", () => {
    // 54 cm pit-to-pit → 108 cm full chest
    expect(circumferenceFromPitToPit("54", "cm")).toBe(108);
  });

  it("converts inches then doubles (Kyle types inches)", () => {
    // measureToStorage rounds half to 1 decimal: 21 * 2.54 → 53.3 cm half → 106.6 full
    const full = circumferenceFromPitToPit("21", "in");
    expect(full).toBe(106.6);
  });

  it("measure patch for tops uses doubled chest and clears usual-fit flags", () => {
    const patch = profilePatchFromMeasure({
      category: "shirt",
      displayValue: "54",
      units: "cm",
    });
    expect(patch.chest).toBe(108);
    expect(patch.firstSizeSource).toBe("measure");
    expect(patch.chestFromUsual).toBe(false);
  });

  it("measure patch for bottoms stores waist without doubling", () => {
    const patch = profilePatchFromMeasure({
      category: "pants",
      displayValue: "84",
      units: "cm",
    });
    expect(patch.waist).toBe(84);
    expect(patch.chest).toBeUndefined();
  });
});

describe("no server metering in this flow", () => {
  it("helpers never import or call bumpUsage (source pin)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const src = readFileSync(join(root, "components/first-size.js"), "utf8");
    const ui = readFileSync(join(root, "components/FirstSizeBlock.jsx"), "utf8");
    expect(src).not.toMatch(/bumpUsage/);
    expect(ui).not.toMatch(/bumpUsage/);
    expect(src).not.toMatch(/monitoredFetch|chart-vision|authorizePaid/);
    expect(ui).not.toMatch(/monitoredFetch|chart-vision/);
  });
});

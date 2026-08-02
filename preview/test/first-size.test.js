// Phase 1 first-size chooser pure helpers (F 2026-08-02).
import { describe, expect, it } from "vitest";
import { parseSizeChart } from "../../credenza-fashion.jsx";
import {
  FIRST_SIZE_USUAL_FIT_PROV,
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

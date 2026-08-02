// fitMeasureFieldsFor write-path pin (Kyle 2026-08-02 item 6).
// Shorts must save into shortsLength / "Shorts length". Pants keep
// pantsLength / "Trouser length". Mixing them is the confirmed fault that
// left the engine reading an empty shortsLength while the ask wrote pantsLength.
import { describe, expect, it } from "vitest";

const { fitMeasureFieldsFor } = await import("../../components/SizeRecommendation.jsx");

describe("fitMeasureFieldsFor", () => {
  it("shorts write path uses shortsLength, not pantsLength", () => {
    const fields = fitMeasureFieldsFor("shorts");
    expect(fields.map((f) => f.key)).toEqual(["waist", "shortsLength"]);
    expect(fields.find((f) => f.key === "shortsLength").label).toBe("Shorts length");
    expect(fields.some((f) => f.key === "pantsLength")).toBe(false);
  });

  it("pants write path keeps pantsLength / Trouser length", () => {
    const fields = fitMeasureFieldsFor("pants");
    expect(fields.map((f) => f.key)).toEqual(["waist", "pantsLength"]);
    expect(fields.find((f) => f.key === "pantsLength").label).toBe("Trouser length");
  });

  it("shirt asks for chest only", () => {
    expect(fitMeasureFieldsFor("shirt").map((f) => f.key)).toEqual(["chest"]);
  });
});

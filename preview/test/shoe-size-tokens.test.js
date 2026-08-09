// Spec step 3 (2026-08-08): the shoe-size helpers behind the no-chart pick
// screen. EU = US + 33 lands every row of the standard men's table.
import { describe, expect, it } from "vitest";
import {
  extendShoeRun,
  parseShoeSizeToken,
  shoeChipLabel,
  shoeUsualLabel,
} from "../../credenza-fashion.jsx";

describe("parseShoeSizeToken", () => {
  it("reads labelled and bare tokens", () => {
    expect(parseShoeSizeToken("EU 43")).toEqual({ system: "eu", n: 43 });
    expect(parseShoeSizeToken("EU43")).toEqual({ system: "eu", n: 43 });
    expect(parseShoeSizeToken("US 10")).toEqual({ system: "us", n: 10 });
    expect(parseShoeSizeToken("us10")).toEqual({ system: "us", n: 10 });
  });

  it("reads a bare number as EU from 35 up and as US up to 15", () => {
    expect(parseShoeSizeToken("43")).toEqual({ system: "eu", n: 43 });
    expect(parseShoeSizeToken("10")).toEqual({ system: "us", n: 10 });
    expect(parseShoeSizeToken("22")).toBe(null);
  });

  it("passes letter sizes through as not-shoe", () => {
    expect(parseShoeSizeToken("M")).toBe(null);
    expect(parseShoeSizeToken("XXL")).toBe(null);
    expect(parseShoeSizeToken("")).toBe(null);
  });
});

describe("shoeChipLabel", () => {
  it("prints both systems on one chip", () => {
    expect(shoeChipLabel("EU 43")).toBe("EU 43 · US 10");
    expect(shoeChipLabel("43")).toBe("EU 43 · US 10");
    expect(shoeChipLabel("US 10")).toBe("US 10 · EU 43");
  });

  it("stays empty for letter sizes", () => {
    expect(shoeChipLabel("L")).toBe("");
  });
});

describe("shoeUsualLabel", () => {
  it("converts the saved usual into the sentence form", () => {
    expect(shoeUsualLabel("US 10")).toBe("US 10 (about EU 43)");
    expect(shoeUsualLabel("EU 43")).toBe("EU 43 (about US 10)");
    expect(shoeUsualLabel("L")).toBe("");
  });
});

describe("extendShoeRun", () => {
  it("extends the run in the LISTING's scale so it covers the usual (Kyle: a US 10 needs chips up to EU 43+, not 39)", () => {
    expect(extendShoeRun(["40", "41", "42"], "US 10")).toEqual(["40", "41", "42", "43"]);
    expect(extendShoeRun(["EU 40", "EU 41"], "US 9")).toEqual(["EU 40", "EU 41", "EU 42"]);
  });

  it("converts the other way for a US-scale run", () => {
    expect(extendShoeRun(["US 8", "US 9"], "EU 43")).toEqual(["US 8", "US 9", "US 10"]);
  });

  it("inserts in numeric order, not just at the end", () => {
    expect(extendShoeRun(["40", "42"], "EU 41")).toEqual(["40", "41", "42"]);
  });

  it("leaves a run that already covers the usual, and every letter run, alone", () => {
    expect(extendShoeRun(["42", "43", "44"], "US 10")).toEqual(["42", "43", "44"]);
    expect(extendShoeRun(["S", "M", "L"], "US 10")).toEqual(["S", "M", "L"]);
    expect(extendShoeRun(["40", "41"], "L")).toEqual(["40", "41"]);
  });
});

// Pins the optional review-capture field writer (handoff README §3 + AGENT-NOTES).
// Unset fields are ABSENT keys — never null, "", or 0.
import { describe, expect, it } from "vitest";
import { nextReviewField } from "../../haul-review-fields.js";

describe("nextReviewField", () => {
  it("starts from an empty object and keeps unset keys absent", () => {
    expect(nextReviewField(undefined, {})).toEqual({});
    expect(nextReviewField(null, { note: "" })).toEqual({});
  });

  it("writes a note and removes it when cleared", () => {
    const withNote = nextReviewField({}, { note: "Heavy fleece." });
    expect(withNote).toEqual({ note: "Heavy fleece." });
    expect(nextReviewField(withNote, { note: "" })).toEqual({});
    expect(nextReviewField(withNote, { note: null })).toEqual({});
  });

  it("stores rebuy as true or false only; Skip removes the key", () => {
    expect(nextReviewField({}, { rebuy: true })).toEqual({ rebuy: true });
    expect(nextReviewField({ rebuy: true }, { rebuy: false })).toEqual({ rebuy: false });
    expect(nextReviewField({ rebuy: false }, { rebuy: null })).toEqual({});
    expect(nextReviewField({ rebuy: true }, { rebuy: "skip" })).toEqual({});
  });

  it("stores rating as an integer 1–10 only", () => {
    expect(nextReviewField({}, { rating: 8 })).toEqual({ rating: 8 });
    expect(nextReviewField({}, { rating: 1 })).toEqual({ rating: 1 });
    expect(nextReviewField({}, { rating: 10 })).toEqual({ rating: 10 });
    expect(nextReviewField({ rating: 8 }, { rating: 0 })).toEqual({});
    expect(nextReviewField({ rating: 8 }, { rating: 11 })).toEqual({});
    expect(nextReviewField({ rating: 8 }, { rating: null })).toEqual({});
    expect(nextReviewField({ rating: 8 }, { rating: 7.5 })).toEqual({});
  });

  it("stores run as small|true|large only; blank unsets", () => {
    expect(nextReviewField({}, { run: "small" })).toEqual({ run: "small" });
    expect(nextReviewField({}, { run: "true" })).toEqual({ run: "true" });
    expect(nextReviewField({}, { run: "large" })).toEqual({ run: "large" });
    expect(nextReviewField({ run: "small" }, { run: "" })).toEqual({});
    expect(nextReviewField({ run: "small" }, { run: "huge" })).toEqual({});
  });

  it("stores photos only when the list has entries", () => {
    const withPhotos = nextReviewField({}, { photos: ["data:image/png;base64,aa"] });
    expect(withPhotos.photos).toEqual(["data:image/png;base64,aa"]);
    expect(nextReviewField(withPhotos, { photos: [] })).toEqual({});
  });

  it("merges a patch without inventing empty siblings", () => {
    const next = nextReviewField({ note: "ok", rebuy: true }, { rating: 9, run: "true" });
    expect(next).toEqual({ note: "ok", rebuy: true, rating: 9, run: "true" });
    expect("photos" in next).toBe(false);
  });
});

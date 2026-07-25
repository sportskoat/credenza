// Price edit write-through (2026-07-25 live defect): a resolved card carries
// priceUsd from the server. A manual price edit used to keep that stale
// priceUsd, so the card showed the OLD converted price forever — "I change
// it to 60, it doesn't update." A hand-set price now invalidates priceUsd
// and pins against the next resolve overwrite.
import { describe, expect, it } from "vitest";
import { buildEditDraft, buildEditPatch } from "../../credenza-fashion.jsx";

const BASE = {
  title: "Test hoodie",
  price: 600,
  currency: "CNY",
  priceUsd: 84.05,
};

function draftWith(overrides) {
  return { ...buildEditDraft(BASE), ...overrides };
}

describe("buildEditPatch price handling", () => {
  it("invalidates priceUsd when the price changes", () => {
    const patch = buildEditPatch(draftWith({ price: "60" }), BASE);
    expect(patch.price).toBe(60);
    expect(patch.priceUsd).toBeNull();
    expect(patch.priceManual).toBe(true);
  });

  it("keeps priceUsd and sets no pin when the price is untouched", () => {
    const patch = buildEditPatch(draftWith({ colorway: "Bone" }), BASE);
    expect(patch.price).toBe(600);
    expect(patch.priceUsd).toBe(84.05);
    expect("priceManual" in patch).toBe(false);
  });

  it("re-seeds priceUsd 1:1 for a USD-priced edit", () => {
    const patch = buildEditPatch(draftWith({ price: "60", currency: "USD" }), {
      ...BASE,
      currency: "USD",
    });
    expect(patch.price).toBe(60);
    expect(patch.priceUsd).toBe(60);
    expect(patch.priceManual).toBe(true);
  });

  it("clearing the price lifts the pin and the USD figure", () => {
    const patch = buildEditPatch(draftWith({ price: "" }), BASE);
    expect(patch.price).toBeNull();
    expect(patch.priceUsd).toBeNull();
    expect(patch.priceManual).toBe(false);
  });

  it("garbage price input clears, never NaN", () => {
    const patch = buildEditPatch(draftWith({ price: "abc" }), BASE);
    expect(patch.price).toBeNull();
  });
});

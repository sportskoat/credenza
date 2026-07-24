import { describe, it, expect } from "vitest";
import { migrateHaul, HAULS_KEY } from "../../credenza-fashion.jsx";

describe("migrateHaul (Part 5 task 7)", () => {
  it("keeps a full record through the whitelist", () => {
    const raw = {
      id: "haul-summer",
      name: "Summer haul",
      createdAt: 100,
      updatedAt: 200,
      budget: 250.5,
      currency: "CNY",
      archived: true,
      parcel: { weightGrams: 2400, dims: { l: 40, w: 30, h: 20 }, packaging: "reinforced" },
      history: [{ at: 150, type: "budget", detail: "$250" }],
    };
    expect(migrateHaul(raw)).toEqual(raw);
  });

  it("drops unknown fields — same rule as migrateItem", () => {
    const h = migrateHaul({ name: "Winter", evil: "<script>", budget: "abc" });
    expect(h).not.toBeNull();
    expect("evil" in h).toBe(false);
    expect(h.budget).toBe(null);
  });

  it("requires a name and rejects non-objects", () => {
    expect(migrateHaul(null)).toBe(null);
    expect(migrateHaul("Summer")).toBe(null);
    expect(migrateHaul({ name: "  " })).toBe(null);
    expect(migrateHaul({})).toBe(null);
  });

  it("derives a stable slug id from the name when none is stored", () => {
    expect(migrateHaul({ name: "Summer Haul 2026" }).id).toBe("haul-summer-haul-2026");
    expect(migrateHaul({ id: "given", name: "X" }).id).toBe("given");
  });

  it("normalizes the parcel and the currency", () => {
    const h = migrateHaul({
      name: "X",
      currency: "EUR",
      parcel: { weightGrams: -5, dims: { l: "40", w: 0, h: 20 }, packaging: "gold" },
    });
    expect(h.currency).toBe("USD");
    expect(h.parcel.weightGrams).toBe(null);
    expect(h.parcel.packaging).toBe("none");
    expect(h.parcel.dims).toEqual({ l: 40, w: null, h: 20 });
  });

  it("caps history at 50 entries and drops malformed ones", () => {
    const history = Array.from({ length: 60 }, (_, i) => ({ at: i, type: "budget", detail: "d" }));
    history.push(null, "junk", { noType: true });
    const h = migrateHaul({ name: "X", history });
    expect(h.history).toHaveLength(50);
    expect(h.history.every((e) => e.type)).toBe(true);
  });

  it("exports the storage key the shim erase path knows", () => {
    expect(HAULS_KEY).toBe("credenza-fashion-hauls-v1");
  });
});

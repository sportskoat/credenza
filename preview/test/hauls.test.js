import { describe, it, expect } from "vitest";
import { migrateHaul, migrateHaulShip, HAULS_KEY } from "../../credenza-fashion.jsx";

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
    // A haul that never opened the parcel panel has no shipping settings, so
    // every screen falls back to the starting numbers.
    expect(migrateHaul(raw)).toEqual({ ...raw, ship: null });
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

// The haul's shipping settings (haul handoff README, "State").
//
// README: "Three things must survive a reload: item stages, the edited rate
// table, and parcel submission/milestone state." The rates are the person's own
// numbers. Credenza never presents a rate as if it knows today's price, so a
// dropped rate table silently replaces real quotes with our starting guesses.
describe("migrateHaulShip", () => {
  it("reads an absent panel as never opened", () => {
    expect(migrateHaulShip(null)).toBe(null);
    expect(migrateHaulShip("EMS")).toBe(null);
    expect(migrateHaul({ name: "X" }).ship).toBe(null);
  });

  it("keeps the edited rate table and the submission state across a reload", () => {
    const ship = migrateHaul({
      name: "X",
      ship: {
        divisor: 5000,
        line: "DHL",
        rates: { EMS: 12.4, "GD-EUB": 16, DHL: 24.75 },
        ratesEditedAt: "2026-07-12",
        packagingGrams: 210,
        domesticUsd: 21.5,
        declared: 45,
        submitted: true,
        milestone: 2,
        tracking: "LX123456789CN",
      },
    }).ship;
    expect(ship).toEqual({
      divisor: 5000,
      line: "DHL",
      rates: { EMS: 12.4, "GD-EUB": 16, DHL: 24.75 },
      ratesEditedAt: "2026-07-12",
      packagingGrams: 210,
      domesticUsd: 21.5,
      declared: 45,
      submitted: true,
      milestone: 2,
      // One slot per step, so a step taken back keeps the date it carried.
      milestoneAt: [null, null, null, null],
      tracking: "LX123456789CN",
    });
  });

  it("keeps the date the person marked each step", () => {
    const ship = migrateHaulShip({ milestone: 1, milestoneAt: ["2026-07-31", "2026-08-01"] });
    expect(ship.milestoneAt).toEqual(["2026-07-31", "2026-08-01", null, null]);
  });

  it("throws away a step date that is not a date", () => {
    expect(migrateHaulShip({ milestoneAt: [12, {}, null, "ok"] }).milestoneAt).toEqual([
      null,
      null,
      null,
      "ok",
    ]);
  });

  it("falls back to the starting numbers when the panel is empty", () => {
    const ship = migrateHaulShip({});
    expect(ship.divisor).toBe(6000);
    expect(ship.line).toBe("EMS");
    expect(ship.rates).toEqual({ EMS: 13.1, "GD-EUB": 15.4, DHL: 22.3 });
    expect(ship.packagingGrams).toBe(140);
    expect(ship.domesticUsd).toBe(18.4);
    expect(ship.declared).toBe(0);
    expect(ship.submitted).toBe(false);
    expect(ship.milestone).toBe(0);
    expect(ship.tracking).toBe("");
  });

  it("refuses a divisor and a line it does not recognise", () => {
    expect(migrateHaulShip({ divisor: 4000 }).divisor).toBe(6000);
    expect(migrateHaulShip({ divisor: "5000" }).divisor).toBe(5000);
    expect(migrateHaulShip({ line: "FedEx" }).line).toBe("EMS");
  });

  it("replaces a rate of zero or below with the line's starting number", () => {
    const ship = migrateHaulShip({ rates: { EMS: 0, "GD-EUB": -4, DHL: "junk" } });
    expect(ship.rates).toEqual({ EMS: 13.1, "GD-EUB": 15.4, DHL: 22.3 });
  });

  it("holds packaging inside 0 to 400 grams on a step of ten", () => {
    expect(migrateHaulShip({ packagingGrams: 0 }).packagingGrams).toBe(0);
    expect(migrateHaulShip({ packagingGrams: 187 }).packagingGrams).toBe(190);
    expect(migrateHaulShip({ packagingGrams: 900 }).packagingGrams).toBe(140);
    expect(migrateHaulShip({ packagingGrams: -20 }).packagingGrams).toBe(140);
  });

  it("holds the tracking step between the first and the last", () => {
    expect(migrateHaulShip({ milestone: 9 }).milestone).toBe(3);
    expect(migrateHaulShip({ milestone: -2 }).milestone).toBe(0);
    expect(migrateHaulShip({ milestone: "two" }).milestone).toBe(0);
  });

  it("caps a very long tracking number", () => {
    expect(migrateHaulShip({ tracking: "L".repeat(200) }).tracking).toHaveLength(64);
  });
});

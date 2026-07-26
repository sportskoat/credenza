import { describe, expect, it } from "vitest";
import { formatMoney, itemUsdAmount, priceLabel, sumItemsUsd } from "../../credenza-fashion.jsx";

describe("itemUsdAmount", () => {
  it("prefers priceUsd over CNY price", () => {
    expect(itemUsdAmount({ priceUsd: 12.5, price: 100, currency: "CNY" })).toBe(12.5);
  });

  it("converts CNY with the 0.14 fallback", () => {
    expect(itemUsdAmount({ price: 100, currency: "CNY" })).toBe(14);
    expect(itemUsdAmount({ price: 229, currency: "¥" })).toBe(32.06);
  });

  it("keeps USD price as USD", () => {
    expect(itemUsdAmount({ price: 40, currency: "USD" })).toBe(40);
    expect(itemUsdAmount({ price: 18.5, currency: "$" })).toBe(18.5);
  });

  it("returns null for missing or unknown currency amounts", () => {
    expect(itemUsdAmount(null)).toBe(null);
    expect(itemUsdAmount({})).toBe(null);
    expect(itemUsdAmount({ price: 50, currency: "EUR" })).toBe(null);
  });

  it("accepts zero without inventing a positive total", () => {
    expect(itemUsdAmount({ priceUsd: 0 })).toBe(0);
    expect(itemUsdAmount({ price: 0, currency: "CNY" })).toBe(0);
  });
});

describe("sumItemsUsd", () => {
  const items = [
    { id: "a", priceUsd: 10 },
    { id: "b", price: 100, currency: "CNY" }, // 14
    { id: "c", price: 20, currency: "EUR" }, // ignored
    { id: "d", priceUsd: 5, findStatus: "returned" },
  ];

  it("sums only known USD amounts", () => {
    expect(sumItemsUsd(items)).toBe(29);
  });

  it("excludes returned items when excludeReturned is true", () => {
    expect(sumItemsUsd(items, { excludeReturned: true })).toBe(24);
  });

  it("never double-counts priceUsd and CNY on the same item", () => {
    expect(
      sumItemsUsd([{ priceUsd: 12, price: 1000, currency: "CNY" }, { priceUsd: 3 }])
    ).toBe(15);
  });

  it("returns 0 for empty input", () => {
    expect(sumItemsUsd([])).toBe(0);
    expect(sumItemsUsd(null)).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats USD and CNY without inventing values", () => {
    expect(formatMoney(12, "USD")).toBe("$12");
    expect(formatMoney(12.5, "USD")).toBe("$12.50");
    expect(formatMoney(100, "CNY")).toBe("¥100");
    expect(formatMoney(null, "USD")).toBe("");
  });
});

describe("priceLabel primary currency", () => {
  it("shows only USD when the primary is USD", () => {
    // Default PRICE_PRIMARY is USD. Dual ¥+$ must not appear.
    const label = priceLabel({ price: 99, currency: "CNY", priceUsd: 14.59 });
    expect(label).toBe("$14.59");
    expect(label).not.toMatch(/¥/);
  });

  it("still shows USD via FX when priceUsd is missing", () => {
    // itemUsdAmount converts 99 * 0.14 → 13.86, so USD primary still shows $.
    const label = priceLabel({ price: 99, currency: "CNY" });
    expect(label).toBe("$13.86");
  });
});

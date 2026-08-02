import { describe, expect, it } from "vitest";
import {
  PRICE_PRIMARIES,
  formatMoney,
  itemAmountIn,
  itemCnyAmount,
  itemEurAmount,
  itemUsdAmount,
  nextPricePrimary,
  normalizePricePrimary,
  priceLabel,
  sumItemsCny,
  sumItemsIn,
  sumItemsUsd,
} from "../../credenza-fashion.jsx";

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

  // The shelf handoff (2026-07-28) cut order status to bought-or-not, so no
  // item is "returned" any more. excludeReturned survives as a no-op so old
  // callers still work: every card on the shelf counts toward the total.
  it("counts every item even when excludeReturned is true", () => {
    expect(sumItemsUsd(items, { excludeReturned: true })).toBe(29);
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

  it("formats EUR with the € prefix like USD", () => {
    expect(formatMoney(45, "EUR")).toBe("€45");
    expect(formatMoney(45.5, "EUR")).toBe("€45.50");
  });

  it("formats the rest of the top-8 set with stable symbols", () => {
    expect(formatMoney(12, "GBP")).toBe("£12");
    expect(formatMoney(1200, "JPY")).toBe("¥1200");
    expect(formatMoney(19000, "KRW")).toBe("₩19000");
    expect(formatMoney(19, "CAD")).toBe("C$19");
    expect(formatMoney(21.5, "AUD")).toBe("A$21.50");
  });
});

// EUR mirror of itemUsdAmount (2026-08-01): same shape, 0.13 fallback.
describe("itemEurAmount", () => {
  it("prefers priceEur over CNY price", () => {
    expect(itemEurAmount({ priceEur: 10.5, price: 100, currency: "CNY" })).toBe(10.5);
  });

  it("converts CNY with the 0.13 fallback", () => {
    expect(itemEurAmount({ price: 100, currency: "CNY" })).toBe(13);
    expect(itemEurAmount({ price: 229, currency: "¥" })).toBe(29.77);
  });

  it("keeps EUR price as EUR", () => {
    expect(itemEurAmount({ price: 40, currency: "EUR" })).toBe(40);
    expect(itemEurAmount({ price: 18.5, currency: "€" })).toBe(18.5);
  });

  it("returns null for missing or unknown currency amounts", () => {
    expect(itemEurAmount(null)).toBe(null);
    expect(itemEurAmount({})).toBe(null);
    expect(itemEurAmount({ price: 50, currency: "GBP" })).toBe(null);
  });

  it("accepts zero without inventing a positive total", () => {
    expect(itemEurAmount({ priceEur: 0 })).toBe(0);
    expect(itemEurAmount({ price: 0, currency: "CNY" })).toBe(0);
  });
});

// Top-8 list order (lane 2, 2026-08-02). Live UI opens a picker; nextPricePrimary
// still walks the list for any leftover cycle callers and for this pin.
describe("nextPricePrimary", () => {
  it("walks the top-8 list in picker order and wraps", () => {
    expect(PRICE_PRIMARIES).toEqual(["USD", "EUR", "CNY", "GBP", "JPY", "KRW", "CAD", "AUD"]);
    expect(nextPricePrimary("USD")).toBe("EUR");
    expect(nextPricePrimary("EUR")).toBe("CNY");
    expect(nextPricePrimary("CNY")).toBe("GBP");
    expect(nextPricePrimary("AUD")).toBe("USD");
  });

  it("normalizes unknown codes to USD", () => {
    expect(normalizePricePrimary("XYZ")).toBe("USD");
    expect(normalizePricePrimary("gbp")).toBe("GBP");
  });
});

describe("itemAmountIn top-8", () => {
  it("converts CNY to GBP/JPY/KRW with offline fallbacks", () => {
    const item = { price: 100, currency: "CNY" };
    expect(itemAmountIn(item, "GBP")).toBe(11);
    expect(itemAmountIn(item, "JPY")).toBe(2100);
    expect(itemAmountIn(item, "KRW")).toBe(19000);
    expect(itemAmountIn(item, "CAD")).toBe(19);
    expect(itemAmountIn(item, "AUD")).toBe(21);
  });

  it("prefers priceFx over the offline fallback", () => {
    const item = { price: 100, currency: "CNY", priceFx: { GBP: 9.5, JPY: 2000 } };
    expect(itemAmountIn(item, "GBP")).toBe(9.5);
    expect(itemAmountIn(item, "JPY")).toBe(2000);
  });

  it("sums in a non-legacy currency", () => {
    const items = [
      { price: 100, currency: "CNY" },
      { price: 50, currency: "CNY" },
    ];
    expect(sumItemsIn(items, "GBP")).toBe(16.5);
    expect(sumItemsIn(items, "JPY")).toBe(3150);
  });
});

// Kyle 2026-07-28: "If you switch from USD to CNY, it doesn't change the
// dollar amount." The CNY direction converts too.
describe("itemCnyAmount", () => {
  it("keeps the stored CNY price", () => {
    expect(itemCnyAmount({ price: 229, currency: "CNY" })).toBe(229);
    expect(itemCnyAmount({ price: 99, currency: "¥", priceUsd: 14.59 })).toBe(99);
  });

  it("converts USD to whole yuan with the same fallback rate", () => {
    expect(itemCnyAmount({ price: 40, currency: "USD" })).toBe(286);
    expect(itemCnyAmount({ priceUsd: 14.59 })).toBe(104);
  });

  it("returns null for missing or unknown currency amounts", () => {
    expect(itemCnyAmount(null)).toBe(null);
    expect(itemCnyAmount({})).toBe(null);
    expect(itemCnyAmount({ price: 50, currency: "EUR" })).toBe(null);
  });
});

describe("sumItemsCny", () => {
  const items = [
    { id: "a", price: 100, currency: "CNY" },
    { id: "b", priceUsd: 14 }, // 100 yuan
    { id: "c", price: 20, currency: "EUR" }, // ignored
    { id: "d", price: 50, currency: "CNY", findStatus: "returned" },
  ];

  it("sums stored yuan plus converted dollars", () => {
    expect(sumItemsCny(items)).toBe(250);
  });

  it("counts every item even when excludeReturned is true", () => {
    expect(sumItemsCny(items, { excludeReturned: true })).toBe(250);
  });

  it("returns 0 for empty input", () => {
    expect(sumItemsCny([])).toBe(0);
    expect(sumItemsCny(null)).toBe(0);
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

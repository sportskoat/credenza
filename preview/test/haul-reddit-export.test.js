// Pins the Reddit markdown for a frozen haul share (handoff README §5).
import { describe, expect, it } from "vitest";
import { buildRedditHaulMarkdown } from "../../haul-reddit-export.js";

const RICH = {
  title: "casuals",
  count: 2,
  agent: "Superbuy",
  shipLine: "EMS",
  chargeableG: 2753,
  goodsUsd: 41.24,
  shipUsd: 39.3,
  landedUsd: 138.4,
  orderedAt: "2026-06-23T00:00:00.000Z",
  receivedAt: "2026-07-12T00:00:00.000Z",
  includes: {
    prices: true,
    w2c: true,
    fit: true,
    sellers: true,
    qc: false,
    weights: true,
  },
  intro:
    "Two pieces through Superbuy. Sizes are read against my own measurements: 98cm chest, 79cm waist, 178cm.",
  items: [
    {
      title: "Arc Shorts",
      priceUsd: 27.25,
      size: "L",
      seller: "beverly-luxury",
      storeUrl: "https://weidian.com/item.html?itemID=4712233990",
      albumUrl: "https://beverlyluxury.x.yupoo.com/albums/98421",
      fit: { short: "L = US 30–31" },
    },
    {
      title: "Mertra T-shirt",
      priceUsd: 13.99,
      size: "XL",
      seller: "shop4m1n8251",
      storeUrl: "https://weidian.com/item.html?itemID=5518042771",
      fit: { short: "XL = US M" },
    },
  ],
};

const SPARSE = {
  title: "quiet haul",
  count: 1,
  includes: {
    prices: false,
    w2c: false,
    fit: true,
    sellers: false,
    qc: false,
    weights: false,
  },
  items: [
    {
      title: "Basic tee",
      size: "M",
    },
  ],
};

const SHARE = "https://credenzafashion.com/s/nm5drud9e3w6";

describe("buildRedditHaulMarkdown", () => {
  it("matches the rich template: header, gated columns, raw W2C, measures, link", () => {
    const md = buildRedditHaulMarkdown(RICH, SHARE);
    expect(md).toBe(
      [
        "**casuals — 2 items, $138.40 landed** · Superbuy · EMS, 2753 g chargeable · ordered 23 Jun, received 12 Jul (19 days)",
        "",
        "| Item | Price | Size | Fit | Seller | W2C |",
        "|---|---|---|---|---|---|",
        "| Arc Shorts | $27.25 | L | L = US 30–31 | beverly-luxury | https://weidian.com/item.html?itemID=4712233990 · [album](https://beverlyluxury.x.yupoo.com/albums/98421) |",
        "| Mertra T-shirt | $13.99 | XL | XL = US M | shop4m1n8251 | https://weidian.com/item.html?itemID=5518042771 |",
        "",
        "My measurements: 98cm chest, 79cm waist, 178cm. Every fit call is read off the seller's own chart.",
        "",
        "Photos, notes and the full breakdown: https://credenzafashion.com/s/nm5drud9e3w6",
      ].join("\n")
    );
  });

  it("drops absent segments and columns on a sparse doc", () => {
    const md = buildRedditHaulMarkdown(SPARSE, SHARE);
    expect(md).toBe(
      [
        "**quiet haul — 1 item**",
        "",
        "| Item | Size | Fit |",
        "|---|---|---|",
        "| Basic tee | M | – |",
        "",
        "Photos, notes and the full breakdown: https://credenzafashion.com/s/nm5drud9e3w6",
      ].join("\n")
    );
  });

  it("never wraps a W2C link in a Credenza redirect", () => {
    const md = buildRedditHaulMarkdown(RICH, SHARE);
    expect(md).not.toMatch(/credenzafashion\.com\/w\//);
    expect(md).toContain("https://weidian.com/item.html?itemID=4712233990");
  });

  it("uses an en dash placeholder when fit is missing", () => {
    const md = buildRedditHaulMarkdown(
      {
        title: "x",
        count: 1,
        includes: { prices: false, w2c: false, fit: true, sellers: false, qc: false, weights: false },
        items: [{ title: "No fit" }],
      },
      SHARE
    );
    expect(md).toContain("| No fit |  | – |");
  });
});

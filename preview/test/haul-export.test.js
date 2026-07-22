import { describe, expect, it } from "vitest";
import {
  canonicalBuyUrl,
  exportHaulBundle,
  exportItemRecord,
  linkByRole,
  photosUrl,
} from "../../credenza-haul-export.js";

const sample = {
  id: "abc",
  title: "Heavyweight Hoodie",
  summary: "Good weight",
  category: "outerwear",
  seller: "Example Studio",
  sellerUrl: "https://weidian.com/?userid=1",
  price: 168,
  priceUsd: 23.5,
  currency: "CNY",
  image: "https://img.example/cover.webp",
  gallery: ["https://img.example/2.webp"],
  links: [
    { url: "https://weidian.com/item.html?itemID=99", role: "buy" },
    { url: "https://foo.x.yupoo.com/albums/1", role: "photos" },
    { url: "https://reddit.com/r/x/comments/1", role: "source" },
  ],
  size: "L",
  recommendedSize: "L",
  sizeNotes: "M 胸围112\nL 胸围116",
  findStatus: "want",
  favorite: true,
  canonicalKey: "weidian:99",
  createdAt: 1721600000000,
};

describe("link helpers", () => {
  it("finds links by role", () => {
    expect(linkByRole(sample, "buy")).toContain("weidian.com");
    expect(photosUrl(sample)).toContain("yupoo.com");
    expect(canonicalBuyUrl(sample)).toBe(sample.links[0].url);
  });

  it("infers buy from host when role missing", () => {
    const item = {
      links: [{ url: "https://item.taobao.com/item.htm?id=1" }],
    };
    expect(canonicalBuyUrl(item)).toContain("taobao.com");
  });
});

describe("exportItemRecord", () => {
  it("emits a portable product record with canonical buy only", () => {
    const rec = exportItemRecord(sample);
    expect(rec.name).toBe("Heavyweight Hoodie");
    expect(rec.buyUrl).toContain("weidian.com");
    expect(rec.buyUrl).not.toMatch(/superbuy|sugargoo|cssbuy/i);
    expect(rec.recommendedSize).toBe("L");
    expect(rec.offers.price).toBe(168);
    expect(rec.offers.priceUsd).toBe(23.5);
    expect(rec.images).toHaveLength(2);
    expect(rec.sourceUrl).toContain("reddit.com");
  });

  it("tolerates sparse items", () => {
    const rec = exportItemRecord({ id: "x" });
    expect(rec.name).toBe("Untitled");
    expect(rec.buyUrl).toBeNull();
    expect(rec.offers).toBeUndefined();
  });
});

describe("exportHaulBundle", () => {
  it("wraps products with schema + context", () => {
    const bundle = exportHaulBundle([sample], {
      preferredAgent: "superbuy",
      measureUnits: "in",
      exportedAt: "2026-07-22T12:00:00.000Z",
      appVersion: "test",
    });
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.context.preferredAgent).toBe("superbuy");
    expect(bundle.context.itemCount).toBe(1);
    expect(bundle.products[0].buyUrl).toContain("weidian");
    expect(bundle.disclaimer).toMatch(/not a public product catalog/i);
  });

  it("respects maxItems truncation", () => {
    const many = [sample, { ...sample, id: "b" }, { ...sample, id: "c" }];
    const bundle = exportHaulBundle(many, { maxItems: 2 });
    expect(bundle.products).toHaveLength(2);
    expect(bundle.context.truncated).toBe(true);
    expect(bundle.context.sourceItemCount).toBe(3);
  });

  it("handles empty shelf", () => {
    const bundle = exportHaulBundle([]);
    expect(bundle.products).toEqual([]);
    expect(bundle.context.itemCount).toBe(0);
  });
});

/**
 * resolve.js pure helpers + Taobao HTML parse (no live network).
 * Spec: docs/specs/empty-taobao-cards.md
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { _test } = require("../netlify/functions/resolve.js");
const { weidianItemId, taobaoFamilyItemId, classifyBuyLink, parseWorldTaobaoHtml } = _test;

describe("classifyBuyLink", () => {
  it("classifies Weidian itemIDs", () => {
    expect(classifyBuyLink("https://weidian.com/item.html?itemID=7777810977")).toEqual({
      marketplace: "weidian",
      itemId: "7777810977",
    });
    expect(weidianItemId("https://shop.v.weidian.com/item.html?itemID=1234567890")).toBe("1234567890");
  });

  it("classifies Taobao and Tmall ids", () => {
    expect(classifyBuyLink("https://item.taobao.com/item.htm?id=856801351597")).toEqual({
      marketplace: "taobao",
      itemId: "856801351597",
    });
    expect(classifyBuyLink("https://detail.tmall.com/item.htm?id=680012345678")).toEqual({
      marketplace: "tmall",
      itemId: "680012345678",
    });
    expect(taobaoFamilyItemId("https://world.taobao.com/item/856801351597.htm")).toEqual({
      marketplace: "taobao",
      itemId: "856801351597",
    });
  });

  it("rejects junk and non-buy hosts", () => {
    expect(classifyBuyLink("https://example.com/item?id=1")).toBeNull();
    expect(classifyBuyLink("javascript:alert(1)")).toBeNull();
    expect(classifyBuyLink("")).toBeNull();
    expect(classifyBuyLink("https://seller.x.yupoo.com/albums/1")).toBeNull();
  });
});

describe("parseWorldTaobaoHtml", () => {
  it("reads og:title and og:image", () => {
    const html = `
      <html><head>
      <meta property="og:title" content="直播專拍，請記得備註...-淘寶Taobao | 天貓Tmall"/>
      <meta property="og:image" content="https://img.alicdn.com/imgextra/i3/x.png"/>
      <title>直播專拍，請記得備註...-淘寶Taobao | 天貓Tmall</title>
      </head></html>`;
    const facts = parseWorldTaobaoHtml(html);
    expect(facts.title).toContain("直播");
    expect(facts.title).not.toMatch(/淘寶Taobao/);
    expect(facts.mainImage).toBe("https://img.alicdn.com/imgextra/i3/x.png");
    expect(facts.images).toEqual(["https://img.alicdn.com/imgextra/i3/x.png"]);
  });

  it("protocol-relative og:image becomes https", () => {
    const html = `<meta property="og:image" content="//img.alicdn.com/x.jpg"/><title>Tee</title>`;
    expect(parseWorldTaobaoHtml(html).mainImage).toBe("https://img.alicdn.com/x.jpg");
  });

  it("pulls a ¥ price when present", () => {
    const html = `<title>Hoodie</title><span>¥ 199.5</span>`;
    expect(parseWorldTaobaoHtml(html).priceCny).toBe(199.5);
  });

  it("returns empty facts for blank HTML", () => {
    const facts = parseWorldTaobaoHtml("");
    expect(facts.title).toBe("");
    expect(facts.mainImage).toBeNull();
  });
});

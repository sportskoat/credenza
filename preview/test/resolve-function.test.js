/**
 * resolve.js pure helpers + Taobao HTML parse (no live network).
 * Spec: docs/specs/empty-taobao-cards.md
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { _test } = require("../netlify/functions/resolve.js");
const {
  weidianItemId,
  taobaoFamilyItemId,
  ali1688ItemId,
  classifyBuyLink,
  parseWorldTaobaoHtml,
  parseWorldTaobaoIsland,
  parse1688Html,
  descImageUrls,
  extractYupooLinksFromText,
} = _test;
const WORLD_TAOBAO_FIXTURE = require("fs").readFileSync(
  require("path").join(__dirname, "fixtures/resolve/world-taobao-item-752339164885.html"),
  "utf8"
);

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

  it("classifies 1688 offer ids", () => {
    expect(classifyBuyLink("https://detail.1688.com/offer/7335890124.html")).toEqual({
      marketplace: "1688",
      itemId: "7335890124",
    });
    expect(ali1688ItemId("https://m.1688.com/offer/922443855703.html")).toBe("922443855703");
    expect(ali1688ItemId("https://detail.1688.com/offer/12345.htm?offerId=99999999999")).toBe("12345");
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

describe("parse1688Html", () => {
  it("reads og:title and og:image", () => {
    const html = `
      <html><head>
      <meta property="og:title" content="夏季纯棉T恤批发-1688"/>
      <meta property="og:image" content="//cbu01.alicdn.com/img/x.jpg"/>
      <title>夏季纯棉T恤批发-1688</title>
      </head></html>`;
    const facts = parse1688Html(html);
    expect(facts.title).toContain("T恤");
    expect(facts.title).not.toMatch(/1688$/);
    expect(facts.mainImage).toBe("https://cbu01.alicdn.com/img/x.jpg");
  });

  it("reads Schema.org Product JSON-LD when og is missing", () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"批发连帽卫衣","image":["//img.alicdn.com/imgextra/i1/x.png"],"offers":{"@type":"Offer","price":"39.90","priceCurrency":"CNY"}}
      </script>
      </head></html>`;
    const facts = parse1688Html(html);
    expect(facts.title).toBe("批发连帽卫衣");
    expect(facts.mainImage).toBe("https://img.alicdn.com/imgextra/i1/x.png");
    expect(facts.priceCny).toBe(39.9);
  });

  it("returns empty facts for blank HTML", () => {
    const facts = parse1688Html("");
    expect(facts.title).toBe("");
    expect(facts.mainImage).toBeNull();
  });
});

describe("descImageUrls (Weidian Product Details photos)", () => {
  it("keeps type-2 photo blocks in order, deduped and cleaned", () => {
    const urls = descImageUrls([
      { type: 2, url: "https://si.geilicdn.com/a_467_207.jpg?w=30&h=30" },
      { type: 10000, text: "购前说明", url: "https://si.geilicdn.com/folded.png" },
      { type: 2, url: "https://si.geilicdn.com/b_800_800.jpg.webp" },
      { type: 2, url: "https://si.geilicdn.com/a_467_207.jpg" },
      { type: 1, text: "not a photo" },
      { type: 2, url: "javascript:alert(1)" },
    ]);
    expect(urls).toEqual([
      "https://si.geilicdn.com/a_467_207.jpg",
      "https://si.geilicdn.com/b_800_800.jpg",
    ]);
  });

  it("reads type-13 album thumbnails (shoe multi-model shops)", () => {
    // Live shape: getDetailDesc type 13 → itemDetailImgAlbum.albumImgList[].thumbnail
    const urls = descImageUrls([
      { type: 1, text: "Yupoo: yolo66.x.yupoo.com" },
      {
        type: 13,
        itemDetailImgAlbum: {
          albumImgList: [
            { thumbnail: "https://si.geilicdn.com/chart_1.jpg?x=1" },
            { thumbnail: "https://si.geilicdn.com/chart_2.jpg" },
            { thumbnail: "https://si.geilicdn.com/chart_1.jpg" },
            { url: "https://si.geilicdn.com/full.jpg" },
            { thumbnail: "javascript:alert(1)" },
          ],
        },
      },
      { type: 10000, text: "购前说明", url: "https://si.geilicdn.com/legal.png" },
    ]);
    expect(urls).toEqual([
      "https://si.geilicdn.com/chart_1.jpg",
      "https://si.geilicdn.com/chart_2.jpg",
      "https://si.geilicdn.com/full.jpg",
    ]);
  });

  it("merges type-2 then type-13 without dropping either", () => {
    const urls = descImageUrls([
      { type: 2, url: "https://si.geilicdn.com/first.jpg" },
      {
        type: 13,
        itemDetailImgAlbum: {
          albumImgList: [{ thumbnail: "https://si.geilicdn.com/album.jpg" }],
        },
      },
    ]);
    expect(urls).toEqual([
      "https://si.geilicdn.com/first.jpg",
      "https://si.geilicdn.com/album.jpg",
    ]);
  });

  it("caps at 20 and tolerates garbage input", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ type: 2, url: `https://si.geilicdn.com/${i}.jpg` }));
    expect(descImageUrls(many)).toHaveLength(20);
    expect(descImageUrls(null)).toEqual([]);
    expect(descImageUrls("nope")).toEqual([]);
    expect(descImageUrls([{ type: 13, itemDetailImgAlbum: null }])).toEqual([]);
  });
});

describe("parseWorldTaobaoIsland (SEO data island)", () => {
  it("reads title, gallery, real price, and seller from a live capture", () => {
    const island = parseWorldTaobaoIsland(WORLD_TAOBAO_FIXTURE);
    expect(island).toBeTruthy();
    expect(island.title).toContain("Tagkita");
    expect(island.images.length).toBeGreaterThan(0);
    expect(island.images[0]).toMatch(/^https:\/\/img\.alicdn\.com\//);
    expect(island.priceCny).toBe(145);
    expect(island.sellerName).toContain("金鯊");
  });

  it("normalizes protocol-relative image URLs and drops junk", () => {
    const html =
      'var b = {"loaderData":{"pdp-pc":{"data":{"httpData":{"normalItemResponse":{' +
      '"item":{"title":" Tee ","images":["//img.alicdn.com/a.jpg","notaurl","https://img.alicdn.com/a.jpg"]},' +
      '"itemPrice":{"promotionPrice":"88.50"},"seller":{"shopName":"Shop"}}}}}}};';
    const island = parseWorldTaobaoIsland(html);
    expect(island.title).toBe("Tee");
    expect(island.images).toEqual(["https://img.alicdn.com/a.jpg"]);
    expect(island.priceCny).toBe(88.5);
    expect(island.sellerName).toBe("Shop");
  });

  it("returns null when the island is absent or broken", () => {
    expect(parseWorldTaobaoIsland("<html><body>no island</body></html>")).toBe(null);
    expect(parseWorldTaobaoIsland('var b = {"loaderData": {broken')).toBe(null);
    expect(parseWorldTaobaoIsland("")).toBe(null);
  });
});

describe("extractYupooLinksFromText (Weidian desc notes)", () => {
  it("normalizes bare shop hosts and full album URLs", () => {
    expect(
      extractYupooLinksFromText("Yupoo1 :ruok66.x.yupoo.com\nsee https://mook-official.x.yupoo.com/albums/1")
    ).toEqual([
      "https://ruok66.x.yupoo.com",
      "https://mook-official.x.yupoo.com/albums/1",
    ]);
  });

  it("ignores empty and non-links", () => {
    expect(extractYupooLinksFromText("SEE MY YUPOO")).toEqual([]);
  });
});

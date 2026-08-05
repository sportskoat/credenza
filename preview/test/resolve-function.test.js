/**
 * resolve.js pure helpers + Taobao HTML parse (no live network).
 * Spec: docs/specs/empty-taobao-cards.md
 */
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { _test } = require("../netlify/functions/resolve.js");
const {
  weidianItemId,
  taobaoFamilyItemId,
  ali1688ItemId,
  classifyBuyLink,
  unwrapAgentBuyLink,
  taobaoShortHost,
  classifyViaRedirect,
  parseWorldTaobaoHtml,
  parseWorldTaobaoIsland,
  parse1688Html,
  descImageUrls,
  extractYupooLinksFromText,
  urlAspect,
  isChartShaped,
  galleryWithDescPhotos,
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

  // Kyle haul pastes 2026-07-26 — Fansbuy agent fronts must resolve like Weidian.
  it("classifies Fansbuy item-micro links as Weidian", () => {
    expect(
      classifyBuyLink("https://fansbuy.com/item-micro-7799601727.html?promotionCode=52c32b7af9506121")
    ).toEqual({ marketplace: "weidian", itemId: "7799601727" });
    expect(classifyBuyLink("https://fansbuy.com/item-micro-7809917249.html")).toEqual({
      marketplace: "weidian",
      itemId: "7809917249",
    });
    expect(classifyBuyLink("https://fansbuy.com/item-micro-7520678906.html")).toEqual({
      marketplace: "weidian",
      itemId: "7520678906",
    });
    expect(unwrapAgentBuyLink("https://fansbuy.com/item-micro-7799601727.html")).toEqual({
      marketplace: "weidian",
      itemId: "7799601727",
    });
  });

  it("classifies Superbuy-family wrapped ?url= buy links", () => {
    const wrapped =
      "https://www.superbuy.com/en/page/buy?url=" +
      encodeURIComponent("https://weidian.com/item.html?itemID=7777810977");
    expect(classifyBuyLink(wrapped)).toEqual({ marketplace: "weidian", itemId: "7777810977" });
  });

  it("unwraps usfans path links with the usfans codes, not the hoobuy ones", () => {
    // usfans: 3 weidian / 4 1688 / 5 taobao (probed live 2026-07-28).
    // hoobuy would read 3 as 1688 — the map keys off the host.
    expect(unwrapAgentBuyLink("https://usfans.com/product/3/7800400500")).toEqual({
      marketplace: "weidian",
      itemId: "7800400500",
    });
    expect(unwrapAgentBuyLink("https://usfans.com/product/5/856801351597")).toEqual({
      marketplace: "taobao",
      itemId: "856801351597",
    });
    expect(unwrapAgentBuyLink("https://hoobuy.com/product/3/712345678901")).toEqual({
      marketplace: "1688",
      itemId: "712345678901",
    });
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

describe("galleryWithDescPhotos (Kyle 2026-07-29, Weidian item 7744643744)", () => {
  // The live feed for that item: photo 1 is the size table, photos 2-7 are the
  // product shots the card never showed. The SKU feed carried the main photo
  // only, so the card read "ALL 2 PHOTOS" while the page showed five.
  const CHART = "https://si.geilicdn.com/pcitem1895556439-0bf00000019db0e56bba0a2304aa-unadjust_861_629.png";
  const SHOTS = [
    "https://si.geilicdn.com/pcitem1895556439-7a280000019db0e3ef400a22d1a4_4284_4284.jpg",
    "https://si.geilicdn.com/pcitem1895556439-661f0000019db0e3fcab0a2394a4_4284_4284.jpg",
  ];

  it("reads the width and height out of the CDN path", () => {
    expect(urlAspect(CHART)).toBeCloseTo(861 / 629, 5);
    expect(urlAspect(SHOTS[0])).toBe(1);
    expect(urlAspect("https://si.geilicdn.com/no-size.jpg")).toBeNull();
    expect(urlAspect("https://si.geilicdn.com/a_0_0.jpg")).toBeNull();
    expect(urlAspect(null)).toBeNull();
  });

  it("calls a landscape image a chart and a square or portrait image a photo", () => {
    expect(isChartShaped(CHART)).toBe(true);
    expect(isChartShaped(SHOTS[0])).toBe(false);
    // Portrait product shots are common and must stay in the gallery.
    expect(isChartShaped("https://si.geilicdn.com/a_800_1200.jpg")).toBe(false);
    // No size in the path — treat it as a photo, never hide it.
    expect(isChartShaped("https://si.geilicdn.com/plain.jpg")).toBe(false);
  });

  it("appends the product shots and leaves the table out", () => {
    const out = galleryWithDescPhotos(["https://si.geilicdn.com/main_4284_4284.jpg"], [CHART, ...SHOTS]);
    expect(out).toEqual(["https://si.geilicdn.com/main_4284_4284.jpg", ...SHOTS]);
  });

  it("never repeats a photo and never passes ten", () => {
    const many = Array.from({ length: 14 }, (_, i) => `https://si.geilicdn.com/d${i}_900_900.jpg`);
    expect(galleryWithDescPhotos([many[0]], many)).toHaveLength(10);
    expect(galleryWithDescPhotos(null, null)).toEqual([]);
    expect(galleryWithDescPhotos(["https://si.geilicdn.com/a_900_900.jpg"], "nope")).toEqual([
      "https://si.geilicdn.com/a_900_900.jpg",
    ]);
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
    // The type-10000 folded strip rides in page order (Kyle 2026-08-04: the
    // fold is where the long chart strip lives).
    expect(urls).toEqual([
      "https://si.geilicdn.com/a_467_207.jpg",
      "https://si.geilicdn.com/folded.png",
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
      "https://si.geilicdn.com/legal.png",
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

  it("drops the shared 购前说明 legal-notice photo, keeps other type-10000 strips", () => {
    const urls = descImageUrls([
      {
        type: 10000,
        text: "购前说明",
        url: "https://si.geilicdn.com/img-791300000199cc14effd0a2102c5-unadjust_2250_4929.png",
      },
      { type: 10000, text: "尺码表", url: "https://si.geilicdn.com/real-folded.png" },
      { type: 2, url: "https://si.geilicdn.com/chart_800_600.png" },
    ]);
    // The boilerplate skip is exact-file only — a different folded strip or
    // any other photo must still reach the pool.
    expect(urls).toEqual([
      "https://si.geilicdn.com/real-folded.png",
      "https://si.geilicdn.com/chart_800_600.png",
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

describe("taobaoShortHost (parser audit 2026-07-27)", () => {
  it("flags id-less Taobao-family links and nothing else", () => {
    expect(taobaoShortHost("https://m.tb.cn/h.6abCdEf")).toBe(true);
    expect(taobaoShortHost("https://s.click.taobao.com/t?e=m%3D2%26s%3Dabcd")).toBe(true);
    expect(taobaoShortHost("https://item.taobao.com/item.htm?id=856801351597")).toBe(false);
    expect(taobaoShortHost("https://example.com/h.6abCdEf")).toBe(false);
    expect(taobaoShortHost("not a url")).toBe(false);
  });
});

describe("classifyViaRedirect", () => {
  const guard = require("../netlify/functions/lib/guard.js");
  const redirect = (location) => ({
    status: 302,
    headers: { get: (k) => (k === "location" ? location : null) },
  });
  const htmlPage = (html) => ({
    status: 200,
    headers: { get: () => null },
    body: null,
    arrayBuffer: async () => new TextEncoder().encode(html).buffer,
  });

  it("follows a short link to the item page", async () => {
    guard._setLookupForTest(async () => [{ address: "8.8.8.8" }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => redirect("https://item.taobao.com/item.htm?id=856801351597"))
    );
    const hit = await classifyViaRedirect("https://m.tb.cn/h.6abCdEf");
    expect(hit).toEqual({ marketplace: "taobao", itemId: "856801351597" });
    vi.unstubAllGlobals();
    guard._setLookupForTest(null);
  });

  it("reads the item URL out of an HTML interstitial", async () => {
    guard._setLookupForTest(async () => [{ address: "8.8.8.8" }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        htmlPage('<html><script>location="https://detail.tmall.com/item.htm?id=680012345678&spm=1"</script></html>')
      )
    );
    const hit = await classifyViaRedirect("https://s.click.taobao.com/t?e=abc");
    expect(hit).toEqual({ marketplace: "tmall", itemId: "680012345678" });
    vi.unstubAllGlobals();
    guard._setLookupForTest(null);
  });

  it("refuses a redirect that leaves the Taobao family", async () => {
    guard._setLookupForTest(async () => [{ address: "8.8.8.8" }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => redirect("https://evil.example.com/item.htm?id=856801351597"))
    );
    const hit = await classifyViaRedirect("https://m.tb.cn/h.6abCdEf");
    expect(hit).toBeNull();
    vi.unstubAllGlobals();
    guard._setLookupForTest(null);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler, _test } = require("../netlify/functions/yupoo.js");
const guard = require("../netlify/functions/lib/guard.js");
const limit = require("../netlify/functions/lib/limit.js");
const SECRET = "test-secret";
const ALBUM = "https://mook-official.x.yupoo.com/albums/244505824?uid=1";

function post(url = ALBUM, secret = SECRET) {
  return {
    httpMethod: "POST",
    headers: { "x-credenza-key": secret },
    body: JSON.stringify({ url }),
  };
}

function fixtureHtml() {
  const photos = Array.from({ length: 10 }, (_, index) => {
    const hash = `asset${index}`;
    return `
      <img src="https://photo.yupoo.com/mook-official/${hash}/small.jpg">
      <img data-src="https://photo.yupoo.com/mook-official/${hash}/medium.jpg">
      <div style="background-image:url('https://photo.yupoo.com/mook-official/${hash}/big.jpg')"></div>`;
  }).join("");
  return `<!doctype html>
    <html><head>
      <title>￥229 M32126-109E | 相册 | Mook-offcical | Supplier Product Catalog</title>
      <meta property="og:image" content="https://photo.yupoo.com/mook-official/asset0/medium.jpg">
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Organization",
        name: "Mook-offcical",
      })}</script>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "ImageGallery",
        name: "￥229 M32126-109E",
        author: { "@type": "Person", name: "Mook-offcical" },
        description: "https:\/\/weidian.com\/item.html?itemID=7799763843",
        image: ["https://photo.yupoo.com/mook-official/asset0/original.jpg"],
      })}</script>
    </head><body>
      <img src="https://s.yupoo.com/website/icons/logo.png">
      <a href="https://weidian.com/item.html?itemID=7799763843">Buy</a>
      ${photos}
    </body></html>`;
}

describe("Yupoo function", () => {
  beforeEach(() => {
    process.env.CREDENZA_SEARCH_SECRET = SECRET;
    guard._setLookupForTest(async () => [{ address: "93.184.216.34" }]);
    limit._resetForTest();
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureHtml(),
    }));
  });

  afterEach(() => {
    delete process.env.CREDENZA_SEARCH_SECRET;
    guard._setLookupForTest(null);
    limit._resetForTest();
    vi.restoreAllMocks();
  });

  it("extracts structured album metadata and the canonical buy link", async () => {
    const result = await handler(post());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      url: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
      albumId: "244505824",
      sourceTitle: "￥229 M32126-109E",
      title: "M32126-109E",
      seller: "Mook-offcical",
      sellerAccount: "mook-official",
      priceCny: 229,
      batch: "M32126-109E",
      buyUrl: "https://weidian.com/item.html?itemID=7799763843",
    });
  });

  // The fixture has no per-photo tile markup, so this exercises the flat-scrape
  // fallback that older album templates still need.
  it("falls back to the flat scrape: excludes UI assets, collapses size variants, prefers the best variant", async () => {
    const result = await handler(post());
    const { images, chartImages, photoCount } = JSON.parse(result.body);
    expect(images).toHaveLength(10);
    expect(photoCount).toBe(10);
    expect(chartImages).toEqual([]);
    expect(images.some((url) => url.includes("s.yupoo.com"))).toBe(false);
    expect(images[0]).toContain("asset0/original.jpg");
    expect(images.slice(1).every((url) => url.endsWith("/big.jpg"))).toBe(true);
    expect(new Set(images.map(_test.imageIdentity)).size).toBe(10);
  });

  // ————— Per-photo tiles (2026-07-26) —————
  // Kyle: "this album has 30 different photos"; "don't bring in the sizing
  // chart"; "make sure that they're only halfway decent photos".
  const tile = (hash, { w = 2000, h = 2000, alt = hash + ".jpg", ext = "jpg" } = {}) => `
    <div class="showalbum__children image__main" data-id="${hash}">
      <div class="image__imagewrap" data-type="photo">
        <img alt="${alt}" data-width="${w}" data-height="${h}"
          data-src="https://photo.yupoo.com/mook-official/${hash}/big.${ext}"
          data-origin-src="https://photo.yupoo.com/mook-official/${hash}/o.${ext}"
          src="https://photo.yupoo.com/mook-official/${hash}/small.${ext}">
      </div>
    </div>`;

  it("reads per-photo tiles, so the count matches the album not the fetch cap", () => {
    const html = Array.from({ length: 30 }, (_, i) => tile("p" + i)).join("");
    const tiles = _test.extractPhotoTiles(html, ALBUM);
    expect(tiles).toHaveLength(30);
    expect(_test.partitionTiles(tiles).gallery).toHaveLength(30);
  });

  it("holds size-chart tiles out of the gallery and returns them separately", () => {
    const html = [
      tile("chart", { w: 491, h: 490, alt: "screenshot_2026-06-02_09-53-02.png", ext: "png" }),
      tile("named", { w: 1200, h: 1400, alt: "size chart.jpg" }),
      ...Array.from({ length: 6 }, (_, i) => tile("p" + i)),
    ].join("");
    const { gallery, charts } = _test.partitionTiles(_test.extractPhotoTiles(html, ALBUM));
    expect(gallery).toHaveLength(6);
    expect(charts.map((c) => c.alt)).toEqual([
      "screenshot_2026-06-02_09-53-02.png",
      "size chart.jpg",
    ]);
    expect(gallery.every((g) => !/chart|named/.test(g.url))).toBe(true);
  });

  it("drops tiny and strip-shaped tiles, and keeps tiles with no declared size", () => {
    const html = [
      tile("tiny", { w: 120, h: 120 }),
      tile("strip", { w: 2400, h: 300 }),
      tile("good", { w: 1440, h: 1440 }),
      `<div class="image__imagewrap"><img alt="unknown.jpg"
         data-origin-src="https://photo.yupoo.com/mook-official/unk/o.jpg"></div>`,
    ].join("");
    const { gallery } = _test.partitionTiles(_test.extractPhotoTiles(html, ALBUM));
    expect(gallery.map((g) => g.alt)).toEqual(["good.jpg", "unknown.jpg"]);
  });

  it("never returns an empty gallery when every tile fails vetting", async () => {
    const html = `<!doctype html><html><head><title>￥1 X</title></head><body>
      ${tile("a", { w: 100, h: 100 })}${tile("b", { w: 100, h: 100 })}</body></html>`;
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => html }));
    const { images, photoCount } = JSON.parse((await handler(post())).body);
    expect(images).toHaveLength(2);
    expect(photoCount).toBe(2);
  });

  it("rejects unauthorized and non-album requests before fetching", async () => {
    expect((await handler(post(ALBUM, "wrong"))).statusCode).toBe(401);
    expect((await handler(post("https://example.com/albums/1"))).statusCode).toBe(422);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("normalizes Weidian item ids and Yupoo album identity", () => {
    expect(_test.canonicalBuyUrl("https:\/\/weidian.com\/item.html?itemId=7799763843&utm_source=x"))
      .toBe("https://weidian.com/item.html?itemID=7799763843");
    expect(_test.parseAlbumUrl(ALBUM)).toMatchObject({
      albumId: "244505824",
      sellerAccount: "mook-official",
      url: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
      requestUrl: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
    });
    // Missing uid must default to 1 so open links don't 404 in-browser.
    expect(_test.parseAlbumUrl("https://mook-official.x.yupoo.com/albums/239021655")).toMatchObject({
      albumId: "239021655",
      url: "https://mook-official.x.yupoo.com/albums/239021655?uid=1",
      requestUrl: "https://mook-official.x.yupoo.com/albums/239021655?uid=1",
    });
  });
});

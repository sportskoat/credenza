import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler, _test } = require("../netlify/functions/yupoo.js");
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
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureHtml(),
    }));
  });

  afterEach(() => {
    delete process.env.CREDENZA_SEARCH_SECRET;
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

  it("excludes UI assets, collapses size variants, prefers the best variant, and caps at eight", async () => {
    const result = await handler(post());
    const { images } = JSON.parse(result.body);
    expect(images).toHaveLength(8);
    expect(images.some((url) => url.includes("s.yupoo.com"))).toBe(false);
    expect(images[0]).toContain("asset0/original.jpg");
    expect(images.slice(1).every((url) => url.endsWith("/big.jpg"))).toBe(true);
    expect(new Set(images.map(_test.imageIdentity)).size).toBe(8);
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

// Public share page renderer: v1 shelf cards stay byte-stable, v2 haul docs
// use the haul-sharing redesign (cover marquee, review/receipt, missing-data
// hides the cell).
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharePage = require("../netlify/functions/share-page.js");
const { pageHtml, pageHtmlV1, escapeHtml, safeHref, safeSrc } = sharePage._internal;

function v1Doc(extra = {}) {
  return {
    v: 1,
    title: "Winter haul",
    count: 1,
    truncated: false,
    fields: { prices: true, notes: false, quality: false, sellers: false, parcel: false },
    items: [{ title: "Wool coat", image: "https://cdn.example.com/coat.jpg", priceUsd: 42.5 }],
    totalUsd: 42.5,
    createdAt: 1_700_000_000_000,
    ...extra,
  };
}

function v2Full(extra = {}, itemExtra = {}) {
  return {
    v: 2,
    title: "casuals",
    count: 1,
    truncated: false,
    layout: "both",
    includes: { prices: true, w2c: true, fit: true, sellers: true, qc: true, weights: true },
    intro: "One piece through Superbuy. Sizes are read against my own measurements: 98cm chest, 79cm waist, 178cm.",
    agent: "Superbuy",
    orderedAt: "2026-06-23T00:00:00.000Z",
    receivedAt: "2026-07-12T00:00:00.000Z",
    goodsUsd: 65.03,
    shipUsd: 39.3,
    shipLine: "EMS",
    landedUsd: 104.33,
    chargeableG: 2753,
    items: [
      {
        title: "Fox 94 zip hoodie",
        image: "https://img.test/cover.jpg",
        photos: ["https://img.test/a.jpg", "https://img.test/b.jpg"],
        ownPhotos: ["https://img.test/mine1.jpg"],
        size: "XL",
        platform: "weidian",
        storeUrl: "https://weidian.com/item.html?itemID=1050009723785",
        albumUrl: "https://shop.x.yupoo.com/albums/123",
        buyUrl: "https://www.superbuy.com/en/page/buy?url=encoded&partnercode=201444039",
        priceUsd: 65.03,
        seller: "beverly-luxury",
        weightGrams: 300,
        fabric: "heavyweight",
        qcPhotos: ["https://img.test/qc1.jpg"],
        fit: {
          translation: "Their XL fits like a US M.",
          short: "XL = US M",
          roomLine: "14cm of room on my 98cm. Regular fit.",
          advice: "Around a 98cm chest? Take the XL.",
          source: "Read from the seller's chart",
        },
        note: "Heavy fleece, YKK zip.",
        rebuy: true,
        rating: 9,
        ...itemExtra,
      },
    ],
    createdAt: 1754000000000,
    ...extra,
  };
}

describe("v1 path stays stable", () => {
  it("still renders the v1 grid markers", () => {
    const html = pageHtml(v1Doc());
    expect(html).toContain('<ul class="grid">');
    expect(html).toContain("<h1>Winter haul</h1>");
    expect(html).toContain("Wool coat");
    expect(html).toContain("$42.50");
    expect(html).toContain("Made with");
    expect(html).toContain("Plan your own haul");
  });

  it("routes non-v2 docs through pageHtmlV1", () => {
    const a = pageHtml(v1Doc());
    const b = pageHtmlV1(v1Doc());
    expect(a).toBe(b);
  });
});

describe("v2 full haul page", () => {
  it("renders title, stats, fit lines, rating pill, and rebuy line", () => {
    const html = pageHtml(v2Full(), { code: "abcdefghjkmn" });
    expect(html).toContain("casuals");
    expect(html).toContain("SHARED HAUL · 1 ITEM");
    expect(html).toContain("$104.33");
    expect(html).toContain("Goods");
    expect(html).toContain("$65.03");
    expect(html).toContain("EMS");
    expect(html).toContain("$39.30");
    expect(html).toContain("Chargeable");
    expect(html).toContain("2753 g");
    expect(html).toContain("Ordered 23 Jun → received 12 Jul · 19 days");
    expect(html).toContain("Their XL fits like a US M.");
    expect(html).toContain("14cm of room on my 98cm. Regular fit.");
    expect(html).toContain("Around a 98cm chest? Take the XL.");
    // Apostrophes are HTML-escaped in the served markup.
    expect(html).toContain("Read from the seller&#39;s chart");
    expect(html).toContain("Heavy fleece, YKK zip.");
    expect(html).toContain("I would buy it again.");
    expect(html).toContain('class="cz-rating good"');
    expect(html).toContain(">9</span>");
    expect(html).toContain("/10");
    expect(html).toContain("Landed per piece");
    expect(html).toContain("WHAT IT COST");
    expect(html).toContain("Buy links on this page carry the author's referral codes. They cost the reader nothing.");
    expect(html).toContain("Made with");
    expect(html).toContain("Plan your own haul");
  });

  it("hides ship and landed blocks when those stats are absent", () => {
    const html = pageHtml(
      v2Full({
        shipUsd: undefined,
        shipLine: undefined,
        landedUsd: undefined,
        chargeableG: undefined,
        orderedAt: undefined,
        receivedAt: undefined,
      })
    );
    expect(html).toContain("Goods");
    expect(html).toContain("$65.03");
    expect(html).not.toContain("EMS");
    expect(html).not.toContain("$39.30");
    expect(html).not.toContain("Chargeable");
    expect(html).not.toContain("Landed per piece");
    expect(html).not.toContain("Landed total");
    expect(html).not.toContain("Ordered ");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain(">null<");
  });

  it("hides the Receipt tab when layout is review", () => {
    const html = pageHtml(v2Full({ layout: "review" }));
    expect(html).toContain("REVIEW");
    expect(html).toContain('id="view-review"');
    expect(html).not.toContain(">Receipt<");
    expect(html).not.toContain('data-view="receipt"');
    expect(html).not.toContain('id="view-receipt"');
  });

  it("uses rating colour classes at 9, 7 and 5", () => {
    expect(pageHtml(v2Full({}, { rating: 9 }))).toContain('class="cz-rating good"');
    expect(pageHtml(v2Full({}, { rating: 7 }))).toContain('class="cz-rating mid"');
    expect(pageHtml(v2Full({}, { rating: 5 }))).toContain('class="cz-rating bad"');
  });

  it("includes reduced-motion CSS for the marquee", () => {
    const html = pageHtml(v2Full());
    expect(html).toContain("@media (prefers-reduced-motion:reduce)");
    expect(html).toContain("animation:none!important");
  });

  it("duplicates the marquee track and marks the second copy decorative", () => {
    const html = pageHtml(v2Full());
    expect(html).toContain('class="cz-marquee"');
    const tiles = html.match(/class="cz-tile"/g) || [];
    // Cover photos (unique) duplicated once.
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    expect(tiles.length % 2).toBe(0);
    expect(html).toContain('aria-hidden="true"');
  });

  it("ships the inline script that honours ?v=receipt", () => {
    const html = pageHtml(v2Full({ layout: "both" }));
    expect(html).toContain('searchParams.get("v")');
    expect(html).toContain('"receipt"');
    expect(html).toContain("history.replaceState");
    expect(html).toContain('data-view="receipt"');
    expect(html).toContain('data-view="review"');
  });

  it("puts the raw store URL on the store button and the affiliate link on Buy", () => {
    const html = pageHtml(v2Full());
    expect(html).toContain('href="https://weidian.com/item.html?itemID=1050009723785"');
    // The label says "Store", not "W2C": the house language rule bans "w2c"
    // in any text a user can read (public-site.test.js). The design file's
    // label loses to that rule. The URL routing is unchanged.
    expect(html).toContain("Store · Weidian");
    expect(html).toContain('href="https://www.superbuy.com/en/page/buy?url=encoded&amp;partnercode=201444039"');
    expect(html).toContain("Buy via Superbuy");
    expect(html).not.toContain("credenzafashion.com/w/");
    expect(html).toContain('rel="nofollow noopener"');
  });

  it("writes no undefined, NaN or null strings for a sparse doc", () => {
    const html = pageHtml({
      v: 2,
      title: "Sparse",
      count: 1,
      layout: "review",
      includes: {},
      items: [{ title: "Plain tee" }],
      createdAt: 1,
    });
    expect(html).toContain("Sparse");
    expect(html).toContain("Plain tee");
    expect(html).toContain("NO LISTING PHOTO");
    // Scan visible text only (style blocks may use the word "null" never, but
    // a real leak lands in body copy as bare tokens).
    const body = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
    expect(body).not.toMatch(/\bundefined\b/);
    expect(body).not.toMatch(/\bNaN\b/);
    expect(body).not.toMatch(/>\s*null\s*</);
    expect(html).not.toContain("I would buy it again.");
    expect(html).not.toContain("I would not buy it again.");
    // CSS still defines .cz-rating; the body must not render a rating pill.
    expect(body).not.toContain('class="cz-rating');
  });

  it("shows the explicit no rebuy line", () => {
    const html = pageHtml(v2Full({}, { rebuy: false }));
    expect(html).toContain("I would not buy it again.");
    expect(html).not.toContain("I would buy it again.");
  });

  it("prints the run line under the translation, and hides it when absent", () => {
    expect(pageHtml(v2Full({}, { run: "small" }))).toContain("It ran small on me.");
    expect(pageHtml(v2Full({}, { run: "true" }))).toContain("It ran true to size on me.");
    expect(pageHtml(v2Full({}, { run: "large" }))).toContain("It ran large on me.");
    const absent = pageHtml(v2Full({}, { run: undefined }));
    expect(absent).not.toContain("It ran small on me.");
    expect(absent).not.toContain("It ran true to size on me.");
    expect(absent).not.toContain("It ran large on me.");
  });

  it("escapes attacker-controlled text", () => {
    const html = pageHtml(
      v2Full(
        { title: '<script>alert(1)</script>', intro: '"><img onerror=alert(2)>' },
        { title: "<b>x</b>", note: "<script>x</script>", storeUrl: "javascript:alert(1)" }
      )
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
  });

  it("points og:image at the share image proxy when a cover photo exists", () => {
    const html = pageHtml(v2Full(), { code: "abcdefghjkmn" });
    expect(html).toContain('<meta property="og:image" content="https://credenzafashion.com/s/abcdefghjkmn/img" />');
  });
});

describe("helpers stay strict", () => {
  it("escapeHtml and safe URL helpers still reject bad input", () => {
    expect(escapeHtml("<a>")).toBe("&lt;a&gt;");
    expect(safeHref("javascript:alert(1)")).toBe(null);
    expect(safeSrc("data:text/html;base64,AA")).toBe(null);
    expect(safeSrc("https://img.test/a.jpg")).toBe("https://img.test/a.jpg");
  });
});

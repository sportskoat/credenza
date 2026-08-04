// 2026-08-04 link-failure reasons — one 422 string used to cover every dead
// link, so the card sat blank. The server now names the cause in a `code`
// field (resolve.js buyLinkFailCode, yupoo.js yupooFailCode), the client
// stores it as item.failCode, and DetailBody's listingInfoOf distinguishes a
// thin-but-successful listing (tier 2/3). Corpus: Kyle's 52-link paste.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { buyLinkFailCode, weidianItemId } = require("../netlify/functions/resolve.js")._test;
const { yupooFailCode } = require("../netlify/functions/yupoo.js")._test;
const { listingInfoOf } = await import("../../components/DetailBody.jsx");

describe("buyLinkFailCode (resolve.js)", () => {
  it("names a Weidian shop front", () => {
    expect(buyLinkFailCode("https://weidian.com/?userid=275")).toBe("shop-front");
    expect(buyLinkFailCode("https://shop1621342910.v.weidian.com/")).toBe("shop-front");
  });

  it("calls a short numeric itemID a cut-off item link, not a shop front", () => {
    // Corpus: itemID=77615274 (8 digits) — every working id is 10.
    expect(buyLinkFailCode("https://weidian.com/item.html?itemID=77615274")).toBe("link-cut-off");
  });

  it("names an agent short link", () => {
    expect(buyLinkFailCode("https://k.youshop10.com/abc123")).toBe("agent-short");
  });

  it("names a truncated or unparseable URL", () => {
    expect(buyLinkFailCode("https://e.t")).toBe("link-cut-off");
    expect(buyLinkFailCode("not a url at all")).toBe("link-cut-off");
  });

  it("keeps a generic fallback for ordinary sites", () => {
    expect(buyLinkFailCode("https://example.com/some/page")).toBe("not-a-buy-link");
  });
});

describe("weidianItemId length sanity (Idea 3)", () => {
  it("rejects ids shorter than 10 digits so they cannot become dead cards", () => {
    expect(weidianItemId("https://weidian.com/item.html?itemID=77615274")).toBeNull();
    expect(weidianItemId("https://weidian.com/item.html?itemID=7761527400")).toBe("7761527400");
  });
});

describe("yupooFailCode (yupoo.js)", () => {
  it("distinguishes a category page from a bare shop root", () => {
    expect(yupooFailCode("https://huskyreps.x.yupoo.com/categories/955700")).toBe("yupoo-category");
    expect(yupooFailCode("https://premium888.x.yupoo.com/")).toBe("yupoo-shop-root");
  });

  it("stays generic off Yupoo", () => {
    expect(yupooFailCode("https://example.com/albums/123")).toBe("not-a-buy-link");
  });
});

describe("listingInfoOf (DetailBody tier 2/3 signal)", () => {
  const POLICY =
    "https://si.geilicdn.com/img-791300000199cc14effd0a2102c5-unadjust_2250_4929.png";

  it("sizes listed but only the policy boilerplate photo -> no-measurements", () => {
    expect(
      listingInfoOf({
        url: "https://weidian.com/item.html?itemID=7783100251",
        descImages: [POLICY],
        variants: [
          { title: "颜色", values: ["黑", "白"] },
          { title: "尺码", values: ["S", "M", "L", "XL"] },
        ],
      })
    ).toBe("no-measurements");
  });

  it("a real description photo clears the signal", () => {
    expect(
      listingInfoOf({
        url: "https://weidian.com/item.html?itemID=7783100251",
        descImages: [POLICY, "https://si.geilicdn.com/real-chart-photo.jpg"],
        variants: [{ title: "尺码", values: ["S", "M"] }],
      })
    ).toBe("");
  });

  it("no photos and no size axis on a Taobao link -> bare", () => {
    expect(
      listingInfoOf({
        url: "https://item.taobao.com/item.htm?id=1053557073582",
        descImages: [],
        variants: [],
      })
    ).toBe("bare");
  });

  it("no photos and no size axis OFF Taobao stays silent (the copy names Taobao)", () => {
    expect(
      listingInfoOf({
        url: "https://weidian.com/item.html?itemID=7783100251",
        descImages: [],
        variants: [],
      })
    ).toBe("");
  });

  it("an unenriched card (no fields at all) stays silent", () => {
    expect(listingInfoOf({ url: "https://weidian.com/item.html?itemID=7783100251" })).toBe("");
  });
});

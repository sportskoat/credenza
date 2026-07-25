// Placeholder titles for stashed fashion links (2026-07-25 walkthrough):
// cards titled "x · 12345678" or "weidian.com" read as broken. The seller
// lives in the /photos/<seller>/ path on x.yupoo.com, and Weidian/Taobao
// item ids live in the query string.
import { describe, expect, it } from "vitest";
import { localTitle } from "../../credenza-fashion.jsx";

describe("localTitle fashion placeholders", () => {
  it("names the seller from the x.yupoo.com /photos/ path, not the x host", () => {
    const title = localTitle(
      { type: "link", url: "https://x.yupoo.com/photos/topstoney/albums/12345678", host: "x.yupoo.com" },
      "https://x.yupoo.com/photos/topstoney/albums/12345678"
    );
    expect(title).toBe("topstoney · 12345678");
  });

  it("keeps the seller subdomain on seller.x.yupoo.com albums", () => {
    const title = localTitle(
      { type: "link", url: "https://mook-official.x.yupoo.com/albums/244505824?uid=1", host: "mook-official.x.yupoo.com" },
      "https://mook-official.x.yupoo.com/albums/244505824?uid=1"
    );
    expect(title).toBe("mook-official · 244505824");
  });

  it("never titles a card with the bare x host", () => {
    const title = localTitle(
      { type: "link", url: "https://x.yupoo.com/photos/husky-reps/albums/999", host: "x.yupoo.com" },
      "https://x.yupoo.com/photos/husky-reps/albums/999"
    );
    expect(title).not.toMatch(/^x\b/);
  });

  it("names a Weidian item by its itemID instead of the bare host", () => {
    const title = localTitle(
      { type: "link", url: "https://weidian.com/item.html?itemID=7234567890", host: "weidian.com" },
      "https://weidian.com/item.html?itemID=7234567890"
    );
    expect(title).toBe("Weidian item 7234567890");
  });

  it("names a Taobao item by its id", () => {
    const title = localTitle(
      { type: "link", url: "https://item.taobao.com/item.htm?id=812345678901", host: "item.taobao.com" },
      "https://item.taobao.com/item.htm?id=812345678901"
    );
    expect(title).toBe("Taobao item 812345678901");
  });

  it("falls back to the host for marketplace pages without an id", () => {
    const title = localTitle(
      { type: "link", url: "https://weidian.com/", host: "weidian.com" },
      "https://weidian.com/"
    );
    expect(title).toBe("weidian.com");
  });
});

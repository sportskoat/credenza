// Placeholder titles for stashed fashion links (2026-07-25 walkthrough):
// cards titled "x · 12345678" or "weidian.com" read as broken. The seller
// lives in the /photos/<seller>/ path on x.yupoo.com, and Weidian/Taobao
// item ids live in the query string.
import { describe, expect, it } from "vitest";
import { fashionDisplayTitle, localTitle } from "../../credenza-fashion.jsx";

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

// 2026-07-25 live defect: dead Weidian item pages title themselves literally
// "<UNKNOWN>", and that marker became the card title in production. The junk
// guard skips it so the local fallback title survives.
describe("fashionDisplayTitle junk guard", () => {
  it("skips a literal <UNKNOWN> title and uses the next candidate", () => {
    const title = fashionDisplayTitle({
      translatedTitle: "<UNKNOWN>",
      productTitle: "Denim jacket",
    });
    expect(title).toBe("Denim jacket");
  });

  it("returns an empty string when every candidate is junk", () => {
    expect(fashionDisplayTitle({ title: "<UNKNOWN>" })).toBe("");
    expect(fashionDisplayTitle({ title: "unknown" })).toBe("");
    expect(fashionDisplayTitle({ title: "￥209 <UNKNOWN>" })).toBe("");
    expect(fashionDisplayTitle(null)).toBe("");
    expect(fashionDisplayTitle({})).toBe("");
  });

  it("keeps a real title that follows a price marker", () => {
    expect(fashionDisplayTitle({ title: "￥209 M29855-51E hoodie" })).toBe("M29855-51E hoodie");
  });

  it("truncates long titles to 69 characters plus an ellipsis", () => {
    const title = fashionDisplayTitle({ title: "a".repeat(100) });
    expect(title).toHaveLength(70);
    expect(title.endsWith("…")).toBe(true);
  });
});

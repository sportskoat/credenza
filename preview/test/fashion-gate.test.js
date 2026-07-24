import { describe, it, expect } from "vitest";
import { fashionGateStatus, isFashionUrl } from "../../fashion-gate.js";

describe("fashionGateStatus", () => {
  it("passes every marketplace link", () => {
    expect(fashionGateStatus("https://weidian.com/item.html?itemID=7234567890")).toBe("fashion");
    expect(fashionGateStatus("https://item.taobao.com/item.htm?id=856801351597")).toBe("fashion");
    expect(fashionGateStatus("https://detail.1688.com/offer/940644075601.html")).toBe("fashion");
    expect(fashionGateStatus("https://seller.x.yupoo.com/albums/172098145?uid=1")).toBe("fashion");
  });

  it("passes Reddit and buy-agent links", () => {
    expect(fashionGateStatus("https://www.reddit.com/r/FashionReps/comments/1abc123/x/")).toBe("fashion");
    expect(fashionGateStatus("https://www.superbuy.com/en/page/buy?url=...")).toBe("fashion");
    expect(fashionGateStatus("https://kakobuy.com/item/123")).toBe("fashion");
  });

  it("passes space-obfuscated fashion links", () => {
    expect(fashionGateStatus("https:/ /item. ta oba o.co m /item.htm?id=902046907188")).toBe("fashion");
  });

  it("passes raw text — notes are never gated", () => {
    expect(fashionGateStatus("size up once, print is thick")).toBe("raw");
    expect(fashionGateStatus("")).toBe("raw");
  });

  it("passes prose that mentions a fashion link", () => {
    expect(fashionGateStatus("GP'd this batch https://weidian.com/item.html?itemID=7234567890 fire")).toBe("fashion");
  });

  it("gates non-fashion links, even with prose around them", () => {
    expect(fashionGateStatus("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("gated");
    expect(fashionGateStatus("check this https://www.nytimes.com/2026/07/23/style/x.html out")).toBe("gated");
    expect(fashionGateStatus("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBe("gated");
  });
});

describe("isFashionUrl", () => {
  it("rejects malformed URLs without throwing", () => {
    expect(isFashionUrl("not a url")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  parseImport,
  shareTextLabel,
  taokoulingTitle,
  taobaoShortHost,
  resolvableBuyUrl,
} from "../../credenza-fashion.jsx";

// The five held client fixes from docs/parser-audit-2026-07-27.md.
// Applied after the CH-03..CH-06 commits landed and the hold was released.

describe("messy-lines paste: extractUrls (audit fixes 1+2)", () => {
  it("drops a trailing comma so the card resolves and dedupes", () => {
    const out = parseImport(
      "- Represent shorts https://weidian.com/item.html?itemID=4432567890,\n" +
        "- Represent shorts dup https://weidian.com/item.html?itemID=4432567890"
    );
    // Same item pasted dirty and clean: one card, canonical key, no comma.
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].parsed.url).toBe("https://weidian.com/item.html?itemID=4432567890");
    expect(out.candidates[0].key).toBe("weidian:4432567890");
  });

  it("keeps two genuinely different items", () => {
    const out = parseImport(
      "- Represent shorts https://weidian.com/item.html?itemID=4432567890,\n" +
        "- Nike dunk https://weidian.com/item.html?itemID=7299887766"
    );
    expect(out.candidates).toHaveLength(2);
  });

  it("repairs a space-broken host", () => {
    const out = parseImport(
      "- shorts https://wei dian.co m/item.html?itemID=4432567890"
    );
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].parsed.url).toContain("weidian.com");
  });
});

describe("shareTextLabel (audit fix 3)", () => {
  it("unwraps the platform tag and keeps the product name", () => {
    expect(shareTextLabel("【Yeezy 350 尾货】https://weidian.com/item.html?itemID=1 复制这段描述后打开微店APP"))
      .toBe("Yeezy 350 尾货");
  });

  it("drops a bare platform tag like 【淘宝】", () => {
    expect(shareTextLabel("【淘宝】https://m.tb.cn/h.6abCdEf 「Nike Dunk Low 熊猫」"))
      .toBe("Nike Dunk Low 熊猫");
  });

  it("unwraps a markdown link to its label", () => {
    expect(shareTextLabel("[Represent shorts](https://weidian.com/item.html?itemID=1)"))
      .toBe("Represent shorts");
  });

  it("titles a share-text paste with the product name, not the chrome", () => {
    const out = parseImport(
      "【Yeezy 350 尾货】https://weidian.com/item.html?itemID=4432567890 复制这段描述后打开微店APP"
    );
    expect(out.candidates[0].titleHint).toBe("Yeezy 350 尾货");
  });
});

describe("taokoulingTitle (audit fix 4)", () => {
  it("titles a ￥-wrapped token", () => {
    expect(taokoulingTitle("￥CZ0001 aBcDeFg￥")).toContain("Taobao share code");
  });

  it("stays quiet on ordinary prose", () => {
    expect(taokoulingTitle("just a note about shorts")).toBe("");
  });

  it("a token-only paste becomes a titled note, not a junk fragment", () => {
    const out = parseImport("￥CZ0001 aBcDeFg￥");
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].titleHint).toContain("Taobao share code");
  });
});

describe("taobaoShortHost + resolvableBuyUrl (audit fix 5)", () => {
  it("flags id-less Taobao-family short links", () => {
    expect(taobaoShortHost("https://m.tb.cn/h.6abCdEf")).toBe(true);
    expect(taobaoShortHost("https://s.click.taobao.com/t?e=abc")).toBe(true);
  });

  it("ignores full item links and other hosts", () => {
    expect(taobaoShortHost("https://item.taobao.com/item.htm?id=7234567890")).toBe(false);
    expect(taobaoShortHost("https://weidian.com/item.html?itemID=1")).toBe(false);
    expect(taobaoShortHost("not a url")).toBe(false);
  });

  it("lets a short link through the resolve gate", () => {
    expect(resolvableBuyUrl({ url: "https://m.tb.cn/h.6abCdEf" })).toBe(
      "https://m.tb.cn/h.6abCdEf"
    );
  });

  it("still rejects non-buy links", () => {
    expect(resolvableBuyUrl({ url: "https://www.reddit.com/r/FashionReps/" })).toBeNull();
  });
});

// Parser audit — real-world paste formats through the live import pipeline.
// Not a shipped test: prints a verdict table for the night-queue audit.
import { describe, it } from "vitest";
import { parseImport } from "../../credenza-fashion.jsx";
import { unwrapAgentUrl } from "../../agents.js";

const CASES = [
  ["taobao desktop + spm", "https://item.taobao.com/item.htm?id=7234567890&spm=a21n57.1.hoverItem.1&ns=1"],
  ["taobao short link (no id)", "https://m.tb.cn/h.6abCdEf"],
  ["taobao share text", "【淘宝】https://m.tb.cn/h.6abCdEf 「Nike Dunk Low 熊猫」"],
  ["tmall detail", "https://detail.tmall.com/item.htm?id=6789012345"],
  ["weidian + tracking", "https://weidian.com/item.html?itemID=4432567890&wfr=BuyercopyURL&spider_token=a1b2"],
  ["weidian app share text", "【Yeezy 350 尾货】https://weidian.com/item.html?itemID=4432567890 复制这段描述后打开微店APP"],
  ["1688 offer", "https://detail.1688.com/offer/6543210987.html"],
  ["1688 mobile", "https://m.1688.com/offer/6543210987.html"],
  ["yupoo album + uid", "https://huskyreps.x.yupoo.com/albums/132456789?uid=1"],
  ["yupoo www photos", "https://www.yupoo.com/photos/huskyreps/albums/132456789"],
  ["cnfans weidian", "https://cnfans.com/product/?platform=weidian&id=4432567890"],
  ["cnfans taobao + ref", "https://www.cnfans.com/product?platform=taobao&id=7234567890&ref=98765"],
  ["superbuy wrapped", "https://www.superbuy.com/en/page/buy?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D4432567890"],
  ["fansbuy micro", "https://fansbuy.com/item-micro-4432567890.html?promotionCode=XYZ"],
  ["hoobuy path", "https://hoobuy.com/product/2/4432567890"],
  ["mulebuy shop_type", "https://mulebuy.com/product/?id=7234567890&shop_type=taobao"],
  ["pandabuy legacy", "https://www.pandabuy.com/product?url=https%3A%2F%2Fitem.taobao.com%2Fitem.htm%3Fid%3D7234567890"],
  ["s.click affiliate redirector", "https://s.click.taobao.com/t?e=m%3D2%26s%3Dabcd"],
  ["discord suppressed embed", "<https://weidian.com/item.html?itemID=4432567890>"],
  ["reddit markdown link", "[Represent shorts](https://weidian.com/item.html?itemID=4432567890)"],
  ["reddit QC post", "https://www.reddit.com/r/FashionReps/comments/abc123/qc_represent_shorts/"],
  ["x status", "https://x.com/curator/status/1234567890"],
  ["tiktok video", "https://www.tiktok.com/@hunter/video/7234567890"],
  ["linktree curator", "https://linktr.ee/topfinds"],
  ["t.co wrapper", "https://t.co/AbCdEfGh"],
  ["taokouling token (no URL)", "￥CZ0001 aBcDeFg￥"],
  ["trailing comma paste", "https://weidian.com/item.html?itemID=4432567890,"],
  ["space-broken url", "https://wei dian.co m/item.html?itemID=4432567890"],
  ["old.reddit haul", "https://old.reddit.com/r/FashionReps/comments/xyz789/10kg_haul/"],
  ["google sheets haul", "https://docs.google.com/spreadsheets/d/1AbC/edit"],
];

describe("parser audit", () => {
  it("prints verdicts", () => {
    const rows = [];
    for (const [name, paste] of CASES) {
      const out = parseImport(paste);
      const first = out.candidates[0];
      const unwrapped = unwrapAgentUrl(paste.replace(/^<|>$/g, ""));
      rows.push({
        case: name,
        provider: out.provider,
        cards: out.candidates.length,
        url: first && first.parsed && first.parsed.url ? first.parsed.url.slice(0, 70) : "(none)",
        title: first ? (first.titleHint || "").slice(0, 34) : "",
        agentUnwrap: unwrapped ? unwrapped.url.slice(0, 60) : "",
      });
    }
    for (const r of rows) {
      console.log(
        [
          r.case.padEnd(32),
          ("p:" + r.provider).padEnd(14),
          ("n:" + r.cards).padEnd(5),
          r.url.padEnd(72),
          ("t:" + r.title).padEnd(38),
          r.agentUnwrap ? "→ " + r.agentUnwrap : "",
        ].join("")
      );
    }
  });
});

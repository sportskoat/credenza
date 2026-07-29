// ACBuy product-link shape probe (2026-07-28). Load candidate shapes for a
// real Weidian item in a headed-capable browser and report what renders.
import { chromium } from "playwright";

const ID = "7800400500"; // real Weidian item used in the 2026-07-24 agent probes
const CANDIDATES = [
  `https://www.acbuy.com/product/?id=${ID}&shop_type=weidian`,
  `https://www.acbuy.com/product/?id=${ID}&platform=WEIDIAN`,
  `https://www.acbuy.com/product/2/${ID}`,
  `https://www.acbuy.com/en/page/buy?url=${encodeURIComponent(`https://weidian.com/item.html?itemID=${ID}`)}`,
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const url of CANDIDATES) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
    const finalUrl = page.url();
    const text = (await page.evaluate(() => document.body.innerText || "")).slice(0, 6000);
    const hasPrice = /¥|CNY|\$\s?\d|price/i.test(text);
    const hasId = text.includes(ID);
    const dumpedHome = /Enter Product Name|Shop on TaoBao by acbuy\s*Home/i.test(text) && !hasId;
    console.log("== " + url);
    console.log("   final: " + finalUrl);
    console.log("   price-marker: " + hasPrice + " | item-id-on-page: " + hasId + " | looks-like-homepage: " + dumpedHome);
    console.log("   first 200 chars: " + JSON.stringify(text.slice(0, 200)));
  } catch (e) {
    console.log("== " + url + "\n   ERROR: " + e.message.split("\n")[0]);
  }
}
await browser.close();

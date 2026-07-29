import { chromium } from "playwright";
const ID = "7800400500";
const CANDIDATES = [
  `https://usfans.com/product/?id=${ID}&shop_type=weidian`,
  `https://usfans.com/product/?id=${ID}&platform=WEIDIAN`,
  `https://usfans.com/product/2/${ID}`,
  `https://www.usfans.com/en/page/buy?url=${encodeURIComponent(`https://weidian.com/item.html?itemID=${ID}`)}`,
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const url of CANDIDATES) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
    const finalUrl = page.url();
    const text = (await page.evaluate(() => document.body.innerText || "")).slice(0, 6000);
    console.log("== " + url);
    console.log("   final: " + finalUrl);
    console.log("   item-id-on-page: " + text.includes(ID));
    console.log("   first 160 chars: " + JSON.stringify(text.slice(0, 160)));
  } catch (e) {
    console.log("== " + url + "\n   ERROR: " + e.message.split("\n")[0]);
  }
}
await browser.close();

import { chromium } from "playwright";
const WD = "7800400500";   // real Weidian
const TB = "856801351597"; // real Taobao
const CANDIDATES = [
  [`https://usfans.com/product/1/${TB}`, "numeric 1 + taobao"],
  [`https://usfans.com/product/2/${WD}`, "numeric 2 + weidian (longer wait)"],
  [`https://usfans.com/product/3/${WD}`, "numeric 3 + weidian"],
  [`https://usfans.com/product/weidian/${WD}`, "word platform + weidian"],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [url, label] of CANDIDATES) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(9000);
    const finalUrl = page.url();
    const text = (await page.evaluate(() => document.body.innerText || "")).slice(0, 6000);
    console.log("== " + label + " :: " + url);
    console.log("   final: " + finalUrl);
    console.log("   id-on-page: " + (text.includes(WD) || text.includes(TB)) + " | price: " + /¥|\$\s?\d{2}/.test(text));
    console.log("   " + JSON.stringify(text.slice(0, 220)));
  } catch (e) {
    console.log("== " + label + "\n   ERROR: " + e.message.split("\n")[0]);
  }
}
await browser.close();

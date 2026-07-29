import { chromium } from "playwright";
const TB = "856801351597";
const A1688 = "712345678901";
const CANDIDATES = [
  [`https://usfans.com/product/1/${TB}`, "code 1 + taobao"],
  [`https://usfans.com/product/2/${TB}`, "code 2 + taobao"],
  [`https://usfans.com/product/1/${A1688}`, "code 1 + 1688"],
  [`https://usfans.com/product/4/${A1688}`, "code 4 + 1688"],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [url, label] of CANDIDATES) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);
    const finalUrl = page.url();
    const text = (await page.evaluate(() => document.body.innerText || "")).slice(0, 6000);
    const product = /Visit Store|Product details/.test(text);
    console.log("== " + label + " :: final=" + finalUrl + " product-page=" + product);
    if (product) console.log("   " + JSON.stringify(text.slice(0, 200)));
  } catch (e) {
    console.log("== " + label + "\n   ERROR: " + e.message.split("\n")[0]);
  }
}
await browser.close();

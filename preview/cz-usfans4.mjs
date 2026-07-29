import { chromium } from "playwright";
const TB = "856801351597";
const CANDIDATES = [
  [`https://usfans.com/product/5/${TB}`, "code 5 + taobao"],
  [`https://usfans.com/product/6/${TB}`, "code 6 + taobao"],
  [`https://usfans.com/product/7/${TB}`, "code 7 + taobao"],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [url, label] of CANDIDATES) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);
    const finalUrl = page.url();
    const text = (await page.evaluate(() => document.body.innerText || "")).slice(0, 4000);
    const product = /Visit Store|Product details/.test(text);
    console.log("== " + label + " :: final=" + finalUrl + " product-page=" + product);
    if (product) console.log("   " + JSON.stringify(text.slice(0, 200)));
  } catch (e) {
    console.log("== " + label + "\n   ERROR: " + e.message.split("\n")[0]);
  }
}
await browser.close();

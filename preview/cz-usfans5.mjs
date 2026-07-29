import { chromium } from "playwright";
const TB = "856801351597";
const browser = await chromium.launch();
const page = await browser.newPage();
for (const code of ["5", "6"]) {
  const url = `https://usfans.com/product/${code}/${TB}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(8000);
  const text = (await page.evaluate(() => document.body.innerText || "")).slice(0, 8000);
  const platformLine = /taobao|tmall|weidian|1688/i.exec(text);
  // grab the product title area
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleIdx = lines.findIndex((l) => /[一-鿿]|\w{4,} \w{4,}/.test(l) && l.length > 15);
  console.log("== code " + code + " platform-word: " + (platformLine && platformLine[0]));
  console.log("   lines 4-14: " + JSON.stringify(lines.slice(4, 14)));
}
await browser.close();

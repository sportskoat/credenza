// Quick state check for Kyle's "what happened here": fresh grid + carousel
// screenshots with the current code, dark theme.
import { chromium } from "/Users/kylewensel/credenza/preview/node_modules/playwright-core/index.mjs";
import fs from "node:fs";

const OUT = "/Users/kylewensel/.buzz/.scratch/scrim2";

const seed = `(() => {
  if (!location.host.includes("5173")) return;
  try {
    const c = document.createElement("canvas");
    c.width = 480; c.height = 600;
    const g = c.getContext("2d");
    const img = g.createImageData(480, 600);
    let s = 1234567;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = rnd() * 255; img.data[i + 1] = rnd() * 255;
      img.data[i + 2] = rnd() * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const noise = c.toDataURL("image/png");
    const now = Date.now();
    localStorage.setItem("credenza-fashion-items-v1", JSON.stringify([
      { id: "scrim-photo", title: "Vintage varsity jacket", type: "link",
        url: "https://weidian.com/item.html?itemID=12345", host: "weidian.com",
        image: noise, priceUsd: 45, currency: "USD", size: "M",
        seller: "testshop", category: "outerwear", importance: "medium",
        createdAt: now, updatedAt: now },
      { id: "scrim-nophoto", title: "Canvas tote bag", type: "link",
        url: "https://weidian.com/item.html?itemID=23456", host: "weidian.com",
        priceUsd: 19, currency: "USD", size: "One size",
        seller: "toteshop", category: "bag", importance: "medium",
        createdAt: now - 1000, updatedAt: now - 1000 },
    ]));
    localStorage.setItem("credenza-prefs-v1", JSON.stringify({
      theme: "rainbow", colorwayVersion: 4, sortMode: "recent",
      shelfFilter: "all", pricePrimary: "USD", measureUnits: "in",
      onboardingDone: true,
    }));
  } catch (e) {}
})();`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(seed);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
await page.waitForSelector(".cz-photo-list-card", { timeout: 15000 });
await page.screenshot({ path: `${OUT}/state-grid.png` });
await page.locator('[aria-label="Carousel view"]').click();
await page.waitForSelector(".cz-carousel-front", { timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/state-carousel.png` });
console.log("console errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();

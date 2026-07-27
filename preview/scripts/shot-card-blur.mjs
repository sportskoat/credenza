// Side-by-side shots for the card backdrop-filter decision. Writes two PNGs so
// the difference can be judged by eye, not only by the numbers in
// probe-card-blur-diff.mjs.
import { chromium } from "playwright";
const items = Array.from({ length: 24 }, (_, i) => ({
  id: "x" + i, title: "Item " + i, url: "https://weidian.com/item.html?itemID=" + i,
  price: 100 + i, currency: "CNY", images: [], addedAt: Date.now() - i * 1000, haul: "Haul " + (i % 4),
}));
const prefs = { viewMode: "cards", sortMode: "recent", theme: "rainbow", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {}, stashMode: "link" };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await ctx.addInitScript(({ shelf, p }) => {
  localStorage.setItem("credenza-fashion-items-v1", shelf);
  localStorage.setItem("credenza-prefs-v1", p);
}, { shelf: JSON.stringify(items), p: JSON.stringify(prefs) });
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page.addStyleTag({ content: "*,*::before,*::after{animation:none !important;transition:none !important}" });
await page.waitForTimeout(400);
await page.screenshot({ path: ".verify-shots/blur-A-shipped.png" });
await page.addStyleTag({ content: '.cz-app[data-fashion="true"] article > div{-webkit-backdrop-filter:none !important;backdrop-filter:none !important}' });
await page.waitForTimeout(400);
await page.screenshot({ path: ".verify-shots/blur-B-removed.png" });
await browser.close();
console.log("wrote .verify-shots/blur-A-shipped.png and blur-B-removed.png");

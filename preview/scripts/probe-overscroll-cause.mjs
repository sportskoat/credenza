import { chromium } from "playwright";
const items = Array.from({ length: 24 }, (_, i) => ({
  id: "x" + i, title: "Item " + i, url: "https://weidian.com/item.html?itemID=" + i,
  price: 100 + i, currency: "CNY", images: [], addedAt: Date.now() - i * 1000, haul: "Test haul",
}));
const prefs = { viewMode: "cards", sortMode: "recent", theme: "rainbow", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {}, stashMode: "link" };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(({ shelf, p }) => {
  localStorage.setItem("credenza-fashion-items-v1", shelf);
  localStorage.setItem("credenza-prefs-v1", p);
}, { shelf: JSON.stringify(items), p: JSON.stringify(prefs) });
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const top = () => page.evaluate(() => document.querySelector(".cz-modal-surface-stacked")?.scrollTop);

await page.click(".cz-avatar"); await page.waitForTimeout(700);
await page.mouse.move(195, 500); await page.mouse.wheel(0, 400); await page.waitForTimeout(300);
console.log("1 as-shipped                     surface.scrollTop =", await top());

await page.evaluate(() => { document.querySelector(".cz-modal-page").style.overscrollBehavior = "auto"; });
await page.mouse.wheel(0, 400); await page.waitForTimeout(300);
console.log("2 page overscroll-behavior:auto  surface.scrollTop =", await top());

await page.evaluate(() => { const p = document.querySelector(".cz-modal-page"); p.style.overscrollBehavior = ""; p.style.overflowY = "visible"; });
await page.mouse.wheel(0, 400); await page.waitForTimeout(300);
console.log("3 page overflow-y:visible        surface.scrollTop =", await top());
await browser.close();

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
await page.click(".cz-avatar");
await page.waitForTimeout(700);

// which element does the browser pick as the scroller under the finger?
console.log(await page.evaluate(() => {
  const el = document.elementFromPoint(195, 600);
  const chain = [];
  let n = el;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    chain.push(`${n.className || n.tagName} ov=${cs.overflowY} ch=${n.clientHeight} sh=${n.scrollHeight} scrollable=${n.scrollHeight > n.clientHeight && /auto|scroll/.test(cs.overflowY)}`);
    n = n.parentElement;
  }
  return "CHAIN under (195,600):\n  " + chain.join("\n  ");
}));
await page.mouse.wheel(0, 400);
await page.waitForTimeout(400);
console.log("after wheel:", await page.evaluate(() => {
  const s = document.querySelector(".cz-modal-surface-stacked, .cz-modal-surface");
  const p = document.querySelector(".cz-modal-page");
  return JSON.stringify({ surface: s?.scrollTop, page: p?.scrollTop });
}));
await browser.close();

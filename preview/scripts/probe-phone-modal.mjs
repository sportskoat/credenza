import { chromium } from "playwright";
const items = Array.from({ length: 24 }, (_, i) => ({
  id: "x" + i, title: "Item " + i, url: "https://weidian.com/item.html?itemID=" + i,
  price: 100 + i, currency: "CNY", images: [], addedAt: Date.now() - i * 1000, haul: "Test haul",
}));
const prefs = { viewMode: "cards", sortMode: "recent", theme: "rainbow", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {}, stashMode: "link" };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
await ctx.addInitScript(({ shelf, p }) => {
  localStorage.setItem("credenza-fashion-items-v1", shelf);
  localStorage.setItem("credenza-prefs-v1", p);
}, { shelf: JSON.stringify(items), p: JSON.stringify(prefs) });
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

await page.click(".cz-avatar");
await page.waitForTimeout(700);
console.log("PROFILE:", await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const r = (e) => e ? { ch: e.clientHeight, sh: e.scrollHeight, ov: getComputedStyle(e).overflowY, top: Math.round(e.getBoundingClientRect().top), bot: Math.round(e.getBoundingClientRect().bottom) } : null;
  return JSON.stringify({ dialog: r(q(".cz-modal")), surface: r(q(".cz-modal-surface-stacked")) || r(q(".cz-modal-surface")), stack: r(q(".cz-modal-stack")), page: r(q(".cz-modal-page")), vh: innerHeight });
}));
// touch drag upward inside the sheet
const before = await page.evaluate(() => { const s = document.querySelector(".cz-modal-surface-stacked, .cz-modal-surface"); return s ? s.scrollTop : -1; });
await page.touchscreen.tap(195, 600);
await page.mouse.move(195, 700); await page.mouse.down();
for (let y = 700; y > 300; y -= 40) { await page.mouse.move(195, y); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(500);
const after = await page.evaluate(() => { const s = document.querySelector(".cz-modal-surface-stacked, .cz-modal-surface"); return s ? s.scrollTop : -1; });
console.log("surface scrollTop before/after drag:", before, after);
await page.screenshot({ path: ".verify-shots/phone-profile.png" });
await browser.close();

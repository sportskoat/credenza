// Confirm the cause: .cz-shell has margin-inline:auto inside a column flex
// .cz-app on phones, so it sizes to its content instead of the screen.
import { webkit } from "playwright";
const baseUrl = process.argv[2] || "https://credenzafashion.com";
const now = Date.now();
const mk = (i) => ({ id: "p" + i, createdAt: now - i * 1000, updatedAt: now - i * 1000,
  url: "https://weidian.com/item.html?itemID=78121241" + i, title: i % 2 ? "M33821-133E Heavy-Weight Casual T-Shirt Long Title" : "Short Tee",
  image: "https://picsum.photos/seed/cz" + i + "/600/800", gallery: [], links: [], price: 179 + i, currency: "CNY",
  seller: "mook", category: "shirt", size: "L", colorway: "White", weightGrams: 420,
  project: i % 3 === 0 ? "casuals" : "winter", findStatus: "want" });
const items = Array.from({ length: 8 }, (_, i) => mk(i + 1));
const prefs = { viewMode: "grid", sortMode: "recent", colorwayVersion: 4, preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" }, measureUnits: "in", onboardingDone: true, theme: "rainbow" };
const browser = await webkit.launch();
const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(({ s, p }) => { localStorage.setItem("credenza-fashion-items-v1", s); localStorage.setItem("credenza-prefs-v1", p); }, { s: JSON.stringify(items), p: JSON.stringify(prefs) });
const page = await ctx.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);
const w = () => page.evaluate(() => { const n = document.querySelector(".cz-shell"); const r = n.getBoundingClientRect(); return { left: Math.round(r.left), w: Math.round(r.width) }; });
console.log("shelf, before fix:", JSON.stringify(await w()));
await page.locator('button, [role="tab"], a').filter({ hasText: /^Hauls/ }).first().click({ force: true });
await page.waitForTimeout(2000);
console.log("hauls, before fix:", JSON.stringify(await w()));
await page.screenshot({ path: ".verify-shots/p4-hauls-before.png" });
await page.addStyleTag({ content: "@media (max-width: 767px){ .cz-app[data-fashion=\"true\"] > .cz-shell { width: 100%; } }" });
await page.waitForTimeout(800);
console.log("hauls, after fix:", JSON.stringify(await w()));
await page.screenshot({ path: ".verify-shots/p4-hauls-after.png" });
await page.locator('button, [role="tab"], a').filter({ hasText: /^Shelf/ }).first().click({ force: true });
await page.waitForTimeout(1800);
console.log("shelf, after fix:", JSON.stringify(await w()));
await page.screenshot({ path: ".verify-shots/p4-shelf-after.png" });
await browser.close();

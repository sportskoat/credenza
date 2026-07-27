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
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const bodyOverflow = () => page.evaluate(() => document.body.style.overflow || "(empty)");
const scrollY = () => page.evaluate(() => window.scrollY);

console.log("baseline body.overflow:", await bodyOverflow());
await page.mouse.wheel(0, 600);
await page.waitForTimeout(400);
console.log("baseline scrollY after wheel:", await scrollY());
await page.evaluate(() => window.scrollTo(0, 0));

// Open profile, then open a sub-page, then close. Check the lock unwinds.
await page.getByRole("button", { name: "Profile" }).first().click({ force: true });
await page.waitForTimeout(700);
console.log("profile open -> body.overflow:", await bodyOverflow());
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
console.log("profile closed -> body.overflow:", await bodyOverflow());
await page.mouse.wheel(0, 600);
await page.waitForTimeout(400);
console.log("scrollY after close+wheel:", await scrollY());

// Now the nested case: open profile, open the settings sheet path (two locks).
await page.evaluate(() => window.scrollTo(0, 0));
await page.getByRole("button", { name: "Settings" }).first().click({ force: true });
await page.waitForTimeout(600);
console.log("settings open -> body.overflow:", await bodyOverflow());
await page.getByRole("button", { name: /Your sizes/ }).first().click({ force: true }).catch(() => console.log("no sizes row"));
await page.waitForTimeout(700);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
console.log("settings closed -> body.overflow:", await bodyOverflow());
await page.mouse.wheel(0, 600);
await page.waitForTimeout(400);
console.log("FINAL scrollY after wheel:", await scrollY());
await browser.close();

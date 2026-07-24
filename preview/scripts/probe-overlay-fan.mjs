// Overlay probe: light theme, grid card tap, check fan vs Buy stacking.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });
const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);
const prefs = {
  viewMode: "cards", sortMode: "recent", theme: "light", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {},
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(
  ({ shelfJson, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelfJson: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.getByLabel("Search your shelf").first().fill("VEILANCE");
await page.waitForTimeout(1200);

// Tap the grid card photo to open the solo overlay.
await page.locator(".cz-card-toggle").first().click({ force: true });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(outDir, "probe-overlay-front.png") });

// Is there a flip affordance in the overlay?
const overlayState = await page.evaluate(() => {
  const overlay = document.querySelector(".cz-carousel-overlay");
  if (!overlay) return { overlay: false };
  return {
    overlay: true,
    flip: !!overlay.querySelector("[class*=flip], [aria-label*=lip]"),
    back: !!overlay.querySelector(".cz-carousel-back-content"),
    fan: !!overlay.querySelector(".cz-corner-fan"),
    buy: !!overlay.querySelector(".cz-sheet-buy"),
  };
});
console.log("overlay:", JSON.stringify(overlayState));

// Flip if a flip control exists; then hover the fan and measure stacking.
if (overlayState.flip) {
  await page.locator(".cz-carousel-overlay [aria-label*=lip i]").first().click({ force: true });
  await page.waitForTimeout(1200);
}
const fan = page.locator(".cz-carousel-overlay .cz-corner-fan");
if (await fan.count()) {
  await fan.hover({ force: true });
  await page.waitForTimeout(800);
}
const stack = await page.evaluate(() => {
  const overlay = document.querySelector(".cz-carousel-overlay");
  if (!overlay) return null;
  const buy = overlay.querySelector(".cz-sheet-buy");
  const fanEl = overlay.querySelector(".cz-corner-fan");
  if (!buy || !fanEl) return { buy: !!buy, fan: !!fanEl };
  const buyBox = buy.getBoundingClientRect();
  const fanBox = fanEl.getBoundingClientRect();
  // Sample points across the Buy row; what paints on top?
  const hits = [];
  for (let f = 0.1; f < 1; f += 0.2) {
    const x = Math.round(buyBox.left + buyBox.width * f);
    const y = Math.round(buyBox.top + 12);
    const el = document.elementFromPoint(x, y);
    hits.push(el ? (el.className.toString() || el.tagName).slice(0, 40) : "none");
  }
  return {
    buyZ: getComputedStyle(buy).zIndex,
    overlap: !(fanBox.bottom <= buyBox.top || fanBox.top >= buyBox.bottom),
    fanBottom: Math.round(fanBox.bottom),
    buyTop: Math.round(buyBox.top),
    hits,
  };
});
console.log("stack:", JSON.stringify(stack));
await page.screenshot({ path: join(outDir, "probe-overlay-back.png") });
await browser.close();

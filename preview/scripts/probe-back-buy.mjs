// Card-back probe: Buy pinned + visible without scrolling, fade at scroll edge.
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
  viewMode: "cards", sortMode: "recent", theme: "dark", colorwayVersion: 4,
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

await page.getByText("FLIP FOR MORE").first().click({ force: true, timeout: 5000 });
await page.waitForTimeout(1400);

const state = await page.evaluate(() => {
  const back = document.querySelector(".cz-carousel-back-content");
  const buy = back && back.querySelector(".cz-sheet-buy .cz-buy-btn");
  if (!back || !buy) return { found: false };
  const backBox = back.getBoundingClientRect();
  const buyBox = buy.getBoundingClientRect();
  return {
    found: true,
    scrollable: back.scrollHeight > back.clientHeight + 8,
    buyVisibleNoScroll: buyBox.bottom <= backBox.bottom + 1 && buyBox.top >= backBox.top,
    buyBottomGap: Math.round(backBox.bottom - buyBox.bottom),
    atEndClass: back.classList.contains("is-at-end"),
  };
});
console.log("no scroll:", JSON.stringify(state));
await page.screenshot({ path: join(outDir, "probe-back-buy-pinned.png") });

// Scroll to the end: fade must drop, Buy still visible.
await page.evaluate(() => {
  const back = document.querySelector(".cz-carousel-back-content");
  back.scrollTop = back.scrollHeight;
});
await page.waitForTimeout(500);
const endState = await page.evaluate(() => {
  const back = document.querySelector(".cz-carousel-back-content");
  const buy = back.querySelector(".cz-sheet-buy .cz-buy-btn");
  const backBox = back.getBoundingClientRect();
  const buyBox = buy.getBoundingClientRect();
  return {
    atEndClass: back.classList.contains("is-at-end"),
    buyVisible: buyBox.bottom <= backBox.bottom + 1,
  };
});
console.log("scrolled to end:", JSON.stringify(endState));
await page.screenshot({ path: join(outDir, "probe-back-buy-end.png") });
await browser.close();

// Overlap probe: does the photo fan paint over the sticky Buy row?
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
  viewMode: "carousel", sortMode: "recent", theme: "dark", colorwayVersion: 4,
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

// Navigate the carousel to the P385 card (title search), then flip it.
await page.getByLabel("Search your shelf").first().fill("VEILANCE");
await page.waitForTimeout(1200);
await page.getByText("FLIP FOR MORE").first().click({ force: true, timeout: 5000 });
await page.waitForTimeout(1400);

// Scroll the back content so the fan slides under the sticky Buy row.
await page.evaluate(() => {
  const back = document.querySelector(".cz-carousel-back-content");
  if (back) back.scrollTop = back.scrollHeight;
});
await page.waitForTimeout(600);

const state = await page.evaluate(() => {
  const back = document.querySelector(".cz-carousel-back-content");
  const buy = back && back.querySelector(".cz-sheet-buy");
  if (!back || !buy) return { found: false };
  const buyBox = buy.getBoundingClientRect();
  // What paints at the center of the Buy button?
  const cx = Math.round(buyBox.left + buyBox.width / 2);
  const cy = Math.round(buyBox.top + buyBox.height / 2);
  const topEl = document.elementFromPoint(cx, cy);
  const fan = back.querySelector(".cz-corner-fan");
  const fanBox = fan ? fan.getBoundingClientRect() : null;
  const buyZ = getComputedStyle(buy).zIndex;
  let fanMaxZ = 0;
  back.querySelectorAll(".cz-corner-fan-card").forEach((c) => {
    fanMaxZ = Math.max(fanMaxZ, Number(getComputedStyle(c).zIndex) || 0);
  });
  return {
    found: true,
    topElement: topEl ? topEl.className.toString().slice(0, 60) : null,
    buyZ,
    fanMaxZ,
    overlap: fanBox
      ? !(fanBox.bottom <= buyBox.top || fanBox.top >= buyBox.bottom)
      : false,
    fanBottom: fanBox ? Math.round(fanBox.bottom) : null,
    buyTop: Math.round(buyBox.top),
  };
});
console.log(JSON.stringify(state));
await page.screenshot({ path: join(outDir, "probe-fan-over-buy.png") });
await browser.close();

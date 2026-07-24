// Overlap probe 2: scroll until the fan sits under the sticky Buy; hover it.
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
await page.getByLabel("Search your shelf").first().fill("VEILANCE");
await page.waitForTimeout(1200);
await page.getByText("FLIP FOR MORE").first().click({ force: true, timeout: 5000 });
await page.waitForTimeout(1400);

// Scan scroll positions; report what paints over the Buy center at each step.
const results = await page.evaluate(() => {
  const back = document.querySelector(".cz-carousel-back-content");
  const buy = back.querySelector(".cz-sheet-buy");
  const out = [];
  for (let s = 0; s <= back.scrollHeight; s += 40) {
    back.scrollTop = s;
    const buyBox = buy.getBoundingClientRect();
    const cx = Math.round(buyBox.left + buyBox.width / 2);
    const cy = Math.round(buyBox.top + 14); // near the top edge, under the fade
    const el = document.elementFromPoint(cx, cy);
    const cls = el ? el.className.toString() : "";
    if (!cls.includes("cz-sheet-buy") && !cls.includes("cz-buy") && !cls.includes("cz-carousel-actions")) {
      out.push({ scroll: s, top: cls.slice(0, 50) });
    }
  }
  return out;
});
console.log("non-buy paint over Buy:", JSON.stringify(results));

// Position the fan right over the Buy, hover to spread, screenshot.
await page.evaluate(() => {
  const back = document.querySelector(".cz-carousel-back-content");
  const fan = back.querySelector(".cz-corner-fan");
  const buy = back.querySelector(".cz-sheet-buy");
  back.scrollTop = Math.max(
    0,
    fan.offsetTop - (buy.getBoundingClientRect().top - back.getBoundingClientRect().top) + 60
  );
});
await page.waitForTimeout(400);
const fanEl = page.locator(".cz-carousel-back-content .cz-corner-fan");
await fanEl.hover({ force: true });
await page.waitForTimeout(700);
const check = await page.evaluate(() => {
  const back = document.querySelector(".cz-carousel-back-content");
  const buy = back.querySelector(".cz-sheet-buy");
  const buyBox = buy.getBoundingClientRect();
  const cx = Math.round(buyBox.left + buyBox.width / 2);
  const cy = Math.round(buyBox.top + 14);
  const el = document.elementFromPoint(cx, cy);
  return {
    topAtBuyTop: el ? el.className.toString().slice(0, 50) : null,
    buyZ: getComputedStyle(buy).zIndex,
  };
});
console.log("hovered:", JSON.stringify(check));
await page.screenshot({ path: join(outDir, "probe-fan-over-buy2.png") });
await browser.close();

// Focus probe: type into the desk search one char at a time, log activeElement.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
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
    // Track every focus/blur on the desk search input.
    window.__focusLog = [];
    document.addEventListener("focusin", (e) =>
      window.__focusLog.push("focusin: " + e.target.className));
    document.addEventListener("focusout", (e) =>
      window.__focusLog.push("focusout: " + e.target.className));
  },
  { shelfJson: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const field = page.locator(".cz-desk-search-field");
await field.click();
for (const ch of "denim") {
  await page.keyboard.type(ch, { delay: 60 });
  await page.waitForTimeout(150);
  const state = await page.evaluate(() => ({
    active: document.activeElement ? document.activeElement.className : "none",
    value: document.querySelector(".cz-desk-search-field")?.value,
  }));
  console.log(`after "${ch}": active="${state.active}" value="${state.value}"`);
}
console.log("--- focus log ---");
const log = await page.evaluate(() => window.__focusLog);
log.forEach((l) => console.log(l));
await browser.close();

import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const items = JSON.parse(readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8"));
const prefs = { viewMode: "cards", sortMode: "recent", theme: "light", colorwayVersion: 4, preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" }, measureUnits: "cm", onboardingDone: true, fitPrefs: {} };
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices["iPhone 15 Pro"] });
await context.addInitScript(({ shelf, prefsJson }) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  navigator.clipboard.readText = async () => "https://weidian.com/item/7291234567";
  if (navigator.permissions && navigator.permissions.query) {
    const orig = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => d && d.name === "clipboard-read" ? Promise.resolve({ state: "granted" }) : orig(d);
  }
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const bannerVisible = await page.locator(".cz-desk-clip-banner").isVisible().catch(() => false);
console.log("desk banner visible on phone:", bannerVisible);
await page.screenshot({ path: join(".verify-shots", "topbar-phone.png") });
await browser.close();

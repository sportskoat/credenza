import { webkit } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const items = JSON.parse(readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8"));
const prefs = { viewMode: "cards", sortMode: "recent", theme: "light", colorwayVersion: 4, preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" }, measureUnits: "cm", onboardingDone: true, fitPrefs: {} };
const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(({ shelf, prefsJson }) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  navigator.clipboard.readText = async () => "https://de tail.1688.com/offer/940644075601.html";
  if (navigator.permissions && navigator.permissions.query) {
    const orig = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => d && d.name === "clipboard-read" ? Promise.resolve({ state: "granted" }) : orig(d);
  }
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const banner = await page.locator(".cz-desk-clip-banner").innerText().catch(() => "(none)");
console.log("banner:", JSON.stringify(banner));
await page.screenshot({ path: join(".verify-shots", "banner-obfuscated.png") });
await browser.close();

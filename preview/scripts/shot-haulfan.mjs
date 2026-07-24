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
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
await page.getByRole("tab", { name: /Hauls/ }).first().click({ force: true });
await page.waitForTimeout(1200);
const badge = page.locator(".cz-haul-fan-more").first();
if (await badge.count()) {
  const style = await badge.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, background: cs.backgroundColor, text: el.textContent };
  });
  console.log("badge:", JSON.stringify(style));
}
await page.screenshot({ path: join(".verify-shots", "haulfan-badge.png") });
await browser.close();

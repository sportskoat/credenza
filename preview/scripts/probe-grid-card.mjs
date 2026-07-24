// Grid-card probe: validateDOMNesting must be gone; Star/Buy still work.
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
const warnings = [];
page.on("console", (m) => {
  const t = m.text();
  if (/validateDOMNesting|cannot appear as a descendant/i.test(t)) warnings.push(t.slice(0, 120));
});
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// Switch to grid (card) view.
await page.getByLabel("Card view").click({ force: true, timeout: 5000 });
await page.waitForTimeout(1200);

// Hover the first card to reveal the Buy button, then screenshot.
const firstCard = page.locator(".cz-editorial-card").first();
await firstCard.hover();
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, "probe-grid-card-hover.png") });

// Structural check: no button inside a button anywhere on the shelf.
const nested = await page.evaluate(() => {
  let count = 0;
  document.querySelectorAll("button").forEach((b) => {
    if (b.querySelector("button")) count++;
  });
  return count;
});
console.log("buttons containing buttons:", nested, "(expect 0)");

// Star still toggles.
const star = firstCard.locator(".cz-card-favorite");
const before = await star.getAttribute("data-liked");
await star.click({ force: true });
await page.waitForTimeout(400);
const after = await firstCard.locator(".cz-card-favorite").getAttribute("data-liked");
console.log("star data-liked:", before, "->", after, "(expect a flip)");

console.log("validateDOMNesting warnings:", warnings.length ? warnings : "none");
await browser.close();

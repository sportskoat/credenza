// Measure the card-back detail stack gaps.
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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
await page.getByText("FLIP FOR MORE").first().click({ force: true });
await page.waitForTimeout(1500);

const gaps = await page.evaluate(() => {
  const sheet = [...document.querySelectorAll(".cz-product-sheet")]
    .find((el) => el.getBoundingClientRect().height > 0);
  if (!sheet) return null;
  const rows = [];
  let prev = null;
  for (const child of sheet.children) {
    const r = child.getBoundingClientRect();
    if (r.height === 0) continue;
    rows.push({
      cls: child.className.split(" ").slice(0, 2).join("."),
      top: Math.round(r.top),
      h: Math.round(r.height),
      gapFromPrev: prev == null ? 0 : Math.round(r.top - prev),
    });
    prev = r.bottom;
  }
  return rows;
});
console.log(JSON.stringify(gaps, null, 1));
await page.screenshot({ path: join(outDir, "spacing-before.png") });
await browser.close();

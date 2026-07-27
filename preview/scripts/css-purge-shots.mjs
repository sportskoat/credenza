// CSS purge verification (LB-12). Shoots the app at four widths against a
// running dev server, into a labelled directory.
//
// Usage: node scripts/css-purge-shots.mjs <before|after> [baseUrl]
//   default baseUrl: http://localhost:5173
//
// Output: preview/.verify-shots/css-purge-<label>/<width>-<view>.png
//
// Run it once before the purge and once after. Compare the two directories.

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const label = process.argv[2];
if (label !== "before" && label !== "after") {
  console.error("Usage: node scripts/css-purge-shots.mjs <before|after> [baseUrl]");
  process.exit(1);
}
const baseUrl = process.argv[3] || "http://localhost:5173";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots", `css-purge-${label}`);
mkdirSync(outDir, { recursive: true });

const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);

const WIDTHS = [390, 768, 1024, 1280];
const browser = await chromium.launch();
const problems = [];

for (const width of WIDTHS) {
  // Grid and cards are separate layouts, so shoot both at every width.
  for (const viewMode of ["cards", "grid"]) {
    const prefs = {
      viewMode,
      sortMode: "recent",
      theme: "dark",
      colorwayVersion: 4,
      preferredAgent: null,
      affiliateCodes: {},
      bodyProfile: { usualSize: "L" },
      measureUnits: "cm",
      onboardingDone: true,
      fitPrefs: {},
    };
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript(
      ({ shelfJson, prefsJson }) => {
        window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
        window.localStorage.setItem("credenza-prefs-v1", prefsJson);
      },
      { shelfJson: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
    );
    const page = await ctx.newPage();
    page.on("pageerror", (err) => problems.push(`${width}/${viewMode}: ${err.message}`));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: join(outDir, `${width}-${viewMode}.png`),
      fullPage: false,
    });
    await ctx.close();
    console.log(`shot ${width} ${viewMode}`);
  }
}

await browser.close();
if (problems.length) {
  console.log("PAGE ERRORS:");
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log(`OK — shots in ${outDir}`);

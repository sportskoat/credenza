// Zero-result search probe: "0 found" must stand alone — no Total chip.
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

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(
  (shelfJson) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
    window.localStorage.setItem(
      "credenza-prefs-v1",
      JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
    );
  },
  JSON.stringify(items)
);
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByLabel("Search your shelf").first().fill("qxvjqwv");
await page.waitForTimeout(1000);
const m = await page.evaluate(() => {
  const row = document.querySelector(".cz-total-row");
  return {
    rowVisible: !!row,
    count: row && row.querySelector(".cz-total-count")?.textContent,
    totalChipPresent: !!(row && row.querySelector(".cz-total-chip")),
  };
});
console.log(JSON.stringify(m));
await page.screenshot({ path: join(outDir, "probe-zero-search.png") });
await browser.close();

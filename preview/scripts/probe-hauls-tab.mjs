// Hauls-tab probe: directory shows no shelf stats row; open haul shows haul text.
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
// Give one item a haul name so the directory has a haul to open.
if (items[0]) items[0].project = "Summer Haul";
if (items[1]) items[1].project = "Summer Haul";
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
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// 1. Hauls tab, directory state.
await page.getByRole("tab", { name: /Hauls/ }).click({ force: true });
await page.waitForTimeout(1200);
const directory = await page.evaluate(() => {
  const row = document.querySelector(".cz-total-row");
  return {
    statsRowPresent: !!row,
    statsText: row ? row.textContent.trim() : null,
    togglesPresent: !!document.querySelector(".cz-toolbar-end"),
    headText: (document.querySelector(".cz-hauls-sub") || {}).textContent || null,
  };
});
console.log("directory:", JSON.stringify(directory));
await page.screenshot({ path: join(outDir, "probe-hauls-directory.png") });

// 2. Open the haul.
await page.locator(".cz-haul-card").first().click({ force: true });
await page.waitForTimeout(1500);
const open = await page.evaluate(() => {
  const row = document.querySelector(".cz-total-row");
  return {
    statsRowPresent: !!row,
    statsText: row ? row.textContent.replace(/\s+/g, " ").trim() : null,
    togglesPresent: !!document.querySelector(".cz-toolbar-end"),
  };
});
console.log("open haul:", JSON.stringify(open));
await page.screenshot({ path: join(outDir, "probe-hauls-open.png") });
await browser.close();

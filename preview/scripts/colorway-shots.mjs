// Colorway verification shots — Gallery (light) + Blackout (dark) on
// mobile (iPhone WebKit) and desktop (1440x900 WebKit) against a local build.
// Usage: node scripts/colorway-shots.mjs [baseUrl]
import { webkit, devices } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "docs", "mobile-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";
const backupPath = join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json");
const shelfJson = readFileSync(backupPath, "utf8");

const browser = await webkit.launch();

async function shoot(name, theme, contextOpts) {
  const context = await browser.newContext(contextOpts);
  await context.addInitScript(
    ({ json, theme }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", json);
      window.localStorage.setItem(
        "credenza-prefs-v1",
        JSON.stringify({ theme, colorwayVersion: 4 })
      );
    },
    { json: shelfJson, theme }
  );
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log(`PAGE ERROR [${name}]:`, err.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(outDir, name) });
  console.log("shot:", name);
  await context.close();
}

await shoot("colorway-gallery-mobile.png", "light", { ...devices["iPhone 15 Pro"] });
await shoot("colorway-blackout-mobile.png", "rainbow", { ...devices["iPhone 15 Pro"] });
await shoot("colorway-gallery-desktop.png", "light", { viewport: { width: 1440, height: 900 } });
await shoot("colorway-blackout-desktop.png", "rainbow", { viewport: { width: 1440, height: 900 } });

await browser.close();

import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });
const baseUrl = process.argv[2] || "http://localhost:4173";

const browser = await chromium.launch();
const context = await browser.newContext(devices["iPhone 15 Pro"]);
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);

const skip = page.getByRole("button", { name: /get started/i }).first();
if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(800); }

// 1. Try a sample shelf
const sample = page.getByText(/try a sample shelf/i).first();
if (await sample.isVisible().catch(() => false)) {
  await sample.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(outDir, "fra-1-sample-shelf.png") });
  console.log("shot: fra-1-sample-shelf");
} else console.log("NO SAMPLE LINK");

// Reset for the import check
await page.evaluate(() => window.localStorage.clear());
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);
const skip2 = page.getByRole("button", { name: /get started/i }).first();
if (await skip2.isVisible().catch(() => false)) { await skip2.click(); await page.waitForTimeout(800); }

// 2. Import a haul
const imp = page.getByText(/import a haul/i).first();
if (await imp.isVisible().catch(() => false)) {
  await imp.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(outDir, "fra-2-import-haul.png") });
  console.log("shot: fra-2-import-haul");
} else console.log("NO IMPORT LINK");

await browser.close();
console.log("done");

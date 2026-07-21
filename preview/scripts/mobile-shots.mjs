// Mobile screenshot harness — WebKit (Safari engine) + iPhone emulation.
// Seeds the shelf from a backup export so shots show the REAL shelf.
//
// Usage: node scripts/mobile-shots.mjs [baseUrl] [backupJsonPath]
//   defaults: https://credenza-kyle.netlify.app, ~/Downloads/credenza-shelf-2026-07-21.json
//
// Output: ../docs/mobile-shots/*.png

import { webkit, devices } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "docs", "mobile-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "https://credenza-kyle.netlify.app";
const backupPath =
  process.argv[3] || join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json");

const shelfJson = readFileSync(backupPath, "utf8");
const items = JSON.parse(shelfJson);
console.log(`Seeding ${items.length} shelf items from ${backupPath}`);

const browser = await webkit.launch();
const context = await browser.newContext({
  ...devices["iPhone 15 Pro"],
});
await context.addInitScript((json) => {
  window.localStorage.setItem("credenza-fashion-items-v1", json);
}, shelfJson);

const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
// Let the shelf render + images settle (networkidle is flaky with image CDNs,
// so use a fixed settle window on top of load).
await page.waitForTimeout(3500);

const shot = (name) =>
  page.screenshot({ path: join(outDir, name) }).then(() => console.log("shot:", name));

// 1. First-run default view (no prefs seeded) — must be the grid on mobile.
await shot("01-first-run-default.png");

// 2. Scrolled grid — more cards, haul cover fans.
await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
await page.waitForTimeout(1200);
await shot("02-grid-scrolled.png");

// 3. Carousel view (opt-in on mobile).
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
const carouselBtn = page.getByRole("button", { name: "Carousel view" });
if (await carouselBtn.count()) {
  await carouselBtn.first().click({ force: true });
  await page.waitForTimeout(2000);
  await shot("03-carousel.png");
} else {
  console.log("carousel toggle not found");
}

// 4. Back to grid, then Import sheet (bottom-sheet check).
const cardBtn = page.getByRole("button", { name: "Card view" });
if (await cardBtn.count()) await cardBtn.first().click({ force: true });
await page.waitForTimeout(800);
const importBtn = page.getByRole("button", { name: "Import", exact: true });
if (await importBtn.count()) {
  await importBtn.first().click({ force: true });
  await page.waitForTimeout(1200);
  await shot("04-import-sheet.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
} else {
  console.log("import button not found");
}

// 5. Agent sheet (bottom-sheet + picker on mobile).
const agentBtn = page.getByRole("button", { name: /^Agent:/ });
if (await agentBtn.count()) {
  await agentBtn.first().click({ force: true });
  await page.waitForTimeout(1200);
  await shot("05-agent-sheet.png");
} else {
  console.log("agent pill not found");
}

await browser.close();
console.log("done ->", outDir);

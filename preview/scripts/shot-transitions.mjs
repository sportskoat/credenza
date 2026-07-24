// Screenshot audit: card back detail stack + animated dropdowns.
import { webkit } from "playwright";
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
  viewMode: "cards",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L" },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
};

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

// Open the first card's overlay (grid tap) → card back with detail stack.
await page.locator(".cz-shelf-grid > div").first().click({ force: true });
await page.waitForTimeout(1800);
await page.screenshot({ path: join(outDir, "trans-back-resting.png") });

// Open the status dropdown → mid-animation + settled.
const track = page.locator(".cz-status-track-btn").first();
if (await track.count()) {
  await track.click({ force: true });
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(outDir, "trans-status-mid.png") });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, "trans-status-open.png") });
  // verify: options visible and clickable
  const opt = page.locator(".cz-status-picker-option").first();
  console.log("status options visible:", await opt.count());
  await track.click({ force: true });
  await page.waitForTimeout(500);
  console.log("picker height after close:",
    await page.locator(".cz-status-stage .t-acc-panel").first().evaluate((el) => el.getBoundingClientRect().height));
}

// Category dropdown.
const catRow = page.locator(".cz-cat-select-row").first();
if (await catRow.count()) {
  await catRow.click({ force: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, "trans-cat-open.png") });
  console.log("cat chips visible:", await page.locator(".cz-cat-select-chip").count());
  await catRow.click({ force: true });
  await page.waitForTimeout(500);
}

// Shimmer check: computed styles on the AI size line.
const shimmer = await page.evaluate(() => {
  const el = document.querySelector(".cz-front-size-text.is-rec.t-shimmer");
  if (!el) return null;
  const cs = getComputedStyle(el);
  const before = getComputedStyle(el, "::before");
  return { color: cs.color, anim: before.animationName, dataText: el.getAttribute("data-text"), text: el.textContent };
});
console.log("front shimmer:", JSON.stringify(shimmer));

await browser.close();

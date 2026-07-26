// Solo overlay probe (2026-07-25): grid → tap card → overlay. Then Space
// must flip the card. Dumps the flipped state after each key press.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });
const baseUrl = process.argv[2] || "http://localhost:4173";

const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json"), "utf8")
);
const prefs = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "rainbow",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: null,
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ shelf, p }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", p);
  },
  { shelf: JSON.stringify(items), p: JSON.stringify(prefs) }
);
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);

const state = async (label) => {
  const s = await page.evaluate(() => {
    const overlay = document.querySelector(".cz-carousel-overlay");
    const flipped = document.querySelectorAll(".cz-carousel-card-inner.is-flipped").length;
    const card = document.querySelector(".cz-carousel-overlay .cz-carousel-card");
    const rect = card ? card.getBoundingClientRect() : null;
    return {
      overlayOpen: !!overlay,
      flippedCards: flipped,
      cardSize: rect ? Math.round(rect.width) + "x" + Math.round(rect.height) : null,
    };
  });
  console.log(label, JSON.stringify(s));
  return s;
};

// Switch to the grid ("cards") view — desktop defaults to carousel.
await page.getByRole("button", { name: "Card view" }).click();
await page.waitForTimeout(900);

// Tap the first grid card.
await page.locator("main img").first().click();
await page.waitForTimeout(1200);
await state("after tap:");
await page.screenshot({ path: join(outDir, "so-1-overlay.png") });
console.log("shot: so-1-overlay");

// Space must flip.
await page.keyboard.press(" ");
await page.waitForTimeout(900);
await state("after space 1:");
await page.screenshot({ path: join(outDir, "so-2-space.png") });
console.log("shot: so-2-space");

// Space again — what happens?
await page.keyboard.press(" ");
await page.waitForTimeout(900);
await state("after space 2:");

await browser.close();
console.log("done");

// Repro: entering carousel view must NOT flip the first card.
import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);
const prefs = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "rainbow",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 96, height: 178, weight: 75 },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
};

const browser = await webkit.launch();
const context = await browser.newContext({ ...devices["iPhone 15 Pro"] });
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

// Switch to carousel view.
await page.getByRole("button", { name: "Carousel view" }).first().click({ force: true });
await page.waitForTimeout(1500);

async function flipState(label) {
  const state = await page.evaluate(() => {
    const backs = [...document.querySelectorAll(".cz-carousel-back")].map((el) =>
      getComputedStyle(el).visibility
    );
    return { anyBackVisible: backs.includes("visible") };
  });
  console.log(label, JSON.stringify(state));
}

await flipState("entry:");

// Flip the center card (tap it), then leave to Card view, then come back.
await page.locator(".cz-carousel-card").first().click({ force: true });
await page.waitForTimeout(1200);
await flipState("after tap:");
// Tap the back face's inert area to unflip? No — leave flipped, switch views.
await page.getByRole("button", { name: "Card view" }).first().click({ force: true });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Carousel view" }).first().click({ force: true });
await page.waitForTimeout(1500);
await flipState("re-entry:");

// His screen: Starred filter on, then enter carousel.
await page.getByRole("button", { name: "Card view" }).first().click({ force: true });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Show starred only" }).first().click({ force: true });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Carousel view" }).first().click({ force: true });
await page.waitForTimeout(1500);
await flipState("starred-entry:");

// The real trigger: Space-flip a card (sets a persistent flipRequest), leave
// to Card view, re-enter. Before the fix the card remounted flipped.
await page.getByRole("button", { name: "Carousel view" }).first().click({ force: true });
await page.waitForTimeout(1200);
await page.keyboard.press(" ");
await page.waitForTimeout(900);
await flipState("after space:");
await page.getByRole("button", { name: "Card view" }).first().click({ force: true });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Carousel view" }).first().click({ force: true });
await page.waitForTimeout(1500);
await flipState("after stale-signal re-entry:");

await page.screenshot({ path: join(".verify-shots", "repro-carousel-entry.png") });
await browser.close();

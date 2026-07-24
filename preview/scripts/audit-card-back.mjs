// One-off: capture the current card back (fit + status) on phone + desktop.
// Seeds the real shelf PLUS a synthetic shorts item with a size chart, so the
// precise-fit (4g) and preference-payoff (5c) blocks render.
import { webkit, devices } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:5173";
const mode = process.argv[3] || "pref"; // "pref" = 5c payoff, "plain" = 4g
const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);

const chartText = [
  "Size chart (cm)",
  "Size  Waist  Hip  Length",
  "S  76  100  45",
  "M  80  104  46",
  "L  84  108  47",
  "XL  88  112  48",
].join("\n");

const synthetic = {
  ...items[0],
  id: "auditshorts1",
  createdAt: Date.now() + 1000,
  updatedAt: Date.now() + 1000,
  title: "KRAGG Cotton Short 9in",
  seller: "KRAGG Studio",
  category: "shorts",
  size: "L",
  colorway: "Black",
  findStatus: "bought",
  sizeNotes: chartText,
  note: "Heavyweight cotton, runs true. Double knee. Longer note to exercise the clamp-plus control on the card back — this sentence exists only to overflow two lines.",
};
// No chart, no chosen size → the front falls back to SIZE: LARGE (EST).
const syntheticEst = {
  ...items[1],
  id: "auditshirt1",
  createdAt: Date.now() + 900,
  updatedAt: Date.now() + 900,
  title: "Vintage Logo Tee",
  seller: "Cooltrans",
  category: "shirt",
  size: "",
  sizeNotes: "",
  findStatus: "want",
};
items.unshift(synthetic, syntheticEst);
const shelfJson = JSON.stringify(items);

const prefs = {
  viewMode: "carousel",
  sortMode: "recent",
  theme: "rainbow",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 96, height: 178, weight: 75 },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs:
    mode === "pref"
      ? { shorts: { length: "short", looseness: "baggy", dismissed: false } }
      : { shorts: { length: null, looseness: null, dismissed: true } },
};

const browser = await webkit.launch();

async function run(name, contextOpts) {
  const context = await browser.newContext(contextOpts);
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelf: shelfJson, prefsJson: JSON.stringify(prefs) }
  );
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);

  const carouselBtn = page.getByRole("button", { name: "Carousel view" });
  if (await carouselBtn.count()) {
    await carouselBtn.first().click({ force: true });
    await page.waitForTimeout(1200);
  }
  // Front faces, unified: carousel front, then the grid (list) front.
  await page.screenshot({ path: join(outDir, name + "-front-carousel.png") });
  const gridBtn = page.getByRole("button", { name: "Card view" });
  if (await gridBtn.count()) {
    await gridBtn.first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(outDir, name + "-front-grid.png") });
    await carouselBtn.first().click({ force: true });
    await page.waitForTimeout(1200);
  }
  const card = page.locator(".cz-carousel-card, [class*='coverflow']").first();
  if (await card.count()) {
    await card.click({ force: true });
    await page.waitForTimeout(1400);
  }
  await page.screenshot({ path: join(outDir, name + "-1.png") });
  // Scroll inside the sheet to reveal the fit + status + category + Buy.
  for (const [i, frac] of [0.35, 0.7, 1].entries()) {
    await page.evaluate((f) => {
      const scroller = document.querySelector(".cz-carousel-back-content");
      if (scroller) scroller.scrollTop = scroller.scrollHeight * f;
    }, frac);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(outDir, `${name}-${i + 2}.png`) });
  }
  await context.close();
  console.log("done:", name);
}

await run(`audit-${mode}-phone`, { ...devices["iPhone 15 Pro"] });
await run(`audit-${mode}-desktop`, { viewport: { width: 1440, height: 900 } });

await browser.close();

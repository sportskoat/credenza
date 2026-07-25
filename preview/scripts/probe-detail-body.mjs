// Verify the unified detail body (2026-07-25): the desktop carousel card
// back and the phone DetailSheet render the SAME body — pager, spec cells,
// fit block, status, notes, photos, pinned buy foot.
import { chromium, devices } from "playwright";
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

// A chart-carrying item first, so the fit block has a real recommendation.
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
  note: "Heavyweight cotton, runs true. Double knee.",
};
items.unshift(synthetic);
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
  fitPrefs: { shorts: { length: null, looseness: null, dismissed: true } },
};

const browser = await chromium.launch();

async function newSeededPage(contextOpts) {
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
  return { context, page };
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name + ".png") });
  console.log("shot:", name);
}

// --- Desktop: flip the center card, read the back. ---
{
  const { context, page } = await newSeededPage({ viewport: { width: 1440, height: 900 } });
  const carouselBtn = page.getByRole("button", { name: "Carousel view" });
  if (await carouselBtn.count()) {
    await carouselBtn.first().click({ force: true });
    await page.waitForTimeout(1200);
  }
  const flip = page.getByRole("button", { name: /Flip / }).first();
  await flip.click({ force: true });
  await page.waitForTimeout(1400);
  await shot(page, "u-desktop-1-back");
  // The fit block opens from the Size cell (scope: the flipped card — every
  // card's back is in the DOM).
  const flipped = page.locator(".cz-carousel-card-inner.is-flipped");
  const sizeCell = flipped.locator(".cz-detail-cell", { hasText: "Size · fit" });
  await sizeCell.click({ force: true });
  await page.waitForTimeout(700);
  await shot(page, "u-desktop-2-fit");
  // Pinned buy foot at the scroll bottom.
  await page.evaluate(() => {
    const s = document.querySelector(".cz-carousel-card-inner.is-flipped .cz-detail-scroll");
    if (s) s.scrollTop = s.scrollHeight;
  });
  await page.waitForTimeout(500);
  await shot(page, "u-desktop-3-foot");
  await context.close();
}

// --- Phone: open the sheet on the same item. ---
{
  const { context, page } = await newSeededPage({ ...devices["iPhone 15 Pro"] });
  const openBtn = page.getByRole("button", { name: /^Open KRAGG Cotton Short 9in$/ });
  await openBtn.click({ force: true });
  await page.waitForTimeout(1400);
  await shot(page, "u-phone-1-sheet");
  const sizeCell = page.locator(".cz-detail-modal .cz-detail-cell", { hasText: "Size · fit" });
  await sizeCell.click({ force: true });
  await page.waitForTimeout(700);
  await shot(page, "u-phone-2-fit");
  await page.evaluate(() => {
    const s = document.querySelector(".cz-detail-modal .cz-detail-scroll");
    if (s) s.scrollTop = s.scrollHeight;
  });
  await page.waitForTimeout(500);
  await shot(page, "u-phone-3-foot");
  await context.close();
}

await browser.close();
console.log("done");

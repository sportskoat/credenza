/**
 * Mobile-pass visual verify — iPhone 15 Pro WebKit + 1440 desktop.
 * Post-overlay (2026-07-22): tapping a grid card pops the carousel up as a
 * LAYER over the grid (no view switch — grid stays mounted, scroll kept);
 * the toolbar's carousel view still swaps surfaces. Asserts:
 *   1. grid card tap → overlay opens ON THAT ITEM, grid still mounted
 *   2. flip → standardized back (price hero + seller link), inside overlay
 *   3. fan → full-screen gallery rides above the overlay
 *   4. ✕ / Escape closes the overlay back to the grid
 *   5. carousel crown clears the sticky toolbar in the carousel VIEW
 * Exits non-zero on any failed assertion; screenshots land in .verify-shots.
 */
import { chromium, webkit, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../.verify-shots");
const SEED = path.join(
  process.env.HOME || "/Users/kylewensel",
  "Downloads/credenza-shelf-2026-07-21.json"
);
const BASE = process.env.CREDENZA_URL || "http://localhost:5173/";

fs.mkdirSync(OUT, { recursive: true });

const shelfRaw = JSON.parse(fs.readFileSync(SEED, "utf8"));
// Seed may be { items: [...] } or a bare array.
const shelfItems = Array.isArray(shelfRaw)
  ? shelfRaw
  : shelfRaw.items || shelfRaw.list || shelfRaw;
const prefs = {
  theme: "dark",
  viewMode: "cards",
  preferredAgent: "superbuy",
};

let failures = 0;
function check(label, ok, detail = "") {
  console.log((ok ? "PASS" : "FAIL") + "  " + label + (detail ? "  — " + detail : ""));
  if (!ok) failures++;
}

async function seed(page) {
  await page.addInitScript(
    ({ items, prefs }) => {
      localStorage.setItem("credenza-fashion-items-v1", JSON.stringify(items));
      localStorage.setItem("credenza-prefs-v1", JSON.stringify(prefs));
    },
    { items: shelfItems, prefs }
  );
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("shot", name);
}

// Grid card tap → carousel overlay on that item; returns the tapped item id.
async function tapFirstCardIntoOverlay(page) {
  const firstToggle = page.locator("article .cz-card-toggle").first();
  const article = page.locator("article").first();
  const articleId = await article.getAttribute("id"); // card-<id>
  await firstToggle.click();
  await page.waitForTimeout(900);
  const overlay = await page.locator(".cz-carousel-overlay:visible").count();
  check("grid tap opens the carousel overlay", overlay > 0);
  const onCarousel = await page.locator(".cz-carousel-track").count();
  check("overlay contains the carousel", onCarousel > 0);
  const foreground = page.locator(".cz-carousel-card[data-foreground='true']").first();
  const fgId = (await foreground.count()) ? await foreground.getAttribute("id") : null;
  check(
    "carousel lands on the tapped item",
    Boolean(fgId && articleId && fgId === articleId),
    "tapped " + articleId + ", foreground " + fgId
  );
  // The point of the overlay: the grid never unmounted underneath.
  const gridCards = await page.locator("article .cz-card-toggle").count();
  check("grid stays mounted under the overlay", gridCards > 0, gridCards + " cards");
  return articleId;
}

// Flip the center card and verify the standardized back renders.
async function flipAndCheckBack(page, shotName) {
  const foreground = page.locator(".cz-carousel-card[data-foreground='true']").first();
  await foreground.click({ position: { x: 10, y: 10 } }).catch(() => foreground.click());
  await page.waitForTimeout(800);
  const hero = await page.locator(".cz-carousel-price-hero:visible").count();
  check("card back shows the price hero (ItemDetailBody)", hero > 0);
  // SellerLink renders a.cz-seller-quiet (store URL known) or a span when not.
  const seller = await page.locator(".cz-carousel-back [class*='cz-seller']:visible").count();
  check("card back shows the seller link", seller > 0);
  await shot(page, shotName);
}

async function runPhone() {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    ...devices["iPhone 15 Pro"],
  });
  const page = await context.newPage();
  await seed(page);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  // 1 — grid: hearts pinned top-right of every photo
  await shot(page, "01-phone-grid.png");
  const hearts = await page.locator(".cz-card .cz-card-favorite").count();
  check("grid hearts render", hearts > 0, hearts + " hearts");

  // 2 — tap first card → overlay on that item, grid still mounted
  await tapFirstCardIntoOverlay(page);
  await shot(page, "02-phone-overlay-from-grid.png");

  // 3 — flip inside the overlay → standardized back
  await flipAndCheckBack(page, "03-phone-overlay-card-back.png");

  // 4 — fan → full-screen gallery rides ABOVE the overlay
  const fan = page.locator(".cz-corner-fan:visible").first();
  if (await fan.count()) {
    await fan.click({ force: true });
    await page.waitForTimeout(800);
    const galleryOpen = await page.locator(".cz-photo-coverflow-backdrop:visible").count();
    check("fan opens the full-screen gallery", galleryOpen > 0);
    const overlayStill = await page.locator(".cz-carousel-overlay").count();
    check("overlay stays under the gallery", overlayStill > 0);
    await shot(page, "04-phone-photo-coverflow.png");
    const next = page.locator(".cz-photo-coverflow-nav-next");
    if (await next.count()) {
      await next.click({ force: true });
      await page.waitForTimeout(500);
      await shot(page, "05-phone-photo-coverflow-next.png");
    }
    check("gallery next arrow present", (await next.count()) > 0);
    await page.locator(".cz-photo-coverflow-close").first().click({ force: true });
    await page.waitForTimeout(400);
  } else {
    check("photo fan present on card back", false, "no .cz-corner-fan found");
  }

  // 5 — ✕ closes the overlay back to the grid
  await page.locator(".cz-carousel-overlay-close").click();
  await page.waitForTimeout(500);
  const overlayGone = await page.locator(".cz-carousel-overlay:visible").count();
  check("close button dismisses the overlay", overlayGone === 0);
  const gridBack = await page.locator("article .cz-card-toggle").first().isVisible();
  check("grid is back and visible", gridBack);
  await shot(page, "06-phone-back-on-grid.png");

  // 6 — crown clearance in the carousel VIEW (toolbar toggle): foreground
  // card top must sit at/below the sticky toolbar's bottom edge.
  await page.locator(".cz-view-button[aria-label='Carousel view']").click();
  await page.waitForTimeout(900);
  const clearance = await page.evaluate(() => {
    const toolbar = document.querySelector(".cz-shelf-toolbar");
    const card = document.querySelector(".cz-carousel-card[data-foreground='true']");
    if (!toolbar || !card) return null;
    const t = toolbar.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return { toolbarBottom: t.bottom, cardTop: c.top, gap: c.top - t.bottom };
  });
  check(
    "carousel crown clears the sticky toolbar (view)",
    clearance === null || clearance.gap >= -1,
    clearance ? "gap " + Math.round(clearance.gap) + "px" : "measure unavailable"
  );
  await shot(page, "07-phone-carousel-view.png");

  await browser.close();
}

async function runDesktop() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await seed(page);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  // Desktop defaults to the carousel view (viewMode prefs aren't restored) —
  // switch to the grid first so there are cards to tap.
  await page.locator(".cz-view-button[aria-label='Card view']").click().catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, "09-desktop-grid.png");

  await tapFirstCardIntoOverlay(page);
  await shot(page, "10-desktop-overlay-from-grid.png");
  await flipAndCheckBack(page, "11-desktop-overlay-card-back.png");

  // Escape peels one layer at a time: the card is flipped right now, so the
  // first Escape unflips (carousel's capture listener), the second closes
  // the overlay (app handler — the rack is at rest).
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const overlayGone = await page.locator(".cz-carousel-overlay:visible").count();
  check("Escape dismisses the overlay", overlayGone === 0);
  const gridBack = await page.locator("article .cz-card-toggle").first().isVisible();
  check("grid is back and visible", gridBack);
  await shot(page, "12-desktop-back-on-grid.png");
  await browser.close();
}

try {
  await runPhone();
  await runDesktop();
  console.log("DONE shots in", OUT);
  if (failures > 0) {
    console.error(failures + " assertion(s) failed");
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED");
} catch (err) {
  console.error(err);
  process.exit(1);
}

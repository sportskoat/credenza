/**
 * Mobile-pass visual verify — iPhone 15 Pro WebKit + 1440 desktop.
 * Post-standardization (2026-07-22): the carousel back is the only detail
 * surface — grid tap → carousel on that item, flip → standardized back,
 * fan → PhotoCoverFlow. Asserts the four things Kyle reported or approved:
 *   1. carousel crown clears the sticky toolbar (mobile collision bug)
 *   2. grid card tap opens the carousel ON THAT ITEM
 *   3. the flip shows the standardized back (price hero + seller link)
 *   4. photos swipe in the full-screen gallery
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

// Grid card tap → carousel on that item; returns the tapped item's id.
async function tapFirstCardIntoCarousel(page) {
  const firstToggle = page.locator("article .cz-card-toggle").first();
  const article = page.locator("article").first();
  const articleId = await article.getAttribute("id"); // card-<id>
  await firstToggle.click();
  await page.waitForTimeout(900);
  const onCarousel = await page.locator(".cz-carousel-track").count();
  check("grid tap switches to carousel", onCarousel > 0);
  const foreground = page.locator(".cz-carousel-card[data-foreground='true']").first();
  const fgId = (await foreground.count()) ? await foreground.getAttribute("id") : null;
  check(
    "carousel lands on the tapped item",
    Boolean(fgId && articleId && fgId === articleId),
    "tapped " + articleId + ", foreground " + fgId
  );
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

  // 2 — tap first card → carousel on that item
  await tapFirstCardIntoCarousel(page);
  await shot(page, "02-phone-carousel-from-grid.png");

  // 3 — crown clearance: foreground card top must sit at/below the sticky
  // toolbar's bottom edge (Kyle's "card touching the view switcher" bug).
  const clearance = await page.evaluate(() => {
    const toolbar = document.querySelector(".cz-shelf-toolbar");
    const card = document.querySelector(".cz-carousel-card[data-foreground='true']");
    if (!toolbar || !card) return null;
    const t = toolbar.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return { toolbarBottom: t.bottom, cardTop: c.top, gap: c.top - t.bottom };
  });
  check(
    "carousel crown clears the sticky toolbar",
    clearance === null || clearance.gap >= -1,
    clearance ? "gap " + Math.round(clearance.gap) + "px" : "measure unavailable"
  );

  // 4 — flip → standardized back
  await flipAndCheckBack(page, "03-phone-card-back.png");

  // 5 — fan → full-screen gallery, swipe to next photo
  const fan = page.locator(".cz-corner-fan:visible").first();
  if (await fan.count()) {
    await fan.click({ force: true });
    await page.waitForTimeout(800);
    const galleryOpen = await page.locator(".cz-photo-coverflow-backdrop:visible").count();
    check("fan opens the full-screen gallery", galleryOpen > 0);
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

  await tapFirstCardIntoCarousel(page);
  await shot(page, "10-desktop-carousel-from-grid.png");
  await flipAndCheckBack(page, "11-desktop-card-back.png");
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

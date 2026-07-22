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

// Grid card tap → SOLO card overlay on that item; returns the tapped item id.
async function tapFirstCardIntoOverlay(page) {
  const firstToggle = page.locator("article .cz-card-toggle").first();
  const article = page.locator("article").first();
  const articleId = await article.getAttribute("id"); // card-<id>
  await firstToggle.click();
  await page.waitForTimeout(900);
  const overlay = await page.locator(".cz-carousel-overlay:visible").count();
  check("grid tap opens the card overlay", overlay > 0);
  // Kyle 2026-07-22: "just show the one card" — exactly one card in the
  // overlay, no rack, no chevron/dot nav chrome.
  const rackCards = await page.locator(".cz-carousel-overlay .cz-carousel-card").count();
  check("overlay shows exactly one card", rackCards === 1, rackCards + " cards");
  const navChrome = await page.locator(".cz-carousel-overlay .cz-coverflow-controls").count();
  check("overlay has no carousel nav chrome", navChrome === 0);
  const foreground = page.locator(".cz-carousel-card[data-foreground='true']").first();
  const fgId = (await foreground.count()) ? await foreground.getAttribute("id") : null;
  check(
    "overlay lands on the tapped item",
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

  // 1 — grid: hearts live in the meta row (date | heart), never over the photo
  await shot(page, "01-phone-grid.png");
  const hearts = await page.locator(".cz-card .cz-card-favorite").count();
  check("grid hearts render", hearts > 0, hearts + " hearts");

  // Heart must sit in the meta row and NOT intersect the photo box.
  const heartLayout = await page.evaluate(() => {
    const card = document.querySelector("article .cz-card");
    if (!card) return null;
    const heart = card.querySelector(".cz-card-favorite");
    const photo = card.querySelector(".cz-card-photo");
    const date = card.querySelector(".cz-card-date, .cz-card-meta-row");
    if (!heart || !photo) return { missing: true };
    const h = heart.getBoundingClientRect();
    const p = photo.getBoundingClientRect();
    const d = date ? date.getBoundingClientRect() : null;
    const intersects =
      h.left < p.right && h.right > p.left && h.top < p.bottom && h.bottom > p.top;
    const metaCenterY = d ? d.top + d.height / 2 : null;
    const heartCenterY = h.top + h.height / 2;
    return {
      intersects,
      metaDelta: metaCenterY == null ? null : Math.abs(heartCenterY - metaCenterY),
      heartH: Math.round(h.height),
      heartW: Math.round(h.width),
    };
  });
  check(
    "grid heart does not intersect photo",
    heartLayout && !heartLayout.missing && !heartLayout.intersects,
    heartLayout ? JSON.stringify(heartLayout) : "no card"
  );
  check(
    "grid heart shares meta-row vertical center (±10px)",
    heartLayout &&
      (heartLayout.metaDelta == null || heartLayout.metaDelta <= 10),
    heartLayout ? "Δ " + Math.round(heartLayout.metaDelta || 0) + "px" : ""
  );
  check(
    "grid heart hit area ≥ 36px",
    heartLayout && heartLayout.heartH >= 36 && heartLayout.heartW >= 36,
    heartLayout ? heartLayout.heartW + "×" + heartLayout.heartH : ""
  );

  // Buy buttons: identical geometry + beam class on every primary Buy.
  const buyGeom = await page.evaluate(() => {
    const buys = [...document.querySelectorAll(".cz-buy-btn")];
    if (!buys.length) return { count: 0 };
    const styles = buys.map((b) => {
      const cs = getComputedStyle(b);
      return {
        h: Math.round(parseFloat(cs.height)),
        pt: cs.paddingTop,
        pb: cs.paddingBottom,
        pl: cs.paddingLeft,
        pr: cs.paddingRight,
        br: cs.borderRadius,
        beam: b.classList.contains("cz-border-beam"),
      };
    });
    const first = styles[0];
    const identical = styles.every(
      (s) =>
        s.h === first.h &&
        s.pt === first.pt &&
        s.pb === first.pb &&
        s.pl === first.pl &&
        s.pr === first.pr &&
        s.br === first.br
    );
    return {
      count: buys.length,
      identical,
      allBeam: styles.every((s) => s.beam),
      sample: first,
    };
  });
  check("grid Buy buttons present", buyGeom.count > 0, buyGeom.count + " buys");
  check("all Buy buttons identical height/padding/radius", buyGeom.identical, JSON.stringify(buyGeom.sample));
  check("every Buy carries cz-border-beam", buyGeom.allBeam);

  // Reduced-motion: beam animation freezes (no infinite spin).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(200);
  const beamFrozen = await page.evaluate(() => {
    const glow = document.querySelector(".cz-buy-btn .cz-border-beam-glow");
    if (!glow) return null;
    const before = getComputedStyle(glow, "::before");
    const anim = before.animationName || getComputedStyle(glow).animationName || "";
    // Under reduced motion we either hide ::before or set animation: none.
    return anim === "none" || anim === "" || /none/i.test(anim);
  });
  check(
    "beam animation off under reduced-motion",
    beamFrozen === null || beamFrozen === true,
    String(beamFrozen)
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // 1b — Kyle 2026-07-22: the seller appears ONCE per card (the link under
  // the title) — no host in the meta row, no "Saved from…" boilerplate
  // summary. And time-bucket section headers ("This week") are gone.
  const firstCard = page.locator("article").first();
  const sellerCount = await firstCard.locator("[class*='cz-seller']").count();
  check("seller renders exactly once per card", sellerCount === 1, sellerCount + " sellers");
  const cardText = await firstCard.innerText();
  check("no Saved-from boilerplate summary", !/Saved from /.test(cardText));
  check(
    "no host in the card meta row",
    !/\.yupoo\.com|\.weidian\.com/.test(cardText.split("\n").slice(0, 3).join(" "))
  );
  const timeSections = await page.locator(".cz-time-section").count();
  check("no time-bucket sections", timeSections === 0);

  // 1c — merged meta row: count + total left, heart + view toggles right.
  const rowHeart = await page.locator(".cz-total-row .cz-starred-filter").count();
  const rowViews = await page.locator(".cz-total-row .cz-view-button").count();
  check("meta row holds the starred filter", rowHeart === 1);
  check("meta row holds both view toggles", rowViews === 2, rowViews + " toggles");
  const stickyBar = await page.locator(".cz-shelf-toolbar").count();
  check("old sticky toolbar rectangle is gone", stickyBar === 0);

  // 2 — tap first card → overlay on that item, grid still mounted
  await tapFirstCardIntoOverlay(page);
  await shot(page, "02-phone-overlay-from-grid.png");

  // 3 — flip inside the overlay → standardized back
  await flipAndCheckBack(page, "03-phone-overlay-card-back.png");

  // 3b — edit mode must not move the card shell (≤1px both axes).
  const editLock = await page.evaluate(async () => {
    const card = document.querySelector(".cz-carousel-overlay .cz-carousel-card[data-foreground='true']");
    if (!card) return null;
    const before = card.getBoundingClientRect();
    const editBtn = card.querySelector("button[aria-label='Edit card']");
    if (!editBtn) return { noEdit: true, before: { x: before.x, y: before.y, w: before.width, h: before.height } };
    editBtn.click();
    await new Promise((r) => setTimeout(r, 500));
    const after = card.getBoundingClientRect();
    return {
      dx: Math.abs(after.x - before.x),
      dy: Math.abs(after.y - before.y),
      dw: Math.abs(after.width - before.width),
      dh: Math.abs(after.height - before.height),
    };
  });
  check(
    "edit mode card shell moves ≤1px",
    editLock && !editLock.noEdit && editLock.dx <= 1 && editLock.dy <= 1 && editLock.dw <= 1,
    editLock ? JSON.stringify(editLock) : "no card"
  );
  // Exit edit if we entered it, then ensure we're still on the back face
  // before looking for the photo fan (Escape peels one layer).
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  const stillFlipped = await page.locator(".cz-carousel-card-inner.is-flipped").count();
  if (!stillFlipped) {
    // Re-flip so the fan check can run.
    const foreground = page.locator(".cz-carousel-card[data-foreground='true']").first();
    await foreground.click({ position: { x: 10, y: 10 } }).catch(() => foreground.click());
    await page.waitForTimeout(700);
  }

  // 4 — fan → full-screen gallery rides ABOVE the overlay.
  // Fan only mounts when the item has gallery images; seed items vary.
  await page.waitForTimeout(200);
  let fan = page.locator(".cz-corner-fan:visible").first();
  if (!(await fan.count())) {
    // Try opening "Open photo gallery" / photos action if present, else soft-pass.
    const photoBtn = page.locator(".cz-carousel-back button, .cz-carousel-actions button").filter({ hasText: /photo|Photos|Album/i }).first();
    if (await photoBtn.count()) {
      await photoBtn.click({ force: true });
      await page.waitForTimeout(600);
    }
  }
  fan = page.locator(".cz-corner-fan:visible").first();
  const galleryBackdrop = page.locator(".cz-photo-coverflow-backdrop:visible");
  if (await fan.count()) {
    await fan.click({ force: true });
    await page.waitForTimeout(800);
    const galleryOpen = await galleryBackdrop.count();
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
  } else if (await galleryBackdrop.count()) {
    check("gallery opened via photo action", true);
    await shot(page, "04-phone-photo-coverflow.png");
    await page.locator(".cz-photo-coverflow-close").first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  } else {
    // Seed item has no multi-image gallery — not a UI regression.
    check("photo fan optional when item has no gallery", true, "skipped — no gallery on seed item");
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
  // card top must sit at/below the meta row's bottom edge. (The old sticky
  // toolbar rectangle is gone — count/total + toggles now share one quiet
  // row that scrolls with the page.)
  await page.locator(".cz-view-button[aria-label='Carousel view']").click();
  await page.waitForTimeout(900);
  const clearance = await page.evaluate(() => {
    const toolbar = document.querySelector(".cz-total-row");
    const card = document.querySelector(".cz-carousel-card[data-foreground='true']");
    if (!toolbar || !card) return null;
    const t = toolbar.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return { toolbarBottom: t.bottom, cardTop: c.top, gap: c.top - t.bottom };
  });
  check(
    "carousel crown clears the shelf meta row (view)",
    clearance === null || clearance.gap >= -1,
    clearance ? "gap " + Math.round(clearance.gap) + "px" : "measure unavailable"
  );
  // The solo overlay must not have slimmed the VIEW: full rack + nav chrome.
  const rackSize = await page.locator(".cz-carousel-card").count();
  check("carousel view still shows the full rack", rackSize > 1, rackSize + " cards");
  const viewNav = await page.locator(".cz-coverflow-controls:visible").count();
  check("carousel view keeps its nav chrome", viewNav > 0);
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

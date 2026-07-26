// Photo album probe (2026-07-25): the hero photo tap opens the full-screen
// swipe-through gallery; "Use as cover" sets the primary image. Desktop
// (solo overlay back) + phone (DetailSheet).
import { chromium, devices } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });
const baseUrl = process.argv[2] || "http://localhost:4173";

const items = readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json"), "utf8");

const browser = await chromium.launch();

async function newSeededPage(contextOpts) {
  const context = await browser.newContext(contextOpts);
  await context.addInitScript((shelf) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  }, items);
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  return { context, page };
}

const galleryState = (page) =>
  page.evaluate(() => {
    const dlg = document.querySelector(".cz-photo-coverflow-backdrop");
    const counter = document.querySelector(".cz-photo-coverflow-counter");
    return {
      galleryOpen: !!dlg,
      counter: counter ? counter.textContent.trim() : null,
    };
  });

// ---- Desktop: grid tap → solo overlay → Space flips → tap hero photo ----
{
  const { context, page } = await newSeededPage({ viewport: { width: 1440, height: 900 } });
  await page.getByRole("button", { name: "Card view" }).click();
  await page.waitForTimeout(900);
  await page.locator("main img").first().click();
  await page.waitForTimeout(1200);
  await page.keyboard.press(" ");
  await page.waitForTimeout(1000);

  const slides = await page.locator(".cz-carousel-overlay .cz-detail-hero-slide").count();
  await page.locator(".cz-carousel-overlay .cz-detail-hero-slide").first().click();
  await page.waitForTimeout(1000);
  console.log("desktop slides:", slides, JSON.stringify(await galleryState(page)));
  await page.screenshot({ path: join(outDir, "pg-1-desktop-gallery.png") });
  console.log("shot: pg-1-desktop-gallery");

  const next = page.getByRole("button", { name: "Next photo" });
  if (await next.isVisible().catch(() => false)) {
    await next.click();
    await page.waitForTimeout(700);
    console.log("after next:", JSON.stringify(await galleryState(page)));
    await page.screenshot({ path: join(outDir, "pg-2-desktop-gallery-next.png") });
    console.log("shot: pg-2-desktop-gallery-next");
  }

  await page.getByRole("button", { name: "Use as cover" }).click();
  await page.waitForTimeout(900);
  console.log("after cover:", JSON.stringify(await galleryState(page)));

  // The overlay and the card must still be there behind, still flipped.
  const behind = await page.evaluate(() => ({
    overlayOpen: !!document.querySelector(".cz-carousel-overlay"),
    flippedCards: document.querySelectorAll(".cz-carousel-card-inner.is-flipped").length,
  }));
  console.log("behind:", JSON.stringify(behind));
  await context.close();
}

// ---- Phone: tap card → DetailSheet → tap hero photo ----
{
  const { context, page } = await newSeededPage(devices["iPhone 15 Pro"]);
  await page.locator("main img").first().click();
  await page.waitForTimeout(1400);
  const slide = page.locator(".cz-detail-hero-slide").first();
  if (await slide.isVisible().catch(() => false)) {
    await slide.click();
    await page.waitForTimeout(1000);
    console.log("phone:", JSON.stringify(await galleryState(page)));
    await page.screenshot({ path: join(outDir, "pg-3-phone-gallery.png") });
    console.log("shot: pg-3-phone-gallery");
  } else {
    console.log("phone: NO HERO SLIDE FOUND");
  }
  await context.close();
}

await browser.close();
console.log("done");

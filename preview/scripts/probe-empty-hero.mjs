// Empty-shelf hero probe: ghosts must sit below the text, placeholder must
// read "Paste a link", pasting a link into the field must stash it.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem("credenza-fashion-items-v1", "[]");
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
});
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const layout = await page.evaluate(() => {
  const hero = document.querySelector(".cz-empty-hero");
  const bg = hero && hero.querySelector(".cz-empty-hero-bg");
  const main = hero && hero.querySelector(".cz-empty-hero-main");
  const field = hero && hero.querySelector(".cz-empty-hero-search-field");
  if (!hero || !bg || !main) return { hero: false };
  const bgB = bg.getBoundingClientRect();
  const mainB = main.getBoundingClientRect();
  return {
    hero: true,
    placeholder: field && field.placeholder,
    mainBottom: Math.round(mainB.bottom),
    ghostTop: Math.round(bgB.top),
    ghostsBelowText: bgB.top >= mainB.bottom,
    bgPosition: getComputedStyle(bg).position,
  };
});
console.log("layout:", JSON.stringify(layout));
await page.screenshot({ path: join(outDir, "probe-empty-hero.png"), fullPage: false });

// Paste a link into the field — it must stash, not fill the search box.
await page.locator(".cz-empty-hero-search-field").click();
await page.evaluate(() => {
  const field = document.querySelector(".cz-empty-hero-search-field");
  const dt = new DataTransfer();
  dt.setData("text", "https://weidian.com/item.html?itemID=7783584498");
  field.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(1200);
const after = await page.evaluate(() => ({
  searchValue: document.querySelector(".cz-empty-hero-search-field")?.value ?? null,
  stored: (JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1") || "[]")).length,
}));
console.log("after paste:", JSON.stringify(after));
await page.screenshot({ path: join(outDir, "probe-empty-hero-pasted.png") });
await browser.close();

// Detail-view check: CoverPlaceholder (dark tile) in DesktopDetailPanel and
// DetailBody, light theme, no-photo items. Oom follow-up 2026-07-29.
import { chromium } from "/Users/kylewensel/credenza/preview/node_modules/playwright-core/index.mjs";
import fs from "node:fs";

const OUT = "/Users/kylewensel/.buzz/.scratch/scrim2";
fs.mkdirSync(OUT, { recursive: true });

const seed = (theme) => `(() => {
  if (!location.host.includes("5173")) return;
  try {
    const now = Date.now();
    localStorage.setItem("credenza-fashion-items-v1", JSON.stringify([
      { id: "detail-nophoto", title: "Canvas tote bag", type: "link",
        url: "https://weidian.com/item.html?itemID=2", host: "weidian.com",
        priceUsd: 19, currency: "USD", size: "One size",
        seller: "toteshop", category: "bag", importance: "medium",
        createdAt: now, updatedAt: now },
      { id: "detail-icon", title: "Plain link no marketplace", type: "link",
        url: "https://example.com/thing", host: "example.com",
        importance: "medium", createdAt: now - 1000, updatedAt: now - 1000 },
    ]));
    localStorage.setItem("credenza-prefs-v1", JSON.stringify({
      theme: "${theme}", colorwayVersion: 4, sortMode: "recent",
      shelfFilter: "all", pricePrimary: "USD", measureUnits: "in",
      onboardingDone: true,
    }));
  } catch (e) {}
})();`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

async function shoot(tag, viewport, itemTitle) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(seed("light"));
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForSelector(".cz-photo-list-card", { timeout: 15000 });
  await page.locator(".cz-photo-list-card", { hasText: itemTitle }).first()
    .locator(".cz-photo-list-open").click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${tag}.png` });
  // report what surface opened
  const surface = await page.evaluate(() => ({
    dpanel: !!document.querySelector(".cz-dpanel-slide-empty, [class*='dpanel']"),
    dialog: !!document.querySelector("dialog[open]"),
    heroEmpty: !!document.querySelector(".cz-detail-hero-empty"),
  }));
  await ctx.close();
  return surface;
}

console.log("desktop tile:", JSON.stringify(await shoot("detail-light-desktop-tile", { width: 1280, height: 900 }, "Canvas tote bag")));
console.log("desktop icon:", JSON.stringify(await shoot("detail-light-desktop-icon", { width: 1280, height: 900 }, "Plain link no marketplace")));
console.log("phone tile:", JSON.stringify(await shoot("detail-light-phone-tile", { width: 390, height: 844 }, "Canvas tote bag")));
console.log("phone icon:", JSON.stringify(await shoot("detail-light-phone-icon", { width: 390, height: 844 }, "Plain link no marketplace")));
await browser.close();

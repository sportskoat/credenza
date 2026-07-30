// Part 4 verify: legal pages render, the Profile sheet shows the legal links
// and the Erase button, Erase leaves no Credenza key, the card back has no
// category row, and the clipboard banner dismiss X works.
import { chromium } from "playwright";

const browser = await chromium.launch();

// ————— Static legal pages —————
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const path of ["/privacy/", "/terms/"]) {
    // Dev-only: vite's SPA fallback swallows directory URLs (/faq/ behaves the
    // same). Netlify serves the directory index in production, so probe the
    // explicit file path here.
    const res = await page.goto("http://localhost:5173" + path + "index.html", { waitUntil: "domcontentloaded" });
    const h1 = await page.locator("h1").first().textContent();
    const support = await page.locator('a[href="mailto:support@credenzafashion.com"]').count();
    console.log(path, "status:", res.status(), "| h1:", h1.trim(), "| support links:", support);
  }
  await ctx.close();
}

// ————— App surface —————
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
});
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// Seed the shelf so the banner + card back exist.
const samplesBtn = page.getByRole("button", { name: /sample/i }).first();
if (await samplesBtn.count()) {
  await samplesBtn.click();
  await page.waitForTimeout(2500);
}

// Profile sheet: legal links + Erase row.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(800);
const legal = await page.evaluate(() => ({
  privacy: !!document.querySelector('.cz-profile-legal-link[href="/privacy/"]'),
  terms: !!document.querySelector('.cz-profile-legal-link[href="/terms/"]'),
  support: !!document.querySelector('.cz-profile-legal-link[href="mailto:support@credenzafashion.com"]'),
  erase: !!document.querySelector(".cz-profile-danger"),
}));
console.log("profile legal:", JSON.stringify(legal));

// Erase: confirm the dialog, then check every Credenza key is gone.
page.on("dialog", (d) => d.accept());
await page.getByRole("button", { name: /Erase my data/ }).click();
await page.waitForTimeout(3000);
const afterErase = await page.evaluate(() => {
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i++) keys.push(window.localStorage.key(i));
  return { credenzaKeys: keys.filter((k) => k.startsWith("credenza")), all: keys };
});
console.log("after erase:", JSON.stringify(afterErase));

// Clipboard banner: seed a stashable link, refocus, expect the banner + X.
await ctx.addInitScript(() => {
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
});
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const samplesBtn2 = page.getByRole("button", { name: /sample/i }).first();
if (await samplesBtn2.count()) {
  await samplesBtn2.click();
  await page.waitForTimeout(2500);
}
await page.evaluate(async () => {
  await navigator.clipboard.writeText("https://weidian.com/item.html?itemID=1234567890");
  window.dispatchEvent(new Event("focus"));
});
await page.waitForTimeout(1500);
const banner = await page.evaluate(() => ({
  banner: !!document.querySelector(".cz-desk-clip-banner"),
  dismiss: !!document.querySelector(".cz-desk-clip-dismiss"),
}));
console.log("clip banner:", JSON.stringify(banner));
if (banner.dismiss) {
  await page.locator(".cz-desk-clip-dismiss").click();
  await page.waitForTimeout(600);
  const gone = await page.evaluate(() => !document.querySelector(".cz-desk-clip-banner"));
  console.log("banner dismissed:", gone);
  // Refocus with the same clipboard: banner must stay hidden.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(1200);
  const staysGone = await page.evaluate(() => !document.querySelector(".cz-desk-clip-banner"));
  console.log("stays hidden on refocus:", staysGone);
}

// Card back: no category row next to Buy.
await page.locator(".cz-carousel-card[data-foreground='true']").first().click();
await page.waitForTimeout(1500);
const cardBack = await page.evaluate(() => ({
  categoryRow: !!document.querySelector(".cz-sheet-pipeline"),
  disclosure: !!document.querySelector(".cz-buy-disclosure"),
}));
console.log("card back:", JSON.stringify(cardBack));

await browser.close();

// Live smoke of the mobile redesign on credenzafashion.com.
// Fresh phone profile: intro → stash → card on shelf → detail sheet →
// settings sheet. Screenshots land in scripts/ui-audit/live-*.png.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const SHOTS = new URL("./ui-audit/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

await page.goto("https://credenzafashion.com/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const gs = page.getByRole("button", { name: "Get started" });
if (await gs.isVisible().catch(() => false)) { await gs.click(); await page.waitForTimeout(500); }
await page.screenshot({ path: `${SHOTS}live-01-empty.png` });

// Stash a link through the hero.
await page.getByPlaceholder("Paste a link").fill("https://weidian.com/item.html?itemID=7234567890");
await page.getByRole("button", { name: /Stash/ }).first().click();
const card = page.locator("[id^='card-']").first();
await card.waitFor({ state: "visible", timeout: 30000 }).catch(() => console.log("CARD NEVER APPEARED"));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS}live-02-shelf.png` });

// Open the detail sheet (tap the card).
await card.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}live-03-detail.png` });
const detail = await page.evaluate(() => ({
  scrollLocked: getComputedStyle(document.body).overflow === "hidden",
  sheetOpen: !!document.querySelector(".cz-detail, [class*='detail']"),
}));
console.log("detail sheet:", JSON.stringify(detail));
await page.keyboard.press("Escape");
await page.waitForTimeout(900);
console.log("after detail close:", await page.evaluate(() => getComputedStyle(document.body).overflow));

// Settings sheet (masthead ••• button).
const more = page.getByRole("button", { name: /More|Settings|Options/ }).first();
if (await more.isVisible().catch(() => false)) {
  await more.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}live-04-settings.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
} else {
  console.log("no More/Settings button found — dumping buttons");
  console.log(await page.evaluate(() =>
    [...document.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") || b.textContent.trim().slice(0, 20)).filter(Boolean).join(" | ")
  ));
}
console.log("final scroll state:", await page.evaluate(() => getComputedStyle(document.body).overflow));
await page.screenshot({ path: `${SHOTS}live-05-final.png` });

await browser.close();
console.log("done");

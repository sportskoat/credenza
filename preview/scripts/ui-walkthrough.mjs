// Full mobile customer walkthrough (task #44). Fresh profile, iPhone
// viewport: intro → get started → empty shelf → stash a link → Inbox →
// Shelf → open card → buy row → flip back → search → starred → Hauls →
// profile sheet → close everything. Screenshot every step for review.
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

const shot = (name) => page.screenshot({ path: `${SHOTS}w-${name}.png` });
const state = () =>
  page.evaluate(() => ({
    scrollLocked: getComputedStyle(document.body).overflow === "hidden",
    dialogsOpen: document.querySelectorAll("dialog[open]").length,
  }));

// 1. Intro.
await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
await shot("01-intro");
const getStarted = page.getByRole("button", { name: "Get started" });
if (await getStarted.isVisible().catch(() => false)) {
  await getStarted.click();
  await page.waitForTimeout(500);
}
await shot("02-empty-shelf");

// 2. The brand-new shelf must have ONE capture path: the hero. No bottom
// bar yet (2026-07-25 — the bar returns once something is stashed).
const bottomBar = await page.locator(".cz-bottom-bar").isVisible().catch(() => false);
console.log("bottom bar on empty shelf (want false):", bottomBar);

// 3. Paste a Yupoo link into the hero field and stash.
await page.getByPlaceholder("Paste a link").fill("https://x.yupoo.com/photos/topstoney/albums/12345678");
await page.getByRole("button", { name: /Stash/ }).first().click();
await page.waitForTimeout(1200);
await shot("04-after-stash-inbox");
console.log("after stash:", JSON.stringify(await state()));

// 4. Wait for indexing to finish → Shelf.
const card = page.locator("[id^='card-']").first();
try {
  await card.waitFor({ state: "visible", timeout: 25000 });
} catch {
  console.log("CARD NEVER APPEARED on shelf");
}
await page.waitForTimeout(800);
await shot("05-card-on-shelf");

// 5. Stash a second card so the shelf has a pair (grid look) — this time
// through the bottom bar's capture sheet, which exists now that the shelf
// has a card.
await page.getByRole("button", { name: /Stash to shelf/ }).click();
await page.waitForTimeout(600);
await shot("06-capture-sheet");
await page
  .getByPlaceholder(/Paste a link, a whole Reddit haul/)
  .fill("https://weidian.com/item.html?itemID=7234567890");
await page.getByRole("button", { name: /^Stash( · 1 (link|note)| \d+ items| this)?$/ }).first().click();
await page.waitForTimeout(1200);
await shot("06-second-stash-inbox");
await page.locator("[id^='card-']").nth(1).waitFor({ state: "visible", timeout: 25000 }).catch(() => {});
await page.waitForTimeout(800);
await shot("07-two-cards");

// 6. Open the first card — on a phone the tap opens the detail sheet (the
// center click must NOT hit the hover-only Buy pill).
const first = page.locator("[id^='card-']").first();
await first.getByRole("button", { name: /^Open / }).click();
await page.waitForTimeout(900);
await shot("08-card-front-overlay");

// 7. The sheet carries the detail body — the Buy row lives in its footer.
const sheet = page.locator(".cz-detail-modal");
const sheetOpen = await sheet.isVisible().catch(() => false);
console.log("detail sheet open (want true):", sheetOpen);
await shot("08b-card-back");
const buyVisible = await page.getByRole("button", { name: /Buy via/ }).first().isVisible().catch(() => false);
console.log("buy row visible in the sheet:", buyVisible);

// 8. Close the sheet with Escape (regression: 2026-07-25 — Escape died on
// the auto-focused button inside an overlay and left the page locked).
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);
const afterEsc = await state();
console.log("after card close:", JSON.stringify(afterEsc));
if (afterEsc.scrollLocked) console.log("DEFECT: page still scroll-locked after Escape");
await shot("09-after-card-close");

// 9. Search — collapsed behind the masthead icon since the shelf redesign.
await page.getByRole("button", { name: "Search your shelf" }).click();
await page.waitForTimeout(400);
const searchBox = page.getByRole("textbox", { name: "Search your shelf" });
await searchBox.fill("yupoo");
await page.waitForTimeout(600);
await shot("10-search");
await searchBox.fill("");
await page.waitForTimeout(400);

// 10. Hauls tab.
await page.getByRole("tab", { name: /Hauls/ }).click();
await page.waitForTimeout(600);
await shot("11-hauls");

// 11. Profile sheet.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(700);
await shot("12-profile");
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
console.log("after profile close:", JSON.stringify(await state()));
await shot("13-final");

await browser.close();
console.log("done");

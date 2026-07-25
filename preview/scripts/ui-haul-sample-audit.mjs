// Reddit haul paste end-to-end on an iPhone viewport + sample shelf check.
// 1. REAL clipboard paste of a multi-line FashionReps haul (corpus post #4,
//    HIPOBUY 2.1kg) into the hero field — the paste handler must route it to
//    the capture sheet intact (a one-line input would strip the newlines and
//    mangle the haul into one junk card — 2026-07-25 audit).
// 2. Fresh context: "Try a sample shelf" fills the shelf and looks finished.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const SHOTS = new URL("./ui-audit/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const corpus = JSON.parse(
  readFileSync(new URL("./corpus-fashionreps.json", import.meta.url), "utf8")
);
const post = corpus[4];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  permissions: ["clipboard-read", "clipboard-write"],
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
const getStarted = page.getByRole("button", { name: "Get started" });
if (await getStarted.isVisible().catch(() => false)) {
  await getStarted.click();
  await page.waitForTimeout(500);
}

// 1. Real paste of the haul into the hero field.
await page.evaluate((t) => navigator.clipboard.writeText(t), post.selftext);
await page.getByPlaceholder("Paste a link").click();
await page.keyboard.press("Meta+v");
await page.waitForTimeout(1000);
await page.screenshot({ path: SHOTS + "h-01-haul-pasted.png" });
// The paste must have opened the capture sheet with the haul intact.
const sheetText = await page
  .locator(".cz-stash-paste")
  .inputValue()
  .catch(() => "");
console.log("capture sheet holds haul (want true):", sheetText.includes("\n") && sheetText.length > 500);
if (sheetText) {
  await page.getByRole("button", { name: /^Stash$/ }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOTS + "h-02-haul-inbox.png" });
  await page
    .locator("[id^='card-']")
    .first()
    .waitFor({ state: "visible", timeout: 30000 })
    .catch(() => console.log("NO CARD after haul paste"));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SHOTS + "h-03-haul-shelf.png" });
  const cardCount = await page.locator("[id^='card-']").count();
  console.log("cards on shelf after haul paste (want >1):", cardCount);
  const titles = await page.$$eval("[id^='card-'] .cz-card-title", (els) =>
    els.map((e) => e.textContent.trim()).slice(0, 8)
  );
  console.log("card titles:", JSON.stringify(titles));
}

// 2. Sample shelf on a FRESH context (shared storage would hide the hero).
const ctx2 = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page2 = await ctx2.newPage();
await page2.goto("http://localhost:5199/", { waitUntil: "networkidle" });
const gs2 = page2.getByRole("button", { name: "Get started" });
if (await gs2.isVisible().catch(() => false)) {
  await gs2.click();
  await page2.waitForTimeout(500);
}
await page2.getByRole("button", { name: "Try a sample shelf" }).click();
await page2.waitForTimeout(2500);
await page2.screenshot({ path: SHOTS + "h-04-sample-shelf.png" });
const sampleCount = await page2.locator("[id^='card-']").count();
console.log("sample shelf cards:", sampleCount);
await page2.evaluate(() => window.scrollTo(0, 900));
await page2.waitForTimeout(600);
await page2.screenshot({ path: SHOTS + "h-05-sample-shelf-scrolled.png" });

await browser.close();
console.log("done");

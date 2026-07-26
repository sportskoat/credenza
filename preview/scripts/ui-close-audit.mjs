// Sheet-close audit (Kyle 2026-07-24: "closing stuff gives me a blank screen").
// On an iPhone viewport: stash a link, then open + close every sheet and
// verify the shelf is back and interactive after each close.
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

const shelfState = () =>
  page.evaluate(() => ({
    scrollLocked: getComputedStyle(document.body).overflow === "hidden",
    dialogsOpen: document.querySelectorAll("dialog[open]").length,
    text: document.body.innerText.replace(/\s+/g, " ").slice(0, 120),
  }));

await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
const getStarted = page.getByRole("button", { name: "Get started" });
if (await getStarted.isVisible().catch(() => false)) {
  await getStarted.click();
  await page.waitForTimeout(400);
}

// Stash one link through the hero field.
await page.getByPlaceholder("Paste a link").click();
await page.keyboard.type("https://weidian.com/item.html?itemID=7234567890");
await page.getByRole("button", { name: "Stash a link or note" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOTS + "4-after-stash.png" });
console.log("after stash:", JSON.stringify(await shelfState()));

// The stash must auto-open the Inbox while the card indexes (2026-07-25 fix —
// the Shelf tab used to lie "Nothing on the shelf yet" right after a stash).
const inboxSelected = await page
  .$eval("#view-tab-inbox", (t) => t.getAttribute("aria-selected"))
  .catch(() => "no-inbox-tab");
console.log("inbox tab selected after stash:", inboxSelected);

// Card detail: wait for indexing to finish (view snaps back to Shelf), then
// open + close the card.
const card = page.locator("[id^='card-']").first();
try {
  await card.waitFor({ state: "visible", timeout: 20000 });
} catch {
  console.log("NO CARD VISIBLE after stash");
}
if (await card.isVisible().catch(() => false)) {
  const shelfSelected = await page
    .$eval("#view-tab-shelf", (t) => t.getAttribute("aria-selected"))
    .catch(() => "no-shelf-tab");
  console.log("shelf tab selected after indexing:", shelfSelected);
  await page.screenshot({ path: SHOTS + "5-card-on-shelf.png" });
  await card.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOTS + "5b-card-open.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const s = await shelfState();
  console.log("after card close:", JSON.stringify(s));
  await page.screenshot({ path: SHOTS + "6-after-card-close.png" });
}

// Agent sheet: open through Profile → Default agent, then close.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Default agent/ }).click();
await page.waitForTimeout(800);
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
console.log("after agent close:", JSON.stringify(await shelfState()));

// Profile sheet: open + close.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: SHOTS + "7-profile.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
console.log("after profile close:", JSON.stringify(await shelfState()));

// Capture sheet once more, close via the X this time.
await page.getByRole("button", { name: /Stash to shelf/ }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Close Stash to shelf/ }).click();
await page.waitForTimeout(700);
console.log("after capture X close:", JSON.stringify(await shelfState()));
await page.screenshot({ path: SHOTS + "8-final-state.png" });

await browser.close();
console.log("done");

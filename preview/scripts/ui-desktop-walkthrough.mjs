// Full DESKTOP customer walkthrough. Fresh profile, 1440x900: intro →
// get started → empty shelf → stash a link → Inbox → Shelf → open card →
// buy row → flip back → search → Hauls → profile sheet → close everything.
// Mirrors ui-walkthrough.mjs (mobile). Screenshot every step for review.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const SHOTS = new URL("./ui-audit/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

const shot = (name) => page.screenshot({ path: `${SHOTS}d-${name}.png` });
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
// bar yet (the bar returns once something is stashed).
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

// 5. Stash a second card so the shelf has a pair (grid look). Desktop has
// no capture sheet (KM-03): + Stash reads the clipboard; without permission
// it shows the guidance tooltip; the advertised fallback is a global paste
// (⌘V anywhere stashes). Exercise exactly that path with a synthetic paste.
await page.getByRole("button", { name: /Stash the clipboard/ }).first().click();
await page.waitForTimeout(600);
await shot("06-clipboard-tooltip");
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.setData("text/plain", "https://weidian.com/item.html?itemID=7234567890");
  window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(1200);
await shot("06-second-stash-inbox");
await page.locator("[id^='card-']").nth(1).waitFor({ state: "visible", timeout: 25000 }).catch(() => {});
await page.waitForTimeout(800);
await shot("07-two-cards");

// 6. Desktop default is the carousel rack: cards flip IN PLACE (no overlay).
// Flip the FOREGROUND card to its back — background cards render no buttons.
const first = page.locator("[id^='card-'][data-foreground='true']").first();
await first.hover();
await page.waitForTimeout(500);
await shot("07b-card-hover");
await first.getByRole("button", { name: /Flip card for details/ }).click();
await page.waitForTimeout(900);
await shot("08-card-back");
const backBits = await first.evaluate((el) => ({
  hasHaul: /Add to a haul/.test(el.textContent || ""),
  hasStatus: /Want/.test(el.textContent || ""),
}));
console.log("card back bits:", JSON.stringify(backBits));

// 7. Flip back with the chevron.
await first.getByRole("button", { name: "Flip back" }).click();
await page.waitForTimeout(900);
await shot("08b-card-front-again");

// 8. Card view (grid): tap a card → modal over the grid → Escape closes it.
await page.getByRole("button", { name: "Card view" }).click();
await page.waitForTimeout(800);
await shot("08c-grid-view");
const gridCard = page.locator("[id^='card-']").first();
await gridCard.click();
await page.waitForTimeout(900);
const modalState = await page.evaluate(() => ({
  dialogs: document.querySelectorAll("dialog[open]").length,
  modal: !!document.querySelector(".t-modal, [class*='modal']"),
}));
console.log("after grid card tap:", JSON.stringify(modalState));
await shot("08d-grid-modal");
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);
const afterEsc = await state();
console.log("after modal close:", JSON.stringify(afterEsc));
if (afterEsc.scrollLocked) console.log("DEFECT: page still scroll-locked after Escape");
await shot("09-after-modal-close");

// 9. Search (desktop field — the mobile row stays in the DOM but hidden).
await page.locator(".cz-desk-search-field").fill("yupoo");
await page.waitForTimeout(600);
await shot("10-search");
await page.locator(".cz-desk-search-field").fill("");
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

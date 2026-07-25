// Repro Kyle's mobile complaints against the dev server (iPhone viewport):
// 1. How many "Paste a link"-ish surfaces show on the empty shelf?
// 2. Open the capture sheet, close it — is the screen blank?
// 3. Stash a single link, close the sheet — what renders (gray boxes)?
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
page.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 160));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });

// Past onboarding if it shows.
const getStarted = page.getByRole("button", { name: "Get started" });
if (await getStarted.isVisible().catch(() => false)) {
  await getStarted.click();
  await page.waitForTimeout(400);
}

await page.screenshot({ path: SHOTS + "1-empty-shelf.png" });

// Count paste-ish surfaces.
const pasteFields = await page.$$eval(
  'input[placeholder*="Paste"], textarea[placeholder*="Paste"], textarea[placeholder*="paste"]',
  (els) => els.map((e) => ({ tag: e.tagName, ph: e.placeholder, visible: !!e.offsetParent }))
);
console.log("paste fields:", JSON.stringify(pasteFields));
const stashButtons = await page.$$eval(
  "button",
  (els) =>
    els
      .filter((e) => /stash/i.test(e.textContent || "") && e.offsetParent)
      .map((e) => (e.textContent || "").trim().slice(0, 30))
);
console.log("visible stash buttons:", JSON.stringify(stashButtons));

// 2. Open the capture sheet, close it, screenshot.
await page.getByRole("button", { name: /open the capture sheet|stash a link or note/i }).first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: SHOTS + "2-capture-sheet.png" });
const dialogVisible = await page.$eval("dialog", (d) => d.open).catch(() => "no-dialog");
console.log("dialog open after stash tap:", dialogVisible);

// Close via the X.
await page.getByRole("button", { name: /close/i }).first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: SHOTS + "3-after-close.png" });
const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 200));
console.log("body after close:", bodyText);

await browser.close();
console.log("done");

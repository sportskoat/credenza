// Delete-confirmation probe: cancel keeps the card, confirm deletes it.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });
const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);
const prefs = {
  viewMode: "cards", sortMode: "recent", theme: "dark", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {},
};

const count = (page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1")).length);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(
  ({ shelfJson, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelfJson: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
});
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const base = await count(page);
console.log("base count:", base);

// Open the center card's back and go to Actions.
await page.getByText("FLIP FOR MORE").first().click({ force: true, timeout: 5000 });
await page.waitForTimeout(1200);
await page.getByLabel("Card actions").first().click({ force: true, timeout: 5000 });
await page.waitForTimeout(700);

// 1) Cancel path: Remove card → dialog → Keep.
await page.getByText("Remove card").first().click({ force: true, timeout: 5000 });
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, "probe-delete-dialog.png") });
const dialogText = await page.locator("dialog[open]").innerText().catch(() => "");
console.log("dialog text:", JSON.stringify(dialogText.slice(0, 140)));
await page.getByRole("button", { name: "Keep" }).click({ timeout: 3000 });
await page.waitForTimeout(600);
console.log("after Keep:", await count(page), "(expect", base + ")");

// 2) Confirm path: Remove card → dialog → Delete.
await page.getByText("Remove card").first().click({ force: true, timeout: 5000 });
await page.waitForTimeout(600);
console.log("dialogs:", await page.locator("dialog").count(), "open:", await page.locator("dialog[open]").count());
await page.screenshot({ path: join(outDir, "probe-delete-second.png") });
await page.locator("dialog[open]").getByRole("button", { name: "Delete", exact: true }).click({ timeout: 3000 });
await page.waitForTimeout(900);
console.log("after Delete:", await count(page), "(expect", base - 1 + ")");

console.log("console errors:", consoleErrors.length ? consoleErrors : "none");
await browser.close();

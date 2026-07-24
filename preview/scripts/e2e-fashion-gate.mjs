// E2E: the fashion gate — YouTube link gates + override works; Taobao passes.
import { webkit } from "playwright";
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
  viewMode: "cards",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L" },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
};

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

const count = () =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1")).length);
const base = await count();
console.log("base items:", base);

async function stashViaSheet(text) {
  await page.getByRole("button", { name: "Stash a link or note" }).first().click({ force: true });
  await page.waitForTimeout(700);
  await page.getByRole("textbox", { name: "Stash a link or note" }).fill(text);
  await page.getByRole("button", { name: "Stash", exact: true }).click({ force: true });
  await page.waitForTimeout(900);
}

// 1. YouTube link → gated toast, no new card.
await stashViaSheet("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
console.log("after youtube:", await count(), "(expect", base + ")");
await page.screenshot({ path: join(outDir, "gate-toast.png") });

// 2. "Stash anyway" → card appears.
await page.getByRole("button", { name: "Stash anyway" }).click({ force: true });
await page.waitForTimeout(1200);
console.log("after stash-anyway:", await count(), "(expect", base + 1 + ")");

// 3. Taobao link → straight through, no gate.
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
await stashViaSheet("https://item.taobao.com/item.htm?id=752339164885");
console.log("after taobao:", await count(), "(expect", base + 2 + ")");
const gateToast = await page.getByText("doesn't look like a fashion link").count();
console.log("gate toast on taobao:", gateToast, "(expect 0)");

await browser.close();

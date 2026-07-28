// Split-rail verification: shoot the desktop detail modal (chart-read state)
// so the layout can be compared against the mockup. One-off; not a gate.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";

const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json"), "utf8")
);

const chartText = [
  "Size chart (cm)",
  "Size  Waist  Hip  Length",
  "S  76  100  45",
  "M  80  104  46",
  "L  84  108  47",
  "XL  88  112  48",
].join("\n");
const synthetic = {
  ...items[0],
  id: "railcheck1",
  createdAt: Date.now() + 1000,
  updatedAt: Date.now() + 1000,
  title: "Arc Shorts",
  seller: "Beverly Luxury",
  category: "shorts",
  size: "L",
  colorway: "Black",
  findStatus: "want",
  sizeNotes: chartText,
  note: "",
};
const shelfJson = JSON.stringify([synthetic, ...items.slice(0, 3)]);

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 96, height: 178, weight: 75 },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: { shorts: { length: null, looseness: null, dismissed: true } },
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: shelfJson, prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: join(outDir, "rail-0-loaded.png") });
console.log("shot: rail-0-loaded");
const names = await page
  .getByRole("button")
  .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.textContent.trim()).filter(Boolean).slice(0, 40));
console.log("buttons:", JSON.stringify(names));

await page.getByRole("button", { name: "List view" }).first().click({ force: true });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, "rail-0b-list.png") });
console.log("shot: rail-0b-list");
// Grid tap → expandedId → DesktopDetailPanel (the split rail) at ≥1024px.
await page.getByText("Arc Shorts").first().click({ force: true });
await page.waitForTimeout(1800);
await page.screenshot({ path: join(outDir, "rail-1-size-row.png") });
console.log("shot: rail-1-size-row");
await context.close();

// Phone: the size chips must still be a full-width row after the fit read.
import { devices } from "playwright";
const pctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
await pctx.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: shelfJson, prefsJson: JSON.stringify(prefs) }
);
const ppage = await pctx.newPage();
ppage.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await ppage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await ppage.waitForTimeout(3500);
await ppage.getByRole("button", { name: /^Open Arc Shorts$/ }).first().click({ force: true });
await ppage.waitForTimeout(1400);
await ppage.evaluate(() => {
  const s = document.querySelector(".cz-detail-modal .cz-detail-scroll");
  if (s) s.scrollTop = 1150;
});
await ppage.waitForTimeout(500);
await ppage.screenshot({ path: join(outDir, "rail-1-phone-size.png") });
console.log("shot: rail-1-phone-size");
await pctx.close();

await browser.close();

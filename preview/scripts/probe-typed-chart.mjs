// Typed chart + missing column proof (Kyle, 2026-07-30: "showing a clear
// warning [when it is] not measured … and let you type the chart numbers by
// hand in twenty seconds … and then read the numbers out of the chart photos
// with the AI reader").
//
// One card, a plain set-in-sleeve shirt. Its chart prints chest and length
// only — no shoulder, no sleeve. (A "tee" or a "boxy" cut would hide those two
// rows for a different reason, which is not what this probe is about.)
// Shot 1: the FIT READ table. The shoulder row reads "n/a" and the footnote
// names the column the seller does not print.
// Shot 2: the hand-typing grid, opened by "Input sizing chart manually", with the size
// names and the four top columns ready to fill.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:5347";

const THIN_CHART = [
  "Size chart (cm)",
  "M: chest 112, length 70",
  "L: chest 116, length 72",
  "XL: chest 120, length 74",
].join("\n");

const now = Date.now();
const items = [
  {
    id: "typed-1",
    createdAt: now,
    updatedAt: now,
    rawText: "https://mook-official.x.yupoo.com/albums/239021655?uid=1",
    url: "https://mook-official.x.yupoo.com/albums/239021655?uid=1",
    type: "article",
    host: "mook-official.x.yupoo.com",
    title: "Heavy cotton oxford shirt",
    summary: "",
    tags: [],
    links: [],
    gallery: [],
    price: 139,
    currency: "CNY",
    seller: "mook-official",
    sellerAccount: "mook-official",
    category: "shirt",
    size: "",
    colorway: "Black",
    findStatus: "want",
    sizeNotes: THIN_CHART,
    sizeChartSource: { via: "album-text", at: "2026-07-30T10:00:00.000Z" },
  },
];

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  theme: "rainbow",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  // The body HAS a shoulder. The chart does not. That is the whole point.
  bodyProfile: { height: 180, weight: 75, chest: 104, shoulder: 46, sleeve: 62 },
  measureUnits: "cm",
  onboardingDone: true,
};

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["iPhone 15 Pro"],
  viewport: { width: 393, height: 1600 },
});
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

await page.getByRole("button", { name: /^Open Heavy cotton oxford shirt$/ }).click({ force: true });
await page.waitForTimeout(1200);
const cell = page.locator(".cz-detail-modal .cz-detail-cell", { hasText: "Size · fit" });
if (await cell.count()) {
  await cell.first().click({ force: true });
  await page.waitForTimeout(800);
}
await page.evaluate(() => {
  const el = document.querySelector(".cz-fitread");
  if (el) el.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(600);

const rows = await page.locator(".cz-fitread-row").allTextContents();
const footnote = await page.locator(".cz-fitread-footnote").first().textContent();
await page.locator(".cz-fitread").first().screenshot({ path: join(outDir, "typed-1-missing-column.png") });

await page.getByRole("button", { name: "Input sizing chart manually" }).click({ force: true });
await page.waitForTimeout(700);
await page.evaluate(() => {
  const el = document.querySelector(".cz-sizing-fix");
  if (el) el.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(400);
const gridRows = await page.locator(".cz-sizing-fix.is-typed .cz-sizing-fix-row").count();
const gridCols = await page.locator(".cz-sizing-fix-col").allTextContents();
await page.locator(".cz-sizing-reading").first().screenshot({ path: join(outDir, "typed-2-grid.png") });

console.log(JSON.stringify({ rows, footnote, gridRows, gridCols }, null, 2));
await context.close();
await browser.close();
console.log("done");

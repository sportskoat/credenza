// Fit engine v2 proof (Kyle, #design 2026-07-30). Three cards, ONE body and
// ONE size chart. Only the title differs. If the engine works, the three cards
// name three different sizes and each says why in plain words.
//
//   Blazer  → 7.5–12.5cm of room → the M
//   Coat    → 12.5–20cm  of room → the L
//   Dry-fit → -2.5–2.5cm of room → the S
//
// A fourth card proves the shoulder rule: a drop-shoulder tee whose shoulders
// hang 8cm past the body must NOT warn about the shoulder.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:5347";

// One chart, four garments. Chest steps 104 / 110 / 118 / 126.
const CHART = [
  "Size chart (cm)",
  "S: chest 104, shoulder 44, length 68",
  "M: chest 110, shoulder 46, length 70",
  "L: chest 118, shoulder 48, length 72",
  "XL: chest 126, shoulder 50, length 74",
].join("\n");
// Shoulders that hang far past a 45cm body, so the shoulder rule is visible.
const DROP_CHART = [
  "Size chart (cm)",
  "M: chest 110, shoulder 52, length 70",
  "L: chest 118, shoulder 54, length 72",
].join("\n");

const now = Date.now();
const card = (id, title, category, chart, i) => ({
  id,
  createdAt: now + i * 1000,
  updatedAt: now + i * 1000,
  rawText: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
  url: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
  type: "article",
  host: "mook-official.x.yupoo.com",
  title,
  summary: "",
  tags: [],
  links: [],
  gallery: [],
  price: 229,
  currency: "CNY",
  seller: "Mook-official",
  sellerAccount: "mook-official",
  category,
  size: "",
  colorway: "Black",
  findStatus: "want",
  sizeNotes: chart,
  sizeChartSource: { via: "album-text", at: "2026-07-30T10:00:00.000Z" },
});

// Kyle 2026-07-30: the saved shorts length is waist to hem, the same
// measurement the chart prints, so the panel compares like with like.
const SHORTS_CHART = [
  "Size chart (cm)",
  "M: waist 78, hip 100, pants length 44",
  "L: waist 82, hip 104, pants length 48",
].join("\n");

const items = [
  card("v2-shorts", "Cotton short", "shorts", SHORTS_CHART, 5),
  card("v2-drop", "Oversized drop shoulder tee", "shirt", DROP_CHART, 4),
  card("v2-dry", "Dri-FIT training top", "shirt", CHART, 3),
  card("v2-coat", "Down puffer jacket", "outerwear", CHART, 2),
  card("v2-blazer", "Wool blazer", "outerwear", CHART, 1),
];

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  theme: "rainbow",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  // One body for every card. Chest 100, shoulder 45.
  bodyProfile: { chest: 100, shoulder: 45, height: 178, weight: 75, waist: 80, shortsLength: 46 },
  measureUnits: "cm",
  onboardingDone: true,
};

const browser = await chromium.launch();
// A phone width, but a tall viewport: the sizing block is taller than a real
// phone screen, and a picture that cuts it in half proves nothing.
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

const results = [];
for (const [id, title] of [
  ["v2-blazer", "Wool blazer"],
  ["v2-coat", "Down puffer jacket"],
  ["v2-dry", "Dri-FIT training top"],
  ["v2-drop", "Oversized drop shoulder tee"],
  ["v2-shorts", "Cotton short"],
]) {
  await page.getByRole("button", { name: new RegExp("^Open " + title + "$") }).click({ force: true });
  await page.waitForTimeout(1200);
  const size = await page.locator(".cz-sizing-value").first().textContent().catch(() => null);
  const why = await page.locator(".cz-sizing-why").first().textContent().catch(() => null);
  await page.screenshot({ path: join(outDir, "v2-" + id + "-1-sheet.png") });
  // Open the fit block for the garment line and the FIT READ table.
  const cell = page.locator(".cz-detail-modal .cz-detail-cell", { hasText: "Size · fit" });
  if (await cell.count()) {
    await cell.first().click({ force: true });
    await page.waitForTimeout(800);
  }
  // Scroll the sizing block into view before the picture — the sheet opens at
  // the photos, and a shot of the top proves nothing about the fit.
  await page.evaluate(() => {
    const el = document.querySelector(".cz-sizing");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(600);
  const prose = await page.locator(".cz-sizing-garment, .cz-fit4-prose").allTextContents().catch(() => []);
  const warnCount = await page.locator(".cz-fitread-mark.is-warn").count().catch(() => 0);
  const rows = await page.locator(".cz-fitread-row").allTextContents().catch(() => []);
  await page.screenshot({ path: join(outDir, "v2-" + id + "-2-fit.png") });
  results.push({ id, title, size: (size || "").trim(), why: (why || "").trim(), prose, warnCount, rows });
  // Back to the shelf.
  const close = page.getByRole("button", { name: /Close|Back/ }).first();
  if (await close.count()) await close.click({ force: true });
  await page.waitForTimeout(900);
}

console.log(JSON.stringify(results, null, 2));
await context.close();
await browser.close();
console.log("done");

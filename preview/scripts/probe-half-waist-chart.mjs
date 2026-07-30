// Half-waist chart proof (Kyle, #design 2026-07-30: "half-chest and half-waist:
// can't those be easily calculated? we should only use what the charts are
// using, right?").
//
// Two shorts cards, ONE body. The two charts describe the SAME garment:
//   A — the seller prints half the waist and half the hip ("1/2Waist 38")
//   B — the seller prints the full circumference ("waist 76")
// If the reader works, both cards name the same size, print the same waist
// number, and keep the seller's own S / M / L names. Before this fix card A
// named three sizes called 36, 38 and 40 and threw the waist away.
//
// The picture also proves the shorts length line: both numbers are waist to
// hem now, so the line states the difference and never estimates.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:5347";

const HALF_CHART = [
  "Size chart (cm)",
  "S: 1/2Waist 36, 1/2Hip 48, pants length 44",
  "M: 1/2Waist 38, 1/2Hip 50, pants length 46",
  "L: 1/2Waist 40, 1/2Hip 52, pants length 48",
].join("\n");
const FULL_CHART = [
  "Size chart (cm)",
  "S: waist 72, hip 96, pants length 44",
  "M: waist 76, hip 100, pants length 46",
  "L: waist 80, hip 104, pants length 48",
].join("\n");

const now = Date.now();
const card = (id, title, chart, i) => ({
  id,
  createdAt: now + i * 1000,
  updatedAt: now + i * 1000,
  rawText: "https://thethunder.x.yupoo.com/albums/239021655?uid=1",
  url: "https://thethunder.x.yupoo.com/albums/239021655?uid=1",
  type: "article",
  host: "thethunder.x.yupoo.com",
  title,
  summary: "",
  tags: [],
  links: [],
  gallery: [],
  price: 129,
  currency: "CNY",
  seller: "thethunder",
  sellerAccount: "thethunder",
  category: "shorts",
  size: "",
  colorway: "Black",
  findStatus: "want",
  sizeNotes: chart,
  sizeChartSource: { via: "album-text", at: "2026-07-30T10:00:00.000Z" },
});

const items = [
  card("half-b", "Mesh short full chart", FULL_CHART, 2),
  card("half-a", "Mesh short half chart", HALF_CHART, 1),
];

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  theme: "rainbow",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  // One body for both cards. Waist 80, hip 98, shorts length 46 waist to hem.
  bodyProfile: { height: 178, weight: 75, waist: 80, hip: 98, shortsLength: 46 },
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

const results = [];
for (const [id, title] of [
  ["half-a", "Mesh short half chart"],
  ["half-b", "Mesh short full chart"],
]) {
  await page.getByRole("button", { name: new RegExp("^Open " + title + "$") }).click({ force: true });
  await page.waitForTimeout(1200);
  const size = await page.locator(".cz-sizing-value").first().textContent().catch(() => null);
  const why = await page.locator(".cz-sizing-why").first().textContent().catch(() => null);
  const cell = page.locator(".cz-detail-modal .cz-detail-cell", { hasText: "Size · fit" });
  if (await cell.count()) {
    await cell.first().click({ force: true });
    await page.waitForTimeout(800);
  }
  await page.evaluate(() => {
    const el = document.querySelector(".cz-sizing");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(600);
  const chips = await page.locator(".cz-sizing-chip").allTextContents().catch(() => []);
  const prose = await page.locator(".cz-sizing-garment, .cz-fit4-prose").allTextContents().catch(() => []);
  const rows = await page.locator(".cz-fitread-row").allTextContents().catch(() => []);
  const warnCount = await page.locator(".cz-fitread-mark.is-warn").count().catch(() => 0);
  await page.screenshot({ path: join(outDir, "half-" + id + "-fit.png") });
  results.push({ id, title, size: (size || "").trim(), why: (why || "").trim(), chips, prose, rows, warnCount });
  const close = page.getByRole("button", { name: /Close|Back/ }).first();
  if (await close.count()) await close.click({ force: true });
  await page.waitForTimeout(900);
}

console.log(JSON.stringify(results, null, 2));
await context.close();
await browser.close();
console.log("done");

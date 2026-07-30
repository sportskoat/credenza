// Kyle 2026-07-30: "upload and type the numbers should be the same format as
// 'edit my measurements' and forget this chart. type the numbers should be
// changed to 'input sizing chart manually'".
//
// Shoots the foot of the fit table on the desktop panel and reports the four
// controls' computed colour, size and height, so "same format" is a number and
// not an opinion.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:5352";

const CHART = [
  "Size chart (cm)",
  "S: chest 110, length 68, shoulder 44, sleeve 20",
  "M: chest 116, length 70, shoulder 46, sleeve 21",
  "L: chest 122, length 72, shoulder 48, sleeve 22",
  "XL: chest 128, length 74, shoulder 50, sleeve 23",
].join("\n");

const now = Date.now();
const items = [
  {
    id: "chart-links-1",
    createdAt: now,
    updatedAt: now,
    rawText: "https://weidian.com/item.html?itemID=7739297298",
    url: "https://weidian.com/item.html?itemID=7739297298",
    type: "article",
    host: "weidian.com",
    title: "Heavy cotton oxford shirt",
    summary: "",
    tags: [],
    links: [],
    gallery: [],
    price: 199,
    currency: "CNY",
    seller: "mook-official",
    sellerAccount: "mook-official",
    category: "shirt",
    size: "",
    colorway: "Black",
    findStatus: "want",
    sizeNotes: CHART,
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
  bodyProfile: { height: 180, weight: 75, chest: 104, shoulder: 46, sleeve: 62 },
  measureUnits: "in",
  onboardingDone: true,
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
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
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const el = document.querySelector(".cz-detail-chart-actions");
  if (el) el.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(500);

const report = await page.evaluate(() => {
  const read = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      label: el.textContent.trim(),
      color: cs.color,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      border: cs.borderTopWidth,
      background: cs.backgroundColor,
      height: Math.round(r.height),
      top: Math.round(r.top),
    };
  };
  const foot = [...document.querySelectorAll(".cz-fitread-footlinks .cz-fitread-footlink")];
  const actions = [...document.querySelectorAll(".cz-detail-chart-actions button")];
  return { footlinks: foot.map(read), chartActions: actions.map(read) };
});
console.log(JSON.stringify(report, null, 2));

const foot = page.locator(".cz-fitread-foot").first();
const box = await foot.boundingBox();
const actions = await page.locator(".cz-detail-chart-actions").first().boundingBox();
await page.screenshot({
  path: join(outDir, "chart-links.png"),
  clip: {
    x: Math.max(0, box.x - 16),
    y: box.y - 30,
    width: Math.min(1440 - box.x + 16, box.width + 32),
    height: actions.y + actions.height - box.y + 46,
  },
});

await context.close();
await browser.close();
console.log("done");

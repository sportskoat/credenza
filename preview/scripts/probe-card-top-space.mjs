// Kyle 2026-07-30: "still too much Whitespace at the top of this card, take it
// out AND TAKE THE LINE OUT. LESS WHITESPACE".
//
// The card is the DESKTOP detail panel. The band Kyle points at runs from the
// bottom of the chip row (WEIGHT / CATEGORY) to the "AI SIZE" kicker, and it
// carries a hairline across it. This probe measures that band in CSS pixels and
// reports whether the hairline is drawn.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:5347";

const CHART = [
  "Size chart (cm)",
  "S: chest 110, length 68",
  "M: chest 116, length 70",
  "L: chest 122, length 72",
  "XL: chest 128, length 74",
].join("\n");

const now = Date.now();
const items = [
  {
    id: "top-space-1",
    createdAt: now,
    updatedAt: now,
    rawText: "https://mook-official.x.yupoo.com/albums/239021655?uid=1",
    url: "https://mook-official.x.yupoo.com/albums/239021655?uid=1",
    type: "article",
    host: "mook-official.x.yupoo.com",
    title: "Vintage Washed Short Sleeve T-Shirt",
    summary: "",
    tags: [],
    links: [],
    gallery: [],
    price: 99,
    currency: "CNY",
    seller: "mook-official",
    sellerAccount: "mook-official",
    category: "shirt",
    size: "",
    colorway: "Black (AC908026)",
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
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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

await page
  .getByRole("button", { name: /^Open Vintage Washed Short Sleeve T-Shirt$/ })
  .click({ force: true });
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const sizing = q(".cz-sizing");
  if (!sizing) return { error: "no .cz-sizing on the page" };
  const facts = q(".cz-detail-facts");
  const section = sizing.closest(".cz-detail-facts-section");
  const kicker = sizing.querySelector(".cz-sizing-kicker");
  // The chip row is the command bar. On desktop it portals above both columns.
  const bar = q(".cz-cmdbar") || q(".cz-detail-cmdbar") || q(".cz-detail-commandbar");
  const box = (el) => (el ? el.getBoundingClientRect() : null);
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const s = cs(sizing);
  const f = cs(facts);
  const sec = cs(section);
  return {
    barClass: bar ? bar.className : null,
    barBottom: bar ? box(bar).bottom : null,
    factsTop: facts ? box(facts).top : null,
    sectionTop: section ? box(section).top : null,
    sizingTop: box(sizing).top,
    kickerTop: kicker ? box(kicker).top : null,
    gapBarToKicker: bar && kicker ? box(kicker).top - box(bar).bottom : null,
    factsMarginTop: f ? f.marginTop : null,
    sectionPaddingTop: sec ? sec.paddingTop : null,
    sizingMarginTop: s.marginTop,
    sizingPaddingTop: s.paddingTop,
    sizingBorderTop: s.borderTopWidth + " " + s.borderTopStyle + " " + s.borderTopColor,
  };
});

console.log(JSON.stringify(report, null, 2));

const panel = page.locator(".cz-dpanel").first();
const target = (await panel.count()) ? panel : page.locator(".cz-detail-modal").first();
await target.screenshot({ path: join(outDir, "card-top-space.png") });

await context.close();
await browser.close();
console.log("done");

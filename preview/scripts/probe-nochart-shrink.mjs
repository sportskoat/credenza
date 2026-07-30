// Kyle 2026-07-30, #design: "don't make these three things super. Only show the
// type in the chart photo. If we can't find the chart, we don't want this to
// take up the entire right side of the page."
//
// Two pictures, both of the "Size and fit" section on a desktop window, so the
// height of the right side is the thing being judged:
//   1. chart found  → the one-word type tag on the chart panel header
//   2. no chart     → the collapsed state
//
// The section height is printed for both, because "takes up the whole side" is
// a number, not an opinion.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";
const now = Date.now();

const CHART_TEXT =
  "M: chest 112 length 70 shoulder 46\nL: chest 116 length 72 shoulder 48\nXL: chest 120 length 74 shoulder 50";

function item(over = {}) {
  return {
    id: "shrink-1",
    createdAt: now - 86400000 * 2,
    updatedAt: now,
    rawText: "https://weidian.com/item.html?itemID=7799763843",
    url: "https://weidian.com/item.html?itemID=7799763843",
    type: "article",
    host: "weidian.com",
    title: "Mutimer Wool Blazer",
    summary: "Heavy wool body. Ships from Guangzhou.",
    tags: [],
    image:
      "https://si.geilicdn.com/pcitem1725553858-6a5e00000191d9d3e1a90a20f3b8-unadjust_640_640.jpg",
    gallery: [],
    links: [],
    price: 249,
    currency: "CNY",
    seller: "Mook-official",
    category: "jacket",
    findStatus: "want",
    weidianUrl: "https://weidian.com/item.html?itemID=7799763843",
    variants: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
    ...over,
  };
}

const prefs = {
  viewMode: "carousel",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: "superbuy",
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", usualTops: "L", chest: 100, height: 180, weight: 78 },
  measureUnits: "cm",
  onboardingDone: true,
};

const browser = await chromium.launch();

async function seeded(items) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
  );
  // The automatic hunt must always miss, or the "no chart" item sizes itself.
  await context.route("**/chart-vision", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ found: false }),
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /^Open Mutimer/ }).first().click({ force: true });
  await page.waitForTimeout(2200);
  return { context, page };
}

async function report(page, name) {
  const section = page.locator('section[aria-label="Size and fit"]').first();
  if (!(await section.count())) {
    console.log("MISSING SECTION:", name);
    return;
  }
  await section.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  await section.screenshot({ path: join(outDir, name + ".png") });
  const facts = await section.evaluate((el) => ({
    height: Math.round(el.getBoundingClientRect().height),
    typeTag: (el.querySelector(".cz-sizing-type") || {}).textContent || null,
    fitTable: !!el.querySelector(".cz-fitread"),
    confidence: !!el.querySelector(".cz-fit4"),
    reasonSentence: !!el.querySelector(".cz-sizing-why"),
    nochartBody: (el.querySelector(".cz-sizing-nochart-body") || {}).textContent || null,
    buttons: [...el.querySelectorAll("button")].map((b) => b.textContent.trim()).filter(Boolean),
  }));
  console.log(name, JSON.stringify(facts, null, 2));
}

{
  const { context, page } = await seeded([item({ sizeChartText: CHART_TEXT })]);
  await report(page, "shrink-1-chart-found");
  await context.close();
}
{
  const { context, page } = await seeded([item({ id: "shrink-2" })]);
  await report(page, "shrink-2-no-chart");
  await context.close();
}

await browser.close();

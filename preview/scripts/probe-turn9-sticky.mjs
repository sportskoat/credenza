// Verify handoff turn 9 §9 (phone sticky bar) on the phone sheet. Five shots:
// the sheet at rest, the sheet scrolled so the bar is up, the same pair on a
// SHIPPED item where the QC prompt appears, and the QC prompt in close-up.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";
const now = Date.now();

function item(over = {}) {
  return {
    id: "t9s-1",
    createdAt: now - 86400000 * 3,
    updatedAt: now,
    rawText: "https://weidian.com/item.html?itemID=7799763843",
    url: "https://weidian.com/item.html?itemID=7799763843",
    type: "article",
    host: "weidian.com",
    title: "Mutimer Wool Varsity Jacket",
    summary: "M: chest 112 length 70\nL: chest 116 length 72\nXL: chest 120 length 74",
    tags: [],
    image: null,
    gallery: [],
    links: [],
    price: 249,
    currency: "CNY",
    seller: "Mook-official",
    category: "jacket",
    project: "winter",
    findStatus: "want",
    size: "L",
    weidianUrl: "https://weidian.com/item.html?itemID=7799763843",
    variants: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
    note: "Ask the agent for a zip close-up in QC. The collar ribbing is the tell on this batch, so a straight-on shot of the neck matters more than the tag.",
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
  bodyProfile: { usualSize: "L", chest: 100, height: 180, weight: 78 },
  measureUnits: "cm",
  onboardingDone: true,
};

const browser = await chromium.launch();

async function newSeededPage(items) {
  const context = await browser.newContext({ ...devices["iPhone 15 Pro"] });
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
  await page.waitForTimeout(3500);
  return { context, page };
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name + ".png") });
  console.log("shot:", name);
}

async function openSheet(page) {
  await page.getByRole("button", { name: /^Open Mutimer/ }).first().click({ force: true });
  await page.waitForTimeout(1400);
}

// The bar only rises once the photo block is fully gone, so scroll the sheet's
// own scroller — not the window. The observer root IS that scroller.
async function scrollSheet(page, top) {
  await page.evaluate((y) => {
    const el = document.querySelector(".cz-detail-scroll");
    if (el) el.scrollTop = y;
  }, top);
  await page.waitForTimeout(700);
}

// One assignment does not reach the bottom: the notes clamp and the QC prompt
// both grow the scroll height after the first paint. Repeat until it settles.
async function scrollToBottom(page) {
  for (let i = 0; i < 5; i += 1) {
    await page.evaluate(() => {
      const el = document.querySelector(".cz-detail-scroll");
      if (el) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(450);
  }
}

// --- WANT item: bar down, then bar up. No QC prompt at this status. ---
{
  const { context, page } = await newSeededPage([item()]);
  await openSheet(page);
  await shot(page, "t9-sticky-1-at-rest");
  await scrollSheet(page, 520);
  await shot(page, "t9-sticky-2-bar-up");
  const up = await page.evaluate(
    () => !!document.querySelector(".cz-detail-stickybar.is-up")
  );
  console.log("bar is up:", up);
  const qc = await page.evaluate(() => !!document.querySelector(".cz-detail-qc-prompt"));
  console.log("qc prompt on WANT (expect false):", qc);
  await context.close();
}

// --- SHIPPED item: the QC prompt is the last block in the sheet. ---
{
  const { context, page } = await newSeededPage([item({ findStatus: "shipped" })]);
  await openSheet(page);
  await scrollToBottom(page);
  await shot(page, "t9-sticky-3-qc-prompt");
  const qc = await page.evaluate(() => !!document.querySelector(".cz-detail-qc-prompt"));
  console.log("qc prompt on SHIPPED (expect true):", qc);
  const box = await page.locator(".cz-detail-qc-prompt").first();
  if (await box.count()) {
    await box.screenshot({ path: join(outDir, "t9-sticky-4-qc-closeup.png") });
    console.log("shot: t9-sticky-4-qc-closeup");
  }
  await context.close();
}

// --- Same item with a QC photo already in: the prompt must be gone. ---
{
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
  const { context, page } = await newSeededPage([
    item({ findStatus: "shipped", qcPhotos: [png] }),
  ]);
  await openSheet(page);
  const qc = await page.evaluate(() => !!document.querySelector(".cz-detail-qc-prompt"));
  console.log("qc prompt when a QC photo exists (expect false):", qc);
  await context.close();
}

await browser.close();
console.log("done");

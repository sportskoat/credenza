// Verify handoff turn 9 §8 (Buy notch + agent picker) on the phone sheet and
// the desktop detail panel. Four shots: notch closed, picker open, and the
// same pair at desktop width where the footer also carries the big price.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";
const now = Date.now();

const items = [
  {
    id: "t9n-1",
    createdAt: now - 86400000 * 3,
    updatedAt: now,
    rawText: "https://weidian.com/item.html?itemID=7799763843",
    url: "https://weidian.com/item.html?itemID=7799763843",
    type: "article",
    host: "weidian.com",
    title: "Mutimer Wool Varsity Jacket",
    summary: "",
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
    weidianUrl: "https://weidian.com/item.html?itemID=7799763843",
    variants: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
    note: "Ask the agent for a zip close-up in QC.",
  },
];

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

async function newSeededPage(contextOpts) {
  const context = await browser.newContext(contextOpts);
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

// --- Phone sheet. ---
{
  const { context, page } = await newSeededPage({ ...devices["iPhone 15 Pro"] });
  await page.getByRole("button", { name: /^Open Mutimer/ }).first().click({ force: true });
  await page.waitForTimeout(1400);
  await shot(page, "t9-notch-1-phone-closed");
  await page.getByRole("button", { name: "Choose buying agent" }).first().click({ force: true });
  await page.waitForTimeout(600);
  await shot(page, "t9-notch-2-phone-open");
  await context.close();
}

// --- Desktop panel: the footer also carries the 26px price. ---
{
  const { context, page } = await newSeededPage({ viewport: { width: 1440, height: 900 } });
  const carouselBtn = page.getByRole("button", { name: "Carousel view" });
  if (await carouselBtn.count()) {
    await carouselBtn.first().click({ force: true });
    await page.waitForTimeout(1200);
  }
  await page.getByRole("button", { name: /Mutimer Wool Varsity/ }).first().click({ force: true });
  await page.waitForTimeout(1600);
  await shot(page, "t9-notch-3-desktop-closed");
  await page.getByRole("button", { name: "Choose buying agent" }).first().click({ force: true });
  await page.waitForTimeout(600);
  await shot(page, "t9-notch-4-desktop-open");
  await context.close();
}

await browser.close();
console.log("done");

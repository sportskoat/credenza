// Verify handoff turn 9 §1 (chips), §2 (sizing block), §5 (status track),
// and §6 (timeline) on both the phone sheet and the desktop card back.
// One item carries a real chart so the sizing block shows the AI state; a
// second is off-track (rl) so the detour node and the missing next-action
// pill are visible in the same pass.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";

const chartText = [
  "Size chart (cm)",
  "Size  Chest  Length",
  "S  108  66",
  "M  112  68",
  "L  116  70",
  "XL  120  72",
].join("\n");

const now = Date.now();
function item(over = {}) {
  return {
    id: "t9-" + (over.id || "1"),
    createdAt: now - 86400000 * 3,
    updatedAt: now,
    rawText: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
    url: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
    type: "article",
    host: "mook-official.x.yupoo.com",
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
    sizeNotes: chartText,
    note: "The Mutimer jacket is very clean and has a more mature look compared to the varsity — wear it over the cream knit. Ask the agent for a zip close-up in QC.",
    ...over,
  };
}

const items = [
  item({ id: "1" }),
  item({
    id: "2",
    title: "Chrome Hearts Cross Tee",
    findStatus: "rl",
    project: "",
    size: "XL",
    createdAt: now - 86400000 * 9,
  }),
];

const prefs = {
  viewMode: "carousel",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: null,
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

// --- Phone sheet: the model the handoff drew (9c). ---
{
  const { context, page } = await newSeededPage({ ...devices["iPhone 15 Pro"] });
  await page.getByRole("button", { name: /^Open Mutimer/ }).first().click({ force: true });
  await page.waitForTimeout(1400);
  await shot(page, "t9-phone-1-top");
  // §4: strip + the 2-up album links, directly under the photo.
  await page.evaluate(() => {
    const s = document.querySelector(".cz-detail-modal .cz-detail-scroll");
    if (s) s.scrollTop = 180;
  });
  await page.waitForTimeout(500);
  await shot(page, "t9-phone-7-album-links");
  await page.evaluate(() => {
    const s = document.querySelector(".cz-detail-modal .cz-detail-scroll");
    if (s) s.scrollTop = 380;
  });
  await page.waitForTimeout(500);
  await shot(page, "t9-phone-2-sizing");
  await page.evaluate(() => {
    const s = document.querySelector(".cz-detail-modal .cz-detail-scroll");
    if (s) s.scrollTop = 760;
  });
  await page.waitForTimeout(500);
  await shot(page, "t9-phone-3-status");

  // Notes (§7): the seeded note is longer than 3 lines, so the clamp and the
  // EXPAND control both have to be doing real work in this pair of shots.
  await page.evaluate(() => {
    const box = document.querySelector(".cz-detail-modal .cz-detail-notes-box");
    if (box) box.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(500);
  await shot(page, "t9-phone-5-notes-clamped");
  await page.getByRole("button", { name: /Expand/ }).first().click({ force: true });
  await page.waitForTimeout(600);
  await shot(page, "t9-phone-6-notes-open");

  // The off-track item: detour node, no next-action pill.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^Open Chrome Hearts/ }).first().click({ force: true });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = document.querySelector(".cz-detail-modal .cz-detail-scroll");
    if (s) s.scrollTop = 700;
  });
  await page.waitForTimeout(500);
  await shot(page, "t9-phone-4-detour");
  await context.close();
}

// --- Desktop card back: same body, wider rail. ---
{
  const { context, page } = await newSeededPage({ viewport: { width: 1440, height: 900 } });
  const carouselBtn = page.getByRole("button", { name: "Carousel view" });
  if (await carouselBtn.count()) {
    await carouselBtn.first().click({ force: true });
    await page.waitForTimeout(1200);
  }
  await page.getByRole("button", { name: /Flip / }).first().click({ force: true });
  await page.waitForTimeout(1400);
  await shot(page, "t9-desktop-1-back");
  await page.evaluate(() => {
    const s = document.querySelector(".cz-carousel-card-inner.is-flipped .cz-detail-scroll");
    if (s) s.scrollTop = 520;
  });
  await page.waitForTimeout(500);
  await shot(page, "t9-desktop-2-status");
  await context.close();
}

await browser.close();
console.log("done");

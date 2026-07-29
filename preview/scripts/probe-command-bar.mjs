// One-off: capture the item-detail command bar (handoff 2026-07-29 §5) on the
// LIVE page, desktop and phone, in both colourways, with each popover open.
//
// Why the live page and not a static HTML file: the theme variables are set as
// inline styles by the app (THEMES, credenza-fashion.jsx:233). In a static page
// `background: var(--cz-card)` collapses to transparent, so a probe reports a
// clean panel that the real app never draws.
import { webkit, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots", "cmdbar");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:5347";

const chartText = [
  "Size chart (cm)",
  "Size  Chest  Shoulder  Sleeve",
  "S  96  43  59",
  "M  100  44.5  61",
  "L  104  46  63",
  "XL  108  47.5  65",
].join("\n");

const now = Date.now();
// Two items on purpose: one with every chip set, one with none of them set.
// Rule 4 of the handoff (no empty chrome) can only be checked on the empty one.
const items = [
  {
    id: "cb-full",
    createdAt: now,
    updatedAt: now,
    url: "https://weidian.com/item.html?itemID=7001",
    title: "M31762-51E",
    image: "https://si.geilicdn.com/nope-1.jpg",
    gallery: ["https://si.geilicdn.com/nope-2.jpg", "https://si.geilicdn.com/nope-3.jpg"],
    links: [{ url: "https://weidian.com/item.html?itemID=7001", role: "buy" }],
    price: 179,
    currency: "CNY",
    seller: "mook-offcical",
    sellerAccount: "mook",
    category: "shirt",
    size: "L",
    colorway: "Navy",
    weightGrams: 420,
    project: "casuals",
    findStatus: "bought",
    sizeNotes: chartText,
    sizeChartSource: { via: "album-text", at: new Date(now).toISOString() },
  },
  {
    id: "cb-empty",
    createdAt: now - 1000,
    updatedAt: now - 1000,
    url: "https://weidian.com/item.html?itemID=7002",
    title: "Unset everything",
    image: "https://si.geilicdn.com/nope-4.jpg",
    gallery: [],
    links: [{ url: "https://weidian.com/item.html?itemID=7002", role: "buy" }],
    price: 88,
    currency: "CNY",
    seller: "replux",
    category: "shirt",
    findStatus: "want",
  },
];

const basePrefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 98, height: 178, weight: 75 },
  measureUnits: "cm",
  onboardingDone: true,
};

const browser = await webkit.launch();
const problems = [];

async function shoot(page, name) {
  await page.screenshot({ path: join(outDir, name + ".png") });
}

async function run(name, theme, contextOpts) {
  const context = await browser.newContext(contextOpts);
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    {
      shelf: JSON.stringify(items),
      prefsJson: JSON.stringify({ ...basePrefs, theme }),
    }
  );
  const page = await context.newPage();
  page.on("pageerror", (err) => problems.push(name + " PAGE ERROR: " + err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(name + " CONSOLE: " + msg.text());
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);

  // Open the first card's detail surface.
  const card = page.locator("article, .cz-photo-list-item").first();
  await card.click({ force: true });
  await page.waitForTimeout(1500);

  const bar = page.locator(".cz-cmdbar").first();
  if (!(await bar.count())) {
    problems.push(name + ": no .cz-cmdbar on the open detail surface");
    await shoot(page, name + "-no-bar");
    await context.close();
    return;
  }
  await shoot(page, name + "-1-bar-closed");

  // Chip order and the values they carry.
  const chips = await page.$$eval(".cz-cmdbar .cz-cmdbar-chip", (nodes) =>
    nodes.map((n) => ({ key: n.getAttribute("data-chip"), text: n.textContent.trim() }))
  );
  console.log(name, "chips:", JSON.stringify(chips));
  const order = chips.map((c) => c.key).join(",");
  if (order !== "status,haul,color,weight,category") {
    problems.push(name + ": chip order is " + order);
  }

  // One popover at a time, and each one drawn on a real surface.
  for (const key of ["status", "haul", "color", "weight", "category"]) {
    await page.click('[data-chip="' + key + '"]', { force: true });
    await page.waitForTimeout(450);
    const open = await page.$$eval(".cz-cmdbar-pop", (nodes) => nodes.length);
    if (open !== 1) problems.push(name + ": " + key + " left " + open + " popovers open");
    // The popover must not be see-through: a menu on a photo is unreadable.
    const bg = await page.$eval(".cz-cmdbar-pop", (n) => getComputedStyle(n).backgroundColor);
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
      problems.push(name + ": " + key + " popover background is " + bg);
    }
    await shoot(page, name + "-2-" + key);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
  if (await page.$(".cz-cmdbar-pop")) problems.push(name + ": Escape left a popover open");

  // The second item is the one with nothing set (rule 4).
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const second = page.locator("article, .cz-photo-list-item").nth(1);
  if (await second.count()) {
    await second.click({ force: true });
    await page.waitForTimeout(1400);
    await shoot(page, name + "-3-unset");
    const unset = await page.$$eval(".cz-cmdbar-value.is-unset", (nodes) =>
      nodes.map((n) => n.textContent.trim())
    );
    console.log(name, "unset prompts:", JSON.stringify(unset));
    if (!unset.length) problems.push(name + ": the empty item shows no placeholder prompts");
  }

  await context.close();
  console.log("done:", name);
}

await run("desktop-blackout", "rainbow", { viewport: { width: 1440, height: 980 } });
await run("desktop-gallery", "light", { viewport: { width: 1440, height: 980 } });
await run("phone-blackout", "rainbow", { ...devices["iPhone 15 Pro"] });

await browser.close();

if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log(" -", p);
  process.exitCode = 1;
} else {
  console.log("\nno problems found");
}

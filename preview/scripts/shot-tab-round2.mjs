// Wide-viewport proof for tab round 2 (panel cap + no Details buy link).
// Usage: VITE_PORT=5183 node scripts/shot-tab-round2.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.VITE_PORT || "5183";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../.scratch-proof");
mkdirSync(OUT, { recursive: true });

const items = [
  {
    id: "x0",
    title: "Color-block hooded jacket",
    url: "https://weidian.com/item.html?itemID=1",
    price: 199,
    currency: "CNY",
    images: Array.from(
      { length: 3 },
      (_, j) => "https://picsum.photos/seed/r2" + j + "/600/800"
    ),
    note: "",
    size: "L",
    category: "outerwear",
    colorway: "Black (AC908026)",
    findStatus: "bought",
    seller: "weidian.com",
    createdAt: Date.now() - 86400000,
    links: [{ url: "https://weidian.com/item.html?itemID=1", role: "buy" }],
  },
];
const prefs = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "dark",
  colorwayVersion: 4,
  preferredAgent: "superbuy",
  affiliateCodes: {},
  bodyProfile: {
    usualSize: "L",
    chest: 98,
    longSleeve: 63.5,
    shoulder: 47,
    length: 55,
    height: 180,
  },
  measureUnits: "in",
  onboardingDone: true,
  fitPrefs: {
    outerwear: { length: "long", looseness: "oversized", dismissed: false },
  },
  stashMode: "link",
  pricePrimary: "USD",
};

async function openAndMeasure(page) {
  await page.goto("http://127.0.0.1:" + PORT + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.locator("article").first().click({ force: true });
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    const panel = document.querySelector(".cz-dpanel");
    const scrim = document.querySelector(".cz-dpanel-scrim");
    if (!panel) return { error: "no panel" };
    const r = panel.getBoundingClientRect();
    const cs = getComputedStyle(panel);
    const grid = document.querySelector(".cz-dpanel-body-grid");
    const gcs = grid ? getComputedStyle(grid) : null;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      panel: {
        width: Math.round(r.width),
        height: Math.round(r.height),
        left: Math.round(r.left),
        maxWidth: cs.maxWidth,
        widthCss: cs.width,
        maxHeight: cs.maxHeight,
      },
      gridCols: gcs ? gcs.gridTemplateColumns : null,
      scrimW: scrim ? scrim.getBoundingClientRect().width : null,
      hasLinkRow: !!document.querySelector(".cz-desk-tab-details .cz-desk-link-list"),
      detailsLinkText: document.querySelector(".cz-desk-tab-details")
        ? document.querySelector(".cz-desk-tab-details").textContent.includes("Buy via")
        : null,
    };
  });
}

async function shot(page, name) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  console.log("shot", path);
}

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

const report = {};
for (const [label, w, h] of [
  ["2440", 2440, 1200],
  ["1440", 1440, 900],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(
    ({ shelf, p }) => {
      localStorage.setItem("credenza-fashion-items-v1", shelf);
      localStorage.setItem("credenza-prefs-v1", p);
    },
    { shelf: JSON.stringify(items), p: JSON.stringify(prefs) }
  );
  const page = await ctx.newPage();
  const metrics = await openAndMeasure(page);
  report[label] = metrics;

  await page.getByRole("tab", { name: /^Details$/i }).first().click({ force: true });
  await page.waitForTimeout(400);
  await shot(page, "round2-details-" + label + ".png");

  await page.getByRole("tab", { name: /^Settings$/i }).first().click({ force: true });
  await page.waitForTimeout(400);
  await shot(page, "round2-settings-" + label + ".png");

  await ctx.close();
}

writeFileSync(join(OUT, "round2-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const fails = [];
for (const [label, data] of Object.entries(report)) {
  if (data.error) fails.push(label + ": " + data.error);
  else {
    if (data.panel.width > 1360 + 2) {
      fails.push(label + " panel width " + data.panel.width + " > 1360");
    }
    if (data.hasLinkRow) fails.push(label + " still has link list");
    if (data.detailsLinkText) fails.push(label + " Details still mentions Buy via");
  }
}
if (fails.length) {
  console.error("PROOF FAIL:\n" + fails.join("\n"));
  process.exit(1);
}
console.log("PROOF PASS");
await browser.close();

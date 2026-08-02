// Touch-context proof for mobile item 1 (cz-sheet-shell scrollport).
// Before/after: inject tall content, measure ch/sh, assign scrollTop, wheel.
// Usage: VITE_PORT=5179 node scripts/probe-sheet-scroll-proof.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.VITE_PORT || "5179";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../.scratch-proof");
mkdirSync(OUT, { recursive: true });

const items = [
  {
    id: "x0",
    title: "Arc Shorts",
    url: "https://weidian.com/item.html?itemID=1",
    price: 199,
    currency: "CNY",
    images: Array.from(
      { length: 4 },
      (_, j) => "https://picsum.photos/seed/p" + j + "/600/800"
    ),
    note: "LONG\n".repeat(80),
    size: "L",
    category: "shorts",
    addedAt: Date.now(),
    haul: "Test",
    findStatus: "want",
  },
];
const prefs = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "dark",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, hip: 95, heightCm: 180 },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
  stashMode: "link",
  pricePrimary: "USD",
};

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
await ctx.addInitScript(
  ({ shelf, p }) => {
    localStorage.setItem("credenza-fashion-items-v1", shelf);
    localStorage.setItem("credenza-prefs-v1", p);
  },
  { shelf: JSON.stringify(items), p: JSON.stringify(prefs) }
);
const page = await ctx.newPage();
await page.goto("http://localhost:" + PORT + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const card = page.locator("article").first();
await card.click({ force: true });
await page.waitForSelector(".cz-detail-scroll", { timeout: 8000 });
await page.waitForTimeout(600);

const beforeShot = join(OUT, "item1-before-inject.png");
await page.screenshot({ path: beforeShot, fullPage: false });

const metrics = await page.evaluate(() => {
  const s = document.querySelector(".cz-detail-scroll");
  if (!s) return { error: "no scroll" };
  const parent = s.parentElement;
  const base = {
    shellClass: parent ? parent.className : null,
    parentFlex: parent ? getComputedStyle(parent).flex : null,
    parentDisplay: parent ? getComputedStyle(parent).display : null,
    parentOverflow: parent ? getComputedStyle(parent).overflow : null,
    parentMinH: parent ? getComputedStyle(parent).minHeight : null,
    ch: s.clientHeight,
    sh: s.scrollHeight,
    st: s.scrollTop,
    overscroll: getComputedStyle(s).overscrollBehavior,
  };
  const d = document.createElement("div");
  d.id = "probe-tall";
  d.style.height = "2000px";
  d.style.background = "linear-gradient(#334, #112)";
  d.style.flex = "0 0 auto";
  d.textContent = "TALL PROBE";
  s.appendChild(d);
  return {
    ...base,
    afterInject: {
      ch: s.clientHeight,
      sh: s.scrollHeight,
      st: s.scrollTop,
      canScroll: s.scrollHeight > s.clientHeight + 20,
    },
  };
});

// Assign scrollTop
const afterAssign = await page.evaluate(() => {
  const s = document.querySelector(".cz-detail-scroll");
  s.scrollTop = 500;
  return { st: s.scrollTop, ch: s.clientHeight, sh: s.scrollHeight };
});

// Wheel
await page.mouse.move(195, 500);
await page.mouse.wheel(0, 300);
await page.waitForTimeout(200);
const afterWheel = await page.evaluate(() => {
  const s = document.querySelector(".cz-detail-scroll");
  return { st: s.scrollTop, ch: s.clientHeight, sh: s.scrollHeight };
});

const afterShot = join(OUT, "item1-after-scroll.png");
await page.screenshot({ path: afterShot, fullPage: false });

const report = {
  metrics,
  afterAssign,
  afterWheel,
  pass:
    metrics.shellClass &&
    String(metrics.shellClass).includes("cz-sheet-shell") &&
    metrics.afterInject &&
    metrics.afterInject.canScroll &&
    afterAssign.st >= 400,
  shots: { beforeShot, afterShot },
};
const reportPath = join(OUT, "item1-scroll-proof.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.pass ? 0 : 1);

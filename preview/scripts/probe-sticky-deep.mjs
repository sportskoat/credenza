// Kyle's "double line" — the deep check. probe-sticky-double.mjs proves the
// name is printed once at the failing scroll position. This one proves the
// bar still WORKS: it must be down while the big title is on screen, and up
// once the big title has left.
//
//   (npx vite --port 5362 --strictPort &) ; sleep 8; node scripts/probe-sticky-deep.mjs
import { webkit } from "playwright";
import { readFileSync } from "fs";

const baseUrl = process.argv[2] || "http://localhost:5362";
const dataUrl = readFileSync(new URL("./probe-photo.txt", import.meta.url), "utf8").trim();
const now = Date.now();
const TITLE = "Mutimer Dinner Jacket";

const items = [
  {
    id: "deep-check",
    createdAt: now,
    updatedAt: now,
    url: "https://weidian.com/item.html?itemID=7812124117",
    title: TITLE,
    image: dataUrl,
    gallery: [dataUrl, dataUrl],
    links: [{ url: "https://weidian.com/item.html?itemID=7812124117", role: "buy" }],
    price: 249,
    currency: "CNY",
    seller: "mook-offcical",
    category: "other",
    size: "S",
    colorway: "Sky",
    project: "winter",
    findStatus: "bought",
    sizeNotes: "Size  Chest\nS  112\nM  116\nL  120",
  },
];
const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "S", chest: 99, waist: 80, height: 178, weight: 72 },
  measureUnits: "in",
  onboardingDone: true,
  theme: "rainbow",
};

const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 399, height: 874 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);
await page.locator("article, .cz-photo-list-item").first().click({ force: true });
await page.waitForTimeout(1600);

async function readAt(top, label) {
  await page.evaluate((y) => {
    document.querySelector(".cz-detail-scroll").scrollTo({ top: y, behavior: "instant" });
  }, top);
  await page.waitForTimeout(800);
  const seen = await page.evaluate((title) => {
    const bar = document.querySelector(".cz-detail-stickybar");
    const big = document.querySelector(".cz-detail-title");
    const root = document.querySelector(".cz-detail-scroll");
    const rootRect = root.getBoundingClientRect();
    const bigRect = big ? big.getBoundingClientRect() : null;
    const bigVisible =
      !!bigRect && bigRect.bottom > rootRect.top && bigRect.top < rootRect.bottom;
    const barUp = !!bar && bar.classList.contains("is-up");
    const barShowsTitle = !!bar && bar.innerText.includes(title);
    return { barUp, barShowsTitle, bigVisible, copies: (barUp && barShowsTitle ? 1 : 0) + (bigVisible ? 1 : 0) };
  }, TITLE);
  await page.screenshot({ path: `.verify-shots/deep-${label}.png` });
  return { label, top, ...seen };
}

const geometry = await page.evaluate(() => {
  const hero = document.querySelector(".cz-detail-hero");
  const row = document.querySelector(".cz-detail-title-row");
  return {
    heroBottom: hero.offsetTop + hero.offsetHeight,
    titleRowBottom: row.offsetTop + row.offsetHeight,
  };
});

const rows = [];
rows.push(await readAt(0, "top"));
rows.push(await readAt(geometry.heroBottom + 6, "photo-gone"));
rows.push(await readAt(geometry.titleRowBottom + 40, "title-gone"));

const problems = [];
if (rows[0].copies !== 1) problems.push("at the top the name is not printed exactly once");
if (rows[1].copies !== 1) problems.push("with the photo gone the name is not printed exactly once");
if (!rows[2].barUp) problems.push("with the title gone the bar did not come up");
if (rows[2].bigVisible) problems.push("with the title gone the big title is still on screen");
if (rows[2].copies !== 1) problems.push("with the title gone the name is not printed exactly once");

console.log(JSON.stringify({ geometry, rows, problems }, null, 1));
console.log(problems.length ? "FAIL" : "PASS — the name is printed once at every scroll position, and the bar still works");
await browser.close();

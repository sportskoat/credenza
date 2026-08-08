// Kyle's "double line": on the phone sheet the item name printed twice — once
// in the sticky bar and once in the big title right under it. The bar watched
// the PHOTO, so it came up while the big title was still on screen.
//
// This probe scrolls the sheet to exactly that moment (the photo's last pixel
// leaving the scroller) and reports how many times the name is painted.
//
//   (npx vite --port 5361 --strictPort &) ; sleep 8; node scripts/probe-sticky-double.mjs
import { webkit } from "playwright";
import { readFileSync } from "fs";

const baseUrl = process.argv[2] || "http://localhost:5361";
const tag = process.argv[3] || "after";
const dataUrl = readFileSync(new URL("./probe-photo.txt", import.meta.url), "utf8").trim();
const now = Date.now();
const TITLE = "Mutimer Dinner Jacket";

const items = [
  {
    id: "double-check",
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

// Scroll to the exact failing moment: the hero's last pixel leaves the top of
// the scroller. A few pixels past, so the observer has certainly fired.
const scrolled = await page.evaluate(() => {
  const root = document.querySelector(".cz-detail-scroll");
  const hero = document.querySelector(".cz-detail-hero");
  if (!root || !hero) return null;
  const top = hero.offsetTop + hero.offsetHeight + 6;
  root.scrollTo({ top, behavior: "instant" });
  return { top, scrollTop: root.scrollTop };
});
await page.waitForTimeout(900);

const seen = await page.evaluate((title) => {
  const bar = document.querySelector(".cz-detail-stickybar");
  const barUp = !!bar && bar.classList.contains("is-up");
  const barText = bar ? bar.innerText.trim() : "";
  const big = document.querySelector(".cz-detail-title");
  // Measure against the SCROLLER, not the window: the sheet sits inside its
  // own scrolling box, so a window rect calls an off-screen title visible.
  const root = document.querySelector(".cz-detail-scroll");
  const bigRect = big ? big.getBoundingClientRect() : null;
  const rootRect = root ? root.getBoundingClientRect() : null;
  const bigVisible =
    !!bigRect && !!rootRect && bigRect.bottom > rootRect.top && bigRect.top < rootRect.bottom;
  return {
    barUp,
    barShowsTitle: barText.includes(title),
    bigVisible,
    bigText: big ? big.textContent.trim() : "",
  };
}, TITLE);

const copies = (seen.barUp && seen.barShowsTitle ? 1 : 0) + (seen.bigVisible ? 1 : 0);
await page.screenshot({ path: ".verify-shots/double-" + tag + ".png" });
console.log(JSON.stringify({ tag, scrolled, ...seen, copiesOfTheName: copies }, null, 1));
console.log(copies > 1 ? "DOUBLE — the name is on screen twice" : "SINGLE — the name is on screen once");
await browser.close();

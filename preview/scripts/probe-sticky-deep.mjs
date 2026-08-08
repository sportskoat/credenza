// Second half of the check: the bar must still arrive once the big title has
// left. Scrolls well past the title and confirms the bar is up and names it.
import { webkit } from "playwright";
import { readFileSync } from "fs";
const baseUrl = process.argv[2] || "http://localhost:5362";
const dataUrl = readFileSync(new URL("./probe-photo.txt", import.meta.url), "utf8").trim();
const now = Date.now();
const TITLE = "Mutimer Dinner Jacket";
const items = [{ id: "deep", createdAt: now, updatedAt: now, url: "https://weidian.com/item.html?itemID=7812124117",
  title: TITLE, image: dataUrl, gallery: [dataUrl, dataUrl],
  links: [{ url: "https://weidian.com/item.html?itemID=7812124117", role: "buy" }],
  price: 249, currency: "CNY", seller: "mook-offcical", category: "other", size: "S",
  colorway: "Sky", project: "winter", findStatus: "bought", sizeNotes: "Size  Chest\nS  112\nM  116\nL  120" }];
const prefs = { viewMode: "grid", sortMode: "recent", colorwayVersion: 4, preferredAgent: null,
  affiliateCodes: {}, bodyProfile: { usualSize: "S", chest: 99 }, measureUnits: "in", onboardingDone: true, theme: "rainbow" };
const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 399, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await context.addInitScript(({ shelf, prefsJson }) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);
await page.locator("article, .cz-photo-list-item").first().click({ force: true });
await page.waitForTimeout(1600);
await page.evaluate(() => {
  const root = document.querySelector(".cz-detail-scroll");
  const t = document.querySelector(".cz-detail-title-row");
  root.scrollTo({ top: t.offsetTop + t.offsetHeight + 40, behavior: "instant" });
});
await page.waitForTimeout(900);
const seen = await page.evaluate((title) => {
  const bar = document.querySelector(".cz-detail-stickybar");
  const big = document.querySelector(".cz-detail-title");
  // Measure against the SCROLLER, not the window: the sheet sits inside its
  // own scrolling box, so a window rect calls an off-screen title visible.
  const root = document.querySelector(".cz-detail-scroll");
  const r = big ? big.getBoundingClientRect() : null;
  const rootRect = root ? root.getBoundingClientRect() : null;
  return { barUp: !!bar && bar.classList.contains("is-up"),
    barShowsTitle: bar ? bar.innerText.includes(title) : false,
    closeVisible: !!document.querySelector(".cz-detail-stickybar-close"),
    bigVisible: !!r && !!rootRect && r.bottom > rootRect.top && r.top < rootRect.bottom };
}, TITLE);
await page.screenshot({ path: ".verify-shots/double-deep.png" });
console.log(JSON.stringify(seen, null, 1));
console.log(seen.barUp && seen.barShowsTitle && !seen.bigVisible ? "PASS — the bar takes over after the title leaves" : "FAIL");
await browser.close();

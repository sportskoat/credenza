// Phone-width walk of the LIVE site, 2026-07-29. Answers one question:
// is the phone layout broadly broken, or are Kyle's reports separate faults?
// Checks: horizontal overflow, page scroll, profile menu width, card panel.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "https://credenzafashion.com";
const now = Date.now();

const CHART =
  "Size  Shoulder  Chest  Length  Sleeve\nM  43  106  65  23.5\nL  45  110  67  24.5\nXL  47  114  69  25.5";

const mk = (i) => ({
  id: "phone-" + i,
  createdAt: now - i * 1000,
  updatedAt: now - i * 1000,
  url: "https://weidian.com/item.html?itemID=781212411" + i,
  title:
    i % 2
      ? "M33821-133E Heavy-Weight American Casual T-Shirt Long Title Version"
      : "Short Tee",
  image: "https://si.geilicdn.com/nope-" + i + ".jpg",
  gallery: ["https://si.geilicdn.com/nope-a" + i + ".jpg"],
  links: [{ url: "https://weidian.com/item.html?itemID=781212411" + i, role: "buy" }],
  price: 179 + i,
  currency: "CNY",
  seller: "mook-offcical",
  sellerAccount: "mook",
  category: "shirt",
  size: "L",
  colorway: "White",
  weightGrams: 420,
  project: i % 3 === 0 ? "casuals" : "winter",
  findStatus: "want",
  sizeNotes: CHART,
});
const items = Array.from({ length: 8 }, (_, i) => mk(i + 1));

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 98, height: 178, weight: 75 },
  measureUnits: "in",
  onboardingDone: true,
  theme: "rainbow",
};

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log((pass ? "PASS  " : "FAIL  ") + name + " — " + detail);
};

const overflowScan = () =>
  // Every element that draws outside the visual viewport, widest first.
  Array.from(document.querySelectorAll("*"))
    .map((n) => {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      const over = Math.max(r.right - window.innerWidth, -r.left);
      if (over <= 1) return null;
      const s = getComputedStyle(n);
      if (s.visibility === "hidden" || s.opacity === "0") return null;
      return {
        tag: n.tagName.toLowerCase(),
        cls: (n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className || "").toString().slice(0, 70),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        over: Math.round(over),
        pos: s.position,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.over - a.over)
    .slice(0, 12);

const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
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
await page.waitForTimeout(4500);

const geom = await page.evaluate(() => ({
  inner: window.innerWidth,
  docScroll: document.documentElement.scrollWidth,
  bodyScroll: document.body.scrollWidth,
  visual: window.visualViewport ? Math.round(window.visualViewport.width) : null,
  scale: window.visualViewport ? window.visualViewport.scale : null,
}));
record(
  "the page is no wider than the phone",
  geom.docScroll <= geom.inner + 1,
  JSON.stringify(geom)
);

const shelfOver = await page.evaluate(overflowScan);
console.log("SHELF OVERFLOW:", JSON.stringify(shelfOver, null, 1));

// The shelf column width against the screen width.
const colw = await page.evaluate(() => {
  const pick = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { sel, left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
  };
  return [pick("header"), pick("main"), pick(".cz-photo-list"), pick("article")].filter(Boolean);
});
console.log("COLUMNS:", JSON.stringify(colw));

await page.screenshot({ path: ".verify-shots/phone-shelf-top.png" });

// ── Scroll test. ──
const scroll = await page.evaluate(async () => {
  const before = window.scrollY;
  window.scrollBy(0, 900);
  await new Promise((r) => setTimeout(r, 500));
  const after = window.scrollY;
  const doc = document.documentElement;
  return {
    before,
    after,
    moved: after - before,
    scrollHeight: doc.scrollHeight,
    inner: window.innerHeight,
    bodyOverflow: getComputedStyle(document.body).overflow,
    htmlOverflow: getComputedStyle(doc).overflow,
  };
});
record(
  "the shelf scrolls down",
  scroll.moved > 100,
  JSON.stringify(scroll)
);
await page.screenshot({ path: ".verify-shots/phone-shelf-scrolled.png" });

// ── Profile menu. ──
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
const acct = page
  .locator('header button[aria-label*="ccount" i], header button[aria-label*="rofile" i], header button')
  .last();
await acct.click({ force: true });
await page.waitForTimeout(900);
const menu = await page.evaluate(() => {
  const cand = [...document.querySelectorAll('[role="menu"], [role="dialog"], .cz-account-menu, .cz-menu')]
    .map((n) => {
      const r = n.getBoundingClientRect();
      return { cls: (n.className || "").toString().slice(0, 60), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
    })
    .filter((m) => m.w > 40);
  return { inner: window.innerWidth, cand };
});
record(
  "the account menu fits on the screen",
  menu.cand.length > 0 && menu.cand.every((m) => m.left >= -1 && m.right <= menu.inner + 1),
  JSON.stringify(menu)
);
await page.screenshot({ path: ".verify-shots/phone-account-menu.png" });
const menuOver = await page.evaluate(overflowScan);
console.log("MENU OVERFLOW:", JSON.stringify(menuOver, null, 1));
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// ── Card detail at phone width. ──
await page.locator("article, .cz-photo-list-item").first().click({ force: true });
await page.waitForTimeout(2000);
await page.screenshot({ path: ".verify-shots/phone-card.png" });
const cardOver = await page.evaluate(overflowScan);
console.log("CARD OVERFLOW:", JSON.stringify(cardOver, null, 1));
record(
  "the open card fits on the screen",
  cardOver.length === 0,
  cardOver.length + " parts draw outside the screen"
);

// ── Size buttons change the numbers. ──
const sizeRead = await page.evaluate(() => {
  const cells = [...document.querySelectorAll(".cz-sizing-cell, .cz-detail-size-choices button, [class*='size'] button")];
  return cells.map((n) => n.textContent.trim().slice(0, 24)).slice(0, 12);
});
console.log("SIZE CONTROLS:", JSON.stringify(sizeRead));
const beforeText = await page.evaluate(() => (document.querySelector(".cz-dpanel") || document.body).innerText);
const sizeBtns = page.locator(".cz-sizing-cell button, button.cz-sizing-cell");
const nBtns = await sizeBtns.count();
if (nBtns > 1) {
  await sizeBtns.nth(0).click({ force: true });
  await page.waitForTimeout(900);
  const t1 = await page.evaluate(() => (document.querySelector(".cz-dpanel") || document.body).innerText);
  await sizeBtns.nth(nBtns - 1).click({ force: true });
  await page.waitForTimeout(900);
  const t2 = await page.evaluate(() => (document.querySelector(".cz-dpanel") || document.body).innerText);
  record("picking a different size changes the numbers", t1 !== t2, "size buttons: " + nBtns + ", text changed: " + (t1 !== t2));
} else {
  record("picking a different size changes the numbers", false, "found " + nBtns + " size buttons");
}
void beforeText;
await page.screenshot({ path: ".verify-shots/phone-card-size.png" });

console.log("\nSUMMARY " + results.filter((r) => r.pass).length + "/" + results.length + " pass");
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name);
await browser.close();

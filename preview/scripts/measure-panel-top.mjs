// One-off: measure the desktop detail panel's top block, so the "tighter top"
// change (Kyle 2026-07-29) is a number, not an eyeball. Run it once on the old
// commit and once on the new one, then compare.
//
// Live page only: the theme variables are inline styles set by the app, so a
// static HTML probe reports boxes the real app never draws.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "http://localhost:5347";
const now = Date.now();

const items = [
  {
    id: "mp-full",
    createdAt: now,
    updatedAt: now,
    url: "https://weidian.com/item.html?itemID=7001",
    title: "M33821-133E Heavy-Weight American Casual T-Shirt",
    image: "https://si.geilicdn.com/nope-1.jpg",
    gallery: ["https://si.geilicdn.com/nope-2.jpg"],
    links: [{ url: "https://weidian.com/item.html?itemID=7001", role: "buy" }],
    price: 179,
    currency: "CNY",
    seller: "mook-offcical",
    sellerAccount: "mook",
    category: "shirt",
    size: "L",
    colorway: "White",
    weightGrams: 420,
    project: "casuals",
    findStatus: "want",
  },
];

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 98, height: 178, weight: 75 },
  measureUnits: "cm",
  onboardingDone: true,
  theme: "rainbow",
};

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
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
await page.waitForTimeout(1500);

const out = await page.evaluate(() => {
  const box = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
  };
  const panel = box(".cz-dpanel");
  const rel = (sel) => {
    const b = box(sel);
    return b && panel ? { ...b, fromPanelTop: Math.round(b.top - panel.top) } : null;
  };
  return {
    panelHeight: panel && panel.height,
    title: rel(".cz-dpanel-header .cz-detail-title"),
    sub: rel(".cz-dpanel-header .cz-detail-sub"),
    bar: rel(".cz-dpanel-bar"),
    photo: rel(".cz-dpanel-left .cz-dpanel-stage"),
    rail: rel(".cz-dpanel-body .cz-detail-scroll > *"),
  };
});

console.log(JSON.stringify(out, null, 2));
if (out.title && out.sub) {
  console.log("gap title bottom -> sub top:", out.sub.top - out.title.bottom);
}
await browser.close();

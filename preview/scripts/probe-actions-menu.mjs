// One-off: Kyle 2026-07-29 — the "..." card-actions menu reads see-through.
// Live page only: theme variables are inline styles set by the app.
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

await page.locator(".cz-dpanel-menu-wrap .cz-dpanel-icon").click();
await page.waitForTimeout(600);

const out = await page.evaluate(() => {
  const read = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const cs = getComputedStyle(n);
    return {
      sel,
      background: cs.backgroundColor,
      backdropFilter: cs.backdropFilter,
      opacity: cs.opacity,
      border: cs.borderColor,
    };
  };
  return [
    read(".cz-dpanel-menu"),
    read(".cz-dpanel-menu .cz-card-action-row"),
    read(".cz-dpanel-menu .cz-card-action-row.danger"),
    read(".cz-dpanel"),
  ];
});
console.log(JSON.stringify(out, null, 2));
await page.locator(".cz-dpanel-menu").screenshot({ path: ".verify-shots/actions-menu.png" });
await page.screenshot({ path: ".verify-shots/actions-menu-full.png" });
await browser.close();

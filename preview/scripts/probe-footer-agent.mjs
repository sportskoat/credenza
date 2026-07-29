// One-off: Kyle 2026-07-29 — "you can't see the buy button here for changing
// an agent". Two questions: does the notch chevron render at all, and does the
// open picker cover the Buy button? Live page only: theme variables are inline
// styles set by the app.
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

const box = (sel) =>
  page.evaluate((s) => {
    const n = document.querySelector(s);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    const cs = getComputedStyle(n);
    return {
      sel: s,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      z: cs.zIndex,
      display: cs.display,
      background: cs.backgroundColor,
    };
  }, sel);

const before = {
  notchWrap: await box(".cz-dpanel-body .cz-buy-notch-wrap"),
  notch: await box(".cz-dpanel-body .cz-buy-notch"),
  toggle: await box(".cz-dpanel-body .cz-buy-notch-toggle"),
  buy: await box(".cz-dpanel-body .cz-detail-buy"),
};
console.log("CLOSED:", JSON.stringify(before, null, 2));

await page.locator(".cz-dpanel-body .cz-detail-foot").screenshot({
  path: ".verify-shots/footer-closed.png",
});

const toggle = page.locator(".cz-dpanel-body .cz-buy-notch-toggle");
if ((await toggle.count()) > 0) {
  await toggle.click();
  await page.waitForTimeout(600);
  const after = {
    pop: await box(".cz-dpanel-body .cz-agent-pop"),
    buy: await box(".cz-dpanel-body .cz-detail-buy"),
  };
  console.log("OPEN:", JSON.stringify(after, null, 2));
  // Is the Buy button's own centre still the top element?
  const hit = await page.evaluate(() => {
    const b = document.querySelector(".cz-dpanel-body .cz-detail-buy");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { top: top ? top.className || top.tagName : null, covered: !b.contains(top) };
  });
  console.log("HIT TEST:", JSON.stringify(hit));
  await page.screenshot({ path: ".verify-shots/footer-open-full.png" });
  await page.locator(".cz-dpanel-body .cz-detail-foot").screenshot({
    path: ".verify-shots/footer-open-row.png",
  });
  const wrapOpen = await box(".cz-dpanel-body .cz-buy-notch-wrap");
  const notchOpen = await box(".cz-dpanel-body .cz-buy-notch");
  const footOpen = await box(".cz-dpanel-body .cz-detail-foot");
  console.log("WRAP/NOTCH/FOOT OPEN:", JSON.stringify({ wrapOpen, notchOpen, footOpen }, null, 2));
  await page.locator(".cz-dpanel").screenshot({
    path: ".verify-shots/footer-open-panel.png",
  });
} else {
  console.log("NO TOGGLE RENDERED");
}
await browser.close();

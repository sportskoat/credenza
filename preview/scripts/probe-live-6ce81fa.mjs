// Post-deploy verification, 2026-07-29, deploy 6a6a1ba9 (built from 6ce81fa).
// Four checks Fable asked for, plus the Buy chevron from 07613d1. Live site
// only: theme variables are inline styles set by the app, so a static read is
// not valid here.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "https://credenzafashion.com";
const now = Date.now();

// The seller chart from Kyle's real Weidian tee (itemID 7812124117). The Large
// sleeve is 24.5cm, which is 9.6 inches. Before the fix the app printed 9.4.
const CHART =
  "Size  Shoulder  Chest  Length  Sleeve\nM  43  106  65  23.5\nL  45  110  67  24.5\nXL  47  114  69  25.5";

const items = [
  {
    id: "live-check",
    createdAt: now,
    updatedAt: now,
    url: "https://weidian.com/item.html?itemID=7812124117",
    title: "M33821-133E Heavy-Weight American Casual T-Shirt",
    image: "https://si.geilicdn.com/nope-1.jpg",
    gallery: ["https://si.geilicdn.com/nope-2.jpg", "https://si.geilicdn.com/nope-3.jpg"],
    links: [{ url: "https://weidian.com/item.html?itemID=7812124117", role: "buy" }],
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
    sizeNotes: CHART,
  },
];

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
await page.waitForTimeout(4000);

// ── Check 2 first: the masthead links live on the shelf page. ──
const navLinks = await page.evaluate(() =>
  [...document.querySelectorAll("a")]
    .filter((a) => /^(Pro|Guides|How it works|FAQ|Support|Contact)$/i.test(a.textContent.trim()))
    .map((a) => ({ text: a.textContent.trim(), target: a.getAttribute("target") || "" }))
);
const blankNav = navLinks.filter((l) => l.target === "_blank");
record(
  "site links stay in this tab",
  navLinks.length >= 3 && blankNav.length === 0,
  "found " + navLinks.length + " links, " + blankNav.length + " open a new tab"
);

await page.locator("article, .cz-photo-list-item").first().click({ force: true });
await page.waitForTimeout(1800);
await page.locator(".cz-dpanel").screenshot({ path: ".verify-shots/live-panel.png" });

// ── Check 1: the chart keeps the half centimetre. ──
const panelText = await page.evaluate(() => {
  const n = document.querySelector(".cz-dpanel");
  return n ? n.innerText : "";
});
record(
  "size chart keeps the half centimetre",
  panelText.includes("9.6") && !panelText.includes("9.4"),
  "panel prints 9.6in: " + panelText.includes("9.6") + ", prints the old 9.4in: " + panelText.includes("9.4")
);

// ── Buy chevron (my own 07613d1 fix). ──
const notch = await page.evaluate(() => {
  const t = document.querySelector(".cz-dpanel-body .cz-buy-notch-toggle");
  const n = document.querySelector(".cz-dpanel-body .cz-buy-notch");
  if (!t || !n) return null;
  const tr = t.getBoundingClientRect();
  const nr = n.getBoundingClientRect();
  return { inside: tr.right <= nr.right + 0.5 && tr.left >= nr.left - 0.5, w: Math.round(tr.width) };
});
record(
  "the agent chevron is visible next to Buy",
  !!notch && notch.inside && notch.w > 0,
  notch ? "chevron " + notch.w + "px wide, inside the button" : "no chevron in the page"
);

// ── Check 4: the actions menu holds two rows only. ──
await page.locator(".cz-dpanel-menu-wrap .cz-dpanel-icon").click();
await page.waitForTimeout(700);
const rows = await page.evaluate(() =>
  [...document.querySelectorAll('.cz-dpanel-menu [role="menuitem"]')].map((n) => n.textContent.trim())
);
record(
  "the ... menu shows Share card and Remove card only",
  rows.length === 2 && rows[0] === "Share card" && rows[1] === "Remove card",
  "rows: " + JSON.stringify(rows)
);
await page.locator(".cz-dpanel-menu").screenshot({ path: ".verify-shots/live-menu.png" });
// Escape here closes the whole panel, so dismiss the menu with its own button.
await page.locator(".cz-dpanel-menu-wrap .cz-dpanel-icon").click();
await page.waitForTimeout(500);

// ── Check 3: the zoom exit button closes the enlarged photo. ──
await page.locator(".cz-dpanel-meta-album").first().click({ force: true });
await page.waitForTimeout(1200);
const zoomIn = page.locator('[aria-label="Enlarge photo"]').first();
let zoomDetail = "no zoom control found";
let zoomPass = false;
if ((await zoomIn.count()) > 0) {
  await zoomIn.click();
  await page.waitForTimeout(800);
  const opened = await page.evaluate(() => !!document.querySelector(".cz-photo-coverflow-zoom"));
  const exit = page.locator('[aria-label="Close enlarged photo"]').first();
  if ((await exit.count()) > 0) {
    await exit.click();
    await page.waitForTimeout(800);
    const stillOpen = await page.evaluate(() => !!document.querySelector(".cz-photo-coverflow-zoom"));
    zoomPass = opened && !stillOpen;
    zoomDetail = "layer opened: " + opened + ", layer closed on the exit click: " + !stillOpen;
  } else {
    zoomDetail = "the enlarge control works, but no exit control was found";
  }
}
record("the zoom exit button closes the enlarged photo", zoomPass, zoomDetail);
await page.screenshot({ path: ".verify-shots/live-zoom.png" });

console.log("\nSUMMARY " + results.filter((r) => r.pass).length + "/" + results.length + " pass");
await browser.close();

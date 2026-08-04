// Live check, 2026-08-04: the haul share sheet on the dev server must show
// no arch behind the content and no scale on tap. Kyle saw the dome again
// after the class rename; this drives the REAL app on :8888 (seeded stash,
// fully received haul) and hit-tests the dome area on hover.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "http://localhost:8888";

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  measureUnits: "in",
  onboardingDone: true,
  theme: "rainbow",
};

const items = [
  {
    id: "probe-1",
    title: "Wool coat",
    url: "https://weidian.com/item.html?itemID=1",
    image: "https://img.test/coat.jpg",
    photos: [],
    priceUsd: 88,
    platform: "weidian",
    project: "casuals",
    addedAt: 1754000000000,
  },
  {
    id: "probe-2",
    title: "Heavy tee",
    url: "https://weidian.com/item.html?itemID=2",
    image: "https://img.test/tee.jpg",
    photos: [],
    priceUsd: 32,
    platform: "weidian",
    project: "casuals",
    addedAt: 1754000001000,
  },
];

// Fully received: the Share pill only shows then (submitted + milestone 3).
const hauls = [{ name: "casuals", ship: { submitted: true, milestone: 3 } }];

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
await context.addInitScript(
  ({ prefsJson, itemsJson, haulsJson }) => {
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    window.localStorage.setItem("credenza-fashion-items-v1", itemsJson);
    window.localStorage.setItem("credenza-fashion-hauls-v1", haulsJson);
  },
  {
    prefsJson: JSON.stringify(prefs),
    itemsJson: JSON.stringify(items),
    haulsJson: JSON.stringify(hauls),
  }
);
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

// Open the hauls tab, then the haul card, then the Share pill.
await page.locator("button", { hasText: "Hauls" }).first().click();
await page.waitForTimeout(800);
await page.locator('[aria-label^="casuals,"]').first().click();
await page.waitForTimeout(1200);
await page.locator("button", { hasText: "Share" }).first().click();
await page.waitForSelector(".cz-haul-share-body", { timeout: 10000 });
await page.waitForTimeout(600);

// Park the mouse over the sheet body, the state the dome appeared in.
await page.hover(".cz-haul-share-body");
await page.waitForTimeout(300);
await page.screenshot({ path: ".verify-shots/live-share-sheet.png" });

const body = await page.evaluate(() => {
  const el = document.querySelector(".cz-haul-share-body");
  const cs = getComputedStyle(el);
  return {
    bg: cs.backgroundColor,
    radius: cs.borderRadius,
    transform: cs.transform,
  };
});
console.log("sheet body:", JSON.stringify(body));
const clean =
  body.bg === "rgba(0, 0, 0, 0)" &&
  body.radius === "0px" &&
  body.transform === "none";
console.log(clean ? "PASS  no arch, no fill, no scale on the live sheet" : "FAIL  the live sheet still carries the pill styles");

// Hit-test the dome area: a point beside the preview card must land on
// sheet content with no fill and no radius, never on a styled arch.
const probe = await page.evaluate(() => {
  const out = [];
  for (const [x, y] of [[620, 260], [480, 420], [760, 560]]) {
    const el = document.elementFromPoint(x, y);
    if (!el) continue;
    const cs = getComputedStyle(el);
    out.push({
      x, y,
      cls: typeof el.className === "string" ? el.className : "",
      bg: cs.backgroundColor,
      radius: cs.borderRadius,
    });
  }
  return out;
});
for (const p of probe) console.log(JSON.stringify(p));

await browser.close();
console.log("shot: .verify-shots/live-share-sheet.png");

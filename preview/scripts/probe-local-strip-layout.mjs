// Local layout check, 2026-08-03: the indexing strip must be a full-width
// band ABOVE the tabs row, never overlapping Shelf/Hauls or the filters.
// Seeds one card so the band mounts, pastes a link to start the strip at
// FETCHING LINK, then asserts the strip box sits above the tabs box.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "http://localhost:5199";
const LINK = "https://weidian.com/item.html?itemID=7812124117";

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass });
  console.log((pass ? "PASS  " : "FAIL  ") + name + " — " + detail);
};

const item = {
  id: "probe-1",
  title: "Probe card",
  url: "https://weidian.com/item.html?itemID=1",
  addedAt: "2026-08-03T00:00:00.000Z",
};

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

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
await context.addInitScript(
  ({ itemJson, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", itemJson);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { itemJson: JSON.stringify([item]), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

// Desktop flow: the Stash button opens the capture sheet; paste there and
// press Enter to stash (the desk search field never captures, CH-04).
await page.locator('button[aria-label="Stash a link or note"]').first().click();
const box = page.locator('textarea[placeholder="Paste a link, or a whole haul block"]');
await box.fill(LINK);
await box.press("Enter");

await page.waitForSelector(".cz-index-strip", { timeout: 20000 });
await page.waitForTimeout(600);

const layout = await page.evaluate(() => {
  const strip = document.querySelector(".cz-index-strip");
  const tabsRow = document.querySelector(".cz-view-tabs-row");
  if (!strip || !tabsRow) return { strip: !!strip, tabsRow: !!tabsRow };
  const s = strip.getBoundingClientRect();
  const t = tabsRow.getBoundingClientRect();
  const inside = strip.closest(".cz-view-tabs-row") !== null;
  return {
    strip: true,
    tabsRow: true,
    insideTabsRow: inside,
    stripBottom: Math.round(s.bottom),
    tabsTop: Math.round(t.top),
    stripWidth: Math.round(s.width),
    tabsWidth: Math.round(t.width),
    overlaps: s.bottom > t.top + 1,
  };
});

record("strip is not inside the tabs row", layout.insideTabsRow === false, "insideTabsRow=" + layout.insideTabsRow);
record(
  "strip sits above the tabs row with no overlap",
  layout.overlaps === false,
  "strip bottom=" + layout.stripBottom + " tabs top=" + layout.tabsTop
);
record(
  "strip is full width like the tabs row",
  Math.abs((layout.stripWidth || 0) - (layout.tabsWidth || 0)) <= 2,
  "strip=" + layout.stripWidth + " tabs=" + layout.tabsWidth
);

await page.locator(".cz-shelf-band").screenshot({ path: ".verify-shots/local-strip-above-tabs.png" });
console.log("  screenshot: .verify-shots/local-strip-above-tabs.png");

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(failed.length === 0 ? "ALL PASS" : failed.length + " FAILURES");
process.exit(failed.length === 0 ? 0 : 1);

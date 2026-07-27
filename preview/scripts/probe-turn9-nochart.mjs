// Verify handoff turn 9 §3 (no chart → snapshot into the parser) on the phone
// sheet. Four shots: the ask with a usual size, the ask with none, the reading
// state with its scan line, and the read-back with its preview chart.
//
// The read is stubbed at the network boundary. `chart-vision` costs money per
// call, and the point here is the states, not the model.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";
const now = Date.now();

const CHART_TEXT =
  "M: chest 112 length 70 shoulder 46\nL: chest 116 length 72 shoulder 48\nXL: chest 120 length 74 shoulder 50";

// A chartless item: no summary numbers, no gallery, nothing the hunt can read.
// It DOES carry a cover photo, so the album shortcut row renders.
function item(over = {}) {
  return {
    id: "t9n-1",
    createdAt: now - 86400000 * 2,
    updatedAt: now,
    rawText: "https://weidian.com/item.html?itemID=7799763843",
    url: "https://weidian.com/item.html?itemID=7799763843",
    type: "article",
    host: "weidian.com",
    title: "Mutimer Wool Varsity Jacket",
    summary: "Heavy wool body, leather sleeves. Ships from Guangzhou.",
    tags: [],
    image: "https://si.geilicdn.com/pcitem1725553858-6a5e00000191d9d3e1a90a20f3b8-unadjust_640_640.jpg",
    gallery: [],
    links: [],
    price: 249,
    currency: "CNY",
    seller: "Mook-official",
    category: "jacket",
    findStatus: "want",
    weidianUrl: "https://weidian.com/item.html?itemID=7799763843",
    variants: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
    ...over,
  };
}

const basePrefs = {
  viewMode: "carousel",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: "superbuy",
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", usualTops: "L", chest: 100, height: 180, weight: 78 },
  measureUnits: "cm",
  onboardingDone: true,
};

const browser = await chromium.launch();

// `mode` decides what the stubbed chart-vision endpoint does:
//   "hit"  → returns the chart after a short delay
//   "hang" → never answers, so the reading state stays on screen
async function newSeededPage(items, prefs = basePrefs, mode = "hit") {
  const context = await browser.newContext({ ...devices["iPhone 15 Pro"] });
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
  );

  // Stub the vision function. The hunt hits the same endpoint, so answering
  // 404 there first would size the item and hide §3 entirely — instead the
  // hunt's own call (images, no photos) always misses.
  await context.route("**/chart-vision", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const fromCustomer = Array.isArray(body.photos) && body.photos.length > 0;
    if (!fromCustomer) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ found: false }),
      });
      return;
    }
    if (mode === "hang") return; // leave the request open
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ found: true, chartText: CHART_TEXT, scanned: 1 }),
    });
  });

  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  return { context, page };
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name + ".png") });
  console.log("shot:", name);
}

async function openSheet(page) {
  await page.getByRole("button", { name: /^Open Mutimer/ }).first().click({ force: true });
  await page.waitForTimeout(1600);
}

// The sizing block sits under the chip row, below the photo panel. Scroll it
// into the middle of the sheet so the whole block is in frame.
async function revealSizing(page) {
  await page.evaluate(() => {
    const el = document.querySelector(".cz-sizing");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(600);
}

async function blockShot(page, selector, name) {
  const box = page.locator(selector).first();
  if (await box.count()) {
    await box.screenshot({ path: join(outDir, name + ".png") });
    console.log("shot:", name);
    return true;
  }
  console.log("MISSING:", selector);
  return false;
}

// --- 1. The ask, with a usual size to fall back on. ---
{
  const { context, page } = await newSeededPage([item()]);
  await openSheet(page);
  await revealSizing(page);
  await shot(page, "t9n-1-ask-sheet");
  await blockShot(page, ".cz-sizing-nochart", "t9n-2-ask-block");

  const state = await page.evaluate(() => {
    const el = document.querySelector(".cz-sizing-nochart");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      dashed: cs.borderTopStyle,
      kicker: (el.querySelector(".cz-sizing-kicker") || {}).textContent,
      prov: (el.querySelector(".cz-sizing-prov") || {}).textContent,
      value: (el.querySelector(".cz-sizing-value") || {}).textContent,
      aside: (el.querySelector(".cz-sizing-aside") || {}).textContent,
      shimmer: /t-shimmer/.test((el.querySelector(".cz-sizing-value") || {}).className || ""),
      actions: [...el.querySelectorAll(".cz-sizing-action")].map((n) => n.textContent.trim()),
      actionHeight: Math.round(
        (el.querySelector(".cz-sizing-action") || { getBoundingClientRect: () => ({ height: 0 }) })
          .getBoundingClientRect().height
      ),
      album: (el.querySelector(".cz-sizing-albumtext") || {}).textContent || "",
      full: !!el.querySelector(".cz-sizing-full"),
    };
  });
  console.log("ask state:", JSON.stringify(state, null, 2));
  await context.close();
}

// --- 2. The ask with no usual size: em-dash and a plain admission. ---
{
  const noUsual = { ...basePrefs, bodyProfile: { chest: 100, height: 180, weight: 78 } };
  const { context, page } = await newSeededPage([item()], noUsual);
  await openSheet(page);
  await revealSizing(page);
  await blockShot(page, ".cz-sizing-nochart", "t9n-3-ask-no-usual");
  const aside = await page.evaluate(
    () => (document.querySelector(".cz-sizing-aside") || {}).textContent
  );
  console.log("no-usual aside:", aside);
  await context.close();
}

// --- 3. The reading state, scan line running. ---
{
  const { context, page } = await newSeededPage([item()], basePrefs, "hang");
  await openSheet(page);
  await revealSizing(page);
  // Feed a real image file through the Snapshot input.
  const input = page.locator(".cz-sizing-action.is-primary input[type=file]").first();
  await input.setInputFiles(join(here, "..", ".verify-shots", "probe-grid-card-hover.png"));
  await page.waitForTimeout(900);
  await blockShot(page, ".cz-sizing-reading", "t9n-4-reading");
  const reading = await page.evaluate(() => {
    const el = document.querySelector(".cz-sizing-reading");
    if (!el) return null;
    return {
      prov: (el.querySelector(".cz-sizing-prov") || {}).textContent,
      text: (el.querySelector(".cz-sizing-read-text") || {}).textContent,
      scanning: !!el.querySelector(".cz-sizing-read-thumb.is-scanning"),
      busy: el.getAttribute("aria-busy"),
      confirm: !!el.querySelector(".cz-sizing-action.is-primary"),
    };
  });
  console.log("reading state:", JSON.stringify(reading, null, 2));
  await context.close();
}

// --- 4. The read-back, with its preview chart and the confirm pair. ---
{
  const { context, page } = await newSeededPage([item()], basePrefs, "hit");
  await openSheet(page);
  await revealSizing(page);
  const input = page.locator(".cz-sizing-action.is-primary input[type=file]").first();
  await input.setInputFiles(join(here, "..", ".verify-shots", "probe-grid-card-hover.png"));
  await page.waitForTimeout(2000);
  await blockShot(page, ".cz-sizing-reading", "t9n-5-readback");
  const back = await page.evaluate(() => {
    const el = document.querySelector(".cz-sizing-reading");
    if (!el) return null;
    return {
      prov: (el.querySelector(".cz-sizing-prov") || {}).textContent,
      text: (el.querySelector(".cz-sizing-read-text") || {}).textContent,
      scanning: !!el.querySelector(".cz-sizing-read-thumb.is-scanning"),
      cells: [...el.querySelectorAll(".cz-sizing-cell")].map((n) => n.textContent.trim()),
      buttons: [...el.querySelectorAll("button")].map((n) => n.textContent.trim()),
    };
  });
  console.log("read-back state:", JSON.stringify(back, null, 2));

  // Open the per-cell editor: a misread digit must be fixable in place.
  const fixBtn = page.getByRole("button", { name: "Fix a number" });
  if (await fixBtn.count()) {
    await fixBtn.click();
    await page.waitForTimeout(500);
    await blockShot(page, ".cz-sizing-reading", "t9n-6-fix-grid");
    const fix = await page.evaluate(() => {
      const el = document.querySelector(".cz-sizing-fix");
      if (!el) return null;
      return {
        cells: [...el.querySelectorAll(".cz-sizing-fix-cell")].map((n) => n.value),
        cellHeight: Math.round(
          el.querySelector(".cz-sizing-fix-cell").getBoundingClientRect().height
        ),
        columns: [...el.querySelectorAll(".cz-sizing-fix-col")].map((n) => n.textContent),
        sizes: [...el.querySelectorAll(".cz-sizing-fix-row .cz-sizing-fix-size")].map(
          (n) => n.textContent
        ),
      };
    });
    console.log("fix grid:", JSON.stringify(fix, null, 2));

    // The open editor grows the section. Confirm the last action is inside it,
    // not clipped by the section's own box.
    const overflow = await page.evaluate(() => {
      const sec = document.querySelector(".cz-sizing-reading");
      const wide = document.querySelector(".cz-sizing-read-retry.is-wide");
      if (!sec || !wide) return null;
      const s = sec.getBoundingClientRect();
      const w = wide.getBoundingClientRect();
      return {
        sectionBottom: Math.round(s.bottom),
        wideBottom: Math.round(w.bottom),
        clipped: Math.round(w.bottom - s.bottom),
        sectionOverflowY: getComputedStyle(sec).overflowY,
      };
    });
    console.log("overflow check:", JSON.stringify(overflow));
    await revealSizing(page);
    await shot(page, "t9n-6b-fix-sheet");

    // Correct one cell, then confirm the preview row follows.
    const large = page.getByLabel("Large chest in cm", { exact: true });
    await large.fill("118");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Done fixing" }).click();
    await page.waitForTimeout(400);
    const cells = await page.evaluate(() =>
      [...document.querySelectorAll(".cz-sizing-cell")].map((n) => n.textContent.trim())
    );
    console.log("after fix, preview cells:", JSON.stringify(cells));
  } else {
    console.log("MISSING: Fix a number button");
  }

  // Accept it, and confirm the ordinary sizing block takes over with a real
  // recommendation. That is the whole loop closing.
  const use = page.getByRole("button", { name: "Use this chart" });
  if (await use.count()) {
    await use.click();
    await page.waitForTimeout(1600);
    await revealSizing(page);
    await blockShot(page, ".cz-sizing", "t9n-7-after-use");
    const after = await page.evaluate(() => {
      const el = document.querySelector(".cz-sizing");
      if (!el) return null;
      return {
        classes: el.className,
        kicker: (el.querySelector(".cz-sizing-kicker") || {}).textContent,
        prov: (el.querySelector(".cz-sizing-prov") || {}).textContent,
        value: (el.querySelector(".cz-sizing-value") || {}).textContent,
        cells: [...el.querySelectorAll(".cz-sizing-cell")].map((n) => n.textContent.trim()),
      };
    });
    console.log("after use:", JSON.stringify(after, null, 2));
  } else {
    console.log("MISSING: Use this chart button");
  }
  await context.close();
}

await browser.close();
console.log("done");

// Live probe, 2026-08-04 (Kyle: "WHY IS THIS SO INCONSISTENT. #1 CONCERN").
// Paste the real Weidian link from Image #54 into the app on :8888 and watch
// the whole chart path: what resolve stores (gallery/descImages/chartImages),
// what the hunt does, how many paid chart reads fire, and what they return.
//
// The app injects its own preview key; nothing secret touches this script.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "http://localhost:8888";
const LINK = "https://weidian.com/item.html?itemID=7636215363";

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
  ({ prefsJson }) => {
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    window.sessionStorage.setItem("credenza-fashion-fit-skipped-at-v1", "1");
  },
  { prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();

// Count the paid chart reads and capture their outcomes.
const visionCalls = [];
page.on("request", (req) => {
  if (req.url().includes("chart-vision") && req.method() === "POST") {
    let urls = [];
    try {
      const body = JSON.parse(req.postData() || "{}");
      urls = (body.images || body.photos || []).map((u) =>
        typeof u === "string" ? u.slice(u.length - 60) : "inline"
      );
    } catch {}
    visionCalls.push({ urls });
  }
});
page.on("response", async (res) => {
  if (res.url().includes("chart-vision")) {
    let body = "";
    try { body = (await res.text()).slice(0, 300); } catch {}
    const call = visionCalls[visionCalls.length - 1] || {};
    call.status = res.status();
    call.body = body;
  }
});

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

// Open the Stash sheet, type the link, stash it.
await page.locator('[aria-label="Stash a link or note"]').click();
await page.waitForTimeout(800);
await page.locator(".cz-stash-surface textarea").fill(LINK);
await page.waitForTimeout(600);
await page.locator("button", { hasText: "Stash · 1 link" }).first().click();

// Wait for the card to finish enriching (status ready on the stored item).
let item = null;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1500);
  item = await page.evaluate(() => {
    const raw = window.localStorage.getItem("credenza-fashion-items-v1");
    const items = raw ? JSON.parse(raw) : [];
    return items[0] || null;
  });
  if (item && item.status === "ready") break;
}

if (!item) {
  console.log("FAIL  no item stored after paste");
  await browser.close();
  process.exit(1);
}

console.log("== after enrich ==");
console.log("status:", item.status, "| title:", String(item.title || "").slice(0, 40));
console.log("gallery:", (item.gallery || []).length, "| descImages:", (item.descImages || []).length,
  "| chartImages:", (item.chartImages || []).length, "| variants:", (item.variants || []).length);
for (const u of (item.descImages || []).slice(0, 20)) console.log("  desc:", u.slice(-60));

// Open the card so the hunt runs.
await page.locator(".cz-card, [class*=card]").first().click().catch(() => {});
await page.waitForTimeout(2000);
// The detail opens; give the hunt time to finish (album read + up to 3 paid).
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  item = await page.evaluate(() => {
    const raw = window.localStorage.getItem("credenza-fashion-items-v1");
    const items = raw ? JSON.parse(raw) : [];
    return items[0] || null;
  });
  if (item && (item.sizeChartText || item.sizeChartHunt)) break;
}

console.log("== after hunt ==");
console.log("sizeChartText:", item.sizeChartText ? "FOUND (" + item.sizeChartText.length + " chars)" : "none");
console.log("sizeChartSource:", JSON.stringify(item.sizeChartSource || null));
console.log("sizeChartHunt stamp:", JSON.stringify(item.sizeChartHunt || null));
console.log("descImages now:", (item.descImages || []).length);
console.log("paid chart reads:", visionCalls.length);
for (const c of visionCalls)
  console.log("  vision", c.status, (c.urls || []).join(" "), String(c.body || "").replace(/\s+/g, " ").slice(0, 160));

// What does the Fit tab say?
const fitText = await page.evaluate(() => {
  const el = document.querySelector(".cz-detail, .cz-dpanel, [role=dialog]");
  return el ? el.textContent.replace(/\s+/g, " ").slice(0, 400) : "(no detail open)";
});
console.log("== fit panel ==", fitText);

await page.screenshot({ path: ".verify-shots/chart-miss-probe.png" });
await browser.close();

// Re-run of the zoom check only. The first probe used fake photo URLs; the
// magnifier hides on a broken photo by design (PhotoCoverFlow.jsx:490), so the
// FAIL was the probe's fault. This one uses real, loadable photos.
import { webkit } from "playwright";
import { readFileSync } from "fs";

const baseUrl = process.argv[2] || "https://credenzafashion.com";
const dataUrl = readFileSync(".verify-shots/dataurl.txt", "utf8").trim();
const now = Date.now();
const items = [{
  id: "zoom-check", createdAt: now, updatedAt: now,
  url: "https://weidian.com/item.html?itemID=7812124117",
  title: "Zoom check tee", image: dataUrl, gallery: [dataUrl, dataUrl],
  links: [{ url: "https://weidian.com/item.html?itemID=7812124117", role: "buy" }],
  price: 179, currency: "CNY", seller: "mook-offcical", category: "shirt",
  size: "L", project: "casuals", findStatus: "want",
}];
const prefs = { viewMode: "grid", sortMode: "recent", colorwayVersion: 4, preferredAgent: null,
  affiliateCodes: {}, measureUnits: "in", onboardingDone: true, theme: "rainbow" };

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
await context.addInitScript(({ shelf, prefsJson }) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);
await page.locator("article, .cz-photo-list-item").first().click({ force: true });
await page.waitForTimeout(1800);
await page.locator(".cz-dpanel-meta-album").first().click({ force: true });
await page.waitForTimeout(1500);
const zoomIn = page.locator('[aria-label="Enlarge photo"]').first();
if ((await zoomIn.count()) === 0) { console.log("FAIL — still no magnifier"); await page.screenshot({ path: ".verify-shots/zoom-nobtn.png" }); await browser.close(); process.exit(1); }
await zoomIn.click();
await page.waitForTimeout(900);
const opened = await page.evaluate(() => !!document.querySelector(".cz-photo-coverflow-zoom"));
await page.screenshot({ path: ".verify-shots/zoom-open.png" });
const exit = page.locator('[aria-label="Close enlarged photo"]').first();
const hasExit = (await exit.count()) > 0;
if (hasExit) { await exit.click(); await page.waitForTimeout(900); }
const stillOpen = await page.evaluate(() => !!document.querySelector(".cz-photo-coverflow-zoom"));
await page.screenshot({ path: ".verify-shots/zoom-closed.png" });
console.log((opened && hasExit && !stillOpen ? "PASS" : "FAIL") + " — opened: " + opened + ", exit control: " + hasExit + ", closed on click: " + !stillOpen);
await browser.close();

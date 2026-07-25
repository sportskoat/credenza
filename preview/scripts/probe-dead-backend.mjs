// Dead-backend UX probe. Every function call fails (simulated outage).
// The customer must get an honest, calm message — never a spinner that
// runs forever, never a raw stack, never a silent no-op.
// Checks: (1) stash a link with preview down, (2) Cloud Ask with ask down.
// Ask needs the feature flag: run against a server started with
//   VITE_ENABLE_CLOUD_ASK=true npx vite --port 5197 --strictPort
// and pass CZ_BASE=http://localhost:5197/ (default: the flagless :5199,
// where check 2 skips itself when the Cloud Ask pill is absent).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.CZ_BASE || "http://localhost:5199/";
const SHOTS = new URL("./ui-audit/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

// Kill every function call with a 503, like a Netlify outage.
await page.route("**/.netlify/functions/**", (route) =>
  route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Function unavailable" }) })
);

await page.goto(BASE, { waitUntil: "networkidle" });
const gs = page.getByRole("button", { name: "Get started" });
if (await gs.isVisible().catch(() => false)) { await gs.click(); await page.waitForTimeout(400); }

// 1. Stash with preview down — the card must still land (link-only) and the
//    failure must surface as enrichment-failed, not a stuck "Indexing".
await page.getByPlaceholder("Paste a link").fill("https://weidian.com/item.html?itemID=7234567890");
await page.getByRole("button", { name: /Stash/ }).first().click();
await page.waitForTimeout(9000); // give enrichment time to fail + settle
await page.screenshot({ path: `${SHOTS}b-01-stash-backend-down.png` });
const stashState = await page.evaluate(() => ({
  cards: document.querySelectorAll("[id^='card-']").length,
  indexing: /indexing/i.test(document.body.textContent || ""),
  toasts: [...document.querySelectorAll("[class*='toast'], [role='status'], [role='alert']")]
    .map((t) => (t.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120))
    .filter(Boolean),
}));
console.log("stash with backend down:", JSON.stringify(stashState, null, 1));

// 2. Cloud Ask with the function down (skips when the flag is off).
const card = page.locator("[id^='card-']").first();
await card.waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
const searchField = page.getByPlaceholder(/Search or paste a link/);
await searchField.fill("do these jeans run small?");
await page.waitForTimeout(400);
const askBtn = page.getByRole("button", { name: /Ask the private cloud shelf|Cloud Ask/ }).first();
if (await askBtn.isVisible().catch(() => false)) {
  await askBtn.click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${SHOTS}b-02-ask-backend-down.png` });
  const askState = await page.evaluate(() => {
    const alert = document.querySelector("[role='alert']");
    return {
      alertText: alert ? (alert.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200) : null,
      spinner: /asking|thinking/i.test(document.body.textContent || ""),
    };
  });
  console.log("ask with backend down:", JSON.stringify(askState, null, 1));
} else {
  console.log("ask with backend down: SKIPPED (Cloud Ask flag off on this build)");
}

await browser.close();
console.log("done");

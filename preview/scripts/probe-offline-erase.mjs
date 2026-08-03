// Offline + erase edge-case probe.
// A) Stash a card, go offline, reload — the shelf must render from
//    localStorage with no network at all.
// B) Seed the account keys (session/entitlement/usage), run "Erase my data",
//    verify every credenza* key is gone.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const SHOTS = new URL("./ui-audit/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

// — A. Offline reload (against the PRODUCTION build on :5198 — the service
// worker only registers in prod builds) ————————————————————————————————
await page.goto("http://localhost:5198/", { waitUntil: "networkidle" });
// The service worker must finish installing + precaching before we cut
// the network, or the offline reload has nothing to fall back to.
await page
  .waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 15000 })
  .catch(() => console.log("WARNING: no SW controller after 15s"));
const gs = page.getByRole("button", { name: "Get started" });
if (await gs.isVisible().catch(() => false)) { await gs.click(); await page.waitForTimeout(400); }
await page.getByPlaceholder("Paste a link").fill("https://weidian.com/item.html?itemID=7234567890");
await page.getByRole("button", { name: /Stash/ }).first().click();
await page.locator("[id^='card-']").first().waitFor({ state: "visible", timeout: 25000 }).catch(() => {});
await page.waitForTimeout(800);

await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" }).catch((e) => console.log("RELOAD FAILED offline:", String(e).slice(0, 120)));
await page.waitForTimeout(2500);
const offline = await page.evaluate(() => ({
  cards: document.querySelectorAll("[id^='card-']").length,
  bodyText: (document.body.textContent || "").replace(/\s+/g, " ").slice(0, 120),
}));
console.log("offline reload:", JSON.stringify(offline));
await page.screenshot({ path: `${SHOTS}e-01-offline-reload.png` });
if (!offline.cards) console.log("DEFECT: shelf empty after offline reload");
await ctx.setOffline(false);

// — B. Erase sweep covers the account keys ————————————————————————————
await page.evaluate(() => {
  localStorage.setItem("credenza-fashion-session-v1", "{}");
  localStorage.setItem("credenza-fashion-entitlement-v1", "{}");
  localStorage.setItem("credenza-fashion-usage-v1", "{}");
  localStorage.setItem("credenza-fashion-usage-v2", "{}");
  localStorage.setItem("credenza-decoy-unrelated", "x"); // not ours — must survive
});
const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("credenza")).length);
// The erase guard is a native window.confirm — accept it.
page.on("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(700);
await page.getByText("Erase my data").click();
await page.waitForTimeout(2500); // erase runs, then the app reloads itself
const after = await page.evaluate(() => ({
  ours: Object.keys(localStorage).filter((k) => k.startsWith("credenza")),
  decoy: localStorage.getItem("credenza-decoy-unrelated"),
}));
console.log("keys before erase:", before, "| after erase:", JSON.stringify(after));
await page.screenshot({ path: `${SHOTS}e-03-after-erase.png` });

await browser.close();
console.log("done");

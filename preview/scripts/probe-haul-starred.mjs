// Starred filter must not shrink an open haul (Kyle 2026-07-24).
import { chromium } from "playwright";

const items = [
  { id: "a1", status: "ready", title: "Starred haul item", project: "casuals", favorite: true, createdAt: 100, price: 10, currency: "USD" },
  { id: "a2", status: "ready", title: "Plain haul item", project: "casuals", favorite: false, createdAt: 90, price: 20, currency: "USD" },
  { id: "a3", status: "ready", title: "Other haul item", project: "casuals", favorite: false, createdAt: 80, price: 30, currency: "USD" },
  { id: "b1", status: "ready", title: "Starred shelf item", project: "", favorite: true, createdAt: 70, price: 40, currency: "USD" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((shelfJson) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true, sortMode: "starred" })
  );
}, JSON.stringify(items));
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const shelfRow = await page.evaluate(() => document.querySelector(".cz-total-row")?.textContent?.trim());

await page.getByRole("tab", { name: /Hauls/i }).click();
await page.waitForTimeout(1000);
await page.getByText("casuals").first().click();
await page.waitForTimeout(1500);
const haulRow = await page.evaluate(() => document.querySelector(".cz-total-row")?.textContent?.trim());
const cardsShown = await page.evaluate(() => document.querySelectorAll(".cz-carousel-card").length);

console.log(JSON.stringify({ shelfRow, haulRow, cardsShown }));
await browser.close();

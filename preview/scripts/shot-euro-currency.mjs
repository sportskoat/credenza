import { webkit } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Euro currency check (2026-08-01): the shelf total toggle must cycle
// CNY -> USD -> EUR -> CNY and show the € mark on the EUR stop.
// Assumes the caller already runs `npx vite` on port 5173 (same convention
// as shot-topbar-phone.mjs).

const items = [
  {
    id: "eur-check-1",
    title: "Euro Check Jacket",
    price: 300,
    currency: "CNY",
    priceUsd: 42,
    priceEur: 39,
    img: "",
    bought: true,
    addedAt: "2026-08-01T00:00:00.000Z",
  },
];
const prefs = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L" },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
  pricePrimary: "CNY",
};

mkdirSync(".verify-shots", { recursive: true });
const browser = await webkit.launch();
const context = await browser.newContext();
await context.addInitScript(({ shelf, prefsJson }) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

const toggle = page.locator(".cz-total-currency");
const totalText = () => page.locator(".cz-total-currency").innerText();
const reelText = () => page.locator(".t-reel-sr").first().innerText();

const shot = async (name) => {
  const p = resolve(".verify-shots", name);
  await page.screenshot({ path: p });
  console.log("screenshot:", p);
};

// Stop 1: CNY (seeded pref).
console.log("state 1 (expect CNY):", (await totalText()).trim(), "| total:", (await reelText()).trim());
await shot("euro-cny.png");

// Stop 2: USD.
await toggle.click();
await page.waitForTimeout(600);
console.log("state 2 (expect USD):", (await totalText()).trim(), "| total:", (await reelText()).trim());
await shot("euro-usd.png");

// Stop 3: EUR — must show the € symbol on the total.
await toggle.click();
await page.waitForTimeout(600);
const eurLabel = (await totalText()).trim();
const eurTotal = (await reelText()).trim();
console.log("state 3 (expect EUR):", eurLabel, "| total:", eurTotal);
console.log(eurLabel.includes("EUR") && eurTotal.includes("€") ? "PASS: EUR shows €" : "FAIL: EUR stop missing €");
await shot("euro-eur.png");

// Stop 4: back to CNY.
await toggle.click();
await page.waitForTimeout(600);
const backLabel = (await totalText()).trim();
console.log("state 4 (expect CNY):", backLabel);
console.log(backLabel.includes("CNY") ? "PASS: cycle returned to CNY" : "FAIL: cycle did not return to CNY");

await browser.close();

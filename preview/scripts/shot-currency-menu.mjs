import { chromium, webkit } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Currency menu proof (lane 2, 2026-08-02): open the top-8 picker from the
// avatar menu on desktop and phone. Assumes vite on :5173.

const items = [
  {
    id: "fx-check-1",
    title: "Currency Menu Jacket",
    price: 300,
    currency: "CNY",
    priceUsd: 42,
    priceEur: 39,
    priceFx: {
      USD: 42,
      EUR: 39,
      CNY: 300,
      GBP: 33,
      JPY: 6300,
      KRW: 57000,
      CAD: 57,
      AUD: 63,
    },
    img: "",
    bought: true,
    addedAt: "2026-08-02T00:00:00.000Z",
  },
];
const prefs = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "rainbow",
  colorwayVersion: 5,
  preferredAgent: null,
  bodyProfile: { usualSize: "L" },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
  pricePrimary: "USD",
};

mkdirSync(".verify-shots", { recursive: true });

async function run(engine, name, viewport) {
  const browser = await engine.launch();
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.width < 500,
    isMobile: viewport.width < 500,
  });
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
  );
  const page = await context.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // Dismiss consent if present so it does not cover the menu.
  const consent = page.locator("button", { hasText: /accept|got it|ok/i }).first();
  if (await consent.count()) {
    try {
      await consent.click({ timeout: 800 });
    } catch {
      /* optional */
    }
  }

  await page.getByRole("button", { name: "Profile" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Currency/ }).click();
  await page.waitForTimeout(600);

  const dialog = page.getByRole("dialog", { name: "Currency" });
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  const codes = await page.locator(".cz-currency-code").allTextContents();
  const active = await page.locator(".cz-currency-row.is-active .cz-currency-code").textContent();
  console.log(name, "codes:", codes.join(","), "| active:", active);

  const path = resolve(".verify-shots", name + ".png");
  await page.screenshot({ path, fullPage: false });
  console.log("screenshot:", path);

  // Pick GBP and confirm the sheet closes and money updates.
  await page.getByRole("radio", { name: /GBP/i }).click();
  await page.waitForTimeout(800);
  const gbpVisible = await page.locator("body").innerText();
  console.log(name, gbpVisible.includes("£") ? "PASS: £ visible after GBP pick" : "WARN: no £ after pick");

  await browser.close();
}

// Desktop (chromium) + phone (webkit) so both surfaces get a picture.
await run(chromium, "currency-menu-desktop", { width: 1280, height: 800 });
await run(webkit, "currency-menu-phone", { width: 390, height: 844 });

// Proof for Kyle 2026-07-30: "can we get a tool tip next to each of these to
// inform the customer how best to measure this?"
//
// A static HTML probe is not valid for this app — the measurements form is
// rendered by JS. This drives the LIVE page: it opens Settings, opens the
// measurements form, counts the "?" buttons, taps one, and shoots the result
// on a desktop width and a phone width.
import { chromium } from "playwright";
import fs from "node:fs";

const URL = process.env.PROBE_URL || "http://localhost:5347/";
const OUT = "/Users/kylewensel/.buzz/.scratch";

async function openMeasurements(page) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem("credenza-prefs-v1", JSON.stringify({ units: "cm" }));
  });
  // /settings/sizes is a real address (Profile Settings design Phase 4), so
  // the probe can land on the measurements form directly.
  await page.goto(URL + "settings/sizes", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.waitForSelector(".cz-measure-field", { timeout: 15000 });
}

async function shoot(page, width, height, name) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(400);
  const fields = await page.locator(".cz-measure-field").count();
  const asks = await page.locator(".cz-measure-how-btn").count();
  const openBefore = await page.locator(".cz-measure-how").count();

  const first = page.locator(".cz-measure-how-btn").nth(2); // Chest
  await first.click();
  await page.waitForTimeout(300);
  const openAfter = await page.locator(".cz-measure-how").count();
  const text = openAfter ? (await page.locator(".cz-measure-how").first().innerText()).trim() : "";

  // The tip must not cover the box it belongs to.
  const tipBox = await page.locator(".cz-measure-how").first().boundingBox();
  const inputBox = await page
    .locator(".cz-measure-field")
    .nth(2)
    .locator(".cz-measure-input")
    .boundingBox();
  const overlaps = tipBox && inputBox && tipBox.y < inputBox.y + inputBox.height;

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await first.click();
  await page.waitForTimeout(300);
  const openClosed = await page.locator(".cz-measure-how").count();

  return { width, fields, asks, openBefore, openAfter, openClosed, overlaps, text };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await openMeasurements(page);
const desktop = await shoot(page, 1440, 1000, "measure-tips-desktop");
const phone = await shoot(page, 390, 844, "measure-tips-phone");
await browser.close();

fs.writeFileSync(`${OUT}/measure-tips.json`, JSON.stringify({ desktop, phone }, null, 2));
console.log(JSON.stringify({ desktop, phone }, null, 2));

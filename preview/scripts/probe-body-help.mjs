// One-off: confirm the body-measurement explainer paragraph shows only in
// "Your body" mode, and stays absent in "A garment that fits" mode.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("preview/.verify-shots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto("http://127.0.0.1:5391/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(400);
await page.getByText("All settings").click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Sizes and measurements" }).click();
await page.waitForTimeout(600);

const garmentCount = await page.locator(".cz-sizes-body-help").count();
console.log("body-help visible in default (garment) mode:", garmentCount > 0);

await page.getByText("Your body", { exact: true }).click();
await page.waitForTimeout(400);

const bodyHelp = page.locator(".cz-sizes-body-help");
const count = await bodyHelp.count();
console.log("body-help visible in body mode:", count > 0);
if (count > 0) {
  console.log("text:", (await bodyHelp.first().innerText()).replace(/\s+/g, " "));
}

await page.screenshot({ path: "preview/.verify-shots/body-help-mode.png" });
await browser.close();

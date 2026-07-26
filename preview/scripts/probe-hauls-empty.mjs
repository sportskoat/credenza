import { chromium, devices } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const outDir = "/Users/kylewensel/credenza/preview/.verify-shots";
mkdirSync(outDir, { recursive: true });
const baseUrl = process.argv[2] || "http://localhost:4173";
const items = JSON.parse(readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json"), "utf8"));
const prefs = { viewMode: "carousel", sortMode: "recent", theme: "rainbow", colorwayVersion: 4, preferredAgent: null, affiliateCodes: {}, bodyProfile: null, measureUnits: "cm", onboardingDone: true, fitPrefs: {} };

const browser = await chromium.launch();
async function run(name, contextOpts) {
  const context = await browser.newContext(contextOpts);
  await context.addInitScript(({ shelf, p }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", p);
  }, { shelf: JSON.stringify(items), p: JSON.stringify(prefs) });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  const hauls = page.getByRole("tab", { name: /hauls/i }).first();
  if (await hauls.isVisible().catch(() => false)) {
    await hauls.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(outDir, name + ".png") });
    console.log("shot:", name);
  } else {
    console.log("NO HAULS TAB:", name);
  }
  await context.close();
}
await run("he-phone", devices["iPhone 15 Pro"]);
await run("he-desktop", { viewport: { width: 1440, height: 900 } });
await browser.close();
console.log("done");

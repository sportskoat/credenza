// One-off: screenshot the Fit preferences sheet (5a) on desktop + phone.
import { webkit, devices } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);
// Own three categories so three sections render.
items[0].category = "shorts";
items[1].category = "shirt";
items[2].category = "outerwear";

const prefs = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 96, height: 178, weight: 75 },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: { shorts: { length: "short", looseness: "baggy", dismissed: false } },
};

const browser = await webkit.launch();

async function run(name, contextOpts) {
  const context = await browser.newContext(contextOpts);
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
  );
  const page = await context.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Profile" }).first().click({ force: true });
  await page.waitForTimeout(900);
  await page.getByText("Fit preferences").first().click({ force: true });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(outDir, name + ".png") });
  await context.close();
  console.log("done:", name);
}

await run("fitprefs-desktop", { viewport: { width: 1440, height: 900 } });
await run("fitprefs-phone", { ...devices["iPhone 15 Pro"] });
await browser.close();

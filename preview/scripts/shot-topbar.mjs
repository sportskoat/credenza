// One-off: screenshot the desktop top bar (search handoff 6a) — resting state
// and clipboard-banner state — plus the ＋ Stash sheet open.
import { webkit } from "playwright";
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
  fitPrefs: {},
};

const browser = await webkit.launch();

async function run(name, clipText) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ({ shelf, prefsJson, clip }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
      // Stub a silent clipboard read so the banner path renders.
      navigator.clipboard.readText = async () => clip;
      if (navigator.permissions && navigator.permissions.query) {
        const orig = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) =>
          d && d.name === "clipboard-read"
            ? Promise.resolve({ state: "granted" })
            : orig(d);
      }
    },
    { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs), clip: clipText }
  );
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(outDir, name + ".png") });

  if (clipText) {
    // ＋ Stash opens the capture sheet.
    await page.getByRole("button", { name: "Stash a link or note" }).first().click({ force: true });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(outDir, name + "-sheet.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // Search filters the shelf.
  await page.getByRole("textbox", { name: "Search your shelf" }).first().fill("short");
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, name + "-search.png") });

  await context.close();
  console.log("done:", name);
}

await run("topbar-resting", "");
await run("topbar-banner", "https://weidian.com/item/7291234567");
await browser.close();

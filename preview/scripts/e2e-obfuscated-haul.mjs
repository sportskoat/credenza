// E2E: stash Kyle's obfuscated W2C paste → expect 5 cards with real URLs.
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
  bodyProfile: { usualSize: "L" },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
};

const PASTE = `W2C links:

404 hat: https://de tail.1688.com/offer/940644075601.html

Seamless Gym tee: https://it em.taobao.com/item.htm?id=752339164885

Stussy tee: Dead link

Black jeans: https:/ /item. ta oba o.co m /item.htm?id=902046907188

Waverunners: https://rep sunofficial.x.yupoo.com/albums/195089624?uid=1&isSubCate=false&referrercate=4716905

LJR TS: - https://repsuno fficial.x.yupoo.com/albums/202074183?uid=1&isSubCate=false&referrercate=5165137

White Jacket: Repsun dead link

Bag: Repsun dead link`;

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

await page.getByRole("button", { name: "Stash a link or note" }).first().click({ force: true });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Reddit haul" }).click({ force: true });
await page.getByRole("textbox", { name: "Stash a link or note" }).fill(PASTE);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Stash", exact: true }).click({ force: true });
await page.waitForTimeout(2500);
await page.screenshot({ path: join(outDir, "e2e-obfuscated-haul.png") });

// Verify the stored items carry real URLs.
const stored = await page.evaluate(() => {
  const items = JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1"));
  return items.slice(0, 6).map((i) => ({ title: i.title, url: i.url, category: i.category }));
});
console.log(JSON.stringify(stored, null, 1));
await browser.close();

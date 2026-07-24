// Repro: desktop carousel + search filter → card overlaps the meta row?
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
  viewMode: "carousel",
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
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

async function geometry(label) {
  const g = await page.evaluate(() => {
    const meta = [...document.querySelectorAll("*")].find(
      (el) => el.children.length === 0 && /FOUND|SAVED/.test(el.textContent || "")
    );
    const track = document.querySelector(".cz-carousel-track");
    const card = document.querySelector(".cz-carousel-card[data-foreground='true']") ||
      document.querySelector(".cz-carousel-card");
    const stage = document.querySelector(".cz-carousel-stage");
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    return {
      meta: r(meta) && { top: r(meta).top, bottom: r(meta).bottom, text: meta.textContent },
      stage: r(stage) && { top: r(stage).top, height: r(stage).height },
      track: r(track) && { top: r(track).top, height: r(track).height },
      card: r(card) && { top: r(card).top, height: r(card).height },
    };
  });
  console.log(label, JSON.stringify(g, null, 1));
}

await geometry("unfiltered:");

await page.getByRole("textbox", { name: "Search your shelf" }).first().fill("ds");
await page.waitForTimeout(400);
await geometry("mid-filter:");
await page.waitForTimeout(2000);
await geometry("settled:");
await page.screenshot({ path: join(outDir, "repro-carousel-filter.png") });
await browser.close();

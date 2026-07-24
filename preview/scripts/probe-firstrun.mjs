// First-run probe: intro screen only, no app shell, desktop == phone.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function check(width, height, label) {
  // Fresh profile: no localStorage seeding at all = brand-new install.
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => ({
    intro: !!document.querySelector(".cz-onboard"),
    masthead: !!document.querySelector(".cz-masthead"),
    avatar: !!document.querySelector(".cz-avatar"),
    deskSearch: !!document.querySelector(".cz-desk-search-shell"),
    mobileSearch: !!document.querySelector(".cz-search-shell"),
    tabs: !!document.querySelector(".cz-view-tabs"),
    bottomBar: !!document.querySelector(".cz-bottom-bar"),
    agentTile: !!document.querySelector(".cz-bar-agent"),
    emptyHero: !!document.querySelector(".cz-empty-hero"),
  }));
  console.log(label + ":", JSON.stringify(state));
  await page.screenshot({ path: join(outDir, "probe-firstrun-" + label + ".png") });
  await ctx.close();
}

await check(1440, 900, "desktop");
await check(390, 844, "phone");
await browser.close();

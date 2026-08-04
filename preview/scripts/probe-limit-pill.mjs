// Prove the counter pill and the one limits sheet in the REAL app.
//
// A static HTML probe is not valid here: the theme values are inline styles
// written by JS, and the pill only exists after the app decides the plan. So
// this drives the running dev server with a browser.
//
// It checks four things:
//   1. the pill renders, signed out, and says how many free cards are left;
//   2. it turns amber on the last free card;
//   3. tapping it opens the ONE limits sheet;
//   4. the sheet does NOT open on its own.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const USAGE_KEY = "credenza-fashion-usage-v2";
const PREFS = {
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

async function openApp(browser, { used }) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await context.addInitScript(
    ({ prefsJson, usageJson, usageKey }) => {
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
      if (usageJson) window.localStorage.setItem(usageKey, usageJson);
    },
    {
      prefsJson: JSON.stringify(PREFS),
      usageKey: USAGE_KEY,
      usageJson: used ? JSON.stringify({ "anon:resolve:total": used }) : "",
    },
  );
  const page = await context.newPage();
  await page.goto("http://localhost:5347", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  return { context, page };
}

async function readPill(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".cz-limit-pill");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      text: el.textContent.trim(),
      tone: [...el.classList].find((c) => c.startsWith("is-")) || "",
      borderColor: cs.borderTopColor,
      height: Math.round(el.getBoundingClientRect().height),
    };
  });
}

const browser = await chromium.launch();
const report = {};

// A fresh visitor. Five cards left, quiet tone, and NO sheet on load.
{
  const { context, page } = await openApp(browser, { used: 0 });
  report.fresh = await readPill(page);
  report.sheetOnLoad = await page.evaluate(() => !!document.querySelector(".cz-limits"));
  await page.screenshot({ path: join(outDir, "limit-pill-fresh.png") });
  await context.close();
}

// Four cards spent. The last free card, amber.
{
  const { context, page } = await openApp(browser, { used: 4 });
  report.lastCard = await readPill(page);
  await page.screenshot({ path: join(outDir, "limit-pill-last.png") });

  // Tapping the pill opens the one sheet.
  await page.click(".cz-limit-pill");
  await page.waitForTimeout(900);
  report.sheet = await page.evaluate(() => {
    const sheet = document.querySelector(".cz-limits");
    if (!sheet) return null;
    const dialog = sheet.closest("dialog");
    return {
      title: dialog ? (dialog.querySelector("h2, [id]") || {}).textContent : null,
      standing: (sheet.querySelector(".cz-limits-standing") || {}).textContent,
      blocks: [...sheet.querySelectorAll(".cz-limits-block-title")].map((b) => b.textContent.trim()),
      caps: [...sheet.querySelectorAll(".cz-limits-cap")].map((c) => c.textContent.trim()),
    };
  });
  await page.screenshot({ path: join(outDir, "limit-sheet.png") });
  await context.close();
}

// Three cards spent. The wall state.
{
  const { context, page } = await openApp(browser, { used: 3 });
  report.spent = await readPill(page);
  await page.screenshot({ path: join(outDir, "limit-pill-spent.png") });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));

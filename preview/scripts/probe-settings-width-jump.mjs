// Bug A (Kyle 2026-08-02 22:25Z): in Settings > Sizes on his phone, clicking
// "pit to pit" then "shoulder seam" shrank "the width of all of the lines" by
// ~1/4 of the screen; "short sleeve" left them at ~5/8. Repro: phone-sized
// webkit (iOS Safari stand-in), garment mode, focus each tops field in turn
// and measure every row/diagram/field-column width after each focus. Widths
// must be identical across steps; any delta is the bug, printed as numbers.
import { webkit } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots", "settings-width-jump");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:5399";

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { measureMode: "garment", usualTops: "L" },
  measureUnits: "in",
  onboardingDone: true,
  theme: "rainbow",
};

const browser = await webkit.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
});
await ctx.addInitScript((p) => {
  localStorage.setItem("credenza-fashion-items-v1", "[]");
  localStorage.setItem("credenza-prefs-v1", p);
}, JSON.stringify(prefs));
const page = await ctx.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);

// Profile menu -> All settings.
await page.locator('button[aria-label="Profile"]').first().click({ force: true });
await page.waitForTimeout(600);
await page.locator(".cz-avatar-menu-row", { hasText: "All settings" }).first().click({ force: true });
await page.waitForTimeout(1600);

// Phone jump chips: go to the Sizes section.
const sizesChip = page.getByText(/^Sizes$/).first();
if (await sizesChip.count()) {
  await sizesChip.click({ force: true });
  await page.waitForTimeout(900);
}

const measure = (label) =>
  page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x * 10) / 10, w: Math.round(r.width * 10) / 10 };
    };
    const rows = [...document.querySelectorAll(".cz-sizes-row")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: (el.querySelector(".cz-sizes-row-label") || {}).textContent || "?",
        x: Math.round(r.x * 10) / 10,
        w: Math.round(r.width * 10) / 10,
      };
    });
    return {
      innerWidth: window.innerWidth,
      visualWidth: window.visualViewport ? Math.round(window.visualViewport.width) : null,
      scale: window.visualViewport ? Math.round(window.visualViewport.scale * 100) / 100 : null,
      card: rect(document.querySelector(".cz-sizes-group-card")),
      groupBody: rect(document.querySelector(".cz-sizes-group-body")),
      diagram: rect(document.querySelector(".cz-sizes-diagram")),
      fields: rect(document.querySelector(".cz-sizes-fields")),
      settingsContent: rect(document.querySelector(".cz-settings-content")),
      rows,
    };
  });

const show = (label, m) => {
  console.log("== " + label + " ==  innerWidth " + m.innerWidth + " visual " + m.visualWidth + " scale " + m.scale);
  console.log("  card " + JSON.stringify(m.card) + "  fields " + JSON.stringify(m.fields) + "  diagram " + JSON.stringify(m.diagram));
  for (const r of m.rows.slice(0, 5)) console.log("  row " + r.label + "  x " + r.x + "  w " + r.w);
};

const input = (name) =>
  page
    .locator(".cz-sizes-row", { has: page.locator(".cz-sizes-row-label", { hasText: name }) })
    .first()
    .locator("input");

await page.locator(".cz-sizes").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.waitForTimeout(500);
show("idle", await measure("idle"));
await page.screenshot({ path: join(outDir, "0-idle.png") });

// 1. Pit to pit: type 30 (Kyle's exact steps).
await input("Pit to pit").click({ force: true });
await page.waitForTimeout(600);
await page.keyboard.type("30");
await page.waitForTimeout(600);
show("after pit-to-pit 30", await measure());
await page.screenshot({ path: join(outDir, "1-pit.png") });

// 2. Shoulder seam.
await input("Shoulder seam").click({ force: true });
await page.waitForTimeout(800);
show("after shoulder-seam focus", await measure());
await page.screenshot({ path: join(outDir, "2-shoulder.png") });

// 3. Short sleeve.
await input("Short sleeve").click({ force: true });
await page.waitForTimeout(800);
show("after short-sleeve focus", await measure());
await page.screenshot({ path: join(outDir, "3-short-sleeve.png") });

await ctx.close();
await browser.close();
console.log("video + shots in " + outDir);

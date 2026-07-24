// Gate 3 verification: beam hue, neighbor text, dark borders, hauls ghost, dots.
import { chromium } from "playwright";
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

const browser = await chromium.launch();

async function seed(ctx, theme) {
  await ctx.addInitScript(
    ({ shelfJson, themeName }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
      window.localStorage.setItem(
        "credenza-prefs-v1",
        JSON.stringify({
          viewMode: "carousel", sortMode: "recent", theme: themeName,
          colorwayVersion: 4, onboardingDone: true, preferredAgent: null,
          affiliateCodes: {}, bodyProfile: { usualSize: "L" }, measureUnits: "cm", fitPrefs: {},
        })
      );
    },
    { shelfJson: JSON.stringify(items), themeName: theme }
  );
}

// 1) Light carousel: beam is one hue; neighbor text hidden; stage masked.
const light = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await seed(light, "light");
const p1 = await light.newPage();
await p1.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(3500);
const carousel = await p1.evaluate(() => {
  const beam = document.querySelector(".cz-border-beam-glow");
  const beamBg = beam ? getComputedStyle(beam.querySelector("::before") || beam).backgroundImage : null;
  const before = document.querySelector(".cz-buy-btn");
  const glowBg = before ? getComputedStyle(before, "::before").backgroundImage : "";
  const neighborMetaHidden = [...document.querySelectorAll('.cz-carousel-card[data-foreground="false"] .cz-carousel-front-meta')]
    .every((el) => getComputedStyle(el).visibility === "hidden");
  const stage = document.querySelector(".cz-carousel-stage");
  const masked = stage && /gradient/.test(getComputedStyle(stage).maskImage || getComputedStyle(stage).webkitMaskImage || "");
  return {
    glowBgHasPink: /f40051|255, 46, 199|a855f7|168, 85, 247|22d3ee|34, 211, 238|f59e0b/.test(glowBg),
    neighborMetaHidden,
    stageMasked: !!masked,
    neighbors: document.querySelectorAll('.cz-carousel-card[data-foreground="false"]').length,
  };
});
console.log("carousel:", JSON.stringify(carousel));
await p1.screenshot({ path: join(outDir, "gate3-carousel-light.png") });

// 2) Dark grid: card borders visible.
const dark = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await dark.addInitScript(
  (shelfJson) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
    window.localStorage.setItem(
      "credenza-prefs-v1",
      JSON.stringify({
        viewMode: "cards", sortMode: "recent", theme: "rainbow",
        colorwayVersion: 4, onboardingDone: true, preferredAgent: null,
        affiliateCodes: {}, bodyProfile: { usualSize: "L" }, measureUnits: "cm", fitPrefs: {},
      })
    );
  },
  JSON.stringify(items)
);
const p2 = await dark.newPage();
await p2.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(3500);
const darkM = await p2.evaluate(() => {
  const card = document.querySelector("article > div");
  return card
    ? {
        border: getComputedStyle(card).borderColor,
        surface: getComputedStyle(card).backgroundColor.slice(0, 40),
        rim: getComputedStyle(card).boxShadow.slice(0, 80),
      }
    : { card: false };
});
console.log("dark card:", JSON.stringify(darkM));
await p2.screenshot({ path: join(outDir, "gate3-dark-grid.png") });

// 3) Hauls tab ghost tile.
const p3 = await light.newPage();
await p3.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await p3.waitForTimeout(3000);
await p3.getByRole("tab", { name: /Hauls/i }).click();
await p3.waitForTimeout(1200);
const hauls = await p3.evaluate(() => ({
  ghost: !!document.querySelector(".cz-haul-card--ghost"),
  ghostLabel: document.querySelector(".cz-haul-card--ghost .cz-haul-card-name")?.textContent || null,
  haulCards: document.querySelectorAll(".cz-haul-card:not(.cz-haul-card--ghost)").length,
}));
console.log("hauls:", JSON.stringify(hauls));
await p3.screenshot({ path: join(outDir, "gate3-hauls.png") });

// 4) Import sheet: neutral dots.
await p3.getByRole("button", { name: /profile/i }).first().click();
await p3.waitForTimeout(700);
await p3.getByText(/Import & backup/i).first().click();
await p3.waitForTimeout(900);
const dots = await p3.evaluate(() => {
  const dot = document.querySelector(".cz-import-source-dot");
  return dot ? { bg: getComputedStyle(dot).backgroundColor, inlineStyle: dot.getAttribute("style") } : { dot: false };
});
console.log("source dot:", JSON.stringify(dots));
await p3.screenshot({ path: join(outDir, "gate3-import-dots.png") });

await browser.close();

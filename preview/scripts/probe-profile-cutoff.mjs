// Profile sheet geometry probe: desktop-narrow (743px, fine pointer) vs phone (coarse).
import { chromium, devices } from "playwright";
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
  viewMode: "cards", sortMode: "recent", theme: "light", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {},
};

async function measure(ctx, label, shot) {
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /profile/i }).first().click();
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const dlg = document.querySelector(".cz-modal");
    const surface = dlg && dlg.querySelector(".cz-modal-surface");
    if (!dlg) return { open: false };
    const b = dlg.getBoundingClientRect();
    const cs = getComputedStyle(dlg);
    return {
      open: true,
      viewport: { w: innerWidth, h: innerHeight },
      coarse: matchMedia("(pointer: coarse)").matches,
      dialog: { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), height: Math.round(b.height) },
      margin: cs.margin,
      maxHeight: cs.maxHeight,
      scrolls: surface ? surface.scrollHeight > surface.clientHeight : null,
      cutOff: Math.round(b.bottom) > innerHeight,
    };
  });
  console.log(label, JSON.stringify(m));
  await page.screenshot({ path: join(outDir, shot) });
  await page.close();
}

const browser = await chromium.launch();

// Case 1: Kyle's desktop window — 743 CSS px wide, fine pointer.
const narrow = await browser.newContext({ viewport: { width: 743, height: 938 } });
await narrow.addInitScript(
  ({ shelfJson, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelfJson: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
await measure(narrow, "desktop-narrow:", "probe-modal-narrow-desktop.png");

// Case 2: real phone — coarse pointer must keep the bottom sheet.
const phone = await browser.newContext({
  ...devices["iPhone 13"],
});
await phone.addInitScript(
  ({ shelfJson, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelfJson: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
await measure(phone, "phone-coarse:  ", "probe-modal-phone.png");

await browser.close();

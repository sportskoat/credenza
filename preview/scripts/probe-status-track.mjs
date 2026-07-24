// Probe: the status track connector must not touch any dot (Kyle 2026-07-24).
// Seeds the shelf, flips the center carousel card, then measures each
// connector box against every dot box — zero overlap = clean.
import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);
const prefs = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "rainbow",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 96, height: 178, weight: 75 },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
};

const browser = await webkit.launch();
const context = await browser.newContext({ ...devices["iPhone 15 Pro"] });
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

await page.getByRole("button", { name: "Carousel view" }).first().click({ force: true });
await page.waitForTimeout(1500);
await page.locator(".cz-carousel-card").first().click({ force: true });
await page.waitForTimeout(1200);

const result = await page.evaluate(() => {
  const track = document.querySelector(".cz-status-track");
  if (!track) return { found: false };
  const dots = [...track.querySelectorAll(".cz-status-track-dot")].map((d) => {
    const r = d.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
  const overlaps = [];
  const connectors = [...track.querySelectorAll(".cz-status-track-connector")].map((c) => {
    const r = c.getBoundingClientRect();
    const box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    dots.forEach((d, i) => {
      const hit =
        box.left < d.right && box.right > d.left && box.top < d.bottom && box.bottom > d.top;
      if (hit) overlaps.push(i);
    });
    return box;
  });
  return { found: true, dots: dots.length, connectors: connectors.length, overlaps };
});
console.log("track:", JSON.stringify(result));

const track = page.locator(".cz-status-track").first();
if (await track.count()) {
  await track.screenshot({ path: "/tmp/track-fixed.png" });
  console.log("shot: /tmp/track-fixed.png");
}
await browser.close();

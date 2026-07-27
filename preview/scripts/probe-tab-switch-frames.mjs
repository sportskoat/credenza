// Kyle 2026-07-27: "the screens are glitchy… the animations to move from one to
// the other are very choppy."
//
// probe-page-slide-frames.mjs cleared the modal sub-page stack. This measures
// the main tab switch — Shelf → Hauls → Shelf — which is what "screens" most
// likely means: the whole grid unmounts and a different one mounts.
//
// Reports rAF gap distribution plus long-task entries, which is where a
// synchronous re-render of 24 cards would show up. Headless Chromium has no GPU
// compositing, so paint cost is understated here and script cost is not.
import { chromium } from "playwright";

const COUNT = Number(process.env.ITEMS || 24);
const items = Array.from({ length: COUNT }, (_, i) => ({
  id: "x" + i, title: "Item " + i, url: "https://weidian.com/item.html?itemID=" + i,
  price: 100 + i, currency: "CNY", images: [], addedAt: Date.now() - i * 1000,
  haul: "Haul " + (i % 4),
}));
const prefs = {
  viewMode: "cards", sortMode: "recent", theme: "rainbow", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {}, stashMode: "link",
};

const VIEWPORT = process.argv.includes("--desktop")
  ? { width: 1280, height: 900 }
  : { width: 390, height: 844 };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  hasTouch: VIEWPORT.width < 500,
  isMobile: VIEWPORT.width < 500,
});
await ctx.addInitScript(({ shelf, p }) => {
  localStorage.setItem("credenza-fashion-items-v1", shelf);
  localStorage.setItem("credenza-prefs-v1", p);
}, { shelf: JSON.stringify(items), p: JSON.stringify(prefs) });

const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

await page.evaluate(() => {
  window.__frames = [];
  window.__long = [];
  window.__rec = false;
  new PerformanceObserver((l) => {
    if (window.__rec) for (const e of l.getEntries()) window.__long.push(+e.duration.toFixed(1));
  }).observe({ entryTypes: ["longtask"] });
  const tick = (t) => {
    if (window.__rec) window.__frames.push(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__start = () => { window.__frames = []; window.__long = []; window.__rec = true; };
  window.__stop = () => {
    window.__rec = false;
    const f = window.__frames;
    const gaps = f.slice(1).map((t, i) => t - f[i]);
    const s = [...gaps].sort((a, b) => a - b);
    const q = (p) => (s.length ? +s[Math.floor((s.length - 1) * p)].toFixed(1) : 0);
    const med = q(0.5);
    return {
      frames: f.length,
      span: f.length ? +(f[f.length - 1] - f[0]).toFixed(0) : 0,
      median: med,
      p90: q(0.9),
      worst: s.length ? +s[s.length - 1].toFixed(1) : 0,
      stutters: gaps.filter((g) => g > med * 2).length,
      longTasks: window.__long,
    };
  };
});

const tab = (name) => page.locator('button.cz-tab', { hasText: name }).first();

if (!(await tab("Shelf").count())) throw new Error("no tabs — the shelf did not seed");

async function press(label, name) {
  await page.evaluate(() => window.__start());
  await tab(name).click({ timeout: 3000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => window.__stop());
  console.log(
    `  ${label.padEnd(18)} frames=${r.frames} span=${r.span}ms median=${r.median} ` +
    `p90=${r.p90} worst=${r.worst} stutters=${r.stutters} longTasks=${JSON.stringify(r.longTasks)}`
  );
}

console.log(`viewport ${VIEWPORT.width}x${VIEWPORT.height}, ${COUNT} items`);
await press("Shelf -> Hauls", "Hauls");
await press("Hauls -> Shelf", "Shelf");
await press("Shelf -> Hauls #2", "Hauls");
await press("Hauls -> Shelf #2", "Shelf");

await browser.close();

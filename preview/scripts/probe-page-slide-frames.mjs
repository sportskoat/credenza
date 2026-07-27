// Kyle 2026-07-27: "the animations to move from one to the other are very
// choppy." This measures the sub-page slide instead of guessing at it.
//
// Method: sample requestAnimationFrame timestamps across the push and the back,
// then report the frame-gap distribution over the transition window only. A
// dropped frame is a gap over twice the median — headless Chromium runs rAF
// faster than 60Hz, so a fixed 33ms threshold would report nothing.
//
// Strict on purpose: the first draft swallowed a click failure with .catch()
// and reported three clean runs of an animation that never played. Every step
// now asserts, and the run asserts that data-page actually flipped.
//
// Run with the dev server up on 5173.
import { chromium } from "playwright";

const items = Array.from({ length: 24 }, (_, i) => ({
  id: "x" + i, title: "Item " + i, url: "https://weidian.com/item.html?itemID=" + i,
  price: 100 + i, currency: "CNY", images: [], addedAt: Date.now() - i * 1000, haul: "Test haul",
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
  window.__rec = false;
  // Log every height the stack is set to, so a multi-step resize shows up as
  // more than one entry rather than as a smooth tween.
  window.__heights = [];
  const tick = (t) => {
    if (window.__rec) {
      window.__frames.push(t);
      const st = document.querySelector(".cz-modal-stack");
      const h = st && st.style.height;
      const last = window.__heights[window.__heights.length - 1];
      if (h && h !== last) window.__heights.push(h);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__start = () => { window.__frames = []; window.__heights = []; window.__rec = true; };
  window.__stop = () => {
    window.__rec = false;
    const f = window.__frames;
    const gaps = f.slice(1).map((t, i) => t - f[i]);
    const sorted = [...gaps].sort((a, b) => a - b);
    const q = (p) => (sorted.length ? +sorted[Math.floor((sorted.length - 1) * p)].toFixed(1) : 0);
    const med = q(0.5);
    return {
      frames: f.length,
      span: f.length ? +(f[f.length - 1] - f[0]).toFixed(0) : 0,
      median: med,
      p90: q(0.9),
      worst: sorted.length ? +sorted[sorted.length - 1].toFixed(1) : 0,
      // A stutter the eye sees: a gap over twice the median cadence.
      stutters: gaps.filter((g) => g > med * 2).length,
      heightSteps: window.__heights.length,
      heights: window.__heights,
    };
  };
});

const openBtn = page.locator('button.cz-profile-row', { hasText: "Default agent" });
const backBtn = page.locator(".cz-modal-back");

await page.click(".cz-avatar");
await page.waitForTimeout(900);
if (!(await openBtn.count())) throw new Error("no 'Default agent' row — the sheet did not open");

const dataPage = () =>
  page.evaluate(() => document.querySelector(".cz-modal-stack")?.getAttribute("data-page"));

async function run(label) {
  if ((await dataPage()) !== "1") throw new Error(`${label}: did not start on page 1`);

  await page.evaluate(() => window.__start());
  await openBtn.click({ timeout: 3000 });
  await page.waitForTimeout(700);
  const push = await page.evaluate(() => window.__stop());
  if ((await dataPage()) !== "2") throw new Error(`${label}: push did not reach page 2`);

  await page.evaluate(() => window.__start());
  await backBtn.click({ timeout: 3000 });
  await page.waitForTimeout(700);
  const pop = await page.evaluate(() => window.__stop());
  if ((await dataPage()) !== "1") throw new Error(`${label}: back did not return to page 1`);

  const fmt = (r) =>
    `frames=${r.frames} span=${r.span}ms median=${r.median} p90=${r.p90} worst=${r.worst} ` +
    `stutters=${r.stutters} heightSteps=${r.heightSteps} ${JSON.stringify(r.heights)}`;
  console.log(`${label}\n  push ${fmt(push)}\n  back ${fmt(pop)}`);
}

console.log(`viewport ${VIEWPORT.width}x${VIEWPORT.height}`);
await run("as-shipped");

await page.evaluate(() => {
  const s = document.createElement("style");
  s.id = "cz-probe";
  s.textContent = ":root{--page-blur:0px}";
  document.head.appendChild(s);
});
await run("--page-blur: 0");

await page.evaluate(() => {
  document.getElementById("cz-probe").textContent =
    ".cz-modal-stack{transition:none !important}";
});
await run("stack height tween off");

await page.evaluate(() => {
  document.getElementById("cz-probe").textContent =
    ".cz-modal.t-modal{transition:transform 260ms,opacity 260ms !important}";
});
await run("dialog max-width tween off");

await browser.close();

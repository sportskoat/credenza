// The compositing audit headless timing cannot do.
//
// probe-page-slide-frames.mjs and probe-tab-switch-frames.mjs both came back
// nearly clean, and that is a limit of the harness, not a verdict: headless
// Chromium composites on the CPU with no GPU, so backdrop-filter and filter
// cost close to nothing there and everything on Kyle's phone.
//
// So count instead of time. A backdrop-filter forces its own compositing layer
// AND makes the browser re-read the pixels behind it every frame the backdrop
// moves. Two of them overlapping is two full-area reads per frame. This reports
// every live blurred element with its painted area, so the bill is visible even
// though this machine does not pay it.
import { chromium } from "playwright";

const items = Array.from({ length: 24 }, (_, i) => ({
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

const audit = () =>
  page.evaluate((vp) => {
    const out = { backdrop: [], filter: [], willChange: [], viewportPx: vp.width * vp.height };
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const area = Math.round(r.width * r.height);
      const name = (el.className && String(el.className).split(" ")[0]) || el.tagName;
      const bd = cs.backdropFilter || cs.webkitBackdropFilter;
      if (bd && bd !== "none") out.backdrop.push({ name, bd, area });
      if (cs.filter && cs.filter !== "none" && /blur/.test(cs.filter)) {
        out.filter.push({ name, f: cs.filter, area });
      }
      if (cs.willChange && cs.willChange !== "auto") {
        out.willChange.push({ name, wc: cs.willChange, area });
      }
    }
    return out;
  }, VIEWPORT);

function report(label, a) {
  const px = a.viewportPx;
  const sum = (xs) => xs.reduce((n, x) => n + x.area, 0);
  console.log(`\n${label}`);
  console.log(
    `  backdrop-filter: ${a.backdrop.length} elements, ` +
    `${(sum(a.backdrop) / px).toFixed(2)}x viewport area re-read per frame`
  );
  for (const b of a.backdrop) {
    console.log(`      ${b.name.padEnd(26)} ${b.bd.padEnd(14)} ${(b.area / px).toFixed(2)}x vp`);
  }
  if (a.filter.length) {
    console.log(`  filter: blur(): ${a.filter.length} elements`);
    for (const f of a.filter) {
      console.log(`      ${f.name.padEnd(26)} ${f.f.padEnd(14)} ${(f.area / px).toFixed(2)}x vp`);
    }
  }
  console.log(`  will-change: ${a.willChange.length} elements (each is a retained layer)`);
  const byWc = {};
  for (const w of a.willChange) byWc[w.wc] = (byWc[w.wc] || 0) + 1;
  for (const [k, v] of Object.entries(byWc)) console.log(`      ${String(v).padStart(3)}x ${k}`);
}

console.log(`viewport ${VIEWPORT.width}x${VIEWPORT.height}`);
report("A. shelf at rest", await audit());

await page.locator("button.cz-tab", { hasText: "Hauls" }).first().click();
await page.waitForTimeout(120);
report("B. mid tab switch (120ms in)", await audit());

await page.locator("button.cz-tab", { hasText: "Shelf" }).first().click();
await page.waitForTimeout(700);
await page.click(".cz-avatar");
await page.waitForTimeout(120);
report("C. mid modal open (120ms in)", await audit());

await page.waitForTimeout(700);
await page.locator("button.cz-profile-row", { hasText: "Default agent" }).click();
await page.waitForTimeout(120);
report("D. mid sub-page slide (120ms in)", await audit());

await browser.close();

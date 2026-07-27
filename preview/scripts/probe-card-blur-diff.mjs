// Does the card backdrop-filter earn its cost?
//
// probe-composite-cost.mjs found 24 .cz-card elements each carrying
// backdrop-filter: blur(18px) — 3.82x the viewport re-read every frame at rest,
// 4.70x during a modal transition, and it scales with the shelf. That is the
// leading suspect for Kyle's "the animations… are very choppy" (2026-07-27).
//
// The argument for removing it is that the backdrop is already soft: the only
// thing behind a card is the ambient background div, which carries
// filter: blur(48px). Blurring an already-Gaussian field by another 18px widens
// the kernel to sqrt(48^2 + 18^2) = 51.3 — 7% on something with no edges left.
//
// An argument is not evidence. This screenshots the same shelf with and without
// the card rule and reports the actual per-pixel difference, per theme, so the
// decision rests on a number.
// The repo has no PNG decoder in node_modules, and adding one for a probe is
// not worth a dependency. Chromium already decodes PNG, so the diff runs in a
// blank page: draw both shots to a canvas and read the pixels back.
import { chromium } from "playwright";

const items = Array.from({ length: 24 }, (_, i) => ({
  id: "x" + i, title: "Item " + i, url: "https://weidian.com/item.html?itemID=" + i,
  price: 100 + i, currency: "CNY", images: [], addedAt: Date.now() - i * 1000,
  haul: "Haul " + (i % 4),
}));
const base = {
  viewMode: "cards", sortMode: "recent", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {}, stashMode: "link",
};

// The rule is scoped to `article > div`, which is every card in both views.
const KILL = `.cz-app[data-fashion="true"] article > div {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}`;

const browser = await chromium.launch();

const judgeCtx = await browser.newContext();
const judge = await judgeCtx.newPage();
await judge.goto("about:blank");

async function diff(a, b) {
  return judge.evaluate(async ([sa, sb]) => {
    const load = (s) =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = "data:image/png;base64," + s;
      });
    const [A, B] = await Promise.all([load(sa), load(sb)]);
    if (A.width !== B.width || A.height !== B.height) return null;
    const px = (img) => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, img.width, img.height).data;
    };
    const da = px(A);
    const db = px(B);
    let changed = 0;
    let visible = 0;
    let sum = 0;
    let worst = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d =
        Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      if (d > 0) changed++;
      // 3 per channel is the floor of what a person can see on a gradient.
      if (d > 9) visible++;
      sum += d;
      if (d > worst) worst = d;
    }
    // A mean hides where the difference lives. Bucket the visibly-changed
    // pixels into 16 rows so a difference concentrated in one band (a header, a
    // sticky bar) reads differently from one spread over every card.
    const rows = 16;
    const band = new Array(rows).fill(0);
    for (let i = 0; i < da.length; i += 4) {
      const d =
        Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      if (d > 9) {
        const y = Math.floor(i / 4 / A.width);
        band[Math.floor((y / A.height) * rows)]++;
      }
    }
    const n = da.length / 4;
    const perBand = Math.floor(n / rows);
    return {
      pctChanged: +((changed / n) * 100).toFixed(2),
      pctVisiblyChanged: +((visible / n) * 100).toFixed(2),
      meanDeltaPerChannel: +(sum / n / 3).toFixed(2),
      worstChannelSum: worst,
      // Percent of each horizontal sixteenth that changed visibly, top to bottom.
      bands: band.map((c) => +((c / perBand) * 100).toFixed(1)),
    };
  }, [a.toString("base64"), b.toString("base64")]);
}

for (const theme of ["rainbow", "dark", "light"]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript(({ shelf, p }) => {
    localStorage.setItem("credenza-fashion-items-v1", shelf);
    localStorage.setItem("credenza-prefs-v1", p);
  }, { shelf: JSON.stringify(items), p: JSON.stringify({ ...base, theme }) });

  const page = await ctx.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  // Freeze anything still moving so the two shots differ by the rule alone.
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none !important;transition:none !important}" });
  await page.waitForTimeout(400);

  const before = await page.screenshot();
  await page.addStyleTag({ content: KILL });
  await page.waitForTimeout(400);
  const after = await page.screenshot();

  const cards = await page.evaluate(
    () => document.querySelectorAll('.cz-app[data-fashion="true"] article > div').length
  );
  console.log(`${theme.padEnd(8)} cards=${cards} ${JSON.stringify(await diff(before, after))}`);
  await ctx.close();
}

await browser.close();

// The other half of probe-card-blur-diff.mjs.
//
// One rule sets backdrop-filter: blur(18px) on both `article > div` (24 cards)
// and .cz-modal-surface (one sheet). The cards measured invisible: they are 86%
// opaque over an ambient field already carrying filter: blur(48px), so there is
// no detail left to blur and no gap to see it through.
//
// The modal surface is a different case. It sits over the shelf itself — card
// edges, titles, prices, hard rectangles — so its blur may be doing real work.
// Same method, so the two answers are comparable: screenshot with and without,
// count pixels that move more than a person can see.
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

const browser = await chromium.launch();
const judge = await (await browser.newContext()).newPage();
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
      if (d > 9) visible++;
      sum += d;
      if (d > worst) worst = d;
    }
    const n = da.length / 4;
    return {
      pctChanged: +((changed / n) * 100).toFixed(2),
      pctVisiblyChanged: +((visible / n) * 100).toFixed(2),
      meanDeltaPerChannel: +(sum / n / 3).toFixed(2),
      worstChannelSum: worst,
    };
  }, [a.toString("base64"), b.toString("base64")]);
}

for (const theme of ["rainbow", "light"]) {
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
  await page.click(".cz-avatar");
  await page.waitForTimeout(900);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none !important;transition:none !important}",
  });
  await page.waitForTimeout(400);

  // Guard the probe. A zero diff is only evidence if the rule was actually live
  // on a visible element and actually went away — otherwise zero just means the
  // selector missed, which is the mistake probe-page-slide-frames.mjs already
  // made once by swallowing a failed click.
  const live = () =>
    page.evaluate(() => {
      const els = [...document.querySelectorAll('.cz-app[data-fashion="true"] .cz-modal-surface')];
      const vis = els.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== "hidden";
      });
      return {
        count: els.length,
        visible: vis.length,
        area: vis.reduce((n, el) => {
          const r = el.getBoundingClientRect();
          return n + Math.round(r.width * r.height);
        }, 0),
        bd: vis.map((el) => getComputedStyle(el).backdropFilter),
      };
    });

  const on = await live();
  if (!on.visible) throw new Error(`${theme}: no visible .cz-modal-surface — the sheet did not open`);
  if (!on.bd.some((b) => /blur/.test(b))) {
    throw new Error(`${theme}: .cz-modal-surface carries no blur to remove (${JSON.stringify(on.bd)})`);
  }

  const before = await page.screenshot();
  await page.addStyleTag({
    content: `.cz-app[data-fashion="true"] .cz-modal-surface{
      -webkit-backdrop-filter:none !important;backdrop-filter:none !important}`,
  });
  await page.waitForTimeout(400);
  const off = await live();
  if (off.bd.some((b) => /blur/.test(b))) {
    throw new Error(`${theme}: the override did not take (${JSON.stringify(off.bd)})`);
  }
  const after = await page.screenshot();

  const vp = 390 * 844;
  console.log(
    `modal surface / ${theme.padEnd(8)} visible=${on.visible} ` +
    `area=${(on.area / vp).toFixed(2)}x vp bd=${on.bd[0]} ${JSON.stringify(await diff(before, after))}`
  );
  await ctx.close();
}

await browser.close();

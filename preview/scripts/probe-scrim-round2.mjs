// Round-2 scrim measurement — PLANS/CREDENZA_SCRIM_ROUND2.md Step C.
// Four cases x two themes. Per-row stddev of brightness across each card,
// plus saved crops for the legibility read. Run: node probe-scrim-round2.mjs
import { chromium } from "/Users/kylewensel/credenza/preview/node_modules/playwright-core/index.mjs";
import fs from "node:fs";

const OUT = "/Users/kylewensel/.buzz/.scratch/scrim2";
fs.mkdirSync(OUT, { recursive: true });

const seed = (theme) => `(() => {
  if (!location.host.includes("5173")) return;
  try {
    const c = document.createElement("canvas");
    c.width = 480; c.height = 600;
    const g = c.getContext("2d");
    const img = g.createImageData(480, 600);
    let s = 1234567;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = rnd() * 255; img.data[i + 1] = rnd() * 255;
      img.data[i + 2] = rnd() * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const noise = c.toDataURL("image/png");
    const now = Date.now();
    localStorage.setItem("credenza-fashion-items-v1", JSON.stringify([
      { id: "scrim-photo", title: "Vintage varsity jacket", type: "link",
        url: "https://weidian.com/item.html?itemID=1", host: "weidian.com",
        image: noise, priceUsd: 45, currency: "USD", size: "M",
        seller: "testshop", category: "outerwear", importance: "medium",
        createdAt: now, updatedAt: now },
      { id: "scrim-nophoto", title: "Canvas tote bag", type: "link",
        url: "https://weidian.com/item.html?itemID=2", host: "weidian.com",
        priceUsd: 19, currency: "USD", size: "One size",
        seller: "toteshop", category: "bag", importance: "medium",
        createdAt: now - 1000, updatedAt: now - 1000 },
      { id: "scrim-sparse", title: "Mystery jacket no facts", type: "link",
        url: "https://weidian.com/item.html?itemID=3", host: "weidian.com",
        image: noise, category: "outerwear", importance: "medium",
        createdAt: now - 2000, updatedAt: now - 2000 },
    ]));
    localStorage.setItem("credenza-prefs-v1", JSON.stringify({
      theme: "${theme}", colorwayVersion: 4, sortMode: "recent",
      shelfFilter: "all", pricePrimary: "USD", measureUnits: "in",
      onboardingDone: true,
    }));
  } catch (e) {}
})();`;

async function analyze(page, buf, rowsPct) {
  const b64 = buf.toString("base64");
  return page.evaluate(async ({ b64, rowsPct }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const out = [];
    for (const p of rowsPct) {
      const y = Math.min(c.height - 1, Math.max(0, Math.round((c.height * p) / 100)));
      const y0 = Math.max(0, y - 2), y1 = Math.min(c.height - 1, y + 2);
      const d = g.getImageData(0, y0, c.width, y1 - y0 + 1).data;
      const vals = [];
      for (let i = 0; i < d.length; i += 4)
        vals.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length);
      out.push({ row: p, mean: +mean.toFixed(1), sd: +sd.toFixed(1) });
    }
    return out;
  }, { b64, rowsPct });
}

// Locate title/price inside a card and return their row centres as % of card height.
async function textRows(card, titleSel, priceSel) {
  return card.evaluate(
    (el, { titleSel, priceSel }) => {
      const cb = el.getBoundingClientRect();
      const pct = (n) => {
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return +(((r.top + r.height / 2 - cb.top) / cb.height) * 100).toFixed(1);
      };
      const t = el.querySelector(titleSel) || document.querySelector(titleSel);
      const p = el.querySelector(priceSel) || document.querySelector(priceSel);
      return { title: pct(t), price: pct(p) };
    },
    { titleSel, priceSel }
  );
}

const FIXED = [55, 60, 65, 70, 74, 78, 82, 86, 90, 94, 97];

async function measureCard(analysisPage, card, tag, titleSel, priceSel) {
  const box = await card.boundingBox();
  if (!box) return { tag, error: "no box" };
  const shot = await card.page().screenshot({ clip: box });
  fs.writeFileSync(`${OUT}/${tag}.png`, shot);
  const rows = await textRows(card, titleSel, priceSel);
  const extra = [rows.title, rows.price].filter((v) => v != null);
  const rowsPct = [...new Set([...FIXED, ...extra])].sort((a, b) => a - b);
  const data = await analyze(analysisPage, shot, rowsPct);
  // meta crop for the legibility read: bottom 50% of the card
  const metaClip = {
    x: box.x, y: box.y + box.height * 0.5, width: box.width, height: box.height * 0.5,
  };
  fs.writeFileSync(`${OUT}/${tag}-meta.png`, await card.page().screenshot({ clip: metaClip }));
  return { tag, titleRow: rows.title, priceRow: rows.price, data };
}

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const analysisPage = await (await browser.newContext()).newPage();
await analysisPage.goto("about:blank");

const report = {};
for (const theme of ["rainbow", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(seed(theme));
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForSelector(".cz-photo-list-card", { timeout: 15000 });

  report[theme] = {};
  report[theme]["grid-photo"] = await measureCard(
    analysisPage,
    page.locator(".cz-photo-list-card", { hasText: "Vintage varsity jacket" }).first(),
    `${theme}-grid-photo`, ".cz-photo-list-title", ".cz-photo-list-price"
  );
  report[theme]["grid-nophoto"] = await measureCard(
    analysisPage,
    page.locator(".cz-photo-list-card", { hasText: "Canvas tote bag" }).first(),
    `${theme}-grid-nophoto`, ".cz-photo-list-title", ".cz-photo-list-price"
  );
  // Sparse item (no ref, no seller, no size, no price): picture only, to
  // confirm no blank gap appears (Step E.5).
  const sparseGrid = page.locator(".cz-photo-list-card", { hasText: "Mystery jacket no facts" }).first();
  fs.writeFileSync(`${OUT}/${theme}-grid-sparse.png`, await sparseGrid.screenshot());

  await page.locator('[aria-label="Carousel view"]').click();
  await page.waitForSelector(".cz-carousel-front", { timeout: 15000 });
  await page.waitForTimeout(900); // let the rack settle

  // The photo card is foreground first; measure it BEFORE clicking away,
  // while it is centred and front-on.
  report[theme]["carousel-photo"] = await measureCard(
    analysisPage,
    page.locator(".cz-carousel-front", { hasText: "Vintage varsity jacket" }).first(),
    `${theme}-carousel-photo`, ".cz-photo-list-title", ".cz-photo-list-price"
  );

  // Centre the tote card, then measure it.
  const toteFront = page.locator(".cz-carousel-front", { hasText: "Canvas tote bag" }).first();
  if (await toteFront.count()) await toteFront.click({ force: true }).catch(() => {});
  await page.waitForTimeout(900);

  report[theme]["carousel-nophoto"] = await measureCard(
    analysisPage,
    page.locator(".cz-carousel-front", { hasText: "Canvas tote bag" }).first(),
    `${theme}-carousel-nophoto`, ".cz-photo-list-title", ".cz-photo-list-price"
  );

  // Sparse item on the carousel: centre it, picture only (Step E.5).
  const sparseFront = page.locator(".cz-carousel-front", { hasText: "Mystery jacket no facts" }).first();
  if (await sparseFront.count()) {
    await sparseFront.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    fs.writeFileSync(`${OUT}/${theme}-carousel-sparse.png`, await sparseFront.screenshot());
  }
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 1));

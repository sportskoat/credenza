// Round 4 proof pictures — PLANS/CREDENZA_DETAIL_PANEL_ROUND4.md.
// Every finished point gets a desktop picture and a phone picture.
// Run: node probe-round4.mjs  (dev server must run on :5173)
import { chromium } from "/Users/kylewensel/credenza/preview/node_modules/playwright-core/index.mjs";
import fs from "node:fs";

const OUT = "/Users/kylewensel/.buzz/.scratch/round4";
fs.mkdirSync(OUT, { recursive: true });

const CHART_TEXT = "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74";

const seed = (theme) => `(() => {
  if (!location.host.includes("5173")) return;
  try {
    const mk = (seedNum) => {
      const c = document.createElement("canvas");
      c.width = 96; c.height = 120;
      const g = c.getContext("2d");
      const img = g.createImageData(96, 120);
      let s = seedNum;
      const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = rnd() * 255; img.data[i + 1] = rnd() * 255;
        img.data[i + 2] = rnd() * 255; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return c.toDataURL("image/png");
    };
    const p1 = mk(1234567), p2 = mk(987654), p3 = mk(5551212);
    const now = Date.now();
    localStorage.setItem("credenza-fashion-items-v1", JSON.stringify([
      { id: "r4-chart", title: "Palace x Nike jersey", type: "link",
        url: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
        host: "mook-official.x.yupoo.com",
        image: p1, gallery: [p2, p3], price: 229, currency: "CNY",
        seller: "Mook-official", sellerAccount: "mook-official",
        category: "tops", sizeNotes: ${JSON.stringify(CHART_TEXT)},
        findStatus: "want", importance: "medium",
        createdAt: now, updatedAt: now },
      { id: "r4-nochart", title: "Canvas tote bag", type: "link",
        url: "https://weidian.com/item.html?itemID=22", host: "weidian.com",
        image: p2, gallery: [p3], priceUsd: 19, currency: "USD",
        seller: "toteshop", category: "tops",
        findStatus: "want", importance: "medium",
        createdAt: now - 1000, updatedAt: now - 1000 },
      { id: "r4-bought", title: "Bought vintage cap", type: "link",
        url: "https://weidian.com/item.html?itemID=33", host: "weidian.com",
        image: p3, priceUsd: 12, currency: "USD",
        seller: "capshop", category: "hat",
        findStatus: "bought", importance: "medium",
        createdAt: now - 2000, updatedAt: now - 2000 },
      { id: "r4-broken", title: "Jacket with dead photos", type: "link",
        url: "https://weidian.com/item.html?itemID=44", host: "weidian.com",
        image: "https://broken.invalid/one.jpg",
        gallery: ["https://broken.invalid/two.jpg", p1],
        priceUsd: 60, currency: "USD",
        seller: "deadshop", category: "outerwear",
        findStatus: "want", importance: "medium",
        createdAt: now - 3000, updatedAt: now - 3000 },
    ]));
    localStorage.setItem("credenza-prefs-v1", JSON.stringify({
      theme: "${theme}", colorwayVersion: 4, sortMode: "recent",
      shelfFilter: "all", pricePrimary: "USD", measureUnits: "cm",
      onboardingDone: true,
      bodyProfile: { chest: 100, height: 180, weight: 75, usualSize: "L" },
    }));
  } catch (e) {}
})();`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

async function newPage(theme, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(seed(theme));
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForSelector(".cz-photo-list-card", { state: "attached", timeout: 30000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}

async function openPanel(page, itemTitle) {
  await page.locator(".cz-photo-list-card", { hasText: itemTitle }).first()
    .locator(".cz-photo-list-open").click();
  await page.waitForTimeout(1600);
}

const shots = [];
async function snap(tag, fn) {
  try { await fn(); shots.push(tag + " ok"); }
  catch (e) { shots.push(tag + " FAILED: " + e.message.split("\n")[0]); }
}

// ── Panel with a chart, both themes, desktop + phone (points 1, 3, 4, 5) ──
await snap("desktop-chart-dark", async () => {
  const { ctx, page } = await newPage("dark", DESKTOP);
  await openPanel(page, "Palace x Nike jersey");
  await page.screenshot({ path: OUT + "/desktop-chart-dark.png" });
  await ctx.close();
});
await snap("desktop-chart-light", async () => {
  const { ctx, page } = await newPage("light", DESKTOP);
  await openPanel(page, "Palace x Nike jersey");
  await page.screenshot({ path: OUT + "/desktop-chart-light.png" });
  await ctx.close();
});
await snap("phone-chart-dark", async () => {
  const { ctx, page } = await newPage("dark", PHONE);
  await openPanel(page, "Palace x Nike jersey");
  await page.screenshot({ path: OUT + "/phone-chart-dark.png", fullPage: true });
  await ctx.close();
});

// ── Panel with no chart, both themes, desktop + phone (point 1: the override
//    must read with no tap) ──
await snap("desktop-nochart-dark", async () => {
  const { ctx, page } = await newPage("dark", DESKTOP);
  await openPanel(page, "Canvas tote bag");
  await page.screenshot({ path: OUT + "/desktop-nochart-dark.png" });
  await ctx.close();
});
await snap("desktop-nochart-light", async () => {
  const { ctx, page } = await newPage("light", DESKTOP);
  await openPanel(page, "Canvas tote bag");
  await page.screenshot({ path: OUT + "/desktop-nochart-light.png" });
  await ctx.close();
});
await snap("phone-nochart-light", async () => {
  const { ctx, page } = await newPage("light", PHONE);
  await openPanel(page, "Canvas tote bag");
  await page.screenshot({ path: OUT + "/phone-nochart-light.png", fullPage: true });
  await ctx.close();
});

// ── The "..." menu: Change category + Delete this photo rows (points 2, 5) ──
await snap("desktop-menu-dark", async () => {
  const { ctx, page } = await newPage("dark", DESKTOP);
  await openPanel(page, "Palace x Nike jersey");
  await page.getByRole("button", { name: "Card actions" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + "/desktop-menu-dark.png" });
  await ctx.close();
});

// ── Thumbnail delete on hover (point 5): one shot at rest, one hovering ──
await snap("desktop-thumb-hover-dark", async () => {
  const { ctx, page } = await newPage("dark", DESKTOP);
  await openPanel(page, "Palace x Nike jersey");
  const wrap = page.locator(".cz-dpanel-thumb-wrap").nth(1);
  await wrap.scrollIntoViewIfNeeded();
  await wrap.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + "/desktop-thumb-hover-dark.png" });
  await ctx.close();
});

// ── Broken photos fall back to tiles (point 7), desktop + phone ──
await snap("desktop-broken-dark", async () => {
  const { ctx, page } = await newPage("dark", DESKTOP);
  await openPanel(page, "Jacket with dead photos");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "/desktop-broken-dark.png" });
  await ctx.close();
});
await snap("phone-broken-light", async () => {
  const { ctx, page } = await newPage("light", PHONE);
  await openPanel(page, "Jacket with dead photos");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "/phone-broken-light.png" });
  await ctx.close();
});

// ── The Bought mark on grid and carousel (point 6), desktop + phone ──
await snap("desktop-grid-bought-dark", async () => {
  const { ctx, page } = await newPage("dark", DESKTOP);
  await page.screenshot({ path: OUT + "/desktop-grid-bought-dark.png" });
  await ctx.close();
});
await snap("desktop-carousel-bought-dark", async () => {
  const { ctx, page } = await newPage("dark", DESKTOP);
  await page.getByRole("button", { name: "Carousel view" }).click();
  await page.waitForTimeout(800);
  await page.locator("button", { hasText: "Bought" }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "/desktop-carousel-bought-dark.png" });
  await ctx.close();
});
await snap("phone-grid-bought-light", async () => {
  const { ctx, page } = await newPage("light", PHONE);
  await page.screenshot({ path: OUT + "/phone-grid-bought-light.png" });
  await ctx.close();
});

await browser.close();
console.log(shots.join("\n"));

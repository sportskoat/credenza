import { chromium } from "playwright";
const items = Array.from({ length: 24 }, (_, i) => ({
  id: "x" + i, title: "Item " + i, url: "https://weidian.com/item.html?itemID=" + i,
  price: 100 + i, currency: "CNY", images: [], addedAt: Date.now() - i * 1000, haul: "Test haul",
}));
const prefs = { viewMode: "cards", sortMode: "recent", theme: "rainbow", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {}, stashMode: "link" };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(({ shelf, p }) => {
  localStorage.setItem("credenza-fashion-items-v1", shelf);
  localStorage.setItem("credenza-prefs-v1", p);
}, { shelf: JSON.stringify(items), p: JSON.stringify(prefs) });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const ringState = () => page.evaluate(() => {
  const el = document.querySelector(".cz-avatar");
  if (!el) return "no avatar";
  const cs = getComputedStyle(el);
  return JSON.stringify({
    focused: document.activeElement === el,
    focusVisible: el.matches(":focus-visible"),
    boxShadow: cs.boxShadow.slice(0, 60),
    outline: cs.outlineStyle + " " + cs.outlineWidth,
  });
});

// 1. Mouse click open, mouse click the X to close.
await page.click(".cz-avatar");
await page.waitForTimeout(600);
await page.click(".cz-modal-header .cz-icon-button");
await page.waitForTimeout(600);
console.log("A mouse-open / mouse-close :", await ringState());

// 2. Mouse click open, Escape to close.
await page.click(".cz-avatar");
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
console.log("B mouse-open / esc-close   :", await ringState());

// 3. Mouse click open, backdrop click to close.
await page.click(".cz-avatar");
await page.waitForTimeout(600);
await page.mouse.click(40, 40);
await page.waitForTimeout(600);
console.log("C mouse-open / backdrop    :", await ringState());

// 4. Sub-page scroll inside the stacked modal.
await page.click(".cz-avatar");
await page.waitForTimeout(600);
const m = await page.evaluate(() => {
  const surf = document.querySelector(".cz-modal-surface-stacked");
  const stack = document.querySelector(".cz-modal-stack");
  const pg = document.querySelector('.cz-modal-page[data-page-id="1"]');
  const r = (e) => e ? { ch: e.clientHeight, sh: e.scrollHeight, ov: getComputedStyle(e).overflowY } : null;
  return JSON.stringify({ surface: r(surf), stack: r(stack), page1: r(pg),
    dialogH: document.querySelector(".cz-modal")?.getBoundingClientRect().height });
});
console.log("D modal box metrics        :", m);
const scrolled = await page.evaluate(async () => {
  const surf = document.querySelector(".cz-modal-surface-stacked");
  const pg = document.querySelector('.cz-modal-page[data-page-id="1"]');
  surf.scrollTop = 9999; pg.scrollTop = 9999;
  await new Promise((r) => setTimeout(r, 200));
  return JSON.stringify({ surfaceTop: surf.scrollTop, pageTop: pg.scrollTop });
});
console.log("E scroll attempt           :", scrolled);
await browser.close();

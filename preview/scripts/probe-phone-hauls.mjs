// Why the Hauls tab draws in a narrow centred column, and whether it scrolls
// with a real drag. Live site, phone width.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "https://credenzafashion.com";
const now = Date.now();
const mk = (i) => ({
  id: "phone-" + i,
  createdAt: now - i * 1000,
  updatedAt: now - i * 1000,
  url: "https://weidian.com/item.html?itemID=781212411" + i,
  title: i % 2 ? "M33821-133E Heavy-Weight American Casual T-Shirt Long Title" : "Short Tee",
  image: "https://picsum.photos/seed/cz" + i + "/600/800",
  gallery: ["https://picsum.photos/seed/czg" + i + "/600/800"],
  links: [{ url: "https://weidian.com/item.html?itemID=781212411" + i, role: "buy" }],
  price: 179 + i,
  currency: "CNY",
  seller: "mook-offcical",
  category: "shirt",
  size: "L",
  colorway: "White",
  weightGrams: 420,
  project: i % 3 === 0 ? "casuals" : "winter",
  findStatus: "want",
});
const items = Array.from({ length: 8 }, (_, i) => mk(i + 1));
const prefs = { viewMode: "grid", sortMode: "recent", colorwayVersion: 4, preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" }, measureUnits: "in", onboardingDone: true, theme: "rainbow" };

const chain = (sel) => {
  const n = document.querySelector(sel);
  if (!n) return null;
  const out = [];
  let cur = n;
  while (cur && cur.tagName && out.length < 9) {
    const s = getComputedStyle(cur);
    const r = cur.getBoundingClientRect();
    const cls = (cur.className || "").toString().trim().split(/\s+/).slice(0, 3).join(".");
    out.push({
      tag: cur.tagName.toLowerCase() + (cls ? "." + cls : ""),
      left: Math.round(r.left), w: Math.round(r.width),
      maxW: s.maxWidth, padL: s.paddingLeft, padR: s.paddingRight,
      margin: s.marginLeft + "/" + s.marginRight,
      transform: s.transform === "none" ? "" : s.transform,
      zoom: s.zoom, display: s.display,
    });
    cur = cur.parentElement;
  }
  return out;
};

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await context.addInitScript(({ shelf, prefsJson }) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
await page.addInitScript(`window.__chain = ${chain.toString()}`);
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);

console.log("SHELF header chain:", JSON.stringify(await page.evaluate(() => window.__chain("header")), null, 1));

await page.locator('button, [role="tab"], a').filter({ hasText: /^Hauls/ }).first().click({ force: true });
await page.waitForTimeout(2500);
console.log("HAULS header chain:", JSON.stringify(await page.evaluate(() => window.__chain("header")), null, 1));

// Real drag scroll over the middle of the page.
const drag = await page.evaluate(async () => {
  const pick = () => {
    for (const n of document.querySelectorAll("*")) {
      if (n.scrollHeight - n.clientHeight > 40 && n.clientHeight > 300 && getComputedStyle(n).overflowY !== "hidden") return n;
    }
    return null;
  };
  const s = pick();
  return s ? { path: (s.className || s.tagName).toString(), before: s.scrollTop, room: s.scrollHeight - s.clientHeight } : null;
});
console.log("REAL SCROLLER:", JSON.stringify(drag));

await page.mouse.move(200, 600);
await page.mouse.wheel(0, 700);
await page.waitForTimeout(900);
const after = await page.evaluate(() => {
  const out = [];
  for (const n of document.querySelectorAll("*")) {
    if (n.scrollTop > 0) out.push({ cls: (n.className || n.tagName).toString().slice(0, 40), top: Math.round(n.scrollTop) });
  }
  return { scrolled: out, winY: window.scrollY };
});
console.log("AFTER WHEEL:", JSON.stringify(after));
await page.screenshot({ path: ".verify-shots/p3-hauls-wheel.png" });
await browser.close();

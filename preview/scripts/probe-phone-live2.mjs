// Phone-width walk, part 2: the Hauls tab, the real scroll container, the
// account menu, and the identity of the wide absolute box found in part 1.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "https://credenzafashion.com";
const now = Date.now();
const CHART =
  "Size  Shoulder  Chest  Length  Sleeve\nM  43  106  65  23.5\nL  45  110  67  24.5\nXL  47  114  69  25.5";

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
  sellerAccount: "mook",
  category: "shirt",
  size: "L",
  colorway: "White",
  weightGrams: 420,
  project: i % 3 === 0 ? "casuals" : "winter",
  findStatus: "want",
  sizeNotes: CHART,
});
const items = Array.from({ length: 8 }, (_, i) => mk(i + 1));
const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 98, height: 178, weight: 75 },
  measureUnits: "in",
  onboardingDone: true,
  theme: "rainbow",
};

const describe = (n) => {
  const parts = [];
  let cur = n;
  for (let i = 0; i < 5 && cur && cur.tagName; i++) {
    const cls = (cur.className && cur.className.baseVal !== undefined ? cur.className.baseVal : cur.className || "").toString().trim().split(/\s+/).slice(0, 2).join(".");
    parts.unshift(cur.tagName.toLowerCase() + (cls ? "." + cls : ""));
    cur = cur.parentElement;
  }
  return parts.join(" > ");
};

const scan = () => {
  const out = [];
  for (const n of document.querySelectorAll("*")) {
    const r = n.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const over = Math.max(r.right - window.innerWidth, -r.left);
    if (over <= 1) continue;
    const s = getComputedStyle(n);
    if (s.visibility === "hidden" || s.opacity === "0") continue;
    out.push({ path: window.__desc(n), left: Math.round(r.left), w: Math.round(r.width), over: Math.round(over), pos: s.position, text: (n.innerText || "").trim().slice(0, 40) });
  }
  return out.sort((a, b) => b.over - a.over).slice(0, 10);
};

const scrollers = () => {
  const out = [];
  for (const n of document.querySelectorAll("*")) {
    if (n.scrollHeight - n.clientHeight > 20 && n.clientHeight > 100) {
      const s = getComputedStyle(n);
      out.push({ path: window.__desc(n), clientH: n.clientHeight, scrollH: n.scrollHeight, oy: s.overflowY });
    }
  }
  return out.slice(0, 8);
};

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await context.addInitScript(({ shelf, prefsJson }) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
await page.addInitScript(`window.__desc = ${describe.toString()}`);
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);

console.log("SHELF OVERFLOW:", JSON.stringify(await page.evaluate(scan), null, 1));
console.log("SHELF SCROLLERS:", JSON.stringify(await page.evaluate(scrollers), null, 1));

const sc = await page.evaluate(() => {
  let best = null;
  for (const n of document.querySelectorAll("*")) {
    if (n.scrollHeight - n.clientHeight > 20 && n.clientHeight > 200) { best = n; break; }
  }
  if (!best) return { found: false };
  const b0 = best.scrollTop;
  best.scrollTop = b0 + 800;
  return { found: true, path: window.__desc(best), before: b0, after: best.scrollTop };
});
console.log("SCROLL TEST:", JSON.stringify(sc));
await page.waitForTimeout(600);
await page.screenshot({ path: ".verify-shots/p2-shelf-scrolled.png" });

// Hauls tab
const hauls = page.locator('button, [role="tab"], a').filter({ hasText: /^Hauls/ }).first();
if (await hauls.count()) {
  await hauls.click({ force: true });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: ".verify-shots/p2-hauls.png" });
  console.log("HAULS OVERFLOW:", JSON.stringify(await page.evaluate(scan), null, 1));
  console.log("HAULS SCROLLERS:", JSON.stringify(await page.evaluate(scrollers), null, 1));
  const hs = await page.evaluate(() => {
    let best = null;
    for (const n of document.querySelectorAll("*")) {
      if (n.scrollHeight - n.clientHeight > 20 && n.clientHeight > 200) { best = n; break; }
    }
    if (!best) return { found: false, docScroll: document.documentElement.scrollHeight, inner: window.innerHeight };
    const b0 = best.scrollTop; best.scrollTop = b0 + 900;
    return { found: true, path: window.__desc(best), before: b0, after: best.scrollTop, room: best.scrollHeight - best.clientHeight };
  });
  console.log("HAULS SCROLL:", JSON.stringify(hs));
  await page.waitForTimeout(600);
  await page.screenshot({ path: ".verify-shots/p2-hauls-scrolled.png" });
} else {
  console.log("HAULS TAB NOT FOUND");
}

// Account menu
const btns = await page.evaluate(() =>
  [...document.querySelectorAll("header button, header a")].map((n, i) => ({ i, label: n.getAttribute("aria-label") || n.textContent.trim().slice(0, 20), cls: (n.className || "").toString().slice(0, 50) }))
);
console.log("HEADER BUTTONS:", JSON.stringify(btns));
await browser.close();

// Sweep for the defect found on .cz-modal-surface, everywhere else.
//
// A backdrop-filter only renders if something behind the element is visible
// through it. If the element's own background is opaque, the browser still
// allocates a compositing layer and still re-reads the pixels behind it every
// frame the backdrop moves — and then covers the result with paint. The bill is
// real and the effect is nil.
//
// This walks every live blurred element in four app states and reports its
// resolved background alpha, so a dead blur is a number rather than a hunch.
// Anything at alpha 1.00 is paying for nothing.
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

const VP = { width: 390, height: 844 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VP, hasTouch: true, isMobile: true });
await ctx.addInitScript(({ shelf, p }) => {
  localStorage.setItem("credenza-fashion-items-v1", shelf);
  localStorage.setItem("credenza-prefs-v1", p);
}, { shelf: JSON.stringify(items), p: JSON.stringify(prefs) });

const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const audit = () =>
  page.evaluate((vp) => {
    const rows = [];
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      const bd = cs.backdropFilter || cs.webkitBackdropFilter;
      if (!bd || bd === "none") continue;
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // rgba(...) or rgb(...); rgb() means alpha 1.
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      const parts = m ? m[1].split(",").map((s) => parseFloat(s)) : [];
      const alpha = parts.length === 4 ? parts[3] : 1;
      rows.push({
        sel: (el.className && String(el.className).split(" ")[0]) || el.tagName,
        bd,
        alpha,
        area: +((r.width * r.height) / (vp.width * vp.height)).toFixed(2),
      });
    }
    return rows;
  }, VP);

function report(label, rows) {
  console.log(`\n${label}`);
  if (!rows.length) return console.log("  (no blurred elements)");
  const dead = rows.filter((r) => r.alpha >= 1);
  const live = rows.filter((r) => r.alpha < 1);
  const sum = (xs) => xs.reduce((n, x) => n + x.area, 0).toFixed(2);
  console.log(`  DEAD (opaque, pays for nothing): ${dead.length} el, ${sum(dead)}x vp`);
  for (const r of dead) console.log(`      ${r.sel.padEnd(28)} ${r.bd.padEnd(12)} a=${r.alpha} ${r.area}x`);
  console.log(`  live (translucent): ${live.length} el, ${sum(live)}x vp`);
  for (const r of live) console.log(`      ${r.sel.padEnd(28)} ${r.bd.padEnd(12)} a=${r.alpha} ${r.area}x`);
}

// Control. This probe reports "nothing found" as a pass, and a broken selector
// reports exactly the same thing — so prove the detector fires before trusting a
// zero. Inject one opaque blurred box and one translucent one, and check that
// the alpha split puts them on opposite sides.
{
  await page.evaluate(() => {
    const mk = (id, bg) => {
      const d = document.createElement("div");
      d.id = id;
      d.style.cssText =
        `position:fixed;left:0;top:0;width:100px;height:100px;z-index:9999;` +
        `background:${bg};backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)`;
      document.body.appendChild(d);
    };
    mk("cz-control-dead", "rgb(10,10,10)");
    mk("cz-control-live", "rgba(10,10,10,0.4)");
  });
  const rows = await audit();
  const dead = rows.find((r) => r.sel === "DIV" && r.alpha >= 1);
  const live = rows.find((r) => r.sel === "DIV" && r.alpha < 1);
  if (!dead) throw new Error("control failed: the opaque blurred box was not detected");
  if (!live) throw new Error("control failed: the translucent blurred box was not detected");
  await page.evaluate(() => {
    document.getElementById("cz-control-dead").remove();
    document.getElementById("cz-control-live").remove();
  });
  console.log("control OK — the detector sees both an opaque and a translucent blur");
}

report("A. shelf at rest", await audit());

await page.locator("button.cz-tab", { hasText: "Hauls" }).first().click();
await page.waitForTimeout(700);
report("B. hauls", await audit());

await page.locator("button.cz-tab", { hasText: "Shelf" }).first().click();
await page.waitForTimeout(700);
await page.click(".cz-avatar");
await page.waitForTimeout(700);
report("C. profile sheet open", await audit());

await page.locator("button.cz-profile-row", { hasText: "Default agent" }).click();
await page.waitForTimeout(700);
report("D. sub-page", await audit());

await browser.close();

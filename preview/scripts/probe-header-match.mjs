// Does the public page header sit on the same grid as the app masthead?
// Kyle 2026-07-30: "create the identical page ... I don't want any difference".
//   (npx vite --port 5352 --strictPort &) ; sleep 9; node scripts/probe-header-match.mjs
import { webkit } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.PROBE_BASE || "http://localhost:5352";
const OUT = ".verify-shots/headermatch";
mkdirSync(OUT, { recursive: true });

const HELPERS = `
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const styleOf = (el) => {
    if (!el) return null;
    const c = getComputedStyle(el);
    return { fontSize: c.fontSize, fontWeight: c.fontWeight, letterSpacing: c.letterSpacing, color: c.color };
  };
  const runOf = (list) => list.length ? {
    left: Math.round(Math.min(...list.map((a) => a.getBoundingClientRect().left))),
    right: Math.round(Math.max(...list.map((a) => a.getBoundingClientRect().right))),
  } : null;
`;

const APP_JS = HELPERS + `
  const nav = [...document.querySelectorAll(".cz-masthead a")].filter((a) => a.textContent.trim() && !String(a.className).includes("brand"));
  ({
    band: pick(".cz-app[data-fashion='true'] .cz-shell"),
    head: pick(".cz-masthead"),
    brand: pick(".cz-masthead .cz-brand"),
    actions: pick(".cz-masthead-actions"),
    nav: runOf(nav),
    words: nav.map((a) => a.textContent.trim()),
    navStyle: styleOf(nav[1]),
  })
`;

const PUB_JS = HELPERS + `
  const nav = [...document.querySelectorAll(".site-head nav.nav a")];
  ({
    band: pick(".site-head"),
    head: pick(".site-head"),
    brand: pick(".site-head .brand"),
    actions: pick(".site-head .nav-open"),
    nav: runOf(nav),
    words: nav.map((a) => a.textContent.trim()),
    navStyle: styleOf(nav[1]),
  })
`;

const browser = await webkit.launch();
const report = [];

for (const width of [1440, 1280, 1100]) {
  const ctx = await browser.newContext({
    colorScheme: "dark",
    viewport: { width, height: 700 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const app = await page.evaluate(APP_JS);
  await page.screenshot({ path: `${OUT}/app-${width}.png`, clip: { x: 0, y: 0, width, height: 130 } });

  await page.goto(BASE + "/pricing/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const pub = await page.evaluate(PUB_JS);
  await page.screenshot({ path: `${OUT}/public-${width}.png`, clip: { x: 0, y: 0, width, height: 130 } });

  const mid = (r) => (r ? Math.round((r.left + r.right) / 2) : null);
  report.push({
    width,
    headBounds: [app.head, pub.head],
    brandLeft: [app.brand && app.brand.left, pub.brand && pub.brand.left],
    actionsRight: [app.actions && app.actions.right, pub.actions && pub.actions.right],
    navMid: [mid(app.nav), mid(pub.nav)],
    viewportMid: width / 2,
    headHeight: [app.head && app.head.height, pub.head && pub.head.height],
    navStyle: [app.navStyle, pub.navStyle],
    words: [app.words, pub.words],
  });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));

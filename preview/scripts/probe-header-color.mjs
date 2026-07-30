// Do the app masthead and the public page header use the SAME colours?
// Kyle 2026-07-30: "now make sure the color is perfectly matching".
//   (npx vite --port 5353 --strictPort &) ; sleep 9; node scripts/probe-header-color.mjs
import { webkit } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.PROBE_BASE || "http://localhost:5353";
const OUT = ".verify-shots/headcolor";
mkdirSync(OUT, { recursive: true });

// Every colour a visitor can see in the header row, read off the live page.
const READ = (root, sel) => `
  (() => {
    const head = document.querySelector(${JSON.stringify(root)});
    if (!head) return { missing: ${JSON.stringify(root)} };
    const s = ${JSON.stringify(sel)};
    const g = (q, prop) => {
      const el = q === "" ? head : head.querySelector(q);
      if (!el) return null;
      return getComputedStyle(el)[prop];
    };
    return {
      headBg: g("", "backgroundColor"),
      hairline: g("", "borderBottomColor"),
      wordmark: g(s.wordmark, "color"),
      kicker: g(s.kicker, "color"),
      navLink: g(s.navLink, "color"),
      navCurrent: g(s.navCurrent, "color"),
      ringBorder: g(s.ring, "borderTopColor"),
      ringFill: g(s.ring, "backgroundColor"),
      ringGlyph: g(s.ring, "color"),
      wordmarkSize: g(s.wordmark, "fontSize"),
      wordmarkTrack: g(s.wordmark, "letterSpacing"),
      wordmarkWeight: g(s.wordmark, "fontWeight"),
      kickerSize: g(s.kicker, "fontSize"),
      kickerTrack: g(s.kicker, "letterSpacing"),
      navSize: g(s.navLink, "fontSize"),
      pageBg: getComputedStyle(document.body).backgroundColor,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    };
  })()
`;

const APP = READ(".cz-masthead", {
  wordmark: ".cz-brand-word",
  kicker: ".cz-brand-sub",
  navLink: ".cz-mast-nav-link",
  navCurrent: ".cz-mast-nav-link[aria-current]",
  ring: ".cz-avatar",
});
const PUB = READ(".site-head", {
  wordmark: ".wordmark",
  kicker: ".kicker",
  navLink: '.nav a:not([aria-current])',
  navCurrent: '.nav a[aria-current="page"]',
  ring: ".nav-open",
});

const browser = await webkit.launch();
for (const scheme of ["dark", "light"]) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 700 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const app = await page.evaluate(APP);
  await page.screenshot({ path: `${OUT}/app-${scheme}.png`, clip: { x: 0, y: 0, width: 1440, height: 100 } });
  await page.goto(BASE + "/pricing/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const pub = await page.evaluate(PUB);
  await page.screenshot({ path: `${OUT}/pricing-${scheme}.png`, clip: { x: 0, y: 0, width: 1440, height: 100 } });
  await page.goto(BASE + "/landing/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const land = await page.evaluate(PUB);
  await page.screenshot({ path: `${OUT}/landing-${scheme}.png`, clip: { x: 0, y: 0, width: 1440, height: 100 } });
  console.log(JSON.stringify({ scheme, app, pub, land }, null, 1));
  await ctx.close();
}
await browser.close();

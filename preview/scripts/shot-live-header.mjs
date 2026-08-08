// Pictures of the shared header on the LIVE site, for Kyle.
//   node scripts/shot-live-header.mjs
import { webkit } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "https://credenzafashion.com";
const OUT = ".verify-shots/liveheader";
const PAGES = [
  ["/guides/", "guides"],
  ["/faq/", "faq"],
  ["/pricing/", "pricing"],
  ["/how/", "how"],
  ["/support/", "support"],
  ["/privacy/", "privacy"],
];

mkdirSync(OUT, { recursive: true });
const browser = await webkit.launch();
const report = [];

for (const [scheme, w, h, tag] of [
  ["dark", 1180, 620, "desktop-dark"],
  ["light", 1180, 620, "desktop-light"],
  ["dark", 402, 620, "phone-dark"],
]) {
  const ctx = await browser.newContext({
    colorScheme: scheme,
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  for (const [url, name] of PAGES) {
    const res = await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const seen = await page.evaluate(() => {
      const head = document.querySelector(".site-head");
      if (!head) return { error: "no .site-head" };
      const links = [...head.querySelectorAll("nav.nav a")].map((a) => a.textContent.trim());
      return { links, height: Math.round(head.getBoundingClientRect().height) };
    });
    report.push([tag, url, res.status(), seen.error || seen.links.join(" | "), seen.height]);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.jpg`, quality: 88, type: "jpeg" });
  }
  await ctx.close();
}
await browser.close();
for (const r of report) console.log(r.join("  ::  "));

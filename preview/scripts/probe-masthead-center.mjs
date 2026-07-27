// LB-65 / header centering (Kyle 2026-07-27: "header here is not centered and
// doesn't look right"). Measures the nav row's centre against the masthead's
// centre at three desktop widths. justify-content: space-between divides the
// LEFTOVER room evenly, so a ~190px brand and a 44px avatar pushed the links
// well right of the true middle; the flex: 1 1 0 pair fixes that.
import { webkit } from "playwright";

const browser = await webkit.launch();
const WIDTHS = [1440, 1280, 1024];
let worst = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  await page.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const m = await page.evaluate(() => {
    const head = document.querySelector(".cz-masthead");
    const nav = document.querySelector(".cz-mast-nav");
    if (!head || !nav) return null;
    const h = head.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    return {
      headCenter: +(h.left + h.width / 2).toFixed(1),
      navCenter: +(n.left + n.width / 2).toFixed(1),
      navLinks: nav.querySelectorAll("a").length,
    };
  });

  if (!m) {
    console.log(width + ": NO MASTHEAD NAV (hidden at this width?)");
    await ctx.close();
    continue;
  }
  const off = +Math.abs(m.headCenter - m.navCenter).toFixed(1);
  worst = Math.max(worst, off);
  console.log(
    width + ": nav centre " + m.navCenter + " vs masthead centre " +
    m.headCenter + " → off by " + off + "px (" + m.navLinks + " links)"
  );
  await ctx.close();
}

console.log("worst offset: " + worst.toFixed(1) + "px");
console.log(worst <= 2 ? "PASS — centred" : "FAIL — still off centre");
await browser.close();

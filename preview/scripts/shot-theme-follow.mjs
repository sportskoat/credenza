// One picture per theme: the app on top, the Pricing page under it.
// The browser is set to Light both times, so the picture shows that the page
// answers the app's choice and not the machine's.
//   (npx vite --port 5354 --strictPort &) ; sleep 9; node scripts/shot-theme-follow.mjs
import { webkit } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.PROBE_BASE || "http://localhost:5354";
const OUT = ".verify-shots/themefollow";
mkdirSync(OUT, { recursive: true });

const browser = await webkit.launch();
const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1280, height: 380 } });
const page = await ctx.newPage();

for (const theme of ["rainbow", "light"]) {
  await page.goto(BASE + "/pricing/");
  await page.evaluate((t) => {
    window.localStorage.setItem("credenza-prefs-v1", JSON.stringify({ theme: t, colorwayVersion: 4 }));
  }, theme);
  await page.goto(BASE + "/");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/app-${theme}.png` });
  await page.goto(BASE + "/pricing/");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/page-${theme}.png` });
  console.log("shot " + theme);
}
await browser.close();

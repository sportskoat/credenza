import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
});
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const m = await page.evaluate(() => ({
  header: !!document.querySelector("header.cz-masthead"),
  h1Count: document.querySelectorAll("h1").length,
  main: !!document.querySelector("main"),
  footer: !!document.querySelector("footer.cz-bottom-bar"),
  footerVisible: (() => {
    const f = document.querySelector("footer.cz-bottom-bar");
    return f ? getComputedStyle(f).display !== "none" : null;
  })(),
}));
console.log(JSON.stringify(m, null, 1));
await browser.close();

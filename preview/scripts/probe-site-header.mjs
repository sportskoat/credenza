// Look at the real pages, in a real browser, in both themes.
//
// These are static files, so unlike the app they can be loaded straight from
// the dev server without any JS setting up the theme. Run the server in the
// SAME shell call as this script or it dies with the call:
//   (npx vite --port 5347 --strictPort &) ; sleep 8; node scripts/probe-site-header.mjs
import { webkit } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:5347";
const OUT = "preview/.verify-shots/siteheader";
const PAGES = ["/guides/", "/landing/", "/pricing/", "/contact/", "/faq/", "/404.html"];

mkdirSync(OUT.replace("preview/", ""), { recursive: true });

const browser = await webkit.launch();
const problems = [];

for (const scheme of ["dark", "light"]) {
  const ctx = await browser.newContext({
    colorScheme: scheme,
    viewport: { width: 1180, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  for (const url of PAGES) {
    const res = await page.goto(BASE + url, { waitUntil: "networkidle" });
    if (!res || res.status() !== 200) {
      problems.push(`${url} returned ${res ? res.status() : "no response"}`);
      continue;
    }
    await page.waitForTimeout(250);

    const seen = await page.evaluate(() => {
      const head = document.querySelector(".site-head");
      if (!head) return { error: "no .site-head" };
      const links = [...head.querySelectorAll("nav.nav a")];
      const cs = (el) => getComputedStyle(el);
      const body = cs(document.body);
      const h1 = document.querySelector("h1");
      return {
        links: links.map((a) => a.textContent.trim()),
        underlined: links.filter((a) => cs(a).textDecorationLine !== "none").length,
        navFont: links[0] ? cs(links[0]).fontFamily.split(",")[0] : "",
        headBottom: Math.round(head.getBoundingClientRect().bottom),
        hairline: cs(head).borderBottomWidth,
        openApp: !!head.querySelector(".nav-open"),
        bodyFont: body.fontFamily.split(",")[0],
        bodySize: body.fontSize,
        bodyBg: body.backgroundColor,
        h1Font: h1 ? cs(h1).fontFamily.split(",")[0] : "",
        h1Size: h1 ? cs(h1).fontSize : "",
      };
    });

    if (seen.error) {
      problems.push(`${url} (${scheme}): ${seen.error}`);
      continue;
    }
    const want = ["How it works", "Guides", "Pricing", "FAQ", "Support", "Contact"];
    if (seen.links.join("|") !== want.join("|")) {
      problems.push(`${url} (${scheme}) header links are ${seen.links.join(", ")}`);
    }
    if (seen.underlined) problems.push(`${url} (${scheme}) has ${seen.underlined} underlined header links`);
    if (!seen.openApp) problems.push(`${url} (${scheme}) has no Open the app button`);
    if (seen.hairline === "0px") problems.push(`${url} (${scheme}) header has no hairline`);

    const slug = url.replace(/\W+/g, "_");
    await page.screenshot({ path: `${OUT.replace("preview/", "")}/${scheme}${slug}.png` });
    console.log(
      `${scheme.padEnd(5)} ${url.padEnd(12)} body ${seen.bodyFont.padEnd(9)} ${seen.bodySize.padEnd(8)}` +
        ` h1 ${seen.h1Font.padEnd(9)} ${seen.h1Size.padEnd(8)} nav ${seen.navFont.padEnd(15)}` +
        ` bg ${seen.bodyBg}`
    );
  }
  await ctx.close();
}

await browser.close();
console.log("\n" + (problems.length ? "PROBLEMS:\n  " + problems.join("\n  ") : "no problems found"));

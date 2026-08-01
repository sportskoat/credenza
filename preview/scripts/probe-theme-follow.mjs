// Do the public pages follow the colour the visitor picked in the app?
// Kyle 2026-07-30 chose option B: the pages read the app's own choice and
// ignore the machine's light/dark setting. A new visitor gets dark.
//
//   (npx vite --port 5354 --strictPort &) ; sleep 9; node scripts/probe-theme-follow.mjs
//
// The browser is put in Light on purpose. Before this change that alone
// turned the pages light while the app stayed dark — the defect Kyle saw.
import { webkit } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.PROBE_BASE || "http://localhost:5354";
const OUT = ".verify-shots/themefollow";
mkdirSync(OUT, { recursive: true });

const DARK = "rgb(0, 0, 0)";
const LIGHT = "rgb(244, 244, 240)";
const PAGES = ["/pricing/", "/landing/", "/guides/", "/404.html"];

const read = () => ({
  attr: document.documentElement.getAttribute("data-theme"),
  body: getComputedStyle(document.body).backgroundColor,
  scheme: getComputedStyle(document.documentElement).colorScheme,
  metaCount: document.querySelectorAll('meta[name="theme-color"]').length,
  metaContent: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") || null,
});

const results = [];
const fail = (name, got, want) => results.push({ ok: false, name, got, want });
const pass = (name, got) => results.push({ ok: true, name, got });

const browser = await webkit.launch();
// colorScheme "light" = a Mac set to Light. The pages must ignore it.
const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const setTheme = async (value) => {
  await page.goto(BASE + "/pricing/");
  await page.evaluate((v) => {
    if (v === null) window.localStorage.removeItem("credenza-prefs-v1");
    else window.localStorage.setItem("credenza-prefs-v1", JSON.stringify({ theme: v }));
  }, value);
};

for (const [label, stored, wantAttr, wantBg, wantMeta] of [
  ["new visitor", null, "dark", DARK, "#050506"],
  ["app set to Blackout", "rainbow", "dark", DARK, "#050506"],
  ["app set to Gallery", "light", "light", LIGHT, "#f4f4f0"],
]) {
  await setTheme(stored);
  for (const path of PAGES) {
    await page.goto(BASE + path);
    const got = await page.evaluate(read);
    const name = `${label} · ${path}`;
    if (got.attr !== wantAttr) fail(name + " attribute", got.attr, wantAttr);
    else if (got.body !== wantBg) fail(name + " background", got.body, wantBg);
    else if (got.metaCount !== 1) fail(name + " theme-color tags", got.metaCount, 1);
    else if (got.metaContent !== wantMeta) fail(name + " status bar", got.metaContent, wantMeta);
    else if (!got.scheme.includes(wantAttr)) fail(name + " color-scheme", got.scheme, wantAttr);
    else pass(name, got.body);
  }
  await page.goto(BASE + "/pricing/");
  await page.screenshot({ path: `${OUT}/${label.replace(/\s+/g, "-")}.png`, fullPage: false });
}

// A record the reader cannot parse must not take a page light.
await page.goto(BASE + "/pricing/");
await page.evaluate(() => window.localStorage.setItem("credenza-prefs-v1", "not json"));
await page.goto(BASE + "/guides/");
const broken = await page.evaluate(read);
if (broken.attr === "dark" && broken.body === DARK) pass("unreadable record stays dark", broken.body);
else fail("unreadable record stays dark", broken.attr + " " + broken.body, "dark " + DARK);

await browser.close();

for (const r of results) console.log((r.ok ? "PASS " : "FAIL ") + r.name + " → " + r.got + (r.ok ? "" : " (want " + r.want + ")"));
const bad = results.filter((r) => !r.ok).length;
console.log(`${results.length - bad}/${results.length} pass`);
process.exit(bad ? 1 : 0);

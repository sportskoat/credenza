import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json"), "utf8"));
const prefs = { viewMode: "carousel", theme: "rainbow", colorwayVersion: 4, onboardingDone: true, measureUnits: "cm" };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(({ shelf, prefsJson }) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelf);
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
}, { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("http://localhost:4173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const flip = page.getByRole("button", { name: /Flip / }).first();
await flip.click({ force: true });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const flipped = document.querySelector(".cz-carousel-card-inner.is-flipped");
  if (!flipped) return { err: "no flipped card" };
  const q = (sel) => flipped.querySelector(sel);
  const style = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { opacity: cs.opacity, vis: cs.visibility, disp: cs.display, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, transform: cs.transform.slice(0, 60) };
  };
  const backContent = q(".cz-carousel-back-content");
  const detailScroll = q(".cz-detail-scroll");
  return {
    backContent: style(backContent),
    detailsPanel: style(q(".cz-card-details-panel")),
    detailScroll: style(detailScroll),
    title: style(q(".cz-detail-title")),
    cells: style(q(".cz-detail-cells")),
    scroll: backContent ? { sh: backContent.scrollHeight, ch: backContent.clientHeight, st: backContent.scrollTop } : null,
    scrollFlex: detailScroll ? (() => { const cs = getComputedStyle(detailScroll); return { flex: cs.flex, flexGrow: cs.flexGrow, flexBasis: cs.flexBasis, flexShrink: cs.flexShrink }; })() : null,
    foot: style(q(".cz-detail-foot")),
    hero: style(q(".cz-detail-hero")),
    heroPager: style(q(".cz-detail-hero-pager")),
    panelChildren: [...(q(".cz-card-details-panel")?.children || [])].map((c) => c.className + " h=" + Math.round(c.getBoundingClientRect().height)),
    dscroll: detailScroll ? { sh: detailScroll.scrollHeight, ch: detailScroll.clientHeight, st: detailScroll.scrollTop } : null,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();

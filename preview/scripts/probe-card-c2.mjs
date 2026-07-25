import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const backup = join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json");
const shelfJson = readFileSync(backup, "utf8");
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
await ctx.addInitScript((j) => window.localStorage.setItem("credenza-fashion-items-v1", j), shelfJson);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(process.argv[2] || "http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

const out = await page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: +b.x.toFixed(1), y: +b.y.toFixed(1) }; };
  const cards = [...document.querySelectorAll(".cz-editorial-card")].slice(0, 4);
  const c0 = cards[0];
  const inner = c0?.querySelector(".cz-card-editorial");
  const heart = c0?.querySelector(".cz-card-favorite-onphoto");
  const cs = (el, ...p) => { if (!el) return null; const s = getComputedStyle(el); return Object.fromEntries(p.map((k) => [k, s[k]])); };
  const ring = heart ? getComputedStyle(heart, "::after") : null;
  const pill = document.querySelector(".cz-card-status .cz-status-pill") || document.querySelector(".cz-card-status");
  return {
    cardHeights: cards.map((c) => r(c).h),
    cardWidth: r(c0)?.w,
    innerShadow: cs(inner, "borderRadius", "boxShadow"),
    body: cs(c0?.querySelector(".cz-card-body"), "padding"),
    photo: r(c0?.querySelector(".cz-card-image")),
    text: cs(c0?.querySelectorAll(".cz-card-toggle")[1], "display", "padding", "rowGap"),
    title: { ...cs(c0?.querySelector(".cz-card-title-serif"), "fontSize", "minHeight", "padding"), rect: r(c0?.querySelector(".cz-card-title-serif")) },
    metaRow: { present: !!c0?.querySelector(".cz-front-meta-row"), ...cs(c0?.querySelector(".cz-front-meta-row"), "display", "alignItems", "justifyContent") },
    size: { ...cs(c0?.querySelector(".cz-front-size"), "fontSize", "color"), rect: r(c0?.querySelector(".cz-front-size")) },
    price: { ...cs(c0?.querySelector(".cz-front-price"), "fontSize", "fontWeight", "color"), rect: r(c0?.querySelector(".cz-front-price")) },
    seller: { ...cs(c0?.querySelector(".cz-front-seller"), "fontSize", "color"), rect: r(c0?.querySelector(".cz-front-seller")) },
    heart: { rect: r(heart), ...cs(heart, "top", "right", "backdropFilter", "background", "color"), ringInset: ring ? ring.inset : null },
    statusPill: pill ? { rect: r(pill), ...cs(pill, "fontSize", "padding", "position", "left", "bottom", "top") } : "none visible",
    buyHover: document.querySelectorAll(".cz-card-buy-hover").length,
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();

// Confirms step 2 is phone-only: desktop grid card and carousel front unchanged.
import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const shelfJson = readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json"), "utf8");
const browser = await webkit.launch();

// Desktop.
const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await dctx.addInitScript((j) => window.localStorage.setItem("credenza-fashion-items-v1", j), shelfJson);
const dp = await dctx.newPage();
dp.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await dp.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await dp.waitForTimeout(3000);
const cardView = dp.getByRole("button", { name: "Card view" });
if (await cardView.count()) { await cardView.first().click({ force: true }); await dp.waitForTimeout(1500); }
console.log("desktop", JSON.stringify(await dp.evaluate(() => {
  const c = document.querySelector(".cz-editorial-card");
  const cs = (s, ...p) => { const el = c.querySelector(s); if (!el) return null; const g = getComputedStyle(el); return Object.fromEntries(p.map((k) => [k, g[k]])); };
  return {
    twoline: !!document.querySelector(".cz-card-twoline"),
    metaRow: !!document.querySelector(".cz-front-meta-row"),
    cardH: +c.getBoundingClientRect().height.toFixed(1),
    inner: cs(".cz-card-editorial", "borderRadius"),
    body: cs(".cz-card-body", "padding"),
    title: cs(".cz-card-title-serif", "fontSize", "padding"),
    price: cs(".cz-front-price", "fontSize", "padding"),
    heart: cs(".cz-card-favorite-onphoto", "top", "right", "width", "height"),
    buyHover: c.querySelectorAll(".cz-card-buy-hover").length,
    photoRatio: cs(".cz-card-image", "aspectRatio"),
  };
}), null, 2));
await dctx.close();

// Phone carousel front.
const pctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
await pctx.addInitScript((j) => window.localStorage.setItem("credenza-fashion-items-v1", j), shelfJson);
const pp = await pctx.newPage();
pp.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await pp.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await pp.waitForTimeout(3000);
console.log("phone buttons:", (await pp.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") || b.textContent.trim()).filter(Boolean).slice(0, 30))).join(" | "));
const carousel = pp.getByRole("button", { name: /carousel/i });
if (await carousel.count()) {
  await carousel.first().click({ force: true });
  await pp.waitForTimeout(2500);
  console.log("carousel", JSON.stringify(await pp.evaluate(() => {
    const f = document.querySelector(".cz-carousel-front-meta") || document.querySelector(".cz-carousel-face");
    if (!f) return "no carousel front";
    const cs = (s, ...p) => { const el = f.querySelector(s); if (!el) return null; const g = getComputedStyle(el); return Object.fromEntries(p.map((k) => [k, g[k]])); };
    const rc = (s) => { const el = f.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { y: +b.y.toFixed(1), h: +b.h?.toFixed?.(1) ?? +b.height.toFixed(1) }; };
    return {
      metaRowInCarousel: !!f.querySelector(".cz-front-meta-row"),
      size: { ...cs(".cz-front-size", "fontSize", "padding", "minHeight"), rect: rc(".cz-front-size") },
      seller: { ...cs(".cz-front-seller", "fontSize"), rect: rc(".cz-front-seller") },
      price: { ...cs(".cz-front-price", "fontSize", "padding"), rect: rc(".cz-front-price") },
    };
  }), null, 2));
  await pp.screenshot({ path: "/tmp/c2-carousel.png" });
} else console.log("carousel toggle not found");
await browser.close();

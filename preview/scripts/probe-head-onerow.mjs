import { webkit } from "playwright";
const BASE = process.env.BASE || "http://localhost:5351";
const PAGES = ["/pricing/", "/faq/", "/guides/", "/how/", "/privacy/", "/support/", "/contact/", "/terms/", "/landing/"];
const b = await webkit.launch();
let bad = 0;
for (const w of [1440, 1024, 900, 402]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  for (const path of PAGES) {
    const r = await p.goto(BASE + path, { waitUntil: "load" });
    if (!r || r.status() !== 200) { console.log("FAIL status", w, path, r && r.status()); bad++; continue; }
    await p.waitForTimeout(250);
    const m = await p.evaluate(() => {
      const h = document.querySelector(".site-head");
      if (!h) return null;
      const brand = h.querySelector(".brand");
      const nav = h.querySelector(".nav");
      const links = [...h.querySelectorAll(".nav a")];
      const cta = h.querySelector(".site-head > a:last-child, .head-cta, .site-head .cta");
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      return {
        head: r(h), brand: brand && r(brand), nav: nav && r(nav),
        linkCount: links.length,
        linkRows: new Set(links.map((l) => Math.round(l.getBoundingClientRect().y))).size,
        cta: cta && cta !== brand ? r(cta) : null,
        docW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
      };
    });
    if (!m) { console.log("FAIL no .site-head", w, path); bad++; continue; }
    const oneRow = m.brand && m.nav && Math.abs((m.brand.y + m.brand.h / 2) - (m.nav.y + m.nav.h / 2)) < 12;
    const offCentre = Math.abs((m.head.x + m.head.w / 2) - m.winW / 2);
    const hscroll = m.docW > m.winW + 1;
    const wide = w >= 1024;
    const ok = (!wide || oneRow) && !hscroll && m.linkCount === 6 && (!wide || m.linkRows === 1) && offCentre <= 2;
    if (!ok) bad++;
    console.log((ok ? "ok  " : "FAIL") + " " + w + " " + path + " head=" + m.head.x + "+" + m.head.w + " links=" + m.linkCount + "/" + m.linkRows + "rows oneRow=" + oneRow + " hscroll=" + hscroll + " doc=" + m.docW + "/" + m.winW + " offCentre=" + offCentre);
  }
  await p.goto(BASE + "/pricing/", { waitUntil: "load" });
  await p.waitForTimeout(250);
  await p.screenshot({ path: ".verify-shots/head-" + w + ".png", clip: { x: 0, y: 0, width: w, height: 200 } });
  await ctx.close();
}
await b.close();
console.log(bad === 0 ? "ALL OK" : bad + " PROBLEMS");
process.exit(bad === 0 ? 0 : 1);

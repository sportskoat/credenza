import { webkit } from "playwright";
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
for (const path of ["/pricing/", "/landing/"]) {
  await p.goto("http://localhost:5351" + path, { waitUntil: "load" });
  const m = await p.evaluate(() => {
    const h = document.querySelector(".site-head");
    const par = h.parentElement;
    const cs = getComputedStyle(par);
    const b1 = h.getBoundingClientRect(), b2 = par.getBoundingClientRect();
    return { tag: par.tagName + "." + par.className, parX: Math.round(b2.x), parW: Math.round(b2.width),
      padL: cs.paddingLeft, padR: cs.paddingRight, maxW: cs.maxWidth,
      headX: Math.round(b1.x), headW: Math.round(b1.width) };
  });
  console.log(path, JSON.stringify(m));
}
await b.close();

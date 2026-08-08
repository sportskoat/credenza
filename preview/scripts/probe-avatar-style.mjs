import { webkit } from "playwright";
const b = await webkit.launch();
const ctx = await b.newContext({ colorScheme:"dark", viewport:{width:1919,height:900} });
const pg = await ctx.newPage();
await pg.goto("http://localhost:5352/",{waitUntil:"networkidle"});
await pg.waitForTimeout(1400);
console.log(JSON.stringify(await pg.evaluate(`(() => {
  const a = document.querySelector(".cz-avatar");
  if (!a) return { missing: true, html: document.querySelector(".cz-masthead-actions")?.innerHTML?.slice(0,600) };
  const c = getComputedStyle(a);
  const r = a.getBoundingClientRect();
  const svg = a.querySelector("svg");
  return { rect:{l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)},
    background:c.backgroundColor, border:c.border, borderRadius:c.borderRadius, color:c.color,
    svgBox: svg?{w:svg.getAttribute("width"),h:svg.getAttribute("height"),sw:getComputedStyle(svg).strokeWidth}:null,
    svgHtml: svg?svg.outerHTML.slice(0,400):null };
})()`), null, 1));
const ctx2 = await b.newContext({ colorScheme:"dark", viewport:{width:402,height:800} });
const pg2 = await ctx2.newPage();
await pg2.goto("http://localhost:5352/",{waitUntil:"networkidle"});
await pg2.waitForTimeout(1400);
console.log("phone", JSON.stringify(await pg2.evaluate(`(() => { const a=document.querySelector(".cz-avatar"); if(!a) return null; const r=a.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height)}; })()`)));
await b.close();

import { webkit } from "playwright";
const BASE = "http://localhost:5352";
const JS_APP = `(() => {
  const p = (sel) => { const e=document.querySelector(sel); if(!e) return null; const r=e.getBoundingClientRect(); return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)}; };
  const nav=[...document.querySelectorAll(".cz-masthead a")].filter(a=>a.textContent.trim()&&!String(a.className).includes("brand"));
  return {shell:p(".cz-app[data-fashion='true'] .cz-shell"), head:p(".cz-masthead"), brand:p(".cz-masthead .cz-brand"), act:p(".cz-masthead-actions"),
    navL: nav.length?Math.round(Math.min(...nav.map(a=>a.getBoundingClientRect().left))):null,
    navR: nav.length?Math.round(Math.max(...nav.map(a=>a.getBoundingClientRect().right))):null,
    navT: nav.length?Math.round(Math.min(...nav.map(a=>a.getBoundingClientRect().top))):null,
    shellPad: getComputedStyle(document.querySelector(".cz-app[data-fashion='true'] .cz-shell")).padding,
    headPad: getComputedStyle(document.querySelector(".cz-masthead")).padding };
})()`;
const JS_PUB = `(() => {
  const p = (sel) => { const e=document.querySelector(sel); if(!e) return null; const r=e.getBoundingClientRect(); return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)}; };
  const nav=[...document.querySelectorAll(".site-head nav.nav a")];
  return {shell:p(".site-head-inner")||p(".site-head"), head:p(".site-head"), brand:p(".site-head .brand"), act:p(".site-head .nav-open"),
    navL: nav.length?Math.round(Math.min(...nav.map(a=>a.getBoundingClientRect().left))):null,
    navR: nav.length?Math.round(Math.max(...nav.map(a=>a.getBoundingClientRect().right))):null,
    navT: nav.length?Math.round(Math.min(...nav.map(a=>a.getBoundingClientRect().top))):null,
    headPad: getComputedStyle(document.querySelector(".site-head")).padding,
    innerPad: document.querySelector(".site-head-inner")?getComputedStyle(document.querySelector(".site-head-inner")).padding:null };
})()`;
const b = await webkit.launch();
for (const width of [1919, 1600, 1440]) {
  const ctx = await b.newContext({ colorScheme:"dark", viewport:{width,height:900} });
  const pg = await ctx.newPage();
  await pg.goto(BASE+"/",{waitUntil:"networkidle"}); await pg.waitForTimeout(1200);
  const app = await pg.evaluate(JS_APP);
  await pg.goto(BASE+"/pricing/",{waitUntil:"networkidle"}); await pg.waitForTimeout(400);
  const pub = await pg.evaluate(JS_PUB);
  console.log(width, JSON.stringify({app,pub},null,1));
  await ctx.close();
}
await b.close();

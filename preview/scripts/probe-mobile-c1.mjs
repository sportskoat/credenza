import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
const json = readFileSync("/Users/kylewensel/Downloads/credenza-shelf-2026-07-21.json","utf8");
const b = await webkit.launch();
const c = await b.newContext({ ...devices["iPhone 15 Pro"] });
await c.addInitScript((j)=>{window.localStorage.setItem("credenza-fashion-items-v1", j);}, json);
const p = await c.newPage();
await p.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const g = (s) => { const e = document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); const cs=getComputedStyle(e); return {s, top:+b.top.toFixed(1), bottom:+b.bottom.toFixed(1), h:+b.height.toFixed(1), w:+b.width.toFixed(1), fs:cs.fontSize, ai:cs.alignItems, pb:cs.paddingBottom}; };
  return [".cz-masthead",".cz-view-tabs-row",".cz-view-tabs",".cz-view-tabs .cz-tab",".cz-tabs-totals",".cz-tabs-count",".cz-tabs-total",".cz-shelf-grid"].map(g);
});
console.log(JSON.stringify(r,null,1));
await b.close();

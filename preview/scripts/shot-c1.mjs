import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
const json = readFileSync("/Users/kylewensel/Downloads/credenza-shelf-2026-07-21.json","utf8");
const b = await webkit.launch();
const c = await b.newContext({ ...devices["iPhone 15 Pro"] });
await c.addInitScript((j)=>{window.localStorage.setItem("credenza-fashion-items-v1", j);}, json);
const p = await c.newPage();
await p.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
await p.screenshot({ path: "/tmp/c1-top.png", clip: { x:0, y:0, width:393, height:300 } });
// reveal search
await p.getByRole("button", { name: /Search your shelf/ }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: "/tmp/c1-search.png", clip: { x:0, y:0, width:393, height:300 } });
await b.close();
console.log("ok");

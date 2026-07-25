// Probes the status chip and both themes on the two-line card.
// Seeds three non-"want" statuses, because the real backup is all "want".
import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const items = JSON.parse(readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json"), "utf8"));
["bought", "shipped", "received"].forEach((s, i) => { if (items[i]) items[i].findStatus = s; });
const shelfJson = JSON.stringify(items);

const browser = await webkit.launch();
for (const theme of ["light", "rainbow"]) {
  const ctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
  await ctx.addInitScript(([j, t]) => {
    window.localStorage.setItem("credenza-fashion-items-v1", j);
    window.localStorage.setItem("credenza-prefs-v1", JSON.stringify({ theme: t, colorwayVersion: 4, viewMode: "grid", sortMode: "recent" }));
  }, [shelfJson, theme]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const cs = (el, ...p) => { const s = getComputedStyle(el); return Object.fromEntries(p.map((k) => [k, s[k]])); };
    const rc = (el) => { const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const wraps = [...document.querySelectorAll(".cz-card-twoline .cz-card-status")];
    const p = wraps[0];
    const card = document.querySelector(".cz-card-twoline");
    return {
      bg: getComputedStyle(document.body).backgroundColor,
      pillCount: wraps.length,
      pillText: p?.textContent,
      pill: p ? { rect: rc(p), ...cs(p, "position", "left", "bottom", "top", "fontSize", "padding", "letterSpacing", "fontWeight", "textTransform", "backgroundColor", "color") } : null,
      gapToPhotoBottom: p ? +(p.closest(".cz-card-photo").getBoundingClientRect().bottom - p.getBoundingClientRect().bottom).toFixed(1) : null,
      cardH: card ? rc(card).h : null,
      seller: cs(document.querySelector(".cz-card-twoline .cz-front-seller"), "color"),
      size: cs(document.querySelector(".cz-card-twoline .cz-front-size"), "color"),
    };
  });
  console.log(theme, JSON.stringify(out, null, 2));
  await page.screenshot({ path: `/tmp/c2-grid-${theme}.png`, clip: { x: 0, y: 100, width: 393, height: 620 } });
  await ctx.close();
}
await browser.close();

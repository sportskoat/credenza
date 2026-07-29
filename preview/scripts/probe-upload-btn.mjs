// Verify "Upload chart photo" fix at 1000/1280/1440/1920: each label one
// line, inside its button. Oom follow-up 2026-07-29.
import { chromium } from "/Users/kylewensel/credenza/preview/node_modules/playwright-core/index.mjs";
import fs from "node:fs";

const OUT = "/Users/kylewensel/.buzz/.scratch/scrim2";
fs.mkdirSync(OUT, { recursive: true });

const seed = `(() => {
  if (!location.host.includes("5173")) return;
  try {
    const now = Date.now();
    localStorage.setItem("credenza-fashion-items-v1", JSON.stringify([
      { id: "detail-nophoto", title: "Canvas tote bag", type: "link",
        url: "https://weidian.com/item.html?itemID=2", host: "weidian.com",
        priceUsd: 19, currency: "USD", size: "One size",
        seller: "toteshop", category: "bag", importance: "medium",
        createdAt: now, updatedAt: now },
    ]));
    localStorage.setItem("credenza-prefs-v1", JSON.stringify({
      theme: "light", colorwayVersion: 4, sortMode: "recent",
      shelfFilter: "all", pricePrimary: "USD", measureUnits: "in",
      onboardingDone: true,
    }));
  } catch (e) {}
})();`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

for (const w of [1000, 1280, 1440, 1920]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addInitScript(seed);
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForSelector(".cz-photo-list-card", { timeout: 15000 });
  await page.locator(".cz-photo-list-card", { hasText: "Canvas tote bag" }).first()
    .locator(".cz-photo-list-open").click();
  await page.waitForTimeout(1400);

  const rows = await page.evaluate(() => {
    const out = [];
    const btns = document.querySelectorAll(
      ".cz-detail-chart-actions .cz-detail-chart-upload, .cz-detail-chart-actions .cz-detail-profile-sizes"
    );
    for (const el of btns) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const cs = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      // one rect per text line; >1 distinct line top = wrapped
      const rects = [...range.getClientRects()].filter((x) => x.width > 1);
      const lineTops = [...new Set(rects.map((x) => Math.round(x.top)))];
      const tb = range.getBoundingClientRect();
      out.push({
        cls: el.className,
        label: (el.textContent || "").trim().slice(0, 32),
        lines: lineTops.length,
        box: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
        textW: +tb.width.toFixed(1),
        insideX: tb.left >= r.left - 0.5 && tb.right <= r.right + 0.5,
        insideY: tb.top >= r.top - 0.5 && tb.bottom <= r.bottom + 0.5,
        whiteSpace: cs.whiteSpace,
      });
    }
    return out;
  });
  console.log(w + "px: " + JSON.stringify(rows));

  const row = page.locator(".cz-detail-chart-actions").first();
  if (await row.count()) {
    const b = await row.boundingBox();
    if (b) await page.screenshot({
      path: `${OUT}/upload-fix-${w}.png`,
      clip: { x: Math.max(0, b.x - 16), y: Math.max(0, b.y - 16), width: b.width + 32, height: b.height + 32 },
    });
  }
  await ctx.close();
}
await browser.close();

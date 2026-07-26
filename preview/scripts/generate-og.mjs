#!/usr/bin/env node
/**
 * Generate public/og.png (1200×630) for Credenza share cards.
 * Usage: node scripts/generate-og.mjs
 */
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../public/og.png");

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 630px;
      background: #17181a;
      color: #f4f4f0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 56px 64px 52px;
      -webkit-font-smoothing: antialiased;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #f4f4f0;
      color: #17181a;
      font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
      font-size: 22px;
      font-weight: 700;
    }
    .word {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.18em;
    }
    h1 {
      max-width: 980px;
      margin-top: 36px;
      font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
      font-size: 64px;
      font-weight: 600;
      line-height: 1.08;
      letter-spacing: -0.028em;
    }
    .bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .sub {
      font-size: 20px;
      line-height: 1.4;
      color: #a8adb5;
      max-width: 640px;
    }
    .url {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 16px;
      color: #7ee2a8;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div>
    <div class="top">
      <span class="mark">C</span>
      <span class="word">CREDENZA</span>
    </div>
    <h1>Your haul lives in 40 tabs and a note app.</h1>
  </div>
  <div class="bottom">
    <p class="sub">Agent haul planner for Taobao, Weidian and 1688. Paste a link, get a card, open Buy in your agent.</p>
    <span class="url">credenzafashion.com</span>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: outPath, type: "png" });
await browser.close();
console.log(`Wrote ${outPath}`);

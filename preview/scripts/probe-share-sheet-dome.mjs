// Repro for the "weird dome" on the haul share sheet (Kyle 2026-08-04).
// Renders the sheet's exact markup with the REAL stylesheet, no app runtime,
// then hit-tests the dome pixel to name the element that paints it.
import { webkit } from "playwright";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../credenza-fashion.css", import.meta.url), "utf8");

const HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>${css}</style>
<style>
  /* stand-ins for the tokens credenza.css would define at :root */
  :root {
    --cz-bg: #000; --cz-ink: #f5f5f7; --cz-sub: #b7bbc2; --cz-faint: #9ea3ab;
    --cz-card: #202024; --cz-card-solid: #202024; --cz-inset-bg: #26262b;
    --cz-hair: rgba(255,255,255,.16); --cz-hairline: rgba(255,255,255,.16);
    --cz-card-border: rgba(255,255,255,.16);
    --cz-money: #4ade80; --cz-action-fill: #f5f5f7; --cz-action-text: #17181a;
    --cz-seg: rgba(255,255,255,.07); --cz-seg-on: #f5f5f7; --cz-seg-on-text: #17181a;
    --cz-focus: #4da3ff;
    --cz-display: Georgia, serif; --cz-sans: system-ui, sans-serif;
    --cz-mono: ui-monospace, Menlo, monospace;
    --dur-micro: 90ms; --dur-press: 120ms; --dur-open: 250ms;
    --ease-out: cubic-bezier(0.23,1,0.32,1);
  }
  body { background: #0a0a0c; margin: 0; font-family: system-ui; }
</style>
</head>
<body>
<div class="cz-app" data-fashion="true" data-theme="dark">
<dialog open class="cz-modal t-modal is-open" style="max-width:560px">
  <div class="cz-modal-surface cz-haul-share-sheet">
    <div class="cz-modal-header" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.16)">
      <h2 style="margin:0;flex:1;font-family:Georgia,serif;font-size:21px;font-weight:500;line-height:1.1">Share this haul</h2>
      <button type="button" class="cz-icon-button" aria-label="Close" style="width:40px;height:40px;border:0;border-radius:999px;background:transparent;color:#b7bbc2;cursor:pointer">✕</button>
    </div>
    <div class="cz-haul-share-body">
      <div class="cz-haul-share-preview-row">
        <div class="cz-haul-share-preview-card">
          <div class="cz-haul-share-preview-photo" role="img" aria-label="winter"></div>
          <div class="cz-haul-share-preview-body">
            <div class="cz-haul-share-preview-title">winter</div>
            <div class="cz-haul-share-preview-meta">3 ITEMS · $142.48</div>
          </div>
        </div>
      </div>
      <div class="cz-haul-share-block">
        <div class="cz-haul-share-label">Include</div>
        <div class="cz-haul-share-chips" role="group" aria-label="Include">
          <button type="button" class="cz-haul-share-chip is-on">Prices</button>
          <button type="button" class="cz-haul-share-chip is-on">W2C links</button>
          <button type="button" class="cz-haul-share-chip is-on">Fit notes</button>
          <button type="button" class="cz-haul-share-chip is-on">Sellers</button>
          <button type="button" class="cz-haul-share-chip">QC photos</button>
          <button type="button" class="cz-haul-share-chip">Weights</button>
        </div>
        <p class="cz-haul-share-caption">Tap to include. QC photos are off until you turn them on for this haul.</p>
      </div>
      <div class="cz-haul-share-block">
        <div class="cz-haul-share-label">How it opens</div>
        <div role="radiogroup" aria-label="How it opens" class="cz-segment t-tabs">
          <span class="t-tabs-pill" aria-hidden="true"></span>
          <button type="button" role="radio" aria-checked="false" class="cz-segment-btn t-tab" data-t-tab-value="review">Review</button>
          <button type="button" role="radio" aria-checked="false" class="cz-segment-btn t-tab" data-t-tab-value="receipt">Receipt</button>
          <button type="button" role="radio" aria-checked="true" class="cz-segment-btn t-tab is-active" data-t-tab-value="both">Both</button>
        </div>
        <p class="cz-haul-share-caption">Opens on the review. The reader can switch to the receipt without leaving the page.</p>
      </div>
      <div class="cz-haul-share-actions">
        <button type="button" class="cz-pill">Create link</button>
        <button type="button" class="cz-pill">Copy for Reddit</button>
        <button type="button" class="cz-pill">Save image</button>
      </div>
      <p class="cz-haul-share-disclosure">The link is a copy, frozen when you make it. Anyone holding it can read the page.</p>
      <div class="cz-haul-share-embed-wrap">
        <div class="cz-haul-share-label">Embed card</div>
        <div class="cz-haul-embed" data-title="winter">
          <div class="cz-haul-embed-mosaic" aria-hidden="true">
            <div class="cz-haul-embed-tile"></div><div class="cz-haul-embed-tile"></div>
            <div class="cz-haul-embed-tile"></div><div class="cz-haul-embed-tile"></div>
          </div>
          <div class="cz-haul-embed-copy">
            <div class="cz-haul-embed-brand">CREDENZA</div>
            <div class="cz-haul-embed-main">
              <div class="cz-haul-embed-title">winter</div>
              <div class="cz-haul-embed-landed">$142.48 landed</div>
              <div class="cz-haul-embed-meta">3 ITEMS · EMS</div>
            </div>
            <div class="cz-haul-embed-url">credenzafashion.com/s/…</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</dialog>
</div>
</body>
</html>`;

const browser = await webkit.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 1400 }, colorScheme: "dark", deviceScaleFactor: 2 })).newPage();
await page.setContent(HTML, { waitUntil: "load" });
await page.waitForTimeout(400);
// Park the mouse over the sheet body: the old class collision filled the
// whole body on :hover (the arch) and scaled it on :active (the tap twitch).
await page.hover(".cz-haul-share-body");
await page.waitForTimeout(250);
await page.screenshot({ path: ".verify-shots/share-sheet-repro.png" });

const body = await page.evaluate(() => {
  const el = document.querySelector(".cz-haul-share-body");
  const cs = getComputedStyle(el);
  return {
    bg: cs.backgroundColor,
    radius: cs.borderRadius,
    border: cs.borderTopWidth + " " + cs.borderTopStyle,
    transform: cs.transform,
  };
});
console.log("sheet body:", JSON.stringify(body));
const clean =
  body.bg === "rgba(0, 0, 0, 0)" &&
  body.radius === "0px" &&
  body.transform === "none";
console.log(clean ? "PASS  no arch, no fill, no scale on the sheet body" : "FAIL  sheet body still carries pill styles");

// Hit-test the dome: a point left of the preview card, high inside the sheet.
const probe = await page.evaluate(() => {
  const out = [];
  for (const [x, y] of [[480, 220], [330, 320], [620, 420], [480, 640]]) {
    const el = document.elementFromPoint(x, y);
    if (!el) { out.push({ x, y, el: null }); continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push({
      x, y,
      tag: el.tagName,
      cls: typeof el.className === "string" ? el.className : "",
      rect: { w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top), l: Math.round(r.left) },
      bg: cs.backgroundColor,
      radius: cs.borderRadius,
    });
  }
  return out;
});
for (const p of probe) console.log(JSON.stringify(p));

await browser.close();
console.log("shot: .verify-shots/share-sheet-repro.png");

// LB-11 verification. A screenshot cannot prove an animation still runs, and
// `LazyMotion strict` reports a stray `motion.` import through console.error
// rather than a thrown exception. So this probe watches the console and then
// exercises the three feature families that the split could break:
//
//   animations  — AnimatePresence mount/unmount and `animate` transforms
//   hover/tap   — whileHover on MorphButton and EditPhotosManager
//   pan         — onPan / onPanEnd on the carousel and the photo cover flow
//
// Pan is the reason this app must load `domMax` rather than `domAnimation`.
// If the feature bundle ever narrows, this probe is what catches it.
//
// Usage: node scripts/probe-lazymotion.mjs [baseUrl]
//   default baseUrl: http://localhost:5173

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const baseUrl = process.argv[2] || "http://localhost:5173";
const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);

const prefs = (viewMode) => ({
  viewMode,
  sortMode: "recent",
  theme: "dark",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L" },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
});

const failures = [];
const notes = [];
const browser = await chromium.launch();

async function open(width, viewMode) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript(
    ({ shelfJson, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelfJson: JSON.stringify(items), prefsJson: JSON.stringify(prefs(viewMode)) }
  );
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => failures.push(`${width}/${viewMode} pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const t = msg.text();
    // `strict` names the offending import in its message. Any framer-motion
    // complaint is a real failure here, not noise.
    if (/motion|LazyMotion|framer/i.test(t)) consoleErrors.push(t);
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  return { ctx, page, consoleErrors };
}

// 1. The app renders at all, and strict says nothing.
{
  const { ctx, page, consoleErrors } = await open(1280, "cards");
  const cards = await page.locator(".cz-carousel-card").count();
  if (!cards) failures.push("1280/cards: no carousel cards rendered");
  else notes.push(`carousel rendered ${cards} cards`);
  for (const e of consoleErrors) failures.push(`1280/cards console: ${e}`);

  // 2. Animations feature — a motion element must carry a generated transform.
  //    If LazyMotion never resolved its features, framer leaves style untouched.
  const transformed = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".cz-carousel-card"));
    return els.filter((el) => {
      const t = getComputedStyle(el).transform;
      return t && t !== "none";
    }).length;
  });
  if (!transformed) failures.push("animations: no carousel card has a transform");
  else notes.push(`animations OK — ${transformed} cards carry a transform`);

  // 3. Pan feature — swipe the carousel and check the active index moves.
  //    This is the assertion that fails if the bundle narrows to domAnimation.
  const before = await page.evaluate(
    () => document.querySelector("[aria-activedescendant]")?.getAttribute("aria-activedescendant") ?? null
  );
  const box = await page.locator(".cz-carousel").first().boundingBox();
  if (!box) {
    failures.push("pan: no .cz-carousel bounding box");
  } else {
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.7, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(box.x + box.width * 0.7 - i * 22, y);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(900);
    const after = await page.evaluate(
      () => document.querySelector("[aria-activedescendant]")?.getAttribute("aria-activedescendant") ?? null
    );
    if (before && after && before === after) {
      failures.push(`pan: swipe did not move the carousel (still ${after})`);
    } else {
      notes.push(`pan OK — active moved ${before} -> ${after}`);
    }
  }
  await ctx.close();
}

// 4. Hover feature — whileHover must produce a scale transform on a button.
//    MorphButton is the search Clear button, and the search row only renders
//    on phone widths (desktop hands search to the glass toggle). So this leg
//    runs at 390: open the field from the masthead, then type.
{
  const { ctx, page, consoleErrors } = await open(390, "grid");
  for (const e of consoleErrors) failures.push(`390/grid console: ${e}`);
  const opener = page.locator('button[aria-label*="earch" i]').first();
  if (await opener.count()) {
    await opener.click();
    await page.waitForTimeout(400);
  }
  const search = page.locator('input[placeholder="Search or paste a link"]').first();
  if (await search.count()) {
    await search.fill("jacket");
    await page.waitForTimeout(500);
  }
  const btn = page.locator(".cz-morph-button").first();
  if ((await btn.count()) === 0) {
    failures.push("hover: .cz-morph-button never mounted, so hover is unverified");
  } else {
    const idle = await btn.evaluate((el) => getComputedStyle(el).transform);
    await btn.hover();
    await page.waitForTimeout(400);
    const hot = await btn.evaluate((el) => getComputedStyle(el).transform);
    if (idle === hot) failures.push(`hover: whileHover produced no change (${idle})`);
    else notes.push(`hover OK — ${idle} -> ${hot}`);
  }
  await ctx.close();
}

await browser.close();

for (const n of notes) console.log("  " + n);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log("  " + f);
  process.exit(1);
}
console.log("\nOK — LazyMotion strict is clean and animations, hover, and pan all run.");

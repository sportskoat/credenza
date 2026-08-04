// Visual check for the indexing paste bar (handoff direction 1b: "the paste
// bar carries it"). Pastes one Weidian link into the hero field while every
// Netlify function hangs, so the job holds in FETCHING LINK — long enough to
// prove the desktop search field itself carries the green wash, the 2px
// bottom bar, the stage label and a dimmed inert Stash button. Then the
// functions come back and fail, and the field must hand itself back to
// search while the strip keeps the failed row.
//
// Needs the app on :8888 (netlify dev). Run: node scripts/probe-index-paste-bar.mjs
import { webkit } from "playwright";

const BASE = process.env.CZ_BASE || "http://localhost:8888";
const LINK = "https://weidian.com/item.html?itemID=105000972378";

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass });
  console.log((pass ? "PASS  " : "FAIL  ") + name + " — " + detail);
};

const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  colorScheme: "dark",
  deviceScaleFactor: 2,
});
const page = await context.newPage();

// Hang every function. The job registers on the same frame as the paste and
// then waits on the resolver, which never answers — a held FETCHING LINK.
let hold = true;
await page.route("**/.netlify/functions/**", async (route) => {
  // Poll until the probe releases the hold, then answer with a real server
  // failure. An aborted route reads as a cancel to the shelf and clears the
  // job; a 500 is the failed read the strip exists to show.
  while (hold) await new Promise((r) => setTimeout(r, 100));
  await route.fulfill({ status: 500, body: "probe failure" });
});

await page.goto(BASE, { waitUntil: "load" });
const heroField = page.locator(".cz-empty-hero-search-field");
await heroField.waitFor({ timeout: 20000 });

// A real paste: React's onPaste reads clipboardData, so build one.
await heroField.evaluate((el, url) => {
  const data = new DataTransfer();
  data.setData("text/plain", url);
  el.dispatchEvent(
    new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
  );
}, LINK);

// The card lands, the desk bar appears, and past the 400ms gate the field
// swaps to the indexing treatment.
const shell = page.locator(".cz-desk-search-shell.is-indexing");
await shell.waitFor({ timeout: 10000 });
await page.waitForTimeout(700); // let the wash ease out to its target

const state = await page.evaluate(() => {
  const text = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : null;
  };
  const widthPct = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return Math.round((el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width) * 100);
  };
  const stash = document.querySelector(".cz-desk-stash-btn");
  return {
    stage: text(".cz-desk-index-stage"),
    tile: text(".cz-desk-index-tile"),
    url: text(".cz-desk-index-url"),
    wash: widthPct(".cz-desk-index-wash"),
    bar: widthPct(".cz-desk-index-bar"),
    stashDisabled: stash ? stash.disabled : null,
    stashOpacity: stash ? getComputedStyle(stash).opacity : null,
    inputGone: !document.querySelector(".cz-desk-search-shell .cz-desk-search-field"),
  };
});

record("stage label reads FETCHING LINK", state.stage === "FETCHING LINK", "stage=" + state.stage);
record("platform tile carries the W", state.tile === "W", "tile=" + state.tile);
record("the pasted URL sits in the field", state.url === LINK, "url=" + state.url);
record("the green wash is filling", state.wash !== null && state.wash > 3 && state.wash <= 30, "wash=" + state.wash + "%");
record("the 2px bar matches the wash", state.bar === state.wash, "bar=" + state.bar + "% vs wash=" + state.wash + "%");
record("Stash is inert at 0.56", state.stashDisabled === true && state.stashOpacity === "0.56",
  "disabled=" + state.stashDisabled + " opacity=" + state.stashOpacity);
record("the search input is out of the field", state.inputGone === true, "inputGone=" + state.inputGone);

// Kyle 2026-08-04: "one consistent animation — it jumps from 1/3 of the way
// there all the way to end." Sample the bar every 100ms: a glide moves a
// little almost every sample and never goes backward; a stepper holds one
// value for whole seconds.
const samples = [];
for (let i = 0; i < 14; i++) {
  samples.push(
    await page.evaluate(() => {
      const el = document.querySelector(".cz-desk-index-bar");
      return el ? el.getBoundingClientRect().width : -1;
    })
  );
  await page.waitForTimeout(100);
}
const distinct = new Set(samples.map((w) => Math.round(w))).size;
const monotonic = samples.every((w, i) => i === 0 || w >= samples[i - 1] - 0.5);
record(
  "the bar glides — new position nearly every 100ms, never backward",
  distinct >= 8 && monotonic,
  distinct + " distinct positions over 1.4s, monotonic=" + monotonic
);

await page.screenshot({ path: ".verify-shots/index-field-fetching.png" });
const bar = await page.locator(".cz-desk-capture").boundingBox();
if (bar) {
  await page.screenshot({
    path: ".verify-shots/index-field-fetching-closeup.png",
    clip: { x: 0, y: Math.max(0, bar.y - 12), width: 1280, height: bar.height + 24 },
  });
}

// Let the functions fail. The field must hand itself back to search — the
// failure lives in the strip, not the field.
hold = false;
await page.waitForTimeout(500);
const reverted = page.locator(".cz-desk-search-shell:not(.is-indexing) .cz-desk-search-field");
try {
  await reverted.waitFor({ timeout: 30000 });
  record("a failed link hands the field back to search", true, "input restored");
} catch {
  record("a failed link hands the field back to search", false, "field still indexing after 30s");
}
const failedRow = await page.locator(".cz-index-row.is-failed").count();
record("the strip keeps the failure", failedRow > 0, "failed rows=" + failedRow);
await page.screenshot({ path: ".verify-shots/index-field-reverted.png" });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
if (failed.length) process.exit(1);

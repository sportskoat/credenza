// Post-deploy verification, 2026-08-03, plan-limits release.
// The link indexing strip on a real stash against the live site.
// Pastes Kyle's real Weidian tee through the paste bar, then watches the
// strip: it must appear with the tile and the item ID, move through the
// stages, and end at INDEXED or at a failure sentence with Retry.
import { webkit } from "playwright";

const baseUrl = process.argv[2] || "https://credenzafashion.com";
const LINK = "https://weidian.com/item.html?itemID=7812124117";

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log((pass ? "PASS  " : "FAIL  " + "") + name + " — " + detail);
};

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  measureUnits: "in",
  onboardingDone: true,
  theme: "rainbow",
};

const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
await context.addInitScript(
  ({ prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", "[]");
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

// Paste through the real bar: fill the field, click Stash.
const field = page.locator('input[placeholder="Paste a link"]');
await field.fill(LINK);
await page.locator('button[aria-label="Stash a link or note"]').click();

// Watch the strip for up to 90 seconds.
const seen = [];
let stripFound = false;
let terminal = "";
const deadline = Date.now() + 90000;
while (Date.now() < deadline && !terminal) {
  const snap = await page.evaluate(() => {
    const strip = document.querySelector(".cz-index-strip");
    if (!strip) return null;
    const step = strip.querySelector(".cz-index-step");
    const head = strip.querySelector(".cz-index-headline");
    const fail = strip.querySelector(".cz-index-fail-copy");
    return {
      head: head ? head.textContent.trim() : "",
      step: step ? step.textContent.trim() : "",
      fail: fail ? fail.textContent.trim() : "",
      thumbs: strip.querySelectorAll(".cz-index-thumb").length,
      tile: (strip.querySelector(".cz-index-tile") || {}).textContent || "",
      label: (strip.querySelector(".cz-index-label") || {}).textContent || "",
      retry: !!strip.querySelector(".cz-index-pill.is-retry"),
    };
  });
  if (snap) {
    stripFound = true;
    const stage = snap.fail ? "FAILED" : snap.step;
    if (stage && seen[seen.length - 1] !== stage) {
      seen.push(stage);
      console.log("  … " + stage + (snap.thumbs ? " (" + snap.thumbs + " thumbs)" : ""));
    }
    if (snap.step === "INDEXED") terminal = "indexed";
    if (snap.fail && snap.retry) terminal = "failed-with-retry";
  }
  await page.waitForTimeout(500);
}

record("strip appears on a real stash", stripFound, "strip found: " + stripFound);

const stripInfo = await page.evaluate(() => {
  const strip = document.querySelector(".cz-index-strip");
  if (!strip) return null;
  return {
    tile: (strip.querySelector(".cz-index-tile") || {}).textContent || "",
    label: (strip.querySelector(".cz-index-label") || {}).textContent || "",
  };
});
record(
  "row shows the Weidian tile and the item ID",
  !!stripInfo && stripInfo.tile === "W" && stripInfo.label === "7812124117",
  stripInfo ? "tile=" + stripInfo.tile + " label=" + stripInfo.label : "no strip in the page"
);

record(
  "strip reaches a terminal state",
  terminal !== "",
  terminal ? "ended at: " + terminal : "no terminal state in 90s; stages seen: " + seen.join(" → ")
);

if (stripFound) {
  await page.locator(".cz-index-strip").screenshot({ path: ".verify-shots/live-index-strip.png" });
  console.log("  screenshot: .verify-shots/live-index-strip.png");
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(failed.length === 0 ? "ALL PASS" : failed.length + " FAILURES");
process.exit(failed.length === 0 ? 0 : 1);

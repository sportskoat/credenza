// Prove the sign-in card is a centered, frosted window on a real phone AND
// a desktop (F 2026-08-01: "give it its own centered container, frosted, on
// all screens"). Before this it was a phone bottom sheet — see git history
// on this file for that probe.
//
// Checks, on a phone AND a desktop:
//   1. the card floats clear of every edge (never anchors to the bottom);
//   2. all four corners stay rounded;
//   3. no drag handle bar (nothing to grab — it does not anchor to an edge);
//   4. the surface background is the translucent frost fill, not the
//      opaque card color the limits wall still uses.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const PREFS = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L" },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
};

const fails = [];
const check = (ok, line) => {
  console.log((ok ? "PASS  " : "FAIL  ") + line);
  if (!ok) fails.push(line);
};

const browser = await chromium.launch();

// Open the sheet the way a person does: paste a link, hit the refusal.
async function openSheet(context) {
  await context.addInitScript((prefsJson) => {
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  }, JSON.stringify(PREFS));
  await context.route("**/.netlify/functions/resolve*", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Sign in to read this link.", code: "sign_in_required" }),
    }),
  );
  const page = await context.newPage();
  await page.goto("http://localhost:5347", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const privacy = page.getByRole("button", { name: "Accept" }).first();
  if (await privacy.isVisible().catch(() => false)) {
    await privacy.click();
    await page.waitForTimeout(500);
  }
  const openBox = page.getByRole("button", { name: "Paste your first link" }).first();
  if (await openBox.isVisible().catch(() => false)) {
    await openBox.click();
    await page.waitForTimeout(900);
  }
  const box = page.locator("textarea, input.cz-empty-hero-search-field").first();
  await box.waitFor({ state: "visible", timeout: 15000 });
  await box.click();
  await page.evaluate((link) => {
    const el = document.querySelector("textarea, input.cz-empty-hero-search-field");
    const data = new DataTransfer();
    data.setData("text/plain", link);
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, "https://weidian.com/item.html?itemID=7300000000");
  await page.waitForTimeout(1500);
  const stash = page.locator(".cz-stash-primary").first();
  if (await stash.isVisible().catch(() => false)) {
    await stash.click();
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(4000);
  await page.locator(".cz-limits").first().waitFor({ state: "visible", timeout: 15000 });
  return page;
}

function readCard() {
  const sheet = document.querySelector(".cz-signin-sheet");
  const dialog = sheet.closest("dialog");
  const r = dialog.getBoundingClientRect();
  const cs = getComputedStyle(sheet);
  const handle = getComputedStyle(sheet, "::before");
  return {
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    left: Math.round(r.left),
    right: Math.round(r.right),
    viewH: Math.round(window.innerHeight),
    viewW: Math.round(window.innerWidth),
    radius: [
      cs.borderTopLeftRadius,
      cs.borderTopRightRadius,
      cs.borderBottomRightRadius,
      cs.borderBottomLeftRadius,
    ],
    handleContent: handle.content,
    background: cs.backgroundColor,
    backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
  };
}

function checkCentered(m, label) {
  check(m.top > 8, `${label}: floats clear of the top: ${m.top}`);
  check(m.bottom < m.viewH - 8, `${label}: floats clear of the bottom: ${m.bottom} of ${m.viewH}`);
  check(m.left > 0 || m.right < m.viewW, `${label}: does not touch both side edges`);
  check(
    parseFloat(m.radius[0]) > 0 &&
      parseFloat(m.radius[1]) > 0 &&
      parseFloat(m.radius[2]) > 0 &&
      parseFloat(m.radius[3]) > 0,
    `${label}: all four corners stay rounded: ${m.radius.join(" / ")}`,
  );
  check(m.handleContent === "none", `${label}: no drag handle bar: ${m.handleContent}`);
  // rgba(...) with an alpha under 1 is the frost fill; the limits wall's
  // opaque --cz-card-solid would read alpha 1 (or no alpha channel at all).
  const alphaMatch = m.background.match(/rgba?\([^)]*,\s*([\d.]+)\)/);
  const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 1;
  check(alpha < 1, `${label}: surface uses the translucent frost fill: ${m.background}`);
}

// ── A real phone ───────────────────────────────────────────────────────────
{
  const context = await browser.newContext({
    ...devices["iPhone 14 Pro"],
    isMobile: false, // Chromium refuses isMobile; touch is what the CSS reads.
    hasTouch: true,
    viewport: { width: 402, height: 874 },
  });
  const page = await openSheet(context);
  const m = await page.evaluate(readCard);
  console.log("phone:", JSON.stringify(m));
  checkCentered(m, "phone");
  await page.screenshot({ path: join(outDir, "signin-centered-phone.png") });
  await context.close();
}

// ── A desktop window ───────────────────────────────────────────────────────
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await openSheet(context);
  const m = await page.evaluate(readCard);
  console.log("desktop:", JSON.stringify(m));
  checkCentered(m, "desktop");
  await page.screenshot({ path: join(outDir, "signin-centered-desktop.png") });
  await context.close();
}

await browser.close();
console.log(fails.length ? "\nFAILED: " + fails.length : "\nALL CHECKS PASS");
process.exit(fails.length ? 1 : 0);

// Prove the sign-in card is a bottom sheet on a real phone, and a centered
// card on a desktop (Kyle 2026-07-31: "no make it correct" — the drawing wins).
//
// The earlier shots were taken in a browser with a MOUSE pointer at 402px
// wide. The app's bottom-sheet rule is gated on a touch pointer, so those
// shots showed the centered desktop card. This probe emulates a real phone:
// touch on, mobile on.
//
// Checks, on a phone:
//   1. the card touches the bottom edge of the screen;
//   2. the card fills the full width;
//   3. only the top corners are rounded;
//   4. the drag handle bar is drawn, centered, at the top of the card.
// Checks, on a desktop: the card floats, with all four corners rounded.
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
  const sheet = document.querySelector(".cz-limits-sheet");
  const dialog = sheet.closest("dialog");
  const r = dialog.getBoundingClientRect();
  const cs = getComputedStyle(sheet);
  const handle = getComputedStyle(sheet, "::before");
  return {
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    left: Math.round(r.left),
    width: Math.round(r.width),
    viewH: Math.round(window.innerHeight),
    viewW: Math.round(window.innerWidth),
    radius: [
      cs.borderTopLeftRadius,
      cs.borderTopRightRadius,
      cs.borderBottomRightRadius,
      cs.borderBottomLeftRadius,
    ],
    handleContent: handle.content,
    handleW: handle.width,
    handleH: handle.height,
  };
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

  check(m.bottom >= m.viewH - 1, `the card touches the bottom edge: ${m.bottom} of ${m.viewH}`);
  check(m.width >= m.viewW - 1, `the card fills the width: ${m.width} of ${m.viewW}`);
  check(m.left <= 1, `the card starts at the left edge: ${m.left}`);
  check(
    parseFloat(m.radius[0]) > 0 && parseFloat(m.radius[1]) > 0,
    `the top corners are rounded: ${m.radius[0]} / ${m.radius[1]}`,
  );
  check(
    parseFloat(m.radius[2]) === 0 && parseFloat(m.radius[3]) === 0,
    `the bottom corners are square: ${m.radius[2]} / ${m.radius[3]}`,
  );
  check(m.handleContent !== "none", `the drag handle bar is drawn: ${m.handleContent}`);
  check(
    parseFloat(m.handleW) >= 32 && parseFloat(m.handleH) >= 3,
    `the drag handle bar has size: ${m.handleW} x ${m.handleH}`,
  );

  await page.screenshot({ path: join(outDir, "limits-bottom-phone.png") });
  await context.close();
}

// ── A desktop window ───────────────────────────────────────────────────────
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await openSheet(context);
  const m = await page.evaluate(readCard);
  console.log("desktop:", JSON.stringify(m));

  check(m.bottom < m.viewH - 20, `the card floats clear of the bottom: ${m.bottom} of ${m.viewH}`);
  check(m.top > 20, `the card floats clear of the top: ${m.top}`);
  check(
    parseFloat(m.radius[2]) > 0 && parseFloat(m.radius[3]) > 0,
    `all four corners stay rounded: ${m.radius[2]} / ${m.radius[3]}`,
  );
  check(m.handleContent === "none", `no drag handle bar on a desktop: ${m.handleContent}`);

  await page.screenshot({ path: join(outDir, "limits-float-desktop.png") });
  await context.close();
}

await browser.close();
console.log(fails.length ? "\nFAILED: " + fails.length : "\nALL CHECKS PASS");
process.exit(fails.length ? 1 : 0);

// Prove the two sign-in faults are gone, in the REAL app.
//
// A static HTML probe is not valid here: the notice, the sheet and the pill
// only exist after the app decides the plan. So this drives the running dev
// server with a browser at phone size.
//
// It checks two things:
//   1. the fourth card opens the ONE limits sheet, not the settings screen;
//   2. the header pill answers a 44px tall tap on a phone.
import { chromium } from "playwright";
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
const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
await context.addInitScript((prefsJson) => {
  window.localStorage.setItem("credenza-prefs-v1", prefsJson);
}, JSON.stringify(PREFS));

// The server refuses the fourth card with this exact body. Nothing else in the
// app may treat a 401 as a sign-in refusal, so the code matters.
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

// The privacy line covers the lower screen on a phone. Answer it first, or
// the taps below land on the banner instead of the app.
const privacy = page.getByRole("button", { name: "Accept" }).first();
if (await privacy.isVisible().catch(() => false)) {
  await privacy.click();
  await page.waitForTimeout(500);
}

// ── Fault 1: the fourth card ────────────────────────────────────────────────
// An empty shelf on a phone has no paste box on screen. The box lives in a
// sheet behind this button, so the probe opens it the way a person does.
const openBox = page.getByRole("button", { name: "Paste your first link" }).first();
if (await openBox.isVisible().catch(() => false)) {
  await openBox.click();
  await page.waitForTimeout(900);
}
// An empty shelf offers a one-line field. A shelf with cards offers the big
// paste box. Take whichever one this screen shows.
const box = page.locator("textarea, input.cz-empty-hero-search-field").first();
await box.waitFor({ state: "visible", timeout: 15000 });
await box.click();
// The field starts a card on a PASTE, not on Enter. Typing the link and
// pressing Enter does nothing, so the probe pastes the way a person does.
await page.evaluate((link) => {
  const el = document.querySelector("textarea, input.cz-empty-hero-search-field");
  const data = new DataTransfer();
  data.setData("text/plain", link);
  el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
}, "https://weidian.com/item.html?itemID=7300000000");
await page.waitForTimeout(1500);
// A paste opens the stash sheet. The card is only read after this button.
const stash = page.locator(".cz-stash-primary").first();
if (await stash.isVisible().catch(() => false)) {
  await stash.click();
  await page.waitForTimeout(1000);
}
await page.waitForTimeout(4000);

const noticeText = await page.evaluate(() => document.body.innerText);
check(/Sign in to read this link/.test(noticeText), "the refusal notice appears");

// The wall opens the sheet by itself. Close it, then prove the notice's own
// button re-opens the SAME sheet, so the person is never left without a way
// back to the answer.
const autoOpen = await page.locator(".cz-limits").first().isVisible().catch(() => false);
check(autoOpen, "the sheet opens at the refusal itself");
await page.keyboard.press("Escape");
await page.waitForTimeout(700);

const action = page.getByRole("button", { name: "What do I get?" }).first();
check(await action.isVisible(), "the notice offers 'What do I get?'");
await action.click();
await page.waitForTimeout(900);

const sheet = await page.evaluate(() => {
  const el = document.querySelector(".cz-limits");
  if (!el) return null;
  const shell = el.closest("[role='dialog']") || el.parentElement;
  return { title: (shell && shell.innerText.split("\n")[0]) || "", text: el.innerText };
});
check(!!sheet, "the one limits sheet opens");
check(!!sheet && /free card/i.test(sheet.title), "the sheet names the third free card: " + (sheet && sheet.title));
check(!/\/settings/.test(page.url()), "the app does not jump to the settings screen: " + page.url());
check(!!sheet && /Sign in/.test(sheet.text), "the sheet holds the Sign in button");
await page.screenshot({ path: join(outDir, "signin-wall-sheet.png") });

await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// ── Fault 2: the pill tap area ──────────────────────────────────────────────
const tap = await page.evaluate(() => {
  const el = document.querySelector(".cz-limit-pill");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el, "::after");
  const grow = (v) => Math.abs(parseFloat(v) || 0);
  return {
    drawnHeight: Math.round(r.height),
    tapHeight: Math.round(r.height + grow(cs.top) + grow(cs.bottom)),
    tapWidth: Math.round(r.width + grow(cs.left) + grow(cs.right)),
    label: el.innerText,
  };
});
check(!!tap, "the pill renders on a phone");
check(!!tap && tap.drawnHeight === 30, "the drawn pill stays 30px: " + (tap && tap.drawnHeight));
check(!!tap && tap.tapHeight >= 44, "the pill answers a 44px tall tap: " + (tap && tap.tapHeight));
check(!!tap && tap.tapWidth >= 44, "the pill answers a 44px wide tap: " + (tap && tap.tapWidth));

// The grown ring must really receive the press, not just measure well.
const hit = await page.evaluate(() => {
  const el = document.querySelector(".cz-limit-pill");
  const r = el.getBoundingClientRect();
  const target = document.elementFromPoint(r.left + r.width / 2, r.bottom + 5);
  return !!(target && (target === el || el.contains(target)));
});
check(hit, "a press 5px below the drawn pill reaches the pill");

await page.screenshot({ path: join(outDir, "signin-wall-pill.png") });

await browser.close();
console.log(fails.length ? "\nFAILED: " + fails.length : "\nALL CHECKS PASS");
process.exit(fails.length ? 1 : 0);

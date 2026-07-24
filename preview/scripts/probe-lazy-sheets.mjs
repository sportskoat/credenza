// Lazy sheets: each dialog must open from its chunk without a console error.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((shelfJson) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
}, JSON.stringify(items));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});

await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const out = {};

// Profile sheet (avatar, top right).
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(1200);
out.profile = await page.evaluate(() => !!document.querySelector(".cz-profile-themes"));
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// Agent sheet: Profile → Default agent.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(1000);
await page.getByText("Default agent").click();
await page.waitForTimeout(1200);
out.agent = await page.evaluate(() => !!document.querySelector("[role='radiogroup']"));
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// Body profile sheet: Profile → Your sizes.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(1000);
await page.getByText("Your sizes").click();
await page.waitForTimeout(1200);
out.body = await page.evaluate(() =>
  [...document.querySelectorAll("dialog")].some((d) => d.open && /measurements/i.test(d.textContent))
);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// Fit prefs sheet: Profile → Fit preferences.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(1000);
await page.getByText("Fit preferences").click();
await page.waitForTimeout(1200);
out.fitPrefs = await page.evaluate(() =>
  [...document.querySelectorAll("dialog")].some((d) => d.open && /Fit preferences/i.test(d.textContent))
);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// Import sheet: Profile → Import & backup.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(1000);
await page.getByText(/Import & backup/).click();
await page.waitForTimeout(1200);
out.import = await page.evaluate(() => !!document.querySelector(".cz-import-paste"));
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// Capture sheet is phone-only; check it in a 390px context.
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
await phone.addInitScript(() => {
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
});
const p2 = await phone.newPage();
p2.on("pageerror", (e) => errors.push("phone pageerror: " + e.message));
await p2.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(3000);
await p2.getByRole("button", { name: "Open the capture sheet" }).click();
await p2.waitForTimeout(1200);
out.capture = await p2.evaluate(() => !!document.querySelector(".cz-stash-paste"));

out.errors = errors.slice(0, 6);
console.log(JSON.stringify(out, null, 1));
await browser.close();

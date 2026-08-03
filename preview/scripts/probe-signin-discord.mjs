// Proof shots for the Discord sign-in button + Google/Discord logos
// (Kyle 2026-08-03). Opens the sign-in modal the way a person does —
// avatar menu, "Sign in" — on a phone and a desktop, and confirms both
// OAuth buttons and both brand marks are on the sheet.
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

async function openModal(context) {
  await context.addInitScript((prefsJson) => {
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  }, JSON.stringify(PREFS));
  const page = await context.newPage();
  await page.goto("http://localhost:5347", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const privacy = page.getByRole("button", { name: "Accept" }).first();
  if (await privacy.isVisible().catch(() => false)) {
    await privacy.click();
    await page.waitForTimeout(500);
  }
  await page.locator(".cz-avatar").first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /sign in/i }).last().click();
  await page.locator(".cz-signin").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(600);
  return page;
}

async function prove(page, label) {
  const google = page.getByRole("button", { name: "Continue with Google" });
  const discord = page.getByRole("button", { name: "Continue with Discord" });
  check(await google.isVisible(), `${label}: Continue with Google is on the sheet`);
  check(await discord.isVisible(), `${label}: Continue with Discord is on the sheet`);
  check(
    (await google.locator("svg.cz-signin-oauth-logo").count()) === 1,
    `${label}: the Google button carries its logo`,
  );
  check(
    (await discord.locator("svg.cz-signin-oauth-logo").count()) === 1,
    `${label}: the Discord button carries its logo`,
  );
  await page.screenshot({ path: join(outDir, `signin-discord-${label}.png`) });
}

{
  const context = await browser.newContext({
    ...devices["iPhone 14 Pro"],
    isMobile: false,
    hasTouch: true,
    viewport: { width: 402, height: 874 },
  });
  await prove(await openModal(context), "phone");
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await prove(await openModal(context), "desktop");
  await context.close();
}

await browser.close();
console.log(fails.length ? "\nFAILED: " + fails.length : "\nALL CHECKS PASS");
process.exit(fails.length ? 1 : 0);

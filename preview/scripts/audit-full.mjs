// Full audit pass: screenshots + functional probes across states and viewports.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);
const prefs = {
  viewMode: "cards", sortMode: "recent", theme: "dark", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {},
};

const consoleIssues = [];
const pageErrors = [];
const results = [];

function wire(page, tag) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      consoleIssues.push(`[${tag}] ${m.type()}: ${m.text().slice(0, 200)}`);
    }
  });
  page.on("pageerror", (e) => pageErrors.push(`[${tag}] ${e.message.slice(0, 300)}`));
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, `audit-${name}.png`) });
  results.push(`shot: ${name}`);
}

async function newCtx(browser, { viewport, shelf, prefsObj, mobile = false }) {
  const context = await browser.newContext({
    viewport,
    ...(mobile ? { hasTouch: true, isMobile: true } : {}),
  });
  await context.addInitScript(
    ({ shelfJson, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelfJson: JSON.stringify(shelf), prefsJson: JSON.stringify(prefsObj) }
  );
  return context;
}

const browser = await chromium.launch();

// ---------- DESKTOP DARK ----------
{
  const ctx = await newCtx(browser, {
    viewport: { width: 1440, height: 900 }, shelf: items, prefsObj: prefs,
  });
  const page = await ctx.newPage();
  wire(page, "desktop");
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await shot(page, "01-shelf-dark");

  // Probe 1: type in the desk search — does the capture sheet open? (Kyle's bug)
  const field = page.locator(".cz-desk-search-field");
  await field.click();
  await page.keyboard.type("denim jacket", { delay: 90 });
  await page.waitForTimeout(600);
  const sheetOpen = await page.locator(".cz-capture-shell").count();
  const sheetText = await page.getByText("Stash to shelf").count();
  results.push(`PROBE search-typing: capture-shell count=${sheetOpen} stash-to-shelf text=${sheetText} (0/0 = bug not reproduced)`);
  const searchVal = await field.inputValue();
  results.push(`PROBE search-typing: field value="${searchVal}" (expect "denim jacket")`);
  await shot(page, "02-search-typing");
  // visible cards after filter
  const visibleCards = await page.locator(".cz-carousel-card:visible, .cz-shelf-card:visible").count();
  results.push(`PROBE search-filter: visible card-ish elements=${visibleCards}`);
  await field.fill("");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Card back
  try {
    await page.getByText("FLIP FOR MORE").first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(1200);
    await shot(page, "03-card-back");
  } catch (e) { results.push("card-back flip FAILED: " + e.message.slice(0, 120)); }

  // Status picker open
  try {
    await page.locator(".cz-status-track-btn").first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(700);
    await shot(page, "04-status-open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } catch (e) { results.push("status open FAILED: " + e.message.slice(0, 120)); }

  // Category menu open
  try {
    await page.locator(".cz-cat-select-row").first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(700);
    await shot(page, "05-category-open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } catch (e) { results.push("category open FAILED: " + e.message.slice(0, 120)); }

  // Card actions + delete flow (confirmation probe)
  try {
    const baseCount = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1")).length);
    await page.getByLabel("Card actions").first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(500);
    await shot(page, "06-card-actions");
    const removeBtn = page.getByText(/Remove card/i).first();
    if (await removeBtn.count()) {
      await removeBtn.click({ force: true });
      await page.waitForTimeout(600);
      await shot(page, "07-after-remove-click");
      const afterCount = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1")).length);
      const dialogUp = await page.locator("[role='dialog'], [role='alertdialog']").count();
      results.push(`PROBE delete: items ${baseCount} -> ${afterCount}, dialog count=${dialogUp} (deleted with no confirm if count dropped and dialog=0)`);
    } else {
      results.push("PROBE delete: no Remove card button found");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } catch (e) { results.push("actions/delete FAILED: " + e.message.slice(0, 150)); }

  // Close overlay if open
  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } catch {}

  // Profile sheet
  try {
    await page.getByLabel("Profile").first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(900);
    await shot(page, "08-profile");
    // open a fit preferences section if visible
    const fitRow = page.getByText(/fit preferences/i).first();
    if (await fitRow.count()) {
      await fitRow.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      await shot(page, "09-profile-fit");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  } catch (e) { results.push("profile FAILED: " + e.message.slice(0, 120)); }

  // Carousel view
  try {
    await page.getByLabel("Carousel view").click({ force: true, timeout: 3000 });
    await page.waitForTimeout(1200);
    await shot(page, "10-carousel-view");
    await page.getByLabel("Card view").click({ force: true, timeout: 3000 });
    await page.waitForTimeout(800);
  } catch (e) { results.push("carousel view FAILED: " + e.message.slice(0, 120)); }

  // Hauls tab
  try {
    await page.locator("#view-tab-hauls").click({ force: true, timeout: 3000 });
    await page.waitForTimeout(1000);
    await shot(page, "11-hauls");
    await page.locator("#view-tab-shelf").click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
  } catch (e) { results.push("hauls FAILED: " + e.message.slice(0, 120)); }

  await ctx.close();
}

// ---------- DESKTOP LIGHT ----------
{
  const ctx = await newCtx(browser, {
    viewport: { width: 1440, height: 900 }, shelf: items,
    prefsObj: { ...prefs, theme: "light" },
  });
  const page = await ctx.newPage();
  wire(page, "light");
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await shot(page, "12-shelf-light");
  try {
    await page.getByText("FLIP FOR MORE").first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(1200);
    await shot(page, "13-card-back-light");
  } catch {}
  await ctx.close();
}

// ---------- MOBILE ----------
{
  const ctx = await newCtx(browser, {
    viewport: { width: 390, height: 844 }, shelf: items, prefsObj: prefs, mobile: true,
  });
  const page = await ctx.newPage();
  wire(page, "mobile");
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await shot(page, "14-mobile-shelf");
  try {
    await page.getByText("FLIP FOR MORE").first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(1200);
    await shot(page, "15-mobile-card-back");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } catch (e) { results.push("mobile flip FAILED: " + e.message.slice(0, 120)); }
  try {
    await page.getByLabel("Open the capture sheet").click({ force: true, timeout: 3000 });
    await page.waitForTimeout(800);
    await shot(page, "16-mobile-capture");
    await page.keyboard.press("Escape");
  } catch (e) { results.push("mobile capture FAILED: " + e.message.slice(0, 120)); }
  await ctx.close();
}

// ---------- EMPTY STATE ----------
{
  const ctx = await newCtx(browser, {
    viewport: { width: 1440, height: 900 }, shelf: [], prefsObj: prefs,
  });
  const page = await ctx.newPage();
  wire(page, "empty");
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await shot(page, "17-empty-hero");
  await ctx.close();
}

await browser.close();

console.log("=== RESULTS ===");
results.forEach((r) => console.log(r));
console.log("=== PAGE ERRORS ===");
pageErrors.forEach((r) => console.log(r));
console.log(pageErrors.length ? `${pageErrors.length} page errors` : "no page errors");
console.log("=== CONSOLE ERRORS/WARNINGS ===");
consoleIssues.forEach((r) => console.log(r));
console.log(consoleIssues.length ? `${consoleIssues.length} console issues` : "no console issues");

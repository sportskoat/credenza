// First-run probe (2026-07-25): what a brand-new customer sees.
// Empty shelf, onboarding not done, then the Stash capture flow:
// dialog, a garbage link (error state), a plausible link (enrichment
// feedback), and the Hauls empty state.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";

const browser = await chromium.launch();

async function newFreshPage(contextOpts) {
  const context = await browser.newContext(contextOpts);
  // No init script: a real first run has an empty localStorage.
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  return { context, page };
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name + ".png") });
  console.log("shot:", name);
}

// ---- Phone first run ----
{
  const { context, page } = await newFreshPage(devices["iPhone 15 Pro"]);
  await shot(page, "fr-phone-1-landing");

  // Dismiss onboarding if it appears (tap through or close).
  const skip = page.getByRole("button", { name: /skip|get started|done|close/i }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(800);
    await shot(page, "fr-phone-2-after-onboarding");
  }

  // Open the Stash capture flow.
  const stash = page.getByRole("button", { name: /stash/i }).first();
  if (await stash.isVisible().catch(() => false)) {
    await stash.click();
    await page.waitForTimeout(900);
    await shot(page, "fr-phone-3-stash-open");

    // Garbage input → error state.
    const field = page.locator("textarea, input[type='url'], input[type='text']").last();
    if (await field.isVisible().catch(() => false)) {
      await field.fill("not a link at all");
      await page.waitForTimeout(600);
      await shot(page, "fr-phone-4-stash-garbage");

      // Plausible link → whatever the customer sees next.
      await field.fill("https://item.taobao.com/item.htm?id=123456789");
      await page.waitForTimeout(600);
      await shot(page, "fr-phone-5-stash-link");
    }
  }
  await context.close();
}

// ---- Desktop first run ----
{
  const { context, page } = await newFreshPage({ viewport: { width: 1440, height: 900 } });
  await shot(page, "fr-desktop-1-landing");

  const skip = page.getByRole("button", { name: /skip|get started|done|close/i }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(800);
    await shot(page, "fr-desktop-2-after-onboarding");
  }

  const stash = page.getByRole("button", { name: /stash/i }).first();
  if (await stash.isVisible().catch(() => false)) {
    await stash.click();
    await page.waitForTimeout(900);
    await shot(page, "fr-desktop-3-stash-open");
  }

  // Hauls empty state.
  const hauls = page.getByRole("tab", { name: /hauls/i }).first()
    .or(page.getByText(/^Hauls/).first());
  if (await hauls.isVisible().catch(() => false)) {
    await hauls.click().catch(() => {});
    await page.waitForTimeout(900);
    await shot(page, "fr-desktop-4-hauls-empty");
  }
  await context.close();
}

await browser.close();
console.log("done");

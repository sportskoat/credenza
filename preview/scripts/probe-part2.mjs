// Part 2 verify: sample shelf renders as one fashion haul, the Agent sheet
// has no referral inputs, and the Buy disclosure shows on a card back.
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
});
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// Empty shelf → add samples.
const samplesBtn = page.getByRole("button", { name: /sample/i }).first();
if (await samplesBtn.count()) {
  await samplesBtn.click();
  await page.waitForTimeout(2500);
}
const shelf = await page.evaluate(() => ({
  cards: document.querySelectorAll(".cz-grid-card, .cz-carousel-card").length,
  haulsTab: document.querySelector('[id="view-tab-hauls"]')?.textContent?.trim() || null,
}));
console.log("shelf:", JSON.stringify(shelf));

// Hauls tab should show one haul with 18 items.
await page.getByRole("tab", { name: /Hauls/i }).click();
await page.waitForTimeout(1200);
const haulMeta = await page.evaluate(() => document.querySelector(".cz-haul-card-meta")?.textContent?.trim());
console.log("haul:", haulMeta);
await page.screenshot({ path: "/tmp/part2-samples.png" });

// Agent sheet: no referral inputs anywhere.
// Desktop viewport: the mobile bottom bar is hidden. Open Profile first.
await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Default agent/ }).click();
await page.waitForTimeout(1200);
const sheet = await page.evaluate(() => ({
  referralInputs: [...document.querySelectorAll("input")].filter((i) =>
    (i.placeholder || "").includes("referral")
  ).length,
  disclosure: !!document.body.textContent.match(/Disclosure: Buy links may include a referral code/),
}));
console.log("agent sheet:", JSON.stringify(sheet));
await page.screenshot({ path: "/tmp/part2-agentsheet.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// Card back: Buy disclosure line. Back to the Shelf tab first.
await page.getByRole("tab", { name: /^Shelf/ }).click();
await page.waitForTimeout(1200);
await page.locator(".cz-carousel-card[data-foreground='true']").click({ force: true });
await page.waitForTimeout(1800);
const buy = await page.evaluate(() => {
  const d = document.querySelector(".cz-buy-disclosure");
  return d ? d.textContent.trim() : null;
});
console.log("buy disclosure:", buy);
await browser.close();

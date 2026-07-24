// Part 6 verify: the six new agents open the correct destination (the plan
// gate), the outbound event records, and the activation milestones fire —
// against the dev server on :5173.
import { chromium } from "playwright";

const WEIDIAN_URL = "https://weidian.com/item.html?itemID=7234567890";

const EXPECTED = {
  mulebuy: "https://mulebuy.com/product/?id=7234567890&shop_type=weidian",
  joyagoo: "https://www.joyagoo.com/en/page/buy?url=" + encodeURIComponent(WEIDIAN_URL),
  cnfans: "https://cnfans.com/product/?platform=WEIDIAN&id=7234567890",
  hoobuy: "https://hoobuy.com/product/2/7234567890",
  oopbuy: "https://oopbuy.com/product/2/7234567890",
  allchinabuy: "https://www.allchinabuy.com/en/page/buy/?url=" + encodeURIComponent(WEIDIAN_URL),
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
await ctx.addInitScript(() => {
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
  window.localStorage.setItem(
    "credenza-fashion-items-v1",
    JSON.stringify([
      {
        id: "p1",
        createdAt: 1,
        updatedAt: 1,
        rawText: "https://weidian.com/item.html?itemID=7234567890",
        url: "https://weidian.com/item.html?itemID=7234567890",
        type: "link",
        host: "weidian.com",
        title: "Probe jacket",
        tags: [],
        gallery: [],
        links: [],
        price: 229,
        currency: "CNY",
        category: "outerwear",
        project: "",
        findStatus: "qc",
      },
    ])
  );
});
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const log = (name, value) => console.log(name + ":", value);
let failures = 0;
const check = (name, ok, detail) => {
  log(name + (ok ? " OK" : " FAIL"), detail === undefined ? "" : detail);
  if (!ok) failures++;
};

// Popups (window.open) land as new pages in the context. Compare URLs with
// the www. stripped — joyagoo normalizes the host behind a redirect.
const bare = (u) => String(u || "").replace(/^(https?:\/\/)www\./, "$1");

// 1. Stash a link by pasting into the desktop search field (a trusted paste,
// clipboard permission granted) → activation "capture".
await page.evaluate(() =>
  navigator.clipboard.writeText("https://weidian.com/item.html?itemID=9999999999")
);
const search = page.getByLabel("Search your shelf").first();
await search.waitFor({ timeout: 10000 });
await search.click();
await page.keyboard.press("Meta+v");
await page.waitForTimeout(900);

// 2. Agent sheet lists the six new agents.
await page.getByLabel("Profile").first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Default agent/ }).click();
await page.waitForTimeout(700);
const radioNames = await page
  .getByRole("radiogroup", { name: "Preferred buying agent" })
  .locator("[role='radio']")
  .allTextContents();
for (const id of Object.keys(EXPECTED)) {
  const label = { mulebuy: "Mulebuy", joyagoo: "Joyagoo", cnfans: "CNFans", hoobuy: "Hoobuy", oopbuy: "Oopbuy", allchinabuy: "AllChinaBuy" }[id];
  check("picker lists " + label, radioNames.some((t) => t.includes(label)), "");
}

// 3. For each new agent: select, close, flip the card, Buy, assert the URL.
for (const [id, expected] of Object.entries(EXPECTED)) {
  const label = { mulebuy: "Mulebuy", joyagoo: "Joyagoo", cnfans: "CNFans", hoobuy: "Hoobuy", oopbuy: "Oopbuy", allchinabuy: "AllChinaBuy" }[id];
  await page.getByRole("radio", { name: new RegExp(label) }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  // Flip the foreground card to reach the back-face Buy button.
  const card = page.locator(".cz-carousel-card[data-foreground='true']").first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(1000);
  }
  // Wait for the popup page event per round — a shared array races the click.
  const popupPromise = ctx.waitForEvent("page", { timeout: 6000 }).catch(() => null);
  await page.getByRole("button", { name: /^Buy/ }).first().click();
  const popup = await popupPromise;
  const got = popup ? popup.url() : "(no popup)";
  check("buy via " + label, bare(got) === bare(expected), got);
  // Close the popup tab if one opened.
  const pages = ctx.pages();
  for (const p of pages) if (p !== page) await p.close();
  // Back to the front face for the next round.
  const flipped = page.locator(".cz-carousel-card[data-foreground='true']").first();
  if (await flipped.count()) {
    await flipped.click();
    await page.waitForTimeout(600);
  }
  // Reopen the agent sheet for the next pick.
  await page.getByLabel("Profile").first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Default agent/ }).click();
  await page.waitForTimeout(500);
}
await page.keyboard.press("Escape");

// 4. The events recorded: outbound log + activation milestones.
const events = await page.evaluate(() => ({
  outbound: JSON.parse(window.localStorage.getItem("credenza-fashion-outbound-v1") || "[]"),
  activation: JSON.parse(window.localStorage.getItem("credenza-fashion-activation-v1") || "{}"),
}));
check(
  "outbound recorded 6 wrapped clicks",
  events.outbound.length === 6 && events.outbound.every((e) => e.wrapped && e.marketplace === "weidian" && e.item),
  JSON.stringify(events.outbound.map((e) => e.agentId))
);
check(
  "outbound stores no raw URL",
  !JSON.stringify(events.outbound).includes("weidian.com"),
  ""
);
check(
  "activation capture + buyClick",
  Boolean(events.activation.capture && events.activation.buyClick),
  JSON.stringify(events.activation)
);

console.log(failures === 0 ? "PROBE-PART6: ALL GREEN" : "PROBE-PART6: " + failures + " FAILURES");
await browser.close();
process.exit(failures === 0 ? 0 : 1);

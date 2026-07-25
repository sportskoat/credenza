// Light theme ("Gallery") audit. The dark "Blackout" theme gets all the
// attention; customers who pick Gallery must get the same finished look.
// Seeds a stocked shelf + light theme, then screenshots: shelf, card back,
// capture sheet, profile sheet, empty-shelf hero. Mobile + desktop.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const SHOTS = new URL("./ui-audit/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const PREFS = {
  viewMode: "cards",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", waist: 80, chest: 96, height: 178, weight: 75 },
  measureUnits: "cm",
  onboardingDone: true,
  fitPrefs: {},
};
const SHELF = [
  {
    id: "probe-yupoo",
    title: "Stone Island crewneck",
    url: "https://x.yupoo.com/photos/topstoney/albums/12345678",
    platform: "yupoo",
    priceCny: 280,
    status: "want",
    starred: true,
    addedAt: Date.now() - 86400000,
    canonicalKey: "yupoo:topstoney/12345678",
  },
  {
    id: "probe-weidian",
    title: "Vintage wash jeans",
    url: "https://weidian.com/item.html?itemID=7234567890",
    platform: "weidian",
    priceCny: 199,
    status: "bought",
    starred: false,
    addedAt: Date.now() - 3600000,
    canonicalKey: "weidian:7234567890",
  },
];

const browser = await chromium.launch();

async function run(name, viewport, mobile) {
  const ctx = await browser.newContext({
    viewport,
    ...(mobile
      ? {
          isMobile: true,
          hasTouch: true,
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        }
      : {}),
  });
  await ctx.addInitScript(
    ({ prefs, shelf }) => {
      localStorage.setItem("credenza-prefs-v1", JSON.stringify(prefs));
      localStorage.setItem("credenza-fashion-items-v1", JSON.stringify(shelf));
    },
    { prefs: PREFS, shelf: SHELF }
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", name, String(e).slice(0, 150)));
  const shot = (n) => page.screenshot({ path: `${SHOTS}g-${name}-${n}.png` });

  await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot("01-shelf");

  // Card back (flip the foreground/first card).
  const fg = page.locator("[id^='card-'][data-foreground='true']").first();
  const anyCard = page.locator("[id^='card-']").first();
  const target = (await fg.count()) ? fg : anyCard;
  const flip = target.getByRole("button", { name: /Flip card for details/ });
  if (await flip.isVisible().catch(() => false)) {
    await flip.click();
    await page.waitForTimeout(900);
    await shot("02-card-back");
    const back = target.getByRole("button", { name: "Flip back" });
    if (await back.isVisible().catch(() => false)) { await back.click(); await page.waitForTimeout(700); }
  } else {
    await target.click();
    await page.waitForTimeout(900);
    await shot("02-card-open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
  }

  // Profile sheet.
  await page.getByRole("button", { name: "Profile" }).click();
  await page.waitForTimeout(800);
  await shot("03-profile");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // Contrast probe: sample key text elements, report fg/bg pairs.
  const contrast = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { color: cs.color, bg: cs.backgroundColor };
    };
    return {
      body: pick("body"),
      tab: pick(".cz-tab, [role='tab']"),
      cardTitle: pick("[id^='card-']"),
    };
  });
  console.log(name, "contrast:", JSON.stringify(contrast));
  await ctx.close();
  console.log("done:", name);
}

await run("mobile", { width: 390, height: 844 }, true);
await run("desktop", { width: 1440, height: 900 }, false);
await browser.close();

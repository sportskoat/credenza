// Lane B proof: photo viewer caption + X in both themes, strip without trash.
import { webkit } from "playwright";
const baseUrl = "http://localhost:5231/";
const out = "/Users/kylewensel/.buzz/.scratch/laneb/";
const now = Date.now();
const photo = (seed) => "https://picsum.photos/seed/" + seed + "/600/800";
const item = {
  id: "laneb1", createdAt: now, updatedAt: now,
  url: "https://weidian.com/item.html?itemID=7744643744",
  title: "M33821-133E Heavy-Weight Casual T-Shirt",
  image: photo("laneb-a"),
  gallery: [photo("laneb-b"), photo("laneb-c"), photo("laneb-d")],
  links: [{ url: "https://weidian.com/item.html?itemID=7744643744", role: "buy" }],
  price: 179, currency: "CNY", seller: "mook", category: "shirt", size: "L",
  colorway: "White", weightGrams: 420, findStatus: "want",
};
const mkPrefs = (theme) => ({
  viewMode: "grid", sortMode: "recent", colorwayVersion: 4, preferredAgent: null,
  affiliateCodes: {}, bodyProfile: { usualSize: "L", chest: 40, waist: 32 },
  measureUnits: "in", onboardingDone: true, theme,
});
const browser = await webkit.launch();

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await ctx.addInitScript(
    ({ s, p }) => {
      localStorage.setItem("credenza-fashion-items-v1", s);
      localStorage.setItem("credenza-prefs-v1", p);
    },
    { s: JSON.stringify([item]), p: JSON.stringify(mkPrefs(theme)) }
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", theme, e.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  // Open the card detail.
  await page.locator("article").first().click({ force: true });
  await page.waitForTimeout(2500);
  // The thumbnail strip, before opening the viewer.
  const strip = page.locator(".cz-edit-photos");
  if (await strip.count()) {
    await strip.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await strip.screenshot({ path: out + "strip-" + theme + ".png" });
    console.log(theme, "strip trash count:", await page.locator(".cz-edit-photo-delete").count());
  } else {
    console.log(theme, "NO STRIP FOUND");
  }
  // Open the big photo view from a strip tile.
  const tile = page.getByRole("button", { name: "View photo 2 full screen" });
  if (await tile.count()) {
    await tile.click({ force: true });
  } else {
    await page.getByRole("button", { name: "Open photo 1 full screen" }).first().click({ force: true });
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + "viewer-" + theme + ".png" });
  // The delete confirm text, on the same dark backdrop.
  const del = page.getByRole("button", { name: "Delete", exact: true });
  if (await del.count()) {
    await del.click({ force: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + "viewer-confirm-" + theme + ".png" });
  } else {
    console.log(theme, "NO DELETE BUTTON IN VIEWER");
  }
  await ctx.close();
}
await browser.close();
console.log("done");

// Kyle 2026-07-29: tapping a size left the numbers on the recommended size.
// This reads the Garment number and the fit-read row out of the LIVE page
// after each tap — not the panel's whole text, which changes on any tap.
import { webkit } from "playwright";
const baseUrl = process.argv[2] || "http://localhost:5371";
const now = Date.now();
const CHART = "Size  Chest  Length\nM  116  70\nL  120  72\nXL  124  74";
const items = [{
  id: "tap-check", createdAt: now, updatedAt: now,
  url: "https://weidian.com/item.html?itemID=7812124117",
  title: "Fit read tap check", image: "https://picsum.photos/seed/tap/600/800",
  gallery: [], links: [{ url: "https://weidian.com/item.html?itemID=7812124117", role: "buy" }],
  price: 179, currency: "CNY", seller: "mook-offcical", category: "shirt",
  colorway: "White", weightGrams: 420, findStatus: "want", sizeNotes: CHART,
}];
const prefs = { viewMode: "grid", sortMode: "recent", colorwayVersion: 4, preferredAgent: null,
  affiliateCodes: {}, bodyProfile: { chest: 96, waist: 80, height: 178, weight: 75, usualSize: "M" }, measureUnits: "cm", onboardingDone: true, theme: "rainbow" };

const browser = await webkit.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
await ctx.addInitScript(({ s, p }) => {
  localStorage.setItem("credenza-fashion-items-v1", s);
  localStorage.setItem("credenza-prefs-v1", p);
}, { s: JSON.stringify(items), p: JSON.stringify(prefs) });
const page = await ctx.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);
await page.locator("article, .cz-photo-list-item").first().click({ force: true });
await page.waitForTimeout(1800);

// A shirt asks the taste question before it shows the confidence strip.
// Dismiss it so the strip's numbers are on screen to read.
const skip = page.locator('button', { hasText: /^Not sure yet$/ }).first();
if (await skip.count()) { await skip.click(); await page.waitForTimeout(800); }

const read = () => page.evaluate(() => {
  const cell = [...document.querySelectorAll(".cz-fit4-math-cell")].find((n) => n.textContent.startsWith("Garment"));
  return {
    garment: cell ? cell.querySelector(".cz-fit4-math-v").textContent : "",
    theirs: [...document.querySelectorAll(".cz-fitread-theirs")].map((n) => n.textContent),
    aside: (document.querySelector(".cz-sizing-aside") || {}).textContent || "",
    hero: (document.querySelector(".cz-sizing-value") || {}).textContent || "",
    strip: (document.querySelector(".cz-fit4") || {}).textContent || "NO STRIP",
  };
});
const tap = async (label) => {
  await page.evaluate((l) => {
    const c = [...document.querySelectorAll(".cz-sizing-chart .cz-sizing-cell")]
      .find((n) => n.querySelector(".cz-sizing-cell-k") && n.querySelector(".cz-sizing-cell-k").textContent === l);
    if (c) c.click();
  }, label);
  await page.waitForTimeout(700);
};

const results = [];
const check = (name, pass, detail) => { results.push(pass); console.log((pass ? "PASS  " : "FAIL  ") + name + " — " + detail); };

const start = await read();
console.log("STRIP:", JSON.stringify(start.strip));
check("no tap: the numbers show the recommended Medium", start.garment === "116cm", "garment " + start.garment + ", hero " + start.hero);

await tap("Large");
const large = await read();
check("tap Large: the garment number moves to 120cm", large.garment === "120cm", "garment " + large.garment);
check("tap Large: the fit read row moves too", large.theirs.includes("120cm") && !large.theirs.includes("116cm"), "theirs " + JSON.stringify(large.theirs));
check("tap Large: the qualifier still names our pick", large.aside === "your pick · we'd take the Medium", "aside " + JSON.stringify(large.aside));
await page.locator(".cz-dpanel, .cz-detail-scroll").first().screenshot({ path: ".verify-shots/tap-large.png" });

await tap("X-Large");
const xl = await read();
check("tap X-Large: the garment number moves to 124cm", xl.garment === "124cm", "garment " + xl.garment);

await tap("Medium");
const med = await read();
check("tap Medium: the qualifier agrees and names the room", med.aside === "we recommend this · 20cm of room", "aside " + JSON.stringify(med.aside));
check("tap Medium: the garment number returns to 116cm", med.garment === "116cm", "garment " + med.garment);
await page.locator(".cz-dpanel, .cz-detail-scroll").first().screenshot({ path: ".verify-shots/tap-medium.png" });

console.log("\nSUMMARY " + results.filter(Boolean).length + "/" + results.length + " pass");
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);

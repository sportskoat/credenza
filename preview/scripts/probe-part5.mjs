// Part 5 verify: the haul board (budget, parcel estimate, archive + the
// Archived toggle), the QC upgrades (cap counter, RL follow-up), and the
// carousel ARIA contract — against the dev server on :5173.
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true })
  );
  const item = (id, over = {}) => ({
    id,
    createdAt: 1,
    updatedAt: 1,
    rawText: "https://weidian.com/item.html?itemID=" + id,
    url: "https://weidian.com/item.html?itemID=" + id,
    type: "link",
    host: "weidian.com",
    title: "Probe jacket " + id,
    tags: [],
    gallery: [],
    links: [],
    price: 229,
    currency: "CNY",
    category: "outerwear",
    project: "Summer haul",
    findStatus: "qc",
    ...over,
  });
  window.localStorage.setItem(
    "credenza-fashion-items-v1",
    JSON.stringify([item("p1"), item("p2", { price: 100 })])
  );
});
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const log = (name, value) => console.log(name + ":", value);

// Carousel ARIA contract (Part 5 a11y).
const aria = await page.evaluate(() => {
  const box = document.querySelector("[role='listbox'][aria-label='Card carousel']");
  return {
    activedescendant: box ? box.getAttribute("aria-activedescendant") : null,
    orientation: box ? box.getAttribute("aria-orientation") : null,
  };
});
log("carousel aria", JSON.stringify(aria));

// Open the haul from the Hauls tab.
await page.getByRole("tab", { name: /Hauls/ }).click();
await page.waitForTimeout(600);
await page.locator(".cz-haul-card[data-haul-name='Summer haul']").click();
await page.waitForTimeout(900);
log("haul open", await page.locator(".cz-haul-open-title").textContent());

// Budget: set 200 USD, expect the spent line.
await page.getByRole("button", { name: "Set a budget" }).click();
await page.locator("#cz-haul-budget-input").fill("200");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(500);
const budgetLine = await page.locator(".cz-haul-board-stat").first().textContent();
log("budget line", budgetLine.trim());

// Parcel: weight prefilled from the pipeline, dims + packaging give a
// chargeable estimate with the agent disclaimer.
await page.getByRole("button", { name: "Estimate the parcel" }).click();
const prefill = await page.locator("#cz-haul-parcel-weight").inputValue();
await page.getByLabel("Length (cm)").fill("40");
await page.getByLabel("Width (cm)").fill("30");
await page.getByLabel("Height (cm)").fill("20");
await page.waitForTimeout(300);
const parcel = await page.evaluate(() => ({
  result: (document.querySelector(".cz-haul-board-result") || {}).textContent || "",
  note: (document.querySelector(".cz-haul-board-note") || {}).textContent || "",
}));
log("parcel prefill weight (g)", prefill);
log("parcel result", JSON.stringify(parcel));
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(500);
const parcelLine = await page.locator(".cz-haul-board-stat").nth(1).textContent();
log("parcel line", parcelLine.trim());

// The record persisted.
const stored = await page.evaluate(() =>
  JSON.parse(window.localStorage.getItem("credenza-fashion-hauls-v1") || "[]")
);
log(
  "stored haul record",
  JSON.stringify({
    budget: stored[0] && stored[0].budget,
    parcel: stored[0] && stored[0].parcel,
    history: stored[0] && stored[0].history.length,
  })
);

// Archive: haul leaves the directory behind the Archived (1) toggle.
await page.getByRole("button", { name: "Archive" }).click();
await page.waitForTimeout(900);
const afterArchive = await page.evaluate(() => ({
  toggle: (document.querySelector(".cz-hauls-archived-toggle") || {}).textContent || null,
  cardVisible: !!document.querySelector(".cz-haul-card[data-haul-name='Summer haul']"),
}));
log("after archive", JSON.stringify(afterArchive));
await page.locator(".cz-hauls-archived-toggle").click();
await page.waitForTimeout(500);
const shownAgain = await page.evaluate(
  () => !!document.querySelector(".cz-haul-card[data-haul-name='Summer haul']")
);
log("archived haul shows after toggle", shownAgain);
// Open it and unarchive — it must come back to the plain directory.
await page.locator(".cz-haul-card[data-haul-name='Summer haul']").click();
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Unarchive" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /All hauls/ }).click();
await page.waitForTimeout(600);
const restored = await page.evaluate(() => ({
  toggle: !!document.querySelector(".cz-hauls-archived-toggle"),
  cardVisible: !!document.querySelector(".cz-haul-card[data-haul-name='Summer haul']"),
}));
log("after unarchive", JSON.stringify(restored));

// QC upgrades: open the haul, flip a card, check the cap counter and the RL
// follow-up chooser.
await page.locator(".cz-haul-card[data-haul-name='Summer haul']").click();
await page.waitForTimeout(900);
await page.locator(".cz-carousel-card[data-foreground='true']").first().click();
await page.waitForTimeout(1200);
const cap = await page.evaluate(
  () => (document.querySelector(".cz-qc-cap") || {}).textContent || null
);
log("qc cap counter", cap);
await page.getByRole("button", { name: /RL · send back/ }).click();
await page.waitForTimeout(500);
const followup = await page.evaluate(() => ({
  row: !!document.querySelector(".cz-qc-followup"),
  returned: ![...document.querySelectorAll("button")].every((b) => b.textContent !== "Mark returned"),
  exchange: ![...document.querySelectorAll("button")].every((b) => b.textContent !== "Ask for exchange"),
}));
log("rl follow-up", JSON.stringify(followup));
await page.getByRole("button", { name: "Ask for exchange" }).click();
await page.waitForTimeout(600);
const afterExchange = await page.evaluate(() => {
  const items = JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1") || "[]");
  const it = items.find((x) => x.findStatus === "bought" || x.findStatus === "rl");
  return it ? { status: it.findStatus, note: it.qcNote || "" } : null;
});
log("after exchange", JSON.stringify(afterExchange));

await browser.close();

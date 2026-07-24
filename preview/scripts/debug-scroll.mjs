// Verify: Kyle's clipboard prose in haul mode → ONE note card, full text kept.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(
  readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-22.json"), "utf8")
);
const prefs = {
  viewMode: "cards", sortMode: "recent", theme: "dark", colorwayVersion: 4,
  preferredAgent: null, affiliateCodes: {}, bodyProfile: { usualSize: "L" },
  measureUnits: "cm", onboardingDone: true, fitPrefs: {}, stashMode: "haul",
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

const PROSE = `─────────────────────────────────────────────────────────────────────────────────
❯ We should probably remove the ability for just anything to be put into the
  clipboard or really any place that imports. We should be looking at links.
  Raw text, yes, but is there a way to just differentiate? If I accidentally
  just throw something from my clipboard in there, is it still gonna process?
  How can we kind of ensure that we're not losing raw text with reddit notes
  and stuff, but keep out links and clipboards that have nothing to do with
  clothes? I`;

const count = () =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1")).length);
const base = await count();

await page.getByRole("button", { name: "Stash a link or note" }).first().click({ force: true });
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Reddit haul" }).click({ force: true });
await page.getByRole("textbox", { name: "Stash a link or note" }).fill(PROSE);
await page.getByRole("button", { name: "Stash", exact: true }).click({ force: true });
await page.waitForTimeout(1500);

const after = await count();
console.log("prose in haul mode:", base, "->", after, after === base + 1 ? "ONE CARD (fixed)" : "STILL SHREDDED");

const newest = await page.evaluate(() => {
  const list = JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1"));
  return list[0] && { title: list[0].title, type: list[0].type, note: (list[0].note || "").slice(0, 80) };
});
console.log("newest card:", JSON.stringify(newest));

// Bulleted list still splits per line?
const LIST = `- black hoodie size L
- white tee size M
- cargo pants 32`;
await page.getByRole("button", { name: "Stash a link or note" }).first().click({ force: true });
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Reddit haul" }).click({ force: true });
await page.getByRole("textbox", { name: "Stash a link or note" }).fill(LIST);
await page.getByRole("button", { name: "Stash", exact: true }).click({ force: true });
await page.waitForTimeout(1500);
const afterList = await count();
console.log("bulleted list:", after, "->", afterList, afterList === after + 3 ? "3 CARDS (kept)" : "CHANGED");

await browser.close();

// Kyle 2026-07-29, two phone screenshots: "no consistency of title.
// everything shrinks inward, see the difference, make it the same". One shot
// is the Hauls tab, the other is the Shelf tab.
//
// This probe measures both tabs at his phone width and reports two things:
// how wide the content runs, and what page heading each tab prints. Those are
// the two ways the tabs can differ.
//
//   (npx vite --port 5365 --strictPort &) ; sleep 8; node scripts/probe-tab-titles.mjs
import { webkit } from "playwright";
import { readFileSync } from "fs";

const baseUrl = process.argv[2] || "http://localhost:5365";
const tag = process.argv[3] || "after";
const dataUrl = readFileSync(new URL("./probe-photo.txt", import.meta.url), "utf8").trim();
const now = Date.now();

const items = [1, 2, 3, 4].map((n) => ({
  id: "tab-check-" + n,
  createdAt: now - n,
  updatedAt: now - n,
  url: "https://weidian.com/item.html?itemID=781212411" + n,
  title: n % 2 ? "Arc Shorts" : "Mutimer Dinner Jacket for the winter run",
  image: dataUrl,
  gallery: [dataUrl],
  links: [{ url: "https://weidian.com/item.html?itemID=781212411" + n, role: "buy" }],
  price: 249,
  currency: "CNY",
  seller: n % 2 ? "beverly-luxury-store" : "",
  category: "other",
  size: n % 2 ? "Large" : "Small",
  findStatus: n % 2 ? "want" : "bought",
  project: "casuals",
}));

const prefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  measureUnits: "in",
  onboardingDone: true,
  theme: "rainbow",
};

const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await context.addInitScript(
  ({ shelf, prefsJson }) => {
    window.localStorage.setItem("credenza-fashion-items-v1", shelf);
    window.localStorage.setItem("credenza-prefs-v1", prefsJson);
  },
  { shelf: JSON.stringify(items), prefsJson: JSON.stringify(prefs) }
);
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);

async function read(label) {
  await page.waitForTimeout(900);
  const seen = await page.evaluate(() => {
    const shell = document.querySelector(".cz-shell");
    const tabs = document.querySelector(".cz-view-tabs");
    const heading = document.querySelector(".cz-shell h1, .cz-shell h2");
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { left: +b.left.toFixed(1), right: +b.right.toFixed(1), width: +b.width.toFixed(1) };
    };
    return {
      viewport: window.innerWidth,
      shell: r(shell),
      tabs: r(tabs),
      heading: heading ? { text: heading.textContent.trim(), tag: heading.tagName, ...r(heading) } : null,
    };
  });
  await page.screenshot({ path: `.verify-shots/tabs-${label}-${tag}.png` });
  return { label, ...seen };
}

const rows = [];
rows.push(await read("shelf"));
await page.getByRole("tab", { name: /Hauls/ }).click({ force: true });
rows.push(await read("hauls"));

const problems = [];
for (const r of rows) {
  if (!r.shell) problems.push(`${r.label}: no shell found`);
  else if (r.shell.width < r.viewport - 1) {
    problems.push(`${r.label}: the page column is ${r.shell.width}px inside a ${r.viewport}px screen`);
  }
}
if (rows[0].tabs && rows[1].tabs && Math.abs(rows[0].tabs.left - rows[1].tabs.left) > 0.5) {
  problems.push("the two tabs start their content at different left edges");
}
console.log(JSON.stringify({ tag, rows, problems }, null, 1));
console.log(problems.length ? "FAIL" : "PASS — both tabs fill the screen and start at the same left edge");
await browser.close();

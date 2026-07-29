// Kyle 2026-07-29: "no consistency of title... make it the same", then
// "match shelf". On Shelf the item name reads ON the picture; on Hauls the
// haul name sat in a box UNDER the picture. The label now rides on the
// picture, over the same scrim the shelf card uses.
//
// The fan needs room to rotate, so the label is inset to the CARD edge, not
// the container edge. That is exactly the thing an eye gets wrong, so this
// probe measures both boxes in a real browser instead.
//
//   (npx vite --port 5371 --strictPort &) ; sleep 8; node scripts/probe-haul-title.mjs
import { webkit } from "playwright";
import { readFileSync } from "fs";

const baseUrl = process.argv[2] || "http://localhost:5371";
const tag = process.argv[3] || "after";
const dataUrl = readFileSync(new URL("./probe-photo.txt", import.meta.url), "utf8").trim();
const now = Date.now();

// The fan only opens when the haul has SEVERAL DISTINCT covers, so the four
// items cannot share one photo — an earlier run of this probe silently
// measured two single cards and proved nothing about the fanned path.
function swatch(hex) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">' +
    '<rect width="800" height="1000" fill="' + hex + '"/></svg>';
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}
const FAN_COVERS = ["#2f4858", "#33658a", "#86bbd8", "#758e4f"].map(swatch);

// Two hauls: one with a single item (flat card, 10%/6% insets) and one with
// four (fanned stack, 12%/8% insets). Both paths must read.
function item(id, project, i) {
  return {
    id,
    createdAt: now - i * 1000,
    updatedAt: now - i * 1000,
    url: "https://weidian.com/item.html?itemID=" + (7812124117 + i),
    title: "Sherpa Pullover " + i,
    image: dataUrl,
    gallery: [dataUrl],
    links: [{ url: "https://weidian.com/item.html?itemID=" + (7812124117 + i), role: "buy" }],
    price: 229,
    currency: "CNY",
    seller: "mook-offcical",
    category: "other",
    size: "L",
    findStatus: "want",
    project,
  };
}

const items = [
  item("h-solo", "Winter one-off", 0),
  ...[1, 2, 3, 4].map((i) => {
    const it = item("h-fan-" + i, "Summer Europe", i);
    it.image = FAN_COVERS[i - 1];
    it.gallery = [FAN_COVERS[i - 1]];
    return it;
  }),
];

const basePrefs = {
  viewMode: "grid",
  sortMode: "recent",
  colorwayVersion: 4,
  preferredAgent: null,
  affiliateCodes: {},
  measureUnits: "in",
  onboardingDone: true,
};

const browser = await webkit.launch();
const results = [];

for (const [theme, width] of [["rainbow", 1280], ["light", 1280], ["rainbow", 402]]) {
  const label = theme + "-" + width;
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    {
      shelf: JSON.stringify(items),
      prefsJson: JSON.stringify({ ...basePrefs, theme }),
    }
  );
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);

  // Open the Hauls tab.
  const tab = page.locator('button:has-text("Hauls")').first();
  await tab.click();
  await page.waitForTimeout(1200);

  // The front card is flat now, so the stack leans further right than it did.
  // Prove that no card pushes the page sideways.
  const overflow = await page.evaluate(() => {
    const shell = document.querySelector(".cz-shell");
    const rights = [...document.querySelectorAll(".cz-haul-fan-card")].map(
      (el) => el.getBoundingClientRect().right
    );
    return {
      sideways: shell.scrollWidth - shell.clientWidth,
      worstRight: +Math.max(...rights).toFixed(1),
      viewport: window.innerWidth,
    };
  });

  const seen = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".cz-haul-card:not(.cz-haul-card--ghost)")];
    if (!cards.length) return { error: "no haul cards on the page" };
    return cards.map((card) => {
      const name = card.querySelector(".cz-haul-card-name");
      const labelEl = card.querySelector(".cz-haul-card-label");
      const fan = card.querySelector(".cz-haul-fan");
      // The topmost fan card is the picture the words must sit on.
      const fanCards = [...card.querySelectorAll(".cz-haul-fan-card")];
      const pic = fanCards.length
        ? fanCards.reduce((best, el) =>
            +getComputedStyle(el).zIndex > +getComputedStyle(best).zIndex ? el : best
          )
        : null;
      const l = labelEl.getBoundingClientRect();
      const p = pic ? pic.getBoundingClientRect() : null;
      const cs = getComputedStyle(labelEl);
      const scrim = getComputedStyle(labelEl, "::before");
      return {
        name: name.textContent,
        single: fan.classList.contains("is-single"),
        // The label must be a CHILD of the front card, so the card clips it.
        insideFrontCard: !!(pic && pic.contains(labelEl)),
        color: cs.color,
        position: cs.position,
        scrimImage: scrim.backgroundImage.slice(0, 24),
        scrimHeight: scrim.height,
        // Positive = the label edge is INSIDE the picture edge.
        insetLeft: p ? +(l.left - p.left).toFixed(2) : null,
        insetRight: p ? +(p.right - l.right).toFixed(2) : null,
        insetBottom: p ? +(p.bottom - l.bottom).toFixed(2) : null,
        // The old defect: the label sat below the picture entirely.
        belowPicture: p ? l.top >= p.bottom : null,
      };
    });
  });

  await page.locator(".cz-hauls-grid").screenshot({
    path: `.verify-shots/haul-title-${label}-${tag}.png`,
  });

  // Hover opens the fan on desktop. The words must stay put and stay readable
  // while the stack rotates out from under them.
  if (width >= 768) {
    await page.locator(".cz-haul-card:not(.cz-haul-card--ghost)").nth(1).hover();
    await page.waitForTimeout(900);
    await page.locator(".cz-hauls-grid").screenshot({
      path: `.verify-shots/haul-title-${label}-${tag}-hover.png`,
    });
  }
  results.push({ label, theme, width, overflow, cards: seen });
  await context.close();
}

const problems = [];
for (const r of results) {
  if (r.cards.error) {
    problems.push(`${r.label}: ${r.cards.error}`);
    continue;
  }
  if (r.overflow.sideways > 0) {
    problems.push(`${r.label}: the hauls page scrolls sideways by ${r.overflow.sideways}px`);
  }
  if (r.overflow.worstRight > r.overflow.viewport) {
    problems.push(`${r.label}: a stack card reaches ${r.overflow.worstRight}px, past the ${r.overflow.viewport}px screen`);
  }
  // Guard against the probe quietly measuring two flat cards.
  if (!r.cards.some((c) => c.single === false)) {
    problems.push(`${r.label}: no fanned haul card was measured — the covers are not distinct`);
  }
  for (const c of r.cards) {
    if (c.belowPicture) problems.push(`${r.label} / ${c.name}: the words still sit under the picture`);
    if (!c.insideFrontCard) problems.push(`${r.label} / ${c.name}: the words are not inside the front card, so the scrim can bleed`);
    if (c.insetLeft < 0) problems.push(`${r.label} / ${c.name}: the words hang ${-c.insetLeft}px off the left edge`);
    if (c.insetRight < 0) problems.push(`${r.label} / ${c.name}: the words hang ${-c.insetRight}px off the right edge`);
    if (c.insetBottom < 0) problems.push(`${r.label} / ${c.name}: the words hang ${-c.insetBottom}px below the picture`);
    if (!c.scrimImage.includes("gradient")) problems.push(`${r.label} / ${c.name}: no scrim behind the words`);
    if (c.color !== "rgb(255, 255, 255)") problems.push(`${r.label} / ${c.name}: the name is ${c.color}, not white`);
  }
}
console.log(JSON.stringify({ tag, results, problems }, null, 1));
console.log(problems.length ? "FAIL" : "PASS — the haul name reads on the picture in both themes and at both widths");
await browser.close();

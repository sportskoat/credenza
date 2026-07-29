// Kyle 2026-07-29: "profile circle on top right is not centered". On his
// phone the white initials pill sits hard against the RIGHT edge of the ring,
// with a gap on the left. This probe measures both boxes in a real browser
// and prints the offset, so nobody has to judge it by eye.
//
// The initials only render for a signed-in account, so the probe puts the
// same markup the app renders into the same button. The CSS under test is
// unchanged by that.
//
//   (npx vite --port 5364 --strictPort &) ; sleep 8; node scripts/probe-avatar-centre.mjs
import { webkit } from "playwright";
import { readFileSync } from "fs";

const baseUrl = process.argv[2] || "http://localhost:5364";
const tag = process.argv[3] || "after";
const dataUrl = readFileSync(new URL("./probe-photo.txt", import.meta.url), "utf8").trim();
const now = Date.now();

// The compact phone masthead — the one Kyle photographed — only appears with
// a shelf behind it (credenza-fashion.jsx:8120), and it is the compact
// masthead that shrinks the ring to 36px. An empty shelf hides the defect.
const items = [
  {
    id: "avatar-check",
    createdAt: now,
    updatedAt: now,
    url: "https://weidian.com/item.html?itemID=7812124117",
    title: "Mutimer Dinner Jacket",
    image: dataUrl,
    gallery: [dataUrl],
    links: [{ url: "https://weidian.com/item.html?itemID=7812124117", role: "buy" }],
    price: 249,
    currency: "CNY",
    seller: "mook-offcical",
    category: "other",
    size: "S",
    findStatus: "bought",
  },
];

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
const results = [];

for (const [label, width] of [["phone", 399], ["desktop", 1280]]) {
  const context = await browser.newContext({
    viewport: { width, height: 874 },
    deviceScaleFactor: 3,
    isMobile: width < 768,
    hasTouch: width < 768,
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
  await page.waitForTimeout(3000);

  const seen = await page.evaluate(() => {
    const btn = document.querySelector(".cz-avatar");
    if (!btn) return { error: "no avatar button" };
    btn.innerHTML = "";
    const span = document.createElement("span");
    span.className = "cz-avatar-initials";
    span.setAttribute("aria-hidden", "true");
    span.textContent = "W";
    btn.appendChild(span);
    const b = btn.getBoundingClientRect();
    const s = span.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    return {
      button: { w: +b.width.toFixed(2), h: +b.height.toFixed(2) },
      pill: { w: +s.width.toFixed(2), h: +s.height.toFixed(2) },
      gapLeft: +(s.left - b.left).toFixed(2),
      gapRight: +(b.right - s.right).toFixed(2),
      gapTop: +(s.top - b.top).toFixed(2),
      gapBottom: +(b.bottom - s.bottom).toFixed(2),
      display: cs.display,
      justifyItems: cs.justifyItems,
      alignItems: cs.alignItems,
      padding: cs.padding,
      boxSizing: cs.boxSizing,
      borderWidth: cs.borderTopWidth,
    };
  });
  seen.offsetX = +((seen.gapLeft - seen.gapRight) / 2).toFixed(2);
  seen.offsetY = +((seen.gapTop - seen.gapBottom) / 2).toFixed(2);
  await page.locator(".cz-avatar").screenshot({ path: `.verify-shots/avatar-${label}-${tag}.png` });
  results.push({ label, width, ...seen });
  await context.close();
}

const problems = [];
for (const r of results) {
  if (Math.abs(r.offsetX) > 0.5) problems.push(`${r.label}: the pill sits ${r.offsetX}px off centre sideways`);
  if (Math.abs(r.offsetY) > 0.5) problems.push(`${r.label}: the pill sits ${r.offsetY}px off centre up-down`);
}
console.log(JSON.stringify({ tag, results, problems }, null, 1));
console.log(problems.length ? "FAIL" : "PASS — the initials pill is centred in the ring at both widths");
await browser.close();

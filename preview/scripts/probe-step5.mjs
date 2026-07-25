// Step 5/6 probe: the mobile detail sheet on a real engine, both themes.
//
// jsdom measures nothing, so the handoff floors (44px touch targets, 16px
// inputs, nothing under 10px) are only checkable here. This probe also
// recomputes the contrast of every new step-6 token pair.
import { webkit, devices } from "playwright";

const ITEM = {
  id: "probe-1",
  title: "Palace x Nike jersey",
  url: "https://weidian.com/item.html?itemID=7649592219",
  seller: "Mook-official",
  price: 229,
  currency: "CNY",
  batch: "M32126-109E",
  size: "XL",
  posterSize: "S",
  recommendedSize: "XL",
  colorway: "Bone white",
  weightGrams: 420,
  findStatus: "bought",
  variants: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
  sizeNotes: "Chest 56cm, Length 74cm. Runs small.",
  notes: "Seen on the Reddit haul thread. Ask for extra QC pics.",
  createdAt: 1750000000000,
};

// WCAG relative luminance, sRGB.
const lum = (r, g, b) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(...a), lum(...b)].sort((x, y) => y - x);
  return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2);
};

// Every token pair step 6 introduces, with the WCAG minimum it must clear.
const PAIRS = [
  ["bought text on bought bg", "--cz-status-bought-text", "--cz-status-bought-bg", 4.5],
  ["shipped text on shipped bg", "--cz-status-shipped-text", "--cz-status-shipped-bg", 4.5],
  ["qc text on qc bg", "--cz-status-qc-text", "--cz-status-qc-bg", 4.5],
  ["money on money-bg", "--cz-money", "--cz-money-bg", 4.5],
  ["money-on-photo on action-fill", "--cz-money-on-photo", "--cz-action-fill", 4.5],
  ["ink on card", "--cz-ink", "--cz-card-solid", 4.5],
  ["faint on card (icon floor)", "--cz-faint", "--cz-card-solid", 3],
];

const browser = await webkit.launch();
let fails = 0;

for (const theme of ["light", "rainbow"]) {
  const ctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
  await ctx.addInitScript(
    ([t, item]) => {
      window.localStorage.setItem("credenza-fashion-items-v1", JSON.stringify([item]));
      window.localStorage.setItem(
        "credenza-prefs-v1",
        JSON.stringify({ theme: t, colorwayVersion: 4, viewMode: "grid", sortMode: "recent" }),
      );
    },
    [theme, ITEM],
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    console.log("PAGE ERROR:", e.message);
    fails++;
  });
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  console.log("\n=== theme:", theme, "===");
  const intro = page.getByRole("button", { name: "Get started" });
  if (await intro.count()) await intro.first().click({ force: true });
  await page.waitForTimeout(400);

  // The shelf itself: cards, masthead, Stash dock.
  await page.screenshot({ path: `/tmp/step5-shelf-${theme}.png` });

  // The ⋯ Settings sheet (phone owns look-and-fit rows after the split).
  await page.getByRole("button", { name: "Settings" }).click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/step5-settings-${theme}.png` });
  await page.getByRole("button", { name: "Close Settings" }).click({ force: true });
  await page.waitForTimeout(400);

  // The Stash sheet from the dock.
  await page.getByRole("button", { name: "Stash to shelf" }).click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/step5-stash-${theme}.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // A card tap opens the sheet, not the carousel overlay.
  await page.getByRole("button", { name: /^Open Palace x Nike jersey$/ }).first().click({ force: true });
  await page.waitForTimeout(900);

  const shape = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [+r.width.toFixed(1), +r.height.toFixed(1)];
    };
    const cs = (el, p) => (el ? getComputedStyle(el)[p] : null);
    const surface = document.querySelector(".cz-detail-surface");
    return {
      opened: !!surface,
      carouselOverlay: !!document.querySelector(".cz-carousel-overlay"),
      surfaceBox: box(surface),
      surfaceBg: cs(surface, "backgroundColor"),
      surfaceRadius: cs(surface, "borderTopLeftRadius"),
      heroBox: box(document.querySelector(".cz-detail-hero")),
      cells: [...document.querySelectorAll(".cz-detail-cell")].map((c) => ({
        label: c.querySelector(".cz-detail-cell-label").textContent.trim(),
        h: +c.getBoundingClientRect().height.toFixed(1),
        labelPx: parseFloat(getComputedStyle(c.querySelector(".cz-detail-cell-label")).fontSize),
        valuePx: parseFloat(getComputedStyle(c.querySelector(".cz-detail-cell-value")).fontSize),
      })),
      statusChips: [...document.querySelectorAll(".cz-detail-status-chip")].map((c) => ({
        t: c.textContent.trim(),
        h: +c.getBoundingClientRect().height.toFixed(1),
        checked: c.getAttribute("aria-checked"),
      })),
      heroBtns: [...document.querySelectorAll(".cz-detail-hero-btn")].map((b) => {
        const r = b.getBoundingClientRect();
        const a = getComputedStyle(b, "::after");
        return { visual: +r.height.toFixed(1), hit: parseFloat(a.height) };
      }),
      buyBox: box(document.querySelector(".cz-detail-buy")),
      // No Save button anywhere: the sheet has no edit mode.
      saveButtons: [...document.querySelectorAll("button")]
        .map((b) => b.textContent.trim())
        .filter((t) => /^(Save|Edit|Done editing)$/.test(t)),
      // Nothing under 10px anywhere in the sheet.
      tooSmall: [...document.querySelectorAll(".cz-detail-surface *")]
        .filter((el) => el.childElementCount === 0 && el.textContent.trim())
        .map((el) => ({ t: el.textContent.trim().slice(0, 22), px: parseFloat(getComputedStyle(el).fontSize) }))
        .filter((x) => x.px < 10),
    };
  });
  console.log("sheet", JSON.stringify(shape, null, 2));
  if (!shape.opened || shape.carouselOverlay || shape.saveButtons.length || shape.tooSmall.length) fails++;
  for (const c of shape.cells) if (c.h < 44) { console.log("FAIL cell <44px:", c.label, c.h); fails++; }
  for (const c of shape.statusChips) if (c.h < 44) { console.log("FAIL chip <44px:", c.t, c.h); fails++; }
  for (const b of shape.heroBtns) if (b.hit < 44) { console.log("FAIL hero hit <44px:", b.hit); fails++; }
  await page.screenshot({ path: `/tmp/step5-sheet-${theme}.png` });

  // The Size · fit cell opens the fit block, never a bare text input.
  await page.getByRole("button", { name: /^Size · fit/ }).first().click({ force: true });
  await page.waitForTimeout(500);
  const fit = await page.evaluate(() => {
    const el = document.querySelector(".cz-detail-fit");
    if (!el) return { fit: false };
    return {
      fit: true,
      kicker: (document.querySelector(".cz-detail-fit-kicker") || {}).textContent,
      badge: (document.querySelector(".cz-detail-fit-badge") || {}).textContent,
      size: (document.querySelector(".cz-detail-fit-size") || {}).textContent,
      sizePx: (() => {
        const n = document.querySelector(".cz-detail-fit-size");
        return n ? parseFloat(getComputedStyle(n).fontSize) : null;
      })(),
      why: (document.querySelector(".cz-detail-fit-why") || {}).textContent,
      chips: [...document.querySelectorAll(".cz-detail-fit-chip")].map((c) => ({
        t: c.textContent.trim(),
        h: +c.getBoundingClientRect().height.toFixed(1),
      })),
    };
  });
  console.log("fit", JSON.stringify(fit, null, 2));
  if (!fit.fit) fails++;
  for (const c of fit.chips || []) if (c.h < 44) { console.log("FAIL fit chip <44px:", c.t, c.h); fails++; }
  await page.screenshot({ path: `/tmp/step5-fit-${theme}.png` });

  // A text cell opens a 16px input. Below 16px iOS zooms the page on focus.
  await page.getByRole("button", { name: /^Colorway/ }).first().click({ force: true });
  await page.waitForTimeout(400);
  const editor = await page.evaluate(() => {
    const i = document.querySelector(".cz-detail-editor-input");
    const d = document.querySelector(".cz-detail-editor-done");
    return {
      editors: document.querySelectorAll(".cz-detail-editor, .cz-detail-fit").length,
      inputPx: i ? parseFloat(getComputedStyle(i).fontSize) : null,
      inputH: i ? +i.getBoundingClientRect().height.toFixed(1) : null,
      focused: document.activeElement ? document.activeElement.className : null,
      doneH: d ? +d.getBoundingClientRect().height.toFixed(1) : null,
    };
  });
  console.log("editor", JSON.stringify(editor));
  if (editor.editors !== 1 || editor.inputPx < 16 || editor.doneH < 44) { console.log("FAIL editor"); fails++; }

  // Step 6: recompute every new token pair against WCAG on this theme.
  // Step 6: recompute every new token pair against WCAG on this theme.
  //
  // Two traps make a naive getComputedStyle read useless here:
  //   1. WebKit returns oklch() verbatim, so a /[\d.]+/ match reads the L, C
  //      and H channels as if they were R, G and B.
  //   2. --cz-money-bg carries alpha, so it must composite over its surface.
  // A canvas solves both: paint the backdrop, paint the color over it, then
  // read the one pixel the eye actually gets.
  const pairPixels = await page.evaluate((pairs) => {
    const cs = getComputedStyle(document.querySelector(".cz-app"));
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d", { willReadFrequently: true });
    const val = (n) => cs.getPropertyValue(n).trim();
    const paint = (color, under) => {
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = under;
      g.fillRect(0, 0, 1, 1);
      g.fillStyle = color;
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const base = val("--cz-card-solid") || val("--cz-bg") || "#ffffff";
    return pairs.map(([name, fg, bg]) => {
      // The background composites over the card first, then the text over that.
      const bgPx = paint(val(bg), base);
      const bgCss = `rgb(${bgPx.join(",")})`;
      return { name, fg: paint(val(fg), bgCss), bg: bgPx, missing: !val(fg) || !val(bg) };
    });
  }, PAIRS.map(([n, f, b]) => [n, f, b]));

  console.log("contrast");
  for (let i = 0; i < PAIRS.length; i++) {
    const min = PAIRS[i][3];
    const m = pairPixels[i];
    if (m.missing) {
      console.log("  MISSING", m.name);
      fails++;
      continue;
    }
    const r = ratio(m.fg, m.bg);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(`  ${ok ? "PASS" : "FAIL"} ${m.name}: ${r}:1 (min ${min})`);
  }

  await ctx.close();
}

await browser.close();
console.log(fails ? `\nPROBE FAILED: ${fails} problem(s)` : "\nPROBE PASSED");
process.exit(fails ? 1 : 0);
